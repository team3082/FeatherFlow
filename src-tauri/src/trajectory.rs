use crate::bezier_curve::BezierCurve;
use crate::controls::{
    build_rotate_keyframes_by_distance,
    collect_split_values,
    parse_actions,
    parse_motion_limits,
    rotate_heading_at_t,
    resolve_motion_limit_at_t,
    stop_duration_at_t,
};
use crate::types::{AnchorPoint, ControlPoint, MotionSettings, PathPoint, TrajectoryResult, Vector2};

const FIELD_HEIGHT_INCHES: f64 = 317.69;

/// Computes a full time-parameterized trajectory from anchors and optional control points.
///
/// This is the top-level pipeline entry point:
/// 1) sample the geometric path,
/// 2) parse actions and motion limits,
/// 3) split at stop/command boundaries,
/// 4) profile each segment,
/// 5) merge results and stop holds into one timeline.
///
/// ################ Arguments
/// * `anchors` - Ordered anchor points that define connected Bezier segments.
/// * `control_points` - Optional control points carrying stop/rotate/command/motion-limit attributes.
///
/// ################ Returns
/// A `TrajectoryResult` containing `total_time` and fully profiled `path_points`.
pub(crate) fn compute_travel_time(
    anchors: Vec<AnchorPoint>,
    control_points: Option<Vec<ControlPoint>>,
    motion_settings: MotionSettings,
) -> TrajectoryResult {
    compute_travel_time_with_orientation(anchors, control_points, motion_settings, false)
}

