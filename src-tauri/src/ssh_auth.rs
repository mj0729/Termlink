use crate::host_key_store::{self, HostKeyRecord};
use russh::keys::{self, HashAlg, PrivateKey, PrivateKeyWithHashAlg, PublicKey};
use russh::*;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::AppHandle;

/// 认证方法
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    Password,
    PrivateKey,
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

/// SSH 客户端处理器
pub struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // 主机密钥验证由外部逻辑处理,这里总是接受
        // 实际验证在 preview_host_key 和 connect_authenticated_session 中完成
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

/// 预览主机密钥
pub async fn preview_host_key(
    app: AppHandle,
    request: SshAuthRequest,
) -> Result<HostKeyVerification, String> {
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

    let algorithm = server_key.algorithm().to_string();
    let fingerprint = extract_fingerprint(&server_key);

    // 获取公钥的 base64 表示
    let public_key_base64 = base64_encode(
        &server_key
            .to_bytes()
            .map_err(|e| format!("序列化服务器公钥失败: {}", e))?,
    );

    // 关闭临时连接
    drop(session);

    let presented = HostKeyIdentity {
        host: request.host.clone(),
        port: request.port,
        algorithm: algorithm.clone(),
        fingerprint_sha256: fingerprint.clone(),
        public_key_base64,
    };

    // 查找存储的主机密钥
    let stored =
        host_key_store::find_host_key_record(&app, &request.host, request.port, &algorithm)?;

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
                public_key_base64: String::new(), // 将在实际连接时更新
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
) -> Result<client::Handle<Client>, String> {
    // 如果启用严格主机密钥检查,先验证
    if request.strict_host_key_checking {
        let verification = preview_host_key(app.clone(), request.clone()).await?;

        if verification.requires_user_confirmation {
            return Err(format!("主机密钥需要确认 (状态: {:?})", verification.state));
        }
    }

    // 创建连接
    let config = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        ..<_>::default()
    };

    let mut session = client::connect(Arc::new(config), (&request.host[..], request.port), Client)
        .await
        .map_err(|e| format!("SSH 连接失败: {}", e))?;

    // 执行认证
    authenticate_session(&mut session, request).await?;

    Ok(session)
}

/// 对会话执行认证
pub async fn authenticate_session(
    session: &mut client::Handle<Client>,
    request: &SshAuthRequest,
) -> Result<AuthMethod, String> {
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
                    }
                    Err(e) => {
                        println!("✗ 私钥认证错误: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("✗ 加载私钥失败: {}", e);
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
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: SshAuthRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.host, deserialized.host);
        assert_eq!(request.port, deserialized.port);
    }
}
