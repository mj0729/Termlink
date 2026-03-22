use crate::ssh_auth::{self, Client, PortForwardRequest, SshAuthRequest};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use russh::{client, Channel, ChannelMsg, Disconnect};
use russh_sftp::client::SftpSession;
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};
use tauri::{Emitter, Manager, Window};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;

const TERMINAL_BUFFER_LIMIT_BYTES: usize = 256 * 1024;
const TERMLINK_CWD_PROMPT_COMMAND: &str = r#"printf '\x1fTERMLINK_CWD:%s\x1f' "$PWD""#;

#[derive(Debug, Clone)]
pub enum ConnectionState {
    Connecting,
    Connected,
    Disconnecting,
    Disconnected,
    Error,
}

enum ConnectionCmd {
    WriteTerminal {
        data: String,
    },
    ResizeTerminal {
        cols: u16,
        rows: u16,
    },
    GetTerminalSnapshot {
        from_seq: u64,
        reply: oneshot::Sender<Result<TerminalSnapshot, String>>,
    },
    OpenSftp {
        reply: oneshot::Sender<Result<Arc<SftpSession>, String>>,
    },
    ExecuteCommand {
        command: String,
        reply: oneshot::Sender<Result<String, String>>,
    },
    ExecFinished,
    Disconnect {
        reply: oneshot::Sender<Result<(), String>>,
    },
}

