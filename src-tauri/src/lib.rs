mod bezier_curve;
mod types;
mod vector2;

use bezier_curve::BezierCurve;
use types::{AnchorPoint, ControlPoint, ControlPointAttribute, PathPoint, Vector2, TrajectoryResult};

const MAX_TRANSLATIONAL_VELOCITY: f64 = 110.0;
const MAX_ROTATIONAL_VELOCITY: f64 = 3.0;
const MAX_WHEEL_SPEED: f64 = 120.0;
const MAX_ACCELERATION: f64 = 110.0;
const MAX_LATERAL_ACCELERATION: f64 = 110.0;
const SWERVE_RADIUS: f64 = 14.0;
const OVERSAMPLING_FACTOR: usize = 100;
const SAMPLING_DISTANCE: f64 = 1.0;
const EPSILON: f64 = 1e-9;

#[derive(Debug, Clone)]
struct ActionDescriptor {
    t: f64,
    kind: ActionKind,
}

#[derive(Debug, Clone)]
struct MotionLimitFrame {
    t: f64,
    max_velocity: f64,
    max_acceleration: f64,
}

#[derive(Debug, Clone)]
enum ActionKind {
    Stop { duration: f64 },
    Rotate { heading: f64 },
    Command { stopping: bool },
}


#[tauri::command]
fn compute_travel_time(anchors: Vec<AnchorPoint>, control_points: Option<Vec<ControlPoint>>) -> TrajectoryResult {
    if anchors.len() < 2 {
        return TrajectoryResult {
            total_time: 0.0,
            path_points: Vec::new(),
        };
    }

    let path_points = generate_path_points(&anchors);
    if path_points.len() < 2 {
        return TrajectoryResult {
            total_time: 0.0,
            path_points: Vec::new(),
        };
    }

    let control_points = control_points.unwrap_or_default();
    let actions = parse_actions(control_points.clone(), anchors.len().saturating_sub(1));
    let motion_limits = parse_motion_limits(&control_points, anchors.len().saturating_sub(1));
    let split_values = collect_split_values(&actions);
    let segments = split_path(&path_points, &split_values);
    let rotate_by_dist = build_rotate_keyframes_by_distance(&path_points, &actions, false);

    let mut all_points: Vec<PathPoint> = Vec::new();
    let mut cumulative_time = 0.0;
    let mut segment_dist_offset = 0.0;

    for (segment_idx, segment) in segments.iter().enumerate() {
        if segment.len() < 2 {
            continue;
        }

        let segment_t_start = if segment_idx == 0 {
            0.0
        } else {
            split_values.get(segment_idx - 1).copied().unwrap_or(0.0)
        };
        let segment_t_end = split_values.get(segment_idx).copied().unwrap_or(1.0);

        let target_headings = build_target_headings(segment, &rotate_by_dist, segment_dist_offset);
        let mut profiled_segment = profile_segment(
            segment,
            &target_headings,
            segment_t_start,
            segment_t_end,
            &motion_limits,
        );
        if profiled_segment.is_empty() {
            continue;
        }

        for point in &mut profiled_segment {
            point.time += cumulative_time;
        }

        if let Some(last) = all_points.last() {
            if let Some(first) = profiled_segment.first() {
                let d = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
                if d < EPSILON {
                    profiled_segment.remove(0);
                }
            }
        }

        if let Some(last) = profiled_segment.last() {
            cumulative_time = last.time;
        }

        all_points.extend(profiled_segment);

        if segment_idx < split_values.len() {
            let split_t = split_values[segment_idx];
            let stop_duration = stop_duration_at_t(&actions, split_t);
            if stop_duration > EPSILON {
                if let Some(last_point) = all_points.last().cloned() {
                    let mut hold = last_point;
                    hold.time += stop_duration;
                    hold.velocity = Vector2 { x: 0.0, y: 0.0 };
                    hold.acceleration = 0.0;
                    hold.rotational_velocity = 0.0;
                    all_points.push(hold);
                    cumulative_time += stop_duration;
                }
            }
        }

        segment_dist_offset += segment
            .windows(2)
            .map(|w| {
                let dx = w[1].x - w[0].x;
                let dy = w[1].y - w[0].y;
                (dx * dx + dy * dy).sqrt()
            })
            .sum::<f64>();
    }

    let total_time = all_points.last().map_or(0.0, |p| p.time);
    TrajectoryResult {
        total_time,
        path_points: all_points,
    }
}

fn normalize_u_to_global_t(u: f64, curve_count: usize) -> f64 {
    if curve_count == 0 {
        return 0.0;
    }

    let max_curve_index = (curve_count - 1) as f64;
    let curve_index = u.floor().clamp(0.0, max_curve_index);
    let local_t = (u - curve_index).clamp(0.0, 1.0);
    ((curve_index + local_t) / curve_count as f64).clamp(0.0, 1.0)
}

