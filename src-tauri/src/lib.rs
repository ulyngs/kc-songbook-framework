use tauri::Manager;

#[cfg(target_os = "macos")]
use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

#[cfg(all(not(target_os = "macos"), not(mobile)))]
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg(mobile)]
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|_app| {
            // Create main window with transparent titlebar on macOS
            #[cfg(target_os = "macos")]
            {
                let win_builder = WebviewWindowBuilder::new(_app, "main", WebviewUrl::default())
                    .title("")
                    .inner_size(1024.0, 768.0)
                    .min_inner_size(400.0, 300.0)
                    .resizable(true)
                    .center()
                    .title_bar_style(TitleBarStyle::Overlay);

                win_builder.build()?;
            }

            // Create main window on desktop platforms (not macOS, not mobile)
            #[cfg(all(not(target_os = "macos"), not(mobile)))]
            {
                let win_builder = WebviewWindowBuilder::new(_app, "main", WebviewUrl::default())
                    .title("KC Songbook")
                    .inner_size(1024.0, 768.0)
                    .min_inner_size(400.0, 300.0)
                    .resizable(true)
                    .center();

                win_builder.build()?;
            }

            // Mobile platforms (iOS, Android) - use minimal config
            #[cfg(mobile)]
            {
                let win_builder = WebviewWindowBuilder::new(_app, "main", WebviewUrl::default());
                win_builder.build()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