struct ConnectionManager {
    connection_id: String,
    session: Arc<client::Handle<Client>>,
    jump_session: Option<Arc<client::Handle<Client>>>,
    state: ConnectionState,
    terminal_channel: Option<Channel<client::Msg>>,
    sftp_session: Option<Arc<SftpSession>>,
    terminal_active: bool,
    terminal_output_seq: u64,
    terminal_buffer: VecDeque<TerminalChunk>,
    terminal_buffer_bytes: usize,
    exec_count: usize,
    cmd_rx: mpsc::UnboundedReceiver<ConnectionCmd>,
    cmd_tx: mpsc::UnboundedSender<ConnectionCmd>,
    window: Window,
    port_forward_tasks: Vec<JoinHandle<()>>,
    pending_port_forwards: Vec<PortForwardRequest>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalChunk {
    pub seq: u64,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalSnapshot {
    pub chunks: Vec<TerminalChunk>,
    pub latest_seq: u64,
}

enum LoopEvent {
    Command(ConnectionCmd),
    Terminal(ChannelMsg),
    TerminalClosed,
    CommandChannelClosed,
}

static CONNECTION_MANAGERS: Lazy<RwLock<HashMap<String, mpsc::UnboundedSender<ConnectionCmd>>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

pub async fn start_connection(
    window: Window,
    auth: SshAuthRequest,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let connection_id = auth.connection_id.clone();

    {
        let managers = CONNECTION_MANAGERS.read();
        if managers.contains_key(&connection_id) {
            return Err(format!("SSH连接已存在: {}", connection_id));
        }
    }

    let authenticated =
        ssh_auth::connect_authenticated_session(&window.app_handle(), &auth).await?;
    let channel = open_terminal_channel(&authenticated.session, cols, rows).await?;
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();

    CONNECTION_MANAGERS
        .write()
        .insert(connection_id.clone(), cmd_tx.clone());

    let manager = ConnectionManager {
        connection_id,
        session: Arc::new(authenticated.session),
        state: ConnectionState::Connecting,
        terminal_channel: Some(channel),
        sftp_session: None,
        terminal_active: true,
        terminal_output_seq: 0,
        terminal_buffer: VecDeque::new(),
        terminal_buffer_bytes: 0,
        exec_count: 0,
        cmd_rx,
        cmd_tx,
        window,
        jump_session: authenticated.jump_session.map(Arc::new),
        port_forward_tasks: Vec::new(),
        pending_port_forwards: auth.port_forwards.clone(),
    };

    tokio::spawn(async move {
        manager.run().await;
    });

    Ok(())
}

pub fn write_terminal(connection_id: String, data: String) -> Result<(), String> {
    manager_sender(&connection_id)?
        .send(ConnectionCmd::WriteTerminal { data })
        .map_err(|e| format!("发送终端写入命令失败: {}", e))
}

pub fn resize_terminal(connection_id: String, cols: u16, rows: u16) -> Result<(), String> {
    manager_sender(&connection_id)?
        .send(ConnectionCmd::ResizeTerminal { cols, rows })
        .map_err(|e| format!("发送终端缩放命令失败: {}", e))
}

pub async fn read_terminal_snapshot(
    connection_id: String,
    from_seq: u64,
) -> Result<TerminalSnapshot, String> {
    let (reply_tx, reply_rx) = oneshot::channel();
    manager_sender(&connection_id)?
        .send(ConnectionCmd::GetTerminalSnapshot {
            from_seq,
            reply: reply_tx,
        })
        .map_err(|e| format!("发送终端快照请求失败: {}", e))?;
    reply_rx
        .await
        .map_err(|_| "等待终端快照结果失败".to_string())?
}

pub async fn open_sftp(connection_id: String) -> Result<Arc<SftpSession>, String> {
    let (reply_tx, reply_rx) = oneshot::channel();
    manager_sender(&connection_id)?
        .send(ConnectionCmd::OpenSftp { reply: reply_tx })
        .map_err(|e| format!("发送 SFTP 打开命令失败: {}", e))?;
    reply_rx
        .await
        .map_err(|_| "等待 SFTP 打开结果失败".to_string())?
}

pub async fn execute_command(connection_id: String, command: String) -> Result<String, String> {
    let (reply_tx, reply_rx) = oneshot::channel();
    manager_sender(&connection_id)?
        .send(ConnectionCmd::ExecuteCommand {
            command,
            reply: reply_tx,
        })
        .map_err(|e| format!("发送命令执行请求失败: {}", e))?;
    reply_rx
        .await
        .map_err(|_| "等待命令执行结果失败".to_string())?
}

pub async fn disconnect_connection(connection_id: String) -> Result<(), String> {
    match manager_sender(&connection_id) {
        Ok(sender) => {
            let (reply_tx, reply_rx) = oneshot::channel();
            sender
                .send(ConnectionCmd::Disconnect { reply: reply_tx })
                .map_err(|e| format!("发送断开命令失败: {}", e))?;
            reply_rx.await.map_err(|_| "等待断开结果失败".to_string())?
        }
        Err(_) => Ok(()),
    }
}

fn manager_sender(connection_id: &str) -> Result<mpsc::UnboundedSender<ConnectionCmd>, String> {
    CONNECTION_MANAGERS
        .read()
        .get(connection_id)
        .cloned()
        .ok_or_else(|| format!("SSH连接不存在: {}", connection_id))
}

async fn open_terminal_channel(
    session: &client::Handle<Client>,
    cols: u16,
    rows: u16,
) -> Result<Channel<client::Msg>, String> {
    let channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("创建终端通道失败: {}", e))?;

    channel
        .request_pty(true, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
        .await
        .map_err(|e| format!("请求 PTY 失败: {}", e))?;

    let _ = channel
        .set_env(false, "PROMPT_COMMAND", TERMLINK_CWD_PROMPT_COMMAND)
        .await;

    channel
        .request_shell(true)
        .await
        .map_err(|e| format!("启动 shell 失败: {}", e))?;

    Ok(channel)
}

impl ConnectionManager {
    async fn run(mut self) {
        self.state = ConnectionState::Connected;
        self.start_port_forwards().await;

        loop {
            let event = if let Some(channel) = self.terminal_channel.as_mut() {
                let cmd_rx = &mut self.cmd_rx;
                tokio::select! {
                    Some(cmd) = cmd_rx.recv() => LoopEvent::Command(cmd),
                    msg = channel.wait() => match msg {
                        Some(msg) => LoopEvent::Terminal(msg),
                        None => LoopEvent::TerminalClosed,
                    }
                }
            } else {
                match self.cmd_rx.recv().await {
                    Some(cmd) => LoopEvent::Command(cmd),
                    None => LoopEvent::CommandChannelClosed,
                }
            };

            let should_break = match event {
                LoopEvent::Command(cmd) => self.handle_command(cmd).await,
                LoopEvent::Terminal(msg) => self.handle_terminal_message(msg).await,
                LoopEvent::TerminalClosed => {
                    self.terminal_channel = None;
                    self.terminal_active = false;
                    false
                }
                LoopEvent::CommandChannelClosed => true,
            };

            if should_break {
                break;
            }

            if self.should_auto_disconnect() {
                let _ = self.handle_disconnect().await;
                break;
            }
        }

        self.cleanup().await;
    }

    async fn handle_command(&mut self, cmd: ConnectionCmd) -> bool {
        match cmd {
            ConnectionCmd::WriteTerminal { data } => {
                if let Some(channel) = self.terminal_channel.as_mut() {
                    if let Err(err) = channel.data(data.as_bytes()).await {
                        self.state = ConnectionState::Error;
                        let _ = self
                            .window
                            .emit("ssh_error", format!("{}: {}", self.connection_id, err));
                        return true;
                    }
                }
            }
            ConnectionCmd::ResizeTerminal { cols, rows } => {
                if let Some(channel) = self.terminal_channel.as_mut() {
                    if let Err(err) = channel.window_change(cols as u32, rows as u32, 0, 0).await {
                        let _ = self
                            .window
                            .emit("ssh_error", format!("{}: {}", self.connection_id, err));
                    }
                }
            }
            ConnectionCmd::GetTerminalSnapshot { from_seq, reply } => {
                let _ = reply.send(Ok(self.build_terminal_snapshot(from_seq)));
            }
            ConnectionCmd::OpenSftp { reply } => {
                let result = self.handle_open_sftp().await;
                let _ = reply.send(result);
            }
            ConnectionCmd::ExecuteCommand { command, reply } => {
                self.exec_count += 1;
                let session = self.session.clone();
                let cmd_tx = self.cmd_tx.clone();
                tokio::spawn(async move {
                    let result = execute_session_command(session, command).await;
                    let _ = reply.send(result);
                    let _ = cmd_tx.send(ConnectionCmd::ExecFinished);
                });
            }
            ConnectionCmd::ExecFinished => {
                self.exec_count = self.exec_count.saturating_sub(1);
            }
            ConnectionCmd::Disconnect { reply } => {
                let result = self.handle_disconnect().await;
                let _ = reply.send(result);
                return true;
            }
        }

        false
    }

    async fn handle_terminal_message(&mut self, msg: ChannelMsg) -> bool {
        match msg {
            ChannelMsg::Data { data } => {
                let output = String::from_utf8_lossy(&data).into_owned();
                let chunk = self.make_terminal_chunk(output);
                let _ = self
                    .window
                    .emit(&format!("ssh_data://{}", self.connection_id), &chunk);
                self.store_terminal_chunk(chunk);
            }
            ChannelMsg::Eof | ChannelMsg::Close | ChannelMsg::ExitStatus { .. } => {
                self.terminal_channel = None;
                self.terminal_active = false;
            }
            _ => {}
        }

        false
    }

    async fn handle_open_sftp(&mut self) -> Result<Arc<SftpSession>, String> {
        if let Some(session) = &self.sftp_session {
            return Ok(session.clone());
        }

        let channel = self
            .session
            .channel_open_session()
            .await
            .map_err(|e| format!("创建 SFTP 通道失败: {}", e))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("请求 SFTP 子系统失败: {}", e))?;

        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("创建 SFTP 会话失败: {}", e))?;

        let session = Arc::new(sftp);
        self.sftp_session = Some(session.clone());

        Ok(session)
    }