fn parse_actions(control_points: Vec<ControlPoint>, curve_count: usize) -> Vec<ActionDescriptor> {
    let mut actions = Vec::new();

    for cp in control_points {
        let global_t = normalize_u_to_global_t(cp.u, curve_count.max(1));

        for attribute in cp.attributes {
            match attribute {
                ControlPointAttribute::Stop { duration } => {
                    actions.push(ActionDescriptor {
                        t: global_t,
                        kind: ActionKind::Stop { duration: duration.max(0.0) },
                    });
                }
                ControlPointAttribute::Rotate { heading } => {
                    actions.push(ActionDescriptor {
                        t: global_t,
                        kind: ActionKind::Rotate { heading },
                    });
                }
                ControlPointAttribute::Command { stopping } => {
                    actions.push(ActionDescriptor {
                        t: global_t,
                        kind: ActionKind::Command { stopping },
                    });
                }
                ControlPointAttribute::Loop { .. } => {}
                ControlPointAttribute::MotionLimits { .. } => {}
            }
        }
    }

    actions.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
    actions
}

fn parse_motion_limits(control_points: &[ControlPoint], curve_count: usize) -> Vec<MotionLimitFrame> {
    let curve_count = curve_count.max(1);
    let mut limits: Vec<MotionLimitFrame> = Vec::new();

    for cp in control_points {
        let global_t = normalize_u_to_global_t(cp.u, curve_count);

        for attribute in &cp.attributes {
            if let ControlPointAttribute::MotionLimits {
                velocity,
                acceleration,
            } = attribute
            {
                if *velocity > EPSILON && *acceleration > EPSILON {
                    limits.push(MotionLimitFrame {
                        t: global_t,
                        max_velocity: *velocity,
                        max_acceleration: *acceleration,
                    });
                }
            }
        }
    }

    limits.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));

    let mut deduped: Vec<MotionLimitFrame> = Vec::new();
    for frame in limits {
        if let Some(last) = deduped.last_mut() {
            if (last.t - frame.t).abs() < EPSILON {
                last.max_velocity = last.max_velocity.min(frame.max_velocity);
                last.max_acceleration = last.max_acceleration.min(frame.max_acceleration);
                continue;
            }
        }
        deduped.push(frame);
    }

    deduped
}

fn resolve_motion_limit_at_t(frames: &[MotionLimitFrame], t: f64) -> (f64, f64) {
    let mut max_velocity = MAX_TRANSLATIONAL_VELOCITY;
    let mut max_acceleration = MAX_ACCELERATION;

    for frame in frames {
        if frame.t <= t + EPSILON {
            max_velocity = frame.max_velocity;
            max_acceleration = frame.max_acceleration;
        } else {
            break;
        }
    }

    (max_velocity, max_acceleration)
}

fn collect_split_values(actions: &[ActionDescriptor]) -> Vec<f64> {
    let mut splits = Vec::new();

    for action in actions {
        match action.kind {
            ActionKind::Stop { .. } => splits.push(action.t),
            ActionKind::Command { stopping } if stopping => splits.push(action.t),
            _ => {}
        }
    }

    splits.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    splits.dedup_by(|a, b| (*a - *b).abs() < EPSILON);
    splits
}

fn stop_duration_at_t(actions: &[ActionDescriptor], t: f64) -> f64 {
    actions
        .iter()
        .filter_map(|action| match action.kind {
            ActionKind::Stop { duration } if (action.t - t).abs() < 1e-6 => Some(duration),
            _ => None,
        })
        .sum::<f64>()
}

fn split_path(path: &[PathPoint], split_values: &[f64]) -> Vec<Vec<PathPoint>> {
    if path.len() < 2 {
        return Vec::new();
    }

    if split_values.is_empty() {
        return vec![path.to_vec()];
    }

    let n = path.len();
    let mut segments: Vec<Vec<PathPoint>> = Vec::new();
    let mut last_t = 0.0;

    for t in split_values {
        let t = t.clamp(0.0, 1.0);
        if t <= last_t + EPSILON {
            continue;
        }

        let start_index = (last_t * (n - 1) as f64).floor() as usize;
        let end_index = ((t * (n - 1) as f64).ceil() as usize).min(n - 1);
        if end_index > start_index {
            segments.push(path[start_index..=end_index].to_vec());
        }
        last_t = t;
    }

    if last_t < 1.0 - EPSILON {
        let start_index = (last_t * (n - 1) as f64).floor() as usize;
        if start_index < n - 1 {
            segments.push(path[start_index..n].to_vec());
        }
    }

    if segments.is_empty() {
        segments.push(path.to_vec());
    }

    segments
}

