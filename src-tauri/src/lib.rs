const MAX_TRANSLATIONAL_VELOCITY: f64 = 170.0;
const MAX_ROTATIONAL_VELOCITY: f64 = 5.0;
const MAX_WHEEL_SPEED: f64 = 170.0;
const MAX_ACCELERATION: f64 = 170.0;
const MAX_LATERAL_ACCELERATION: f64 = 170.0;
const SWERVE_RADIUS: f64 = 14.0;
const OVERSAMPLING_FACTOR: usize = 100;
const SAMPLING_DISTANCE: f64 = 1.0;
const EPSILON: f64 = 1e-9;

mod bezier_curve;
mod controls;
mod types;
mod trajectory;

use types::{AnchorPoint, ControlPoint, TrajectoryResult, CompiledTrajectoryFile};

#[tauri::command]
fn compute_travel_time(
    anchors: Vec<AnchorPoint>,
    control_points: Option<Vec<ControlPoint>>,
) -> TrajectoryResult {
    trajectory::compute_travel_time(anchors, control_points)
}

#[tauri::command]
fn compile_routine_runtime(
    anchors: Vec<AnchorPoint>,
    control_points: Option<Vec<ControlPoint>>,
    routine_id: String,
    routine_name: String,
    generator_version: String,
) -> CompiledTrajectoryFile {
    trajectory::compile_routine_runtime(
        anchors,
        control_points,
        routine_id,
        routine_name,
        generator_version,
    )
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
        .invoke_handler(tauri::generate_handler![compute_travel_time, compile_routine_runtime])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