    async fn handle_close_terminal(&mut self) -> Result<(), String> {
        if let Some(channel) = self.terminal_channel.take() {
            let _ = channel.eof().await;
            let _ = channel.close().await;
        }
        self.terminal_active = false;
        Ok(())
    }

    async fn handle_close_sftp(&mut self) -> Result<(), String> {
        self.sftp_session = None;
        Ok(())
    }

    async fn handle_disconnect(&mut self) -> Result<(), String> {
        if matches!(self.state, ConnectionState::Disconnected) {
            return Ok(());
        }

        self.state = ConnectionState::Disconnecting;
        self.stop_port_forwards();
        let _ = self.handle_close_terminal().await;
        let _ = self.handle_close_sftp().await;

        if let Err(err) = self
            .session
            .disconnect(Disconnect::ByApplication, "", "")
            .await
        {
            self.state = ConnectionState::Error;
            return Err(format!("断开 SSH transport 失败: {}", err));
        }

        if let Some(jump_session) = &self.jump_session {
            let _ = jump_session
                .disconnect(Disconnect::ByApplication, "", "")
                .await;
        }

        self.state = ConnectionState::Disconnected;
        Ok(())
    }

    fn make_terminal_chunk(&mut self, output: String) -> TerminalChunk {
        self.terminal_output_seq += 1;
        TerminalChunk {
            seq: self.terminal_output_seq,
            data: output,
        }
    }

    fn store_terminal_chunk(&mut self, chunk: TerminalChunk) {
        self.terminal_buffer_bytes += chunk.data.len();
        self.terminal_buffer.push_back(chunk);

        while self.terminal_buffer_bytes > TERMINAL_BUFFER_LIMIT_BYTES {
            if let Some(removed) = self.terminal_buffer.pop_front() {
                self.terminal_buffer_bytes = self
                    .terminal_buffer_bytes
                    .saturating_sub(removed.data.len());
            } else {
                break;
            }
        }
    }

