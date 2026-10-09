#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn system_language() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        // Read the primary language configured in macOS, independent of browser preferences.
        objc2_foundation::NSLocale::preferredLanguages()
            .firstObject()
            .map(|language| language.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    { None }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![system_language])
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Не удалось запустить Paint");
}
