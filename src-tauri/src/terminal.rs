use once_cell::sync::Lazy;
use parking_lot::RwLock;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{
    collections::HashMap,
    io::Read,
    thread,
    time::{Duration, Instant},
};
use tauri::Emitter;

enum PtyMsg {
    Write(String),
    Resize { cols: u16, rows: u16 },
}

static PTY_SENDERS: Lazy<RwLock<HashMap<String, crossbeam_channel::Sender<PtyMsg>>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const PTY_OUTPUT_BATCH_WINDOW_MS: u64 = 8;
const PTY_OUTPUT_BATCH_MAX_BYTES: usize = 16 * 1024;

#[tauri::command]
pub fn start_pty(
    window: tauri::Window,
    id: String,
    cols: u16,
    rows: u16,
    program: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
) -> Result<(), String> {
    let (tx, rx) = crossbeam_channel::unbounded::<PtyMsg>();
    PTY_SENDERS.write().insert(id.clone(), tx);

    thread::spawn(move || {
        let pty_system = native_pty_system();
        let pair = match pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }) {
            Ok(p) => p,
            Err(e) => {
                let _ = window.emit("pty_error", format!("{}: {}", id, e));
                return;
            }
        };

        let mut cmd = if let Some(p) = program.clone() {
            let mut c = CommandBuilder::new(p);
            if let Some(a) = args.clone() {
                for s in a {
                    c.arg(s);
                }
            }
            c
        } else if cfg!(windows) {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/K");
            c
        } else {
            let default_shell = std::env::var("SHELL")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "/bin/bash".to_string());
            CommandBuilder::new(default_shell)
        };
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }

        let _child = match pair.slave.spawn_command(cmd) {
            Ok(c) => c,
            Err(e) => {
                let _ = window.emit("pty_error", format!("{}: {}", id, e));
                return;
            }
        };

        let mut reader = match pair.master.try_clone_reader() {
            Ok(r) => r,
            Err(e) => {
                let _ = window.emit("pty_error", format!("{}: {}", id, e));
                return;
            }
        };

        let mut writer = match pair.master.take_writer() {
            Ok(w) => w,
            Err(e) => {
                let _ = window.emit("pty_error", format!("{}: {}", id, e));
                return;
            }
        };

        let (output_tx, output_rx) = crossbeam_channel::unbounded::<Vec<u8>>();

        // Reader loop
        let reader_thread = thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if output_tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        let win_clone = window.clone();
        let id_clone = id.clone();
        let emitter_thread = thread::spawn(move || {
            emit_batched_pty_output(win_clone, id_clone, output_rx);
        });

        // Writer/resize loop
        while let Ok(msg) = rx.recv() {
            match msg {
                PtyMsg::Write(data) => {
                    // Write user input as-is; Windows shells handle CR/LF themselves
                    let _ = std::io::Write::write_all(&mut writer, data.as_bytes());
                }
                PtyMsg::Resize { cols, rows } => {
                    let _ = pair.master.resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
            }
        }

        let _ = reader_thread.join();
        let _ = emitter_thread.join();
        let _ = window.emit(&format!("pty_exit://{}", id), "");
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(id: String, data: String) -> Result<(), String> {
    let tx = PTY_SENDERS.read().get(&id).cloned();
    if let Some(tx) = tx {
        tx.send(PtyMsg::Write(data)).map_err(|e| e.to_string())
    } else {
        Err("PTY not found".into())
    }
}

#[tauri::command]
pub fn resize_pty(id: String, cols: u16, rows: u16) -> Result<(), String> {
    let tx = PTY_SENDERS.read().get(&id).cloned();
    if let Some(tx) = tx {
        tx.send(PtyMsg::Resize { cols, rows })
            .map_err(|e| e.to_string())
    } else {
        Err("PTY not found".into())
    }
}

#[tauri::command]
pub fn close_pty(id: String) -> Result<(), String> {
    PTY_SENDERS.write().remove(&id);
    Ok(())
}

fn emit_batched_pty_output(
    window: tauri::Window,
    id: String,
    rx: crossbeam_channel::Receiver<Vec<u8>>,
) {
    let event_name = format!("pty://{}", id);
    let mut pending = Vec::new();

    loop {
        let chunk = match rx.recv() {
            Ok(chunk) => chunk,
            Err(_) => {
                emit_pty_output_chunk(&window, &event_name, &pending);
                break;
            }
        };

        pending.extend_from_slice(&chunk);
        let deadline = Instant::now() + Duration::from_millis(PTY_OUTPUT_BATCH_WINDOW_MS);

        while pending.len() < PTY_OUTPUT_BATCH_MAX_BYTES {
            let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
                break;
            };

            match rx.recv_timeout(remaining) {
                Ok(next) => pending.extend_from_slice(&next),
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => break,
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    emit_pty_output_chunk(&window, &event_name, &pending);
                    return;
                }
            }
        }

        emit_pty_output_chunk(&window, &event_name, &pending);
        pending.clear();
    }
}

fn emit_pty_output_chunk(window: &tauri::Window, event_name: &str, bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }

    if let Ok(chunk) = std::str::from_utf8(bytes) {
        let _ = window.emit(event_name, chunk);
        return;
    }

    let chunk = String::from_utf8_lossy(bytes).into_owned();
    let _ = window.emit(event_name, chunk);
}