    fn build_terminal_snapshot(&self, from_seq: u64) -> TerminalSnapshot {
        TerminalSnapshot {
            chunks: self
                .terminal_buffer
                .iter()
                .filter(|chunk| chunk.seq > from_seq)
                .cloned()
                .collect(),
            latest_seq: self.terminal_output_seq,
        }
    }

    fn should_auto_disconnect(&self) -> bool {
        !self.terminal_active && self.exec_count == 0
    }

    async fn cleanup(&mut self) {
        self.stop_port_forwards();
        CONNECTION_MANAGERS.write().remove(&self.connection_id);
        let _ = self
            .window
            .emit(&format!("ssh_exit://{}", self.connection_id), "");
    }

    async fn start_port_forwards(&mut self) {
        for forward in self.pending_port_forwards.clone() {
            if forward.r#type != "local" {
                continue;
            }

            match TcpListener::bind(("127.0.0.1", forward.local_port)).await {
                Ok(listener) => {
                    let session = self.session.clone();
                    let window = self.window.clone();
                    let connection_id = self.connection_id.clone();
                    let task = tokio::spawn(async move {
                        loop {
                            let (mut inbound, _) = match listener.accept().await {
                                Ok(socket) => socket,
                                Err(err) => {
                                    let _ = window.emit(
                                        "ssh_error",
                                        format!(
                                            "{connection_id}: 端口转发监听失败 {}: {}",
                                            forward.local_port, err
                                        ),
                                    );
                                    break;
                                }
                            };

                            let session = session.clone();
                            let window = window.clone();
                            let connection_id = connection_id.clone();
                            let forward = forward.clone();

                            tokio::spawn(async move {
                                match session
                                    .channel_open_direct_tcpip(
                                        forward.remote_host.clone(),
                                        forward.remote_port as u32,
                                        "127.0.0.1",
                                        forward.local_port as u32,
                                    )
                                    .await
                                {
                                    Ok(channel) => {
                                        let mut stream = channel.into_stream();
                                        if let Err(err) =
                                            tokio::io::copy_bidirectional(&mut inbound, &mut stream)
                                                .await
                                        {
                                            let _ = window.emit(
                                                "ssh_error",
                                                format!(
                                                    "{connection_id}: 端口转发 {} -> {}:{} 失败: {}",
                                                    forward.local_port,
                                                    forward.remote_host,
                                                    forward.remote_port,
                                                    err
                                                ),
                                            );
                                        }
                                        let _ = stream.shutdown().await;
                                    }
                                    Err(err) => {
                                        let _ = window.emit(
                                            "ssh_error",
                                            format!(
                                                "{connection_id}: 打开端口转发通道 {} -> {}:{} 失败: {}",
                                                forward.local_port,
                                                forward.remote_host,
                                                forward.remote_port,
                                                err
                                            ),
                                        );
                                    }
                                }
                            });
                        }
                    });
                    self.port_forward_tasks.push(task);
                }
                Err(err) => {
                    let _ = self.window.emit(
                        "ssh_error",
                        format!(
                            "{}: 无法绑定本地端口 {}，跳过端口转发到 {}:{} - {}",
                            self.connection_id,
                            forward.local_port,
                            forward.remote_host,
                            forward.remote_port,
                            err
                        ),
                    );
                }
            }
        }
    }

    fn stop_port_forwards(&mut self) {
        self.port_forward_tasks
            .drain(..)
            .for_each(|task| task.abort());
    }
}

async fn execute_session_command(
    session: Arc<client::Handle<Client>>,
    command: String,
) -> Result<String, String> {
    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("创建命令通道失败: {}", e))?;

    channel
        .exec(true, command.as_bytes())
        .await
        .map_err(|e| format!("执行命令失败: {}", e))?;

    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut code = None;

    while let Some(msg) = channel.wait().await {
        match msg {
            ChannelMsg::Data { data } => {
                stdout.push_str(&String::from_utf8_lossy(&data));
            }
            ChannelMsg::ExtendedData { data, .. } => {
                stderr.push_str(&String::from_utf8_lossy(&data));
            }
            ChannelMsg::ExitStatus { exit_status } => {
                code = Some(exit_status);
            }
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }

    if code == Some(0) || code.is_none() {
        Ok(stdout.trim().to_string())
    } else {
        let stderr = stderr.trim();
        let stdout = stdout.trim();
        Err(if !stderr.is_empty() {
            stderr.to_string()
        } else if !stdout.is_empty() {
            stdout.to_string()
        } else {
            format!("命令执行失败，退出码: {:?}", code)
        })
    }
}
