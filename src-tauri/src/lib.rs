mod bezier_curve;
mod types;
mod vector2;

use bezier_curve::BezierCurve;
use types::{AnchorPoint, PathPoint, Vector2};

const MAX_VELOCITY: f64 = 118.0; 
const MAX_ACCELERATION: f64 =  118.0;
const OVERSAMPLING_FACTOR: usize = 100;
const SAMPLING_DISTANCE: f64 = 0.2;   

#[tauri::command]
fn compute_travel_time(anchors: Vec<AnchorPoint>) -> f64 {
    if anchors.len() < 2 {
        return 0.0;
    }

    println!("Generating trajectory for {} anchors...", anchors.len());

    // 1) Generate equal-distance samples along the whole path (arc-length resampling)
    let mut path_points = generate_path_points(&anchors);
    if path_points.is_empty() {
        return 0.0;
    }

    // 2) Set velocity limits (NO curvature-based limit; just clamp to MAX_VELOCITY)
    for point in &mut path_points {
        point.velocity = MAX_VELOCITY;
    }

    // 3) Forward pass (acceleration limit)
    path_points[0].velocity = 0.0;
    for i in 0..path_points.len() - 1 {
        let v_now = path_points[i].velocity;
        let ds = path_points[i + 1].s - path_points[i].s;
        let v_possible = (v_now * v_now + 2.0 * MAX_ACCELERATION * ds).sqrt();
        path_points[i + 1].velocity = path_points[i + 1].velocity.min(v_possible);
    }

    // 4) Backward pass (deceleration limit)
    let last = path_points.len() - 1;
    path_points[last].velocity = 0.0;
    for i in (0..last).rev() {
        let v_next = path_points[i + 1].velocity;
        let ds = path_points[i + 1].s - path_points[i].s;
        let v_possible = (v_next * v_next + 2.0 * MAX_ACCELERATION * ds).sqrt();
        path_points[i].velocity = path_points[i].velocity.min(v_possible);
    }

    // 5) Time integration
    path_points[0].time = 0.0;
    for i in 0..path_points.len() - 1 {
        let v_i = path_points[i].velocity;
        let v_ip1 = path_points[i + 1].velocity;
        let ds = path_points[i + 1].s - path_points[i].s;

        let dt = if (v_i + v_ip1).abs() > 1e-9 {
            2.0 * ds / (v_i + v_ip1)
        } else {
            0.0
        };
        path_points[i + 1].time = path_points[i].time + dt;
    }

    // println!("--- Trajectory Details ---");
    // println!(
    //     "{:<5} | {:<18} | {:<10} | {:<10} | {:<10}",
    //     "Idx", "Position", "Dist (s)", "Vel (v)", "Time (t)"
    // );
    // for (i, p) in path_points.iter().enumerate() {
    //     println!(
    //         "{:<5} | ({:<6.2}, {:<6.2}) | {:<10.2} | {:<10.2} | {:<10.3}",
    //         i, p.x, p.y, p.s, p.velocity, p.time
    //     );
    // }

    let total_time = path_points.last().map_or(0.0, |p| p.time);
    println!("Total computed travel time: {:.3} seconds", total_time);

    total_time
}

/// Equal-distance resampling over all Bézier segments (no curvature used).
fn generate_path_points(anchors: &[AnchorPoint]) -> Vec<PathPoint> {
    let mut path: Vec<PathPoint> = Vec::new();
    let mut cumulative_s_global: f64 = 0.0;

    for i in 0..anchors.len() - 1 {
        // Build the cubic for this pair
        let p0 = anchors[i].position;
        let p1 = anchors[i].position + anchors[i].handle_out_offset;
        let p2 = anchors[i + 1].position + anchors[i + 1].handle_in_offset;
        let p3 = anchors[i + 1].position;
        let curve = BezierCurve::new(p0, p1, p2, p3);

        // 1) Build arc-length LUT for this segment (local distances from segment start)
        let mut arc_length_lut: Vec<(f64, f64)> = Vec::with_capacity(OVERSAMPLING_FACTOR + 1);
        let mut last_pos = curve.position(0.0);
        let mut s_local = 0.0;
        arc_length_lut.push((0.0, 0.0)); // start
        for j in 1..=OVERSAMPLING_FACTOR {
            let t = j as f64 / OVERSAMPLING_FACTOR as f64;
            let pos = curve.position(t);
            s_local += (pos - last_pos).magnitude();
            arc_length_lut.push((s_local, t));
            last_pos = pos;
        }
        let seg_len = s_local;

        // 2) Equal-distance resampling on this segment (local s from 0..seg_len)
        let mut s_along_seg = 0.0;
        // If we're continuing from an existing path, avoid duplicating the first point.
        let mut is_first_sample = path.is_empty();

        while s_along_seg <= seg_len + 1e-9 {
            let t = interpolate_t_for_distance(&arc_length_lut, s_along_seg);
            let pos = curve.position(t);

            // Skip the very first sample if we already have a last point in the global path
            if !is_first_sample {
                if let Some(last_p) = path.last() {
                    // avoid pushing near-duplicate points if spacing is extremely small
                    let d = (pos - Vector2 { x: last_p.x, y: last_p.y }).magnitude();
                    if d < 1e-9 {
                        s_along_seg += SAMPLING_DISTANCE;
                        continue;
                    }
                }
            }

            path.push(PathPoint {
                x: pos.x,
                y: pos.y,
                s: cumulative_s_global + s_along_seg,
                // curvature not used; keep zero if your struct has it
                curvature: 0.0,
                velocity: 0.0,
                time: 0.0,
            });

            s_along_seg += SAMPLING_DISTANCE;
            is_first_sample = false;
        }

        // Advance global s by the exact segment length to keep continuity
        cumulative_s_global += seg_len;
    }

    // Ensure the very last anchor position is included as the final sample
    if let Some(last_anchor) = anchors.last() {
        let last_pos = last_anchor.position;
        if let Some(last_p) = path.last() {
            let d = (last_pos - Vector2 { x: last_p.x, y: last_p.y }).magnitude();
            if d > 1e-9 {
                path.push(PathPoint {
                    x: last_pos.x,
                    y: last_pos.y,
                    s: last_p.s + d,
                    curvature: 0.0,
                    velocity: 0.0,
                    time: 0.0,
                });
            }
        } else {
            path.push(PathPoint {
                x: last_pos.x,
                y: last_pos.y,
                s: 0.0,
                curvature: 0.0,
                velocity: 0.0,
                time: 0.0,
            });
        }
    }

    path
}

/// Invert arc-length LUT (distance → t) by binary search + linear interpolation.
/// The LUT entries are (s_local, t) with s_local from 0..segment_length.
fn interpolate_t_for_distance(lut: &[(f64, f64)], distance: f64) -> f64 {
    if distance <= 0.0 {
        return 0.0;
    }
    let last = lut.last().unwrap();
    if distance >= last.0 {
        return last.1;
    }

    match lut.binary_search_by(|(s, _)| s.partial_cmp(&distance).unwrap()) {
        Ok(idx) => lut[idx].1,
        Err(idx) => {
            let (s1, t1) = lut[idx - 1];
            let (s2, t2) = lut[idx];
            let frac = (distance - s1) / (s2 - s1);
            t1 + frac * (t2 - t1)
        }
    }
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

