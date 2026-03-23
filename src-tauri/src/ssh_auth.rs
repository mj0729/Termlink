use crate::host_key_store::{self, HostKeyRecord};
use once_cell::sync::Lazy;
use russh::keys::{self, HashAlg, PrivateKey, PrivateKeyWithHashAlg, PublicKey};
use russh::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::AppHandle;

/// 认证方法
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    Password,
    PrivateKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyJumpRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    #[serde(default = "default_strict_checking")]
    pub strict_host_key_checking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardRequest {
    pub id: String,
    #[serde(default)]
    pub r#type: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub label: Option<String>,
}

/// SSH 认证请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshAuthRequest {
    pub connection_id: String,
    pub profile_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    #[serde(default = "default_strict_checking")]
    pub strict_host_key_checking: bool,
    #[serde(default)]
    pub proxy_jump: Option<ProxyJumpRequest>,
    #[serde(default)]
    pub port_forwards: Vec<PortForwardRequest>,
}

fn default_strict_checking() -> bool {
    true
}

/// 主机密钥身份
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyIdentity {
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key_base64: String,
}

/// 主机密钥信任状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HostKeyTrustState {
    Trusted,
    Unknown,
    Changed,
    Revoked,
}

/// 主机密钥验证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyVerification {
    pub state: HostKeyTrustState,
    pub presented: HostKeyIdentity,
    pub stored: Option<HostKeyRecord>,
    pub requires_user_confirmation: bool,
}

/// 主机密钥决策动作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HostKeyDecisionAction {
    TrustOnce,
    TrustAndSave,
    Reject,
}

/// 主机密钥决策
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyDecision {
    pub host: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint_sha256: String,
    pub public_key_base64: String,
    pub action: HostKeyDecisionAction,
    pub profile_id: Option<String>,
}

pub struct AuthenticatedSession {
    pub session: client::Handle<Client>,
    pub jump_session: Option<client::Handle<Client>>,
}

/// SSH 客户端处理器
pub struct Client {
    app: AppHandle,
    request: SshAuthRequest,
    verification: Arc<StdMutex<Option<HostKeyVerification>>>,
}

static PENDING_HOST_KEY_VERIFICATIONS: Lazy<StdMutex<HashMap<String, HostKeyVerification>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let verification = build_host_key_verification(&self.app, &self.request, server_public_key)
            .map_err(|error| {
                russh::Error::IO(std::io::Error::new(std::io::ErrorKind::Other, error))
            })?;

        *self.verification.lock().unwrap() = Some(verification.clone());

        if self.request.strict_host_key_checking && verification.requires_user_confirmation {
            cache_pending_host_key_verification(&self.request.connection_id, verification);
            return Ok(false);
        }

        Ok(true)
    }
}

/// 用于捕获服务器公钥的客户端
struct PreviewClient {
    captured_key: Arc<StdMutex<Option<PublicKey>>>,
}

impl client::Handler for PreviewClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // 捕获服务器公钥
        *self.captured_key.lock().unwrap() = Some(server_public_key.clone());
        Ok(true)
    }
}

/// 提取主机密钥指纹
fn extract_fingerprint(public_key: &PublicKey) -> String {
    public_key.fingerprint(HashAlg::Sha256).to_string()
}

fn base64_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose, Engine as _};
    general_purpose::STANDARD.encode(data)
}

fn cache_pending_host_key_verification(connection_id: &str, verification: HostKeyVerification) {
    PENDING_HOST_KEY_VERIFICATIONS
        .lock()
        .unwrap()
        .insert(connection_id.to_string(), verification);
}

fn take_pending_host_key_verification(connection_id: &str) -> Option<HostKeyVerification> {
    PENDING_HOST_KEY_VERIFICATIONS
        .lock()
        .unwrap()
        .remove(connection_id)
}

fn clear_pending_host_key_verification(connection_id: &str) {
    PENDING_HOST_KEY_VERIFICATIONS
        .lock()
        .unwrap()
        .remove(connection_id);
}

fn build_host_key_verification(
    app: &AppHandle,
    request: &SshAuthRequest,
    server_key: &PublicKey,
) -> Result<HostKeyVerification, String> {
    let algorithm = server_key.algorithm().to_string();
    let fingerprint = extract_fingerprint(server_key);
    let public_key_base64 = base64_encode(
        &server_key
            .to_bytes()
            .map_err(|e| format!("序列化服务器公钥失败: {}", e))?,
    );

    let presented = HostKeyIdentity {
        host: request.host.clone(),
        port: request.port,
        algorithm: algorithm.clone(),
        fingerprint_sha256: fingerprint.clone(),
        public_key_base64,
    };

    let stored =
        host_key_store::find_host_key_record(app, &request.host, request.port, &algorithm)?;

    let (state, requires_confirmation) = match stored.as_ref() {
        Some(record) => {
            if record.fingerprint_sha256 == fingerprint {
                (HostKeyTrustState::Trusted, false)
            } else {
                (HostKeyTrustState::Changed, true)
            }
        }
        None => (HostKeyTrustState::Unknown, true),
    };

    Ok(HostKeyVerification {
        state,
        presented,
        stored,
        requires_user_confirmation: requires_confirmation,
    })
}

