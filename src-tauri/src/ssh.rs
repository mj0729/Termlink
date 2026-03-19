use crate::app_key::app_storage_dir;
use crate::connection_store::{self, ConnectionProfile};
use crate::credential_store;
use tauri::AppHandle;

pub type SshProfileMeta = ConnectionProfile;

#[tauri::command]
pub fn save_ssh_profile(
    app: AppHandle,
    profile: SshProfileMeta,
    password: Option<String>,
) -> Result<(), String> {
    connection_store::upsert_connection(&app, profile.clone())?;

    if profile.save_password {
        if let Some(password) = password.filter(|value| !value.is_empty()) {
            credential_store::save_password(&app, &profile.id, &password)?;
            migrate_delete_legacy_password(&profile.id)?;
        }
    } else {
        credential_store::delete_password(&app, &profile.id)?;
        migrate_delete_legacy_password(&profile.id)?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_ssh_profiles(app: AppHandle) -> Result<Vec<SshProfileMeta>, String> {
    connection_store::list_connections(&app)
}

#[tauri::command]
pub fn list_ssh_groups(app: AppHandle) -> Result<Vec<String>, String> {
    connection_store::list_groups(&app)
}

#[tauri::command]
pub fn create_ssh_group(app: AppHandle, group_name: String) -> Result<Vec<String>, String> {
    connection_store::create_group(&app, &group_name)
}

#[tauri::command]
pub fn rename_ssh_group(
    app: AppHandle,
    old_name: String,
    new_name: String,
) -> Result<Vec<String>, String> {
    connection_store::rename_group(&app, &old_name, &new_name)
}

#[tauri::command]
pub fn delete_ssh_group(app: AppHandle, group_name: String) -> Result<Vec<String>, String> {
    connection_store::delete_group(&app, &group_name)
}

#[tauri::command]
pub fn get_ssh_password(app: AppHandle, id: String) -> Result<Option<String>, String> {
    if let Some(password) = credential_store::load_password(&app, &id)? {
        return Ok(Some(password));
    }

    let Ok(entry) = keyring::Entry::new("Termlink", &id) else {
        return Ok(None);
    };

    match entry.get_password() {
        Ok(password) => {
            credential_store::save_password(&app, &id, &password)?;
            let _ = entry.delete_credential();
            Ok(Some(password))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn restart_ssh_connection(
    _app: AppHandle,
    id: String,
    _profile_id: String,
) -> Result<(), String> {
    crate::terminal::close_pty(id)?;
    Ok(())
}

#[tauri::command]
pub fn delete_ssh_profile(app: AppHandle, profile_id: String) -> Result<(), String> {
    connection_store::delete_connection(&app, &profile_id)?;
    credential_store::delete_password(&app, &profile_id)?;
    migrate_delete_legacy_password(&profile_id)?;
    Ok(())
}

#[tauri::command]
pub fn get_profiles_dir(app: AppHandle) -> Result<String, String> {
    let dir = app_storage_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

fn migrate_delete_legacy_password(profile_id: &str) -> Result<(), String> {
    let Ok(entry) = keyring::Entry::new("Termlink", profile_id) else {
        return Ok(());
    };

    match entry.delete_credential() {
        Ok(_) | Err(_) => Ok(()),
    }
}
