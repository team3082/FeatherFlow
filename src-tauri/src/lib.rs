mod types;
use types::AnchorPoint;
use types::PathPoint;

const METERS_TO_INCHES: f64 = 39.3701;


#[tauri::command]
fn compute_travel_time(anchors: Vec<AnchorPoint>) -> f64 {
    println!("Received {} anchors", anchors.len());
    
    let v_max_m = 3.0;   
        let a_max_m = 2.0;   
    let a_lat_m = 2.0;   



    let v_max = v_max_m * METERS_TO_INCHES;      
    let a_max = a_max_m * METERS_TO_INCHES;      
    let a_lat = a_lat_m * METERS_TO_INCHES;    

    return anchors.len() as f64 * 10.0; // Placeholder computation
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![compute_travel_time])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
