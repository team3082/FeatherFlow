use crate::types::{ControlPoint, ControlPointAttribute};

#[derive(Debug, Clone)]
pub(crate) struct ActionDescriptor {
    pub(crate) t: f64,
    pub(crate) kind: ActionKind,
}

#[derive(Debug, Clone)]
pub(crate) enum ActionKind {
    Stop { duration: f64 },
    Rotate { heading: f64 },
    Command { stopping: bool },
}

#[derive(Debug, Clone)]
pub(crate) struct MotionLimitFrame {
    pub(crate) t: f64,
    pub(crate) max_velocity: f64,
    pub(crate) max_acceleration: f64,
}

pub(crate) fn normalize_u_to_global_t(u: f64, curve_count: usize) -> f64 {
    if curve_count == 0 {
        return 0.0;
    }

    let max_curve_index = (curve_count - 1) as f64;
    let curve_index = u.floor().clamp(0.0, max_curve_index);
    let local_t = (u - curve_index).clamp(0.0, 1.0);
    ((curve_index + local_t) / curve_count as f64).clamp(0.0, 1.0)
}

pub(crate) fn parse_actions(control_points: Vec<ControlPoint>, curve_count: usize) -> Vec<ActionDescriptor> {
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

pub(crate) fn parse_motion_limits(control_points: &[ControlPoint], curve_count: usize) -> Vec<MotionLimitFrame> {
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
                if *velocity > crate::EPSILON && *acceleration > crate::EPSILON {
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
            if (last.t - frame.t).abs() < crate::EPSILON {
                last.max_velocity = last.max_velocity.min(frame.max_velocity);
                last.max_acceleration = last.max_acceleration.min(frame.max_acceleration);
                continue;
            }
        }
        deduped.push(frame);
    }

    deduped
}

pub(crate) fn resolve_motion_limit_at_t(frames: &[MotionLimitFrame], t: f64) -> (f64, f64) {
    let mut max_velocity = crate::MAX_TRANSLATIONAL_VELOCITY;
    let mut max_acceleration = crate::MAX_ACCELERATION;

    for frame in frames {
        if frame.t <= t + crate::EPSILON {
            max_velocity = frame.max_velocity;
            max_acceleration = frame.max_acceleration;
        } else {
            break;
        }
    }

    (max_velocity, max_acceleration)
}

pub(crate) fn collect_split_values(actions: &[ActionDescriptor]) -> Vec<f64> {
    let mut splits = Vec::new();

    for action in actions {
        match action.kind {
            ActionKind::Stop { .. } => splits.push(action.t),
            ActionKind::Command { stopping } if stopping => splits.push(action.t),
            _ => {}
        }
    }

    splits.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    splits.dedup_by(|a, b| (*a - *b).abs() < crate::EPSILON);
    splits
}

pub(crate) fn stop_duration_at_t(actions: &[ActionDescriptor], t: f64) -> f64 {
    actions
        .iter()
        .filter_map(|action| match action.kind {
            ActionKind::Stop { duration } if (action.t - t).abs() < 1e-6 => Some(duration),
            _ => None,
        })
        .sum::<f64>()
}

pub(crate) fn rotate_heading_at_t(actions: &[ActionDescriptor], t: f64) -> Option<f64> {
    actions
        .iter()
        .filter_map(|action| match action.kind {
            ActionKind::Rotate { heading } if (action.t - t).abs() < 1e-6 => Some(heading.to_radians()),
            _ => None,
        })
        .last()
}

pub(crate) fn build_rotate_keyframes_by_distance(
    full_path: &[crate::types::PathPoint],
    sample_ts: &[f64],
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
                    (heading).to_radians()
                } else {
                    ((360.0 - (heading)) + 180.0).to_radians()
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

    let mut by_distance: Vec<(f64, f64)> = keyframes_t_heading
        .into_iter()
        .map(|(t, heading)| {
            let dist = interpolate_distance_at_t(full_path, sample_ts, t);
            (dist, heading)
        })
        .collect();

    by_distance.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // Multiple rotate controls can collapse to the same geometric distance at a stop.
    // Keep only the last heading for that location to avoid interpolation discontinuities.
    let mut deduped: Vec<(f64, f64)> = Vec::with_capacity(by_distance.len());
    for (d, h) in by_distance {
        if let Some(last) = deduped.last_mut() {
            if (last.0 - d).abs() < crate::EPSILON {
                last.1 = h;
                continue;
            }
        }
        deduped.push((d, h));
    }

    deduped
}

fn interpolate_distance_at_t(full_path: &[crate::types::PathPoint], sample_ts: &[f64], t: f64) -> f64 {
    if full_path.is_empty() || sample_ts.is_empty() {
        return 0.0;
    }

    let t = t.clamp(0.0, 1.0);
    if t <= sample_ts[0] {
        return full_path[0].s;
    }

    let last_idx = sample_ts.len() - 1;
    if t >= sample_ts[last_idx] {
        return full_path[last_idx].s;
    }

    match sample_ts.binary_search_by(|probe| probe.partial_cmp(&t).unwrap_or(std::cmp::Ordering::Equal)) {
        Ok(idx) => full_path[idx].s,
        Err(idx) => {
            let lo = idx.saturating_sub(1);
            let hi = idx.min(last_idx);
            let t0 = sample_ts[lo];
            let t1 = sample_ts[hi];
            let s0 = full_path[lo].s;
            let s1 = full_path[hi].s;
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

pub(crate) fn interpolate_heading_by_distance(rotate_by_dist: &[(f64, f64)], d: f64) -> f64 {
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
            let alpha = if span > crate::EPSILON { (d - prev_d) / span } else { 0.0 };
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
