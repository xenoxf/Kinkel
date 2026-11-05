// Toda la lógica del juego vive en el frontend (React);
// el shell de Tauri solo abre la ventana.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