fn build_rotate_keyframes_by_distance(
    full_path: &[PathPoint],
    actions: &[ActionDescriptor],
    flipped: bool,
) -> Vec<(f64, f64)> {
    if full_path.len() < 2 {
        return Vec::new();
    }

    let mut keyframes_t_heading: Vec<(f64, f64)> = actions
        .iter()
        .filter_map(|action| match action.kind {
            ActionKind::Rotate { heading } => {
                let radians = if !flipped {
                    (heading + 90.0).to_radians()
                } else {
                    ((360.0 - (heading + 90.0)) + 180.0).to_radians()
                };
                Some((action.t.clamp(0.0, 1.0), radians))
            }
            _ => None,
        })
        .collect();

    keyframes_t_heading.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    if keyframes_t_heading.is_empty() {
        return Vec::new();
    }

    let full_dist: Vec<f64> = full_path.iter().map(|p| p.s).collect();
    let n = full_path.len();

    keyframes_t_heading
        .into_iter()
        .map(|(t, heading)| {
            let point_index = t * (n - 1) as f64;
            let lo = point_index.floor() as usize;
            let hi = (lo + 1).min(n - 1);
            let frac = point_index - lo as f64;
            let dist = full_dist[lo] + frac * (full_dist[hi] - full_dist[lo]);
            (dist, heading)
        })
        .collect()
}

fn build_target_headings(segment: &[PathPoint], rotate_by_dist: &[(f64, f64)], segment_dist_offset: f64) -> Vec<f64> {
    if segment.is_empty() {
        return Vec::new();
    }

    if rotate_by_dist.is_empty() {
        return vec![0.0; segment.len()];
    }

    let mut seg_dist = vec![0.0; segment.len()];
    for i in 1..segment.len() {
        let dx = segment[i].x - segment[i - 1].x;
        let dy = segment[i].y - segment[i - 1].y;
        seg_dist[i] = seg_dist[i - 1] + (dx * dx + dy * dy).sqrt();
    }

    seg_dist
        .into_iter()
        .map(|d| interpolate_heading_by_distance(rotate_by_dist, segment_dist_offset + d))
        .collect()
}

fn interpolate_heading_by_distance(rotate_by_dist: &[(f64, f64)], d: f64) -> f64 {
    if d <= rotate_by_dist[0].0 {
        return rotate_by_dist[0].1;
    }

    let last = rotate_by_dist[rotate_by_dist.len() - 1];
    if d >= last.0 {
        return last.1;
    }

    for k in 0..rotate_by_dist.len() - 1 {
        let (prev_d, prev_h) = rotate_by_dist[k];
        let (next_d, next_h) = rotate_by_dist[k + 1];
        if prev_d <= d && d < next_d {
            let span = next_d - prev_d;
            let alpha = if span > EPSILON { (d - prev_d) / span } else { 0.0 };
            let mut delta = next_h - prev_h;
            while delta > std::f64::consts::PI {
                delta -= 2.0 * std::f64::consts::PI;
            }
            while delta < -std::f64::consts::PI {
                delta += 2.0 * std::f64::consts::PI;
            }
            return prev_h + alpha * delta;
        }
    }

    last.1
}