/// 预览主机密钥
pub async fn preview_host_key(
    app: AppHandle,
    request: SshAuthRequest,
) -> Result<HostKeyVerification, String> {
    if let Some(cached) = take_pending_host_key_verification(&request.connection_id) {
        return Ok(cached);
    }

    // 创建用于捕获公钥的容器
    let captured_key = Arc::new(StdMutex::new(None));

    // 创建临时连接以获取服务器公钥
    let config = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(10)),
        ..<_>::default()
    };

    let preview_client = PreviewClient {
        captured_key: captured_key.clone(),
    };

    let session = client::connect(
        Arc::new(config),
        (&request.host[..], request.port),
        preview_client,
    )
    .await
    .map_err(|e| format!("连接服务器失败: {}", e))?;

    // 获取捕获的服务器公钥
    let server_key = captured_key
        .lock()
        .unwrap()
        .clone()
        .ok_or("无法获取服务器公钥")?;

    // 关闭临时连接
    drop(session);

    build_host_key_verification(&app, &request, &server_key)
}

/// 保存主机密钥决策
pub fn save_host_key_decision(app: AppHandle, decision: HostKeyDecision) -> Result<(), String> {
    match decision.action {
        HostKeyDecisionAction::TrustAndSave => {
            let now = chrono::Utc::now().to_rfc3339();
            let record = HostKeyRecord {
                host: decision.host,
                port: decision.port,
                algorithm: decision.algorithm,
                fingerprint_sha256: decision.fingerprint_sha256,
                public_key_base64: decision.public_key_base64,
                first_seen_at: now.clone(),
                last_seen_at: now,
                trust_source: "user_confirmed".to_string(),
                profile_id: decision.profile_id,
            };
            host_key_store::upsert_host_key_record(&app, record)?;
        }
        HostKeyDecisionAction::TrustOnce => {
            // 仅本次信任,不保存
        }
        HostKeyDecisionAction::Reject => {
            // 拒绝连接
            return Err("用户拒绝连接".to_string());
        }
    }
    Ok(())
}

/// 建立已认证的 SSH 会话
pub async fn connect_authenticated_session(
    app: &AppHandle,
    request: &SshAuthRequest,
) -> Result<AuthenticatedSession, String> {
    clear_pending_host_key_verification(&request.connection_id);
    if let Some(proxy_jump) = request.proxy_jump.as_ref() {
        let jump_request = SshAuthRequest {
            connection_id: request.connection_id.clone(),
            profile_id: None,
            host: proxy_jump.host.clone(),
            port: proxy_jump.port,
            username: proxy_jump.username.clone(),
            password: proxy_jump.password.clone(),
            private_key_path: proxy_jump.private_key_path.clone(),
            passphrase: proxy_jump.passphrase.clone(),
            strict_host_key_checking: proxy_jump.strict_host_key_checking,
            proxy_jump: None,
            port_forwards: Vec::new(),
        };

        let jump_session = connect_authenticated_handle(app, &jump_request).await?;
        let channel = jump_session
            .channel_open_direct_tcpip(request.host.clone(), request.port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| format!("通过跳板机打开目标通道失败: {}", e))?;

        let stream = channel.into_stream();
        let session = connect_authenticated_stream(app, request, stream).await?;
        clear_pending_host_key_verification(&request.connection_id);

        return Ok(AuthenticatedSession {
            session,
            jump_session: Some(jump_session),
        });
    }

    let session = connect_authenticated_handle(app, request).await?;
    clear_pending_host_key_verification(&request.connection_id);

    Ok(AuthenticatedSession {
        session,
        jump_session: None,
    })
}

async fn connect_authenticated_handle(
    app: &AppHandle,
    request: &SshAuthRequest,
) -> Result<client::Handle<Client>, String> {
    let verification = Arc::new(StdMutex::new(None));

    let config = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        ..<_>::default()
    };

    let client = Client {
        app: app.clone(),
        request: request.clone(),
        verification: verification.clone(),
    };

    let mut session = client::connect(Arc::new(config), (&request.host[..], request.port), client)
        .await
        .map_err(|e| map_connect_error(request, &verification, format!("SSH 连接失败: {}", e)))?;

    authenticate_session(&mut session, request).await?;
    Ok(session)
}

async fn connect_authenticated_stream<R>(
    app: &AppHandle,
    request: &SshAuthRequest,
    stream: R,
) -> Result<client::Handle<Client>, String>
where
    R: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let verification = Arc::new(StdMutex::new(None));

    let config = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        ..<_>::default()
    };

    let client = Client {
        app: app.clone(),
        request: request.clone(),
        verification: verification.clone(),
    };

    let mut session = client::connect_stream(Arc::new(config), stream, client)
        .await
        .map_err(|e| map_connect_error(request, &verification, format!("SSH 连接失败: {}", e)))?;

    authenticate_session(&mut session, request).await?;

    Ok(session)
}

fn map_connect_error(
    request: &SshAuthRequest,
    verification: &Arc<StdMutex<Option<HostKeyVerification>>>,
    fallback: String,
) -> String {
    if request.strict_host_key_checking {
        if let Some(verification) = verification.lock().unwrap().clone() {
            if verification.requires_user_confirmation {
                cache_pending_host_key_verification(&request.connection_id, verification.clone());
                return format!("主机密钥需要确认 (状态: {:?})", verification.state);
            }
        }
    }

    fallback
}

/// 对会话执行认证
pub async fn authenticate_session(
    session: &mut client::Handle<Client>,
    request: &SshAuthRequest,
) -> Result<AuthMethod, String> {
    let mut private_key_error: Option<String> = None;

    // 优先尝试私钥认证
    if let Some(ref key_path) = request.private_key_path {
        match load_keypair(key_path, request.passphrase.as_deref()) {
            Ok(keypair) => {
                println!("开始私钥认证...");
                let auth_result = session
                    .authenticate_publickey(
                        &request.username,
                        PrivateKeyWithHashAlg::new(
                            Arc::new(keypair),
                            session
                                .best_supported_rsa_hash()
                                .await
                                .map_err(|e| format!("获取 RSA 签名算法失败: {}", e))?
                                .flatten(),
                        ),
                    )
                    .await;
                match auth_result {
                    Ok(result) if result.success() => {
                        println!("✓ 私钥认证成功");
                        return Ok(AuthMethod::PrivateKey);
                    }
                    Ok(_) => {
                        println!("✗ 私钥认证失败");
                        private_key_error = Some(if request.passphrase.is_some() {
                            "私钥认证失败: 密码短语错误或私钥与当前用户不匹配".to_string()
                        } else {
                            "私钥认证失败: 私钥无效、与当前用户不匹配，或该私钥需要密码短语".to_string()
                        });
                    }
                    Err(e) => {
                        println!("✗ 私钥认证错误: {}", e);
                        private_key_error = Some(format!("私钥认证失败: {}", e));
                    }
                }
            }
            Err(e) => {
                println!("✗ 加载私钥失败: {}", e);
                private_key_error = Some(e);
            }
        }
    }

    // 回退到密码认证
    if let Some(ref password) = request.password {
        println!("开始密码认证...");
        match session
            .authenticate_password(&request.username, password)
            .await
        {
            Ok(result) if result.success() => {
                println!("✓ 密码认证成功");
                return Ok(AuthMethod::Password);
            }
            Ok(_) => {
                return Err("密码认证失败: 用户名或密码错误".to_string());
            }
            Err(e) => {
                return Err(format!("密码认证过程失败: {}", e));
            }
        }
    }

    if let Some(private_key_error) = private_key_error {
        return Err(private_key_error);
    }

    Err("没有可用的认证方法".to_string())
}

/// 加载私钥
pub fn load_keypair(
    private_key_path: &str,
    passphrase: Option<&str>,
) -> Result<PrivateKey, String> {
    use std::path::Path;

    let path = Path::new(private_key_path);
    if !path.exists() {
        return Err(format!("私钥文件不存在: {}", private_key_path));
    }

    let key_data = std::fs::read(path).map_err(|e| format!("读取私钥文件失败: {}", e))?;

    // 尝试加载私钥
    let keypair = if let Some(pass) = passphrase {
        keys::decode_secret_key(&String::from_utf8_lossy(&key_data), Some(pass))
            .map_err(|e| format!("解密私钥失败: {}", e))?
    } else {
        keys::decode_secret_key(&String::from_utf8_lossy(&key_data), None)
            .map_err(|e| format!("加载私钥失败 (可能需要密码短语): {}", e))?
    };

    Ok(keypair)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_request_serialization() {
        let request = SshAuthRequest {
            connection_id: "test-123".to_string(),
            profile_id: Some("profile-456".to_string()),
            host: "example.com".to_string(),
            port: 22,
            username: "user".to_string(),
            password: Some("pass".to_string()),
            private_key_path: None,
            passphrase: None,
            strict_host_key_checking: true,
            proxy_jump: None,
            port_forwards: Vec::new(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: SshAuthRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.host, deserialized.host);
        assert_eq!(request.port, deserialized.port);
    }
}