fn compute_travel_time_with_orientation(
    anchors: Vec<AnchorPoint>,
    control_points: Option<Vec<ControlPoint>>,
    motion_settings: MotionSettings,
    flipped: bool,
) -> TrajectoryResult {
    if anchors.len() < 2 {
        return TrajectoryResult {
            total_time: 0.0,
            path_points: Vec::new(),
        };
    }

    let (path_points, sample_ts) = generate_path_points(&anchors);
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
    let segments = split_path(&path_points, &sample_ts, &split_values);
    let rotate_by_dist = build_rotate_keyframes_by_distance(&path_points, &sample_ts, &actions, flipped);

    let mut all_points: Vec<PathPoint> = Vec::new();
    let mut cumulative_time = 0.0;
    let mut segment_dist_offset = 0.0;

    for (segment_idx, (segment_points, segment_ts)) in segments.iter().enumerate() {
        if segment_points.len() < 2 {
            continue;
        }

        let target_headings = build_target_headings(segment_points, &rotate_by_dist, segment_dist_offset);
        let mut profiled_segment = profile_segment(
            segment_points,
            segment_ts,
            &target_headings,
            &motion_limits,
            &motion_settings,
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
                if d < crate::EPSILON {
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
            if stop_duration > crate::EPSILON {
                if let Some(last_point) = all_points.last().cloned() {
                    let last_heading = last_point.heading;
                    let mut hold = last_point;
                    if let Some(stop_heading) = rotate_heading_at_t(&actions, split_t) {
                        let mut delta = stop_heading - last_heading;
                        while delta > std::f64::consts::PI {
                            delta -= 2.0 * std::f64::consts::PI;
                        }
                        while delta < -std::f64::consts::PI {
                            delta += 2.0 * std::f64::consts::PI;
                        }
                        hold.heading = last_heading + delta;
                        hold.rotational_velocity = delta / stop_duration;
                    } else {
                        hold.rotational_velocity = 0.0;
                    }
                    hold.time += stop_duration;
                    hold.velocity = Vector2 { x: 0.0, y: 0.0 };
                    hold.acceleration = 0.0;
                    all_points.push(hold);
                    cumulative_time += stop_duration;
                }
            }
        }

        segment_dist_offset += segment_points
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

/// Splits a sampled path into contiguous sub-segments at normalized split boundaries.
///
/// Boundaries are de-duplicated and clamped to `[0, 1]`. Segment endpoints are interpolated
/// exactly at boundary `t` values so stop locations align with control-point parameters.
///
/// ################ Arguments
/// * `path` - Sampled path points.
/// * `sample_ts` - Global normalized `t` value for each sampled point in `path`.
/// * `split_values` - Normalized split boundaries (typically stop/stopping-command locations).
///
/// ################ Returns
/// A list of `(segment_points, segment_ts)` tuples.
fn split_path(path: &[PathPoint], sample_ts: &[f64], split_values: &[f64]) -> Vec<(Vec<PathPoint>, Vec<f64>)> {
    if path.len() < 2 {
        return Vec::new();
    }

    if sample_ts.len() != path.len() {
        return vec![(path.to_vec(), vec![0.0; path.len()])];
    }

    if split_values.is_empty() {
        return vec![(path.to_vec(), sample_ts.to_vec())];
    }

    let mut segments: Vec<(Vec<PathPoint>, Vec<f64>)> = Vec::new();
    let mut boundaries: Vec<f64> = split_values.iter().map(|t| t.clamp(0.0, 1.0)).collect();
    boundaries.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    boundaries.dedup_by(|a, b| (*a - *b).abs() < crate::EPSILON);

    let mut start_t = 0.0;
    for end_t in boundaries.into_iter().chain(std::iter::once(1.0)) {
        if end_t <= start_t + crate::EPSILON {
            continue;
        }

        if let Some(segment) = build_segment_between(path, sample_ts, start_t, end_t) {
            segments.push(segment);
        }

        start_t = end_t;
    }

    if segments.is_empty() {
        segments.push((path.to_vec(), sample_ts.to_vec()));
    }

    segments
}

/// Builds a single segment between two normalized `t` bounds.
///
/// The returned segment always includes exact interpolated endpoints at `t_start` and `t_end`
/// plus interior sampled points that fall strictly inside the range.
///
/// ################ Arguments
/// * `path` - Sampled path points.
/// * `sample_ts` - Global normalized `t` value for each sampled point.
/// * `t_start` - Inclusive segment start in normalized parameter space.
/// * `t_end` - Inclusive segment end in normalized parameter space.
///
/// ################ Returns
/// `Some((points, ts))` when a valid segment can be formed, otherwise `None`.
fn build_segment_between(
    path: &[PathPoint],
    sample_ts: &[f64],
    t_start: f64,
    t_end: f64,
) -> Option<(Vec<PathPoint>, Vec<f64>)> {
    let t_start = t_start.clamp(0.0, 1.0);
    let t_end = t_end.clamp(0.0, 1.0);
    if t_end <= t_start + crate::EPSILON {
        return None;
    }

    let mut segment_points: Vec<PathPoint> = Vec::new();
    let mut segment_ts: Vec<f64> = Vec::new();

    segment_points.push(interpolate_path_point_at_t(path, sample_ts, t_start));
    segment_ts.push(t_start);

    for i in 0..sample_ts.len() {
        let t = sample_ts[i];
        if t > t_start + crate::EPSILON && t < t_end - crate::EPSILON {
            segment_points.push(path[i].clone());
            segment_ts.push(t);
        }
    }

    segment_points.push(interpolate_path_point_at_t(path, sample_ts, t_end));
    segment_ts.push(t_end);

    if segment_points.len() < 2 {
        return None;
    }

    Some((segment_points, segment_ts))
}

/// Interpolates a path point at a specific normalized `t` along the sampled path.
///
/// If `t` lands exactly on a sample, the exact sample is returned. Otherwise linear interpolation
/// is used between nearest neighbors for `x`, `y`, `s`, and `curvature`.
///
/// #### Arguments
/// * `path` - Sampled path points.
/// * `sample_ts` - Global normalized `t` value for each sampled point.
/// * `t` - Query position in normalized parameter space.
///
/// #### Returns
/// Interpolated `PathPoint` with kinematic fields reset for later profiling.
fn interpolate_path_point_at_t(path: &[PathPoint], sample_ts: &[f64], t: f64) -> PathPoint {
    if path.is_empty() || sample_ts.is_empty() {
        return PathPoint::default();
    }

    let t = t.clamp(0.0, 1.0);
    if t <= sample_ts[0] {
        return path[0].clone();
    }

    let last_idx = sample_ts.len() - 1;
    if t >= sample_ts[last_idx] {
        return path[last_idx].clone();
    }

    match sample_ts.binary_search_by(|probe| probe.partial_cmp(&t).unwrap_or(std::cmp::Ordering::Equal)) {
        Ok(idx) => path[idx].clone(),
        Err(idx) => {
            let lo = idx.saturating_sub(1);
            let hi = idx.min(last_idx);
            let t0 = sample_ts[lo];
            let t1 = sample_ts[hi];
            let span = (t1 - t0).abs();
            let alpha = if span <= crate::EPSILON {
                0.0
            } else {
                ((t - t0) / (t1 - t0)).clamp(0.0, 1.0)
            };

            let p0 = &path[lo];
            let p1 = &path[hi];

            PathPoint {
                x: p0.x + alpha * (p1.x - p0.x),
                y: p0.y + alpha * (p1.y - p0.y),
                s: p0.s + alpha * (p1.s - p0.s),
                curvature: p0.curvature + alpha * (p1.curvature - p0.curvature),
                velocity: Vector2 { x: 0.0, y: 0.0 },
                acceleration: 0.0,
                time: 0.0,
                heading: 0.0,
                rotational_velocity: 0.0,
            }
        }
    }
}

/// Builds desired heading values for a segment by sampling rotate keyframes by distance.
///
/// Segment-local cumulative distance is offset by `segment_dist_offset` so interpolation is done
/// in the full-path distance frame.
///
/// #### Arguments
/// * `segment` - Segment path points.
/// * `rotate_by_dist` - Global rotate keyframes as `(distance, heading_radians)`.
/// * `segment_dist_offset` - Total traveled distance before this segment.
///
/// #### Returns
/// Heading target for each segment point.
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
        .map(|d| crate::controls::interpolate_heading_by_distance(rotate_by_dist, segment_dist_offset + d))
        .collect()
}

/// Profiles a segment into a dynamically feasible translational/rotational trajectory.
///
/// The profiler applies velocity caps from motion limits, wheel-speed coupling, rotational
/// constraints, and curvature limits, then performs forward/backward acceleration passes,
/// and finally integrates time and derivatives.
///
/// #### Arguments
/// * `segment` - Geometric segment points.
/// * `segment_ts` - Normalized `t` per segment point.
/// * `target_headings` - Desired heading at each segment point.
/// * `motion_limits` - Piecewise-constant motion-limit frames over global `t`.
///
/// #### Returns
/// Profiled segment points with velocity/time/heading/acceleration fields populated.
fn profile_segment(
    segment: &[PathPoint],
    segment_ts: &[f64],
    target_headings: &[f64],
    motion_limits: &[crate::controls::MotionLimitFrame],
    motion_settings: &MotionSettings,
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

    let mut point_max_velocities = vec![motion_settings.max_translational_velocity; n];
    let mut point_max_accelerations = vec![motion_settings.max_acceleration; n];
    for i in 0..n {
        let rel = if total_distance > crate::EPSILON { distances[i] / total_distance } else { 0.0 };
        let t = segment_ts
            .get(i)
            .copied()
            .unwrap_or(rel)
            .clamp(0.0, 1.0);
        let (v_max, a_max) = resolve_motion_limit_at_t(motion_limits, t.clamp(0.0, 1.0), motion_settings);
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
        if ds <= crate::EPSILON {
            continue;
        }

        let rot_density = (dtheta[i].abs() / ds) * motion_settings.swerve_radius;
        let v_wheel = motion_settings.max_wheel_speed / (1.0 + rot_density);
        velocities[i] = velocities[i].min(v_wheel);

        if dtheta[i].abs() > crate::EPSILON {
            let v_rot = motion_settings.max_rotational_velocity * ds / dtheta[i].abs();
            velocities[i] = velocities[i].min(v_rot);
        }
    }

    for i in 0..n {
        let k = points[i].curvature;
        if k.abs() > crate::EPSILON {
            let a_lat_cap = motion_settings
                .max_lateral_acceleration
                .min(point_max_accelerations[i]);
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
        let dt = if v_avg > crate::EPSILON { ds / v_avg } else { 0.0 };
        time += dt;

        let omega = if dt > crate::EPSILON { dtheta[i] / dt } else { 0.0 };
        let dv = velocities[i] - velocities[i - 1];
        let accel = if dt > crate::EPSILON { dv / dt } else { 0.0 };

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

/// Generates approximately equal-distance samples over all Bezier anchor segments.
///
/// Also returns per-sample normalized global `t` values so control-point events can be mapped
/// accurately in parameter space.
///
/// #### Arguments
/// * `anchors` - Ordered anchor points defining cubic Bezier segments.
///
/// #### Returns
/// Tuple `(path_points, sample_ts)` where each `sample_ts[i]` corresponds to `path_points[i]`.
fn generate_path_points(anchors: &[AnchorPoint]) -> (Vec<PathPoint>, Vec<f64>) {
    let mut path: Vec<PathPoint> = Vec::new();
    let mut sample_ts: Vec<f64> = Vec::new();
    let mut cumulative_s_global: f64 = 0.0;
    let curve_count = anchors.len().saturating_sub(1).max(1);

    for i in 0..anchors.len() - 1 {
        let p0 = anchors[i].position;
        let p1 = anchors[i].position + anchors[i].handle_out_offset;
        let p2 = anchors[i + 1].position + anchors[i + 1].handle_in_offset;
        let p3 = anchors[i + 1].position;
        let curve = BezierCurve::new(p0, p1, p2, p3);

        let mut arc_length_lut: Vec<(f64, f64)> = Vec::with_capacity(crate::OVERSAMPLING_FACTOR + 1);
        let mut last_pos = curve.position(0.0);
        let mut s_local = 0.0;
        arc_length_lut.push((0.0, 0.0));
        for j in 1..=crate::OVERSAMPLING_FACTOR {
            let t = j as f64 / crate::OVERSAMPLING_FACTOR as f64;
            let pos = curve.position(t);
            s_local += (pos - last_pos).magnitude();
            arc_length_lut.push((s_local, t));
            last_pos = pos;
        }
        let seg_len = s_local;

        let mut s_along_seg = 0.0;
        let mut is_first_sample = path.is_empty();

        while s_along_seg <= seg_len + 1e-9 {
            let t = interpolate_t_for_distance(&arc_length_lut, s_along_seg);
            let pos = curve.position(t);

            if !is_first_sample {
                if let Some(last_p) = path.last() {
                    let d = (pos - Vector2 { x: last_p.x, y: last_p.y }).magnitude();
                    if d < 1e-9 {
                        s_along_seg += crate::SAMPLING_DISTANCE;
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
            sample_ts.push(((i as f64 + t.clamp(0.0, 1.0)) / curve_count as f64).clamp(0.0, 1.0));

            s_along_seg += crate::SAMPLING_DISTANCE;
            is_first_sample = false;
        }

        cumulative_s_global += seg_len;
    }

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
                sample_ts.push(1.0);
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
            sample_ts.push(1.0);
        }
    }

    annotate_discrete_curvature(&mut path);

    (path, sample_ts)
}

/// Adds discrete curvature estimates from neighboring samples.
///
/// This captures sharp heading changes at anchor joins (for example when Bezier handles
/// are zero), where analytic per-segment Bezier curvature can remain near zero.
fn annotate_discrete_curvature(path: &mut [PathPoint]) {
    if path.len() < 3 {
        return;
    }

    let mut estimated = vec![0.0; path.len()];

    for i in 1..path.len() - 1 {
        let p_prev = Vector2 {
            x: path[i - 1].x,
            y: path[i - 1].y,
        };
        let p_curr = Vector2 {
            x: path[i].x,
            y: path[i].y,
        };
        let p_next = Vector2 {
            x: path[i + 1].x,
            y: path[i + 1].y,
        };

        let a = p_curr - p_prev;
        let b = p_next - p_curr;
        let c = p_next - p_prev;

        let a_len = a.magnitude();
        let b_len = b.magnitude();
        let c_len = c.magnitude();
        if a_len <= crate::EPSILON || b_len <= crate::EPSILON || c_len <= crate::EPSILON {
            continue;
        }

        let cross = a.x * b.y - a.y * b.x;
        let kappa = (2.0 * cross.abs()) / (a_len * b_len * c_len);
        estimated[i] = kappa;
    }

    for (i, point) in path.iter_mut().enumerate() {
        if estimated[i] > point.curvature.abs() {
            point.curvature = point.curvature.signum() * estimated[i];
            if point.curvature == 0.0 {
                point.curvature = estimated[i];
            }
        }
    }
}

/// Compiles a full trajectory runtime artifact for WPILib integration.
///
/// This creates a versioned JSON-serializable artifact containing both normal and flipped
/// trajectory variants with pre-computed path points, events, and metadata.
///
/// #### Arguments
/// * `anchors` - Path anchor points
/// * `control_points` - Optional control points with actions
/// * `routine_id` - Unique identifier for the routine
/// * `routine_name` - Human-readable routine name
/// * `generator_version` - FeatherFlow version string
///
/// #### Returns
/// A `CompiledTrajectoryFile` ready for serialization to JSON.
pub(crate) fn compile_routine_runtime(
    anchors: Vec<AnchorPoint>,
    control_points: Option<Vec<ControlPoint>>,
    motion_settings: MotionSettings,
    routine_id: String,
    routine_name: String,
    generator_version: String,
) -> crate::types::CompiledTrajectoryFile {
    let normal_result = compute_travel_time(anchors.clone(), control_points.clone(), motion_settings);
    let normal_variant = build_compiled_variant(
        &anchors,
        &normal_result,
        control_points.as_ref(),
        false,
    );

    let flipped_anchors = mirror_anchors_across_field_midline(&anchors);
    let flipped_result = compute_travel_time_with_orientation(
        flipped_anchors.clone(),
        control_points.clone(),
        motion_settings,
        true,
    );
    let flipped_variant = build_compiled_variant(
        &flipped_anchors,
        &flipped_result,
        control_points.as_ref(),
        true,
    );

    crate::types::CompiledTrajectoryFile {
        format_version: 1,
        source_routine_id: routine_id,
        source_routine_name: routine_name,
        generated_at_utc: chrono::Utc::now().to_rfc3339(),
        generator_version,
        coordinate_frame: crate::types::CoordinateFrameMetadata {
            units: "meters".to_string(),
            origin: "bottomLeft".to_string(),
            heading_convention: "degrees_input_radians_output".to_string(),
        },
        variants: crate::types::CompiledVariants {
            normal: normal_variant,
            flipped: flipped_variant,
        },
    }
}

fn mirror_anchors_across_field_midline(anchors: &[AnchorPoint]) -> Vec<AnchorPoint> {
    anchors
        .iter()
        .cloned()
        .map(|mut anchor| {
            anchor.position.y = FIELD_HEIGHT_INCHES - anchor.position.y;
            anchor.handle_in_offset.y = -anchor.handle_in_offset.y;
            anchor.handle_out_offset.y = -anchor.handle_out_offset.y;
            anchor
        })
        .collect()
}

/// Builds a compiled variant with segments and events from trajectory result.
fn build_compiled_variant(
    anchors: &[AnchorPoint],
    traj_result: &TrajectoryResult,
    control_points: Option<&Vec<ControlPoint>>,
    _flipped: bool,
) -> crate::types::CompiledTrajectoryVariant {
    let control_points = control_points
        .map(|cp| cp.clone())
        .unwrap_or_default();
    let actions = parse_actions(control_points.clone(), anchors.len().saturating_sub(1));
    let split_values = collect_split_values(&actions);

    let total_distance = traj_result
        .path_points
        .last()
        .map(|p| p.s)
        .unwrap_or(0.0);

    // Rebuild geometric t->distance mapping so split boundaries and event times
    // align with the same normalized parameter space used during profiling.
    let (geometry_path, geometry_ts) = generate_path_points(anchors);

    // Build compiled events from actions
    let events = build_compiled_events(&actions, &traj_result.path_points, &geometry_path, &geometry_ts);

    // Group path points into segments by split boundaries
    let segments = build_compiled_segments(&traj_result.path_points, &split_values, &geometry_path, &geometry_ts);

    crate::types::CompiledTrajectoryVariant {
        total_time: traj_result.total_time,
        total_distance,
        segments,
        events,
        metadata: crate::types::VariantMetadata {
            sample_count: traj_result.path_points.len(),
            split_ts: split_values,
        },
    }
}

/// Builds compiled events from action descriptors and path points.
fn build_compiled_events(
    actions: &[crate::controls::ActionDescriptor],
    path_points: &[PathPoint],
    geometry_path: &[PathPoint],
    geometry_ts: &[f64],
) -> Vec<crate::types::CompiledEvent> {
    actions
        .iter()
        .map(|action| {
            let target_s = interpolate_distance_at_t(geometry_path, geometry_ts, action.t);
            let time = interpolate_time_at_s(path_points, target_s);
            let (event_type, payload) = match &action.kind {
                crate::controls::ActionKind::Stop { duration } => (
                    "stop".to_string(),
                    serde_json::json!({ "duration": duration }),
                ),
                crate::controls::ActionKind::Command { stopping } => (
                    "command".to_string(),
                    serde_json::json!({ "stopping": stopping }),
                ),
                crate::controls::ActionKind::Rotate { heading } => (
                    "rotate".to_string(),
                    serde_json::json!({ "heading": heading }),
                ),
            };
            crate::types::CompiledEvent {
                event_type,
                t: action.t,
                time,
                payload,
            }
        })
        .collect()
}

/// Builds segments from path points and split t values.
fn build_compiled_segments(
    path_points: &[PathPoint],
    split_ts: &[f64],
    geometry_path: &[PathPoint],
    geometry_ts: &[f64],
) -> Vec<crate::types::CompiledSegment> {
    if path_points.len() < 2 {
        return vec![];
    }

    // Find path point indices corresponding to split t values
    let mut segment_boundaries = vec![0];

    for &split_t in split_ts {
        let target_s = interpolate_distance_at_t(geometry_path, geometry_ts, split_t);
        if let Some(idx) = find_point_index_at_s(path_points, target_s) {
            if *segment_boundaries.last().unwrap() < idx {
                segment_boundaries.push(idx);
            }
        }
    }

    // Always include the last point
    if *segment_boundaries.last().unwrap() < path_points.len() - 1 {
        segment_boundaries.push(path_points.len() - 1);
    }

    let mut segments = vec![];

    for (seg_idx, window) in segment_boundaries.windows(2).enumerate() {
        let start_idx = window[0];
        let end_idx = window[1];

        if start_idx >= end_idx {
            continue;
        }

        let segment_points: Vec<PathPoint> = path_points[start_idx..=end_idx]
            .iter()
            .cloned()
            .map(|mut point| {
                point.heading = normalize_heading_0_2pi(point.heading);
                point
            })
            .collect();

        if segment_points.len() < 2 {
            continue;
        }

        let segment_start_time = segment_points.first().map(|p| p.time).unwrap_or(0.0);
        let segment_end_time = segment_points.last().map(|p| p.time).unwrap_or(segment_start_time);

        // Compute normalized t values
        let total_distance = path_points.last().map(|p| p.s).unwrap_or(1.0).max(1.0);
        let start_t = segment_points.first().map(|p| p.s / total_distance).unwrap_or(0.0);
        let end_t = segment_points.last().map(|p| p.s / total_distance).unwrap_or(0.0);

        let segment_points: Vec<PathPoint> = segment_points
            .into_iter()
            .map(|mut point| {
                point.time -= segment_start_time;
                point
            })
            .collect();

        segments.push(crate::types::CompiledSegment {
            segment_index: seg_idx as i32,
            start_t,
            end_t,
            start_time: segment_start_time,
            end_time: segment_end_time,
            path_points: segment_points,
        });
    }

    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mirrors_anchors_across_field_midline() {
        let anchors = vec![AnchorPoint {
            position: Vector2 { x: 12.0, y: 50.0 },
            handle_in_offset: Vector2 { x: 3.0, y: -4.0 },
            handle_out_offset: Vector2 { x: -2.0, y: 8.0 },
            is_curved: true,
            handles_aligned: false,
            name: "A".to_string(),
        }];

        let mirrored = mirror_anchors_across_field_midline(&anchors);

        assert_eq!(mirrored.len(), 1);
        assert!((mirrored[0].position.x - 12.0).abs() < crate::EPSILON);
        assert!((mirrored[0].position.y - (FIELD_HEIGHT_INCHES - 50.0)).abs() < crate::EPSILON);
        assert!((mirrored[0].handle_in_offset.y - 4.0).abs() < crate::EPSILON);
        assert!((mirrored[0].handle_out_offset.y + 8.0).abs() < crate::EPSILON);
    }
}

fn normalize_heading_0_2pi(heading: f64) -> f64 {
    let two_pi = 2.0 * std::f64::consts::PI;
    heading.rem_euclid(two_pi)
}

/// Finds the index of a path point closest to a given normalized t value.
fn find_point_index_at_s(path_points: &[PathPoint], target_s: f64) -> Option<usize> {
    if path_points.is_empty() {
        return None;
    }

    path_points
        .iter()
        .position(|p| p.s >= target_s)
}

/// Interpolates time at a distance value using linear interpolation.
fn interpolate_time_at_s(path_points: &[PathPoint], target_s: f64) -> f64 {
    if path_points.is_empty() {
        return 0.0;
    }

    let target_s = target_s.max(0.0);

    // Binary search for the segment containing target_s
    match path_points.binary_search_by(|p| p.s.partial_cmp(&target_s).unwrap()) {
        Ok(idx) => path_points[idx].time,
        Err(idx) => {
            if idx == 0 {
                path_points[0].time
            } else if idx >= path_points.len() {
                path_points[path_points.len() - 1].time
            } else {
                let p1 = &path_points[idx - 1];
                let p2 = &path_points[idx];
                let frac = if (p2.s - p1.s).abs() > crate::EPSILON {
                    (target_s - p1.s) / (p2.s - p1.s)
                } else {
                    0.5
                };
                p1.time + frac * (p2.time - p1.time)
            }
        }
    }
}

/// Interpolates cumulative distance at a normalized path parameter t from geometric samples.
fn interpolate_distance_at_t(path: &[PathPoint], sample_ts: &[f64], t: f64) -> f64 {
    if path.is_empty() || sample_ts.is_empty() {
        return 0.0;
    }

    let t = t.clamp(0.0, 1.0);
    if t <= sample_ts[0] {
        return path[0].s;
    }

    let last_idx = sample_ts.len() - 1;
    if t >= sample_ts[last_idx] {
        return path[last_idx].s;
    }

    match sample_ts.binary_search_by(|probe| probe.partial_cmp(&t).unwrap_or(std::cmp::Ordering::Equal)) {
        Ok(idx) => path[idx].s,
        Err(idx) => {
            let lo = idx.saturating_sub(1);
            let hi = idx.min(last_idx);
            let t0 = sample_ts[lo];
            let t1 = sample_ts[hi];
            let s0 = path[lo].s;
            let s1 = path[hi].s;
            let span = (t1 - t0).abs();
            if span <= crate::EPSILON {
                s0
            } else {
                let alpha = ((t - t0) / (t1 - t0)).clamp(0.0, 1.0);
                s0 + alpha * (s1 - s0)
            }
        }
    }
}

/// Inverts an arc-length lookup table to find Bezier `t` for a target traveled distance.
///
/// Uses binary search on the LUT and linear interpolation between adjacent entries.
///
/// #### Arguments
/// * `lut` - Arc-length LUT entries as `(distance, t)` sorted by distance.
/// * `distance` - Query distance from the beginning of the segment.
///
/// #### Returns
/// Interpolated Bezier parameter `t` in `[0, 1]`.
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