fn profile_segment(
    segment: &[PathPoint],
    target_headings: &[f64],
    segment_t_start: f64,
    segment_t_end: f64,
    motion_limits: &[MotionLimitFrame],
) -> Vec<PathPoint> {
    if segment.len() < 2 {
        return Vec::new();
    }

    let n = segment.len();
    let mut points: Vec<PathPoint> = segment
        .iter()
        .map(|p| PathPoint {
            x: p.x,
            y: p.y,
            s: p.s,
            curvature: p.curvature,
            velocity: Vector2 { x: 0.0, y: 0.0 },
            acceleration: 0.0,
            time: 0.0,
            heading: 0.0,
            rotational_velocity: 0.0,
        })
        .collect();

    let mut distances = vec![0.0; n];
    for i in 1..n {
        let dx = points[i].x - points[i - 1].x;
        let dy = points[i].y - points[i - 1].y;
        distances[i] = distances[i - 1] + (dx * dx + dy * dy).sqrt();
    }
    let total_distance = distances[n - 1];

    let mut point_max_velocities = vec![MAX_TRANSLATIONAL_VELOCITY; n];
    let mut point_max_accelerations = vec![MAX_ACCELERATION; n];
    for i in 0..n {
        let rel = if total_distance > EPSILON {
            distances[i] / total_distance
        } else {
            0.0
        };
        let t = segment_t_start + (segment_t_end - segment_t_start) * rel;
        let (v_max, a_max) = resolve_motion_limit_at_t(motion_limits, t.clamp(0.0, 1.0));
        point_max_velocities[i] = v_max;
        point_max_accelerations[i] = a_max;
    }

    let mut headings = if target_headings.len() == n {
        target_headings.to_vec()
    } else {
        vec![0.0; n]
    };

    for i in 1..n {
        let mut delta = headings[i] - headings[i - 1];
        while delta > std::f64::consts::PI {
            delta -= 2.0 * std::f64::consts::PI;
        }
        while delta < -std::f64::consts::PI {
            delta += 2.0 * std::f64::consts::PI;
        }
        headings[i] = headings[i - 1] + delta;
    }

    let mut dtheta = vec![0.0; n];
    for i in 1..n {
        dtheta[i] = headings[i] - headings[i - 1];
    }

    let mut velocities = point_max_velocities.clone();

    for i in 1..n {
        let ds = distances[i] - distances[i - 1];
        if ds <= EPSILON {
            continue;
        }

        let rot_density = (dtheta[i].abs() / ds) * SWERVE_RADIUS;
        let v_wheel = MAX_WHEEL_SPEED / (1.0 + rot_density);
        velocities[i] = velocities[i].min(v_wheel);

        if dtheta[i].abs() > EPSILON {
            let v_rot = MAX_ROTATIONAL_VELOCITY * ds / dtheta[i].abs();
            velocities[i] = velocities[i].min(v_rot);
        }
    }

    for i in 0..n {
        let k = points[i].curvature;
        if k.abs() > EPSILON {
            let a_lat_cap = MAX_LATERAL_ACCELERATION.min(point_max_accelerations[i]);
            let v_lat = (a_lat_cap / k.abs()).sqrt();
            velocities[i] = velocities[i].min(v_lat);
        }
    }

    velocities[0] = 0.0;
    for i in 1..n {
        let ds = (distances[i] - distances[i - 1]).max(0.0);
        let step_accel_limit = point_max_accelerations[i - 1].min(point_max_accelerations[i]);
        let v_accel = (velocities[i - 1] * velocities[i - 1] + 2.0 * step_accel_limit * ds).sqrt();
        velocities[i] = velocities[i].min(v_accel);
    }

    velocities[n - 1] = 0.0;
    for i in (0..n - 1).rev() {
        let ds = (distances[i + 1] - distances[i]).max(0.0);
        let step_accel_limit = point_max_accelerations[i].min(point_max_accelerations[i + 1]);
        let v_decel = (velocities[i + 1] * velocities[i + 1] + 2.0 * step_accel_limit * ds).sqrt();
        velocities[i] = velocities[i].min(v_decel);
    }

    points[0].time = 0.0;
    points[0].heading = headings[0];
    points[0].velocity = Vector2 { x: 0.0, y: 0.0 };
    points[0].rotational_velocity = 0.0;
    points[0].acceleration = 0.0;

    let mut time = 0.0;
    for i in 1..n {
        let ds = distances[i] - distances[i - 1];
        let v_avg = (velocities[i] + velocities[i - 1]) / 2.0;
        let dt = if v_avg > EPSILON { ds / v_avg } else { 0.0 };
        time += dt;

        let omega = if dt > EPSILON { dtheta[i] / dt } else { 0.0 };
        let dv = velocities[i] - velocities[i - 1];
        let accel = if dt > EPSILON { dv / dt } else { 0.0 };

        let p_prev = Vector2 {
            x: points[i - 1].x,
            y: points[i - 1].y,
        };
        let p_now = Vector2 {
            x: points[i].x,
            y: points[i].y,
        };
        let dir = (p_now - p_prev).normalize();

        points[i].velocity = dir * velocities[i];
        points[i].time = time;
        points[i].heading = headings[i];
        points[i].rotational_velocity = omega;
        points[i].acceleration = accel;
    }

    points
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
                curvature: curve.curvature(t),
                velocity: Vector2 { x: 0.0, y: 0.0 },
                acceleration: 0.0,
                time: 0.0,
                heading: 0.0,
                rotational_velocity: 0.0,
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
                    velocity: Vector2 { x: 0.0, y: 0.0 },
                    acceleration: 0.0,
                    time: 0.0,
                    heading: 0.0,
                    rotational_velocity: 0.0,
                });
            }
        } else {
            path.push(PathPoint {
                x: last_pos.x,
                y: last_pos.y,
                s: 0.0,
                curvature: 0.0,
                velocity: Vector2 { x: 0.0, y: 0.0 },
                acceleration: 0.0,
                time: 0.0,
                heading: 0.0,
                rotational_velocity: 0.0,
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