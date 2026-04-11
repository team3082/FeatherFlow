use serde::{Deserialize, Serialize};

fn default_false() -> bool {
    false
}

fn default_zero() -> f64 {
    0.0
}

#[derive(Deserialize, Serialize, Debug, Clone, Copy, Default)]
#[serde(rename_all = "camelCase")]
pub struct Vector2 {
    pub x: f64,
    pub y: f64,
}

impl std::ops::Add for Vector2 {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl std::ops::Sub for Vector2 {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl std::ops::Mul<f64> for Vector2 {
    type Output = Self;
    fn mul(self, rhs: f64) -> Self {
        Self {
            x: self.x * rhs,
            y: self.y * rhs,
        }
    }
}

impl Vector2 {
    pub fn magnitude(&self) -> f64 {
        self.x.hypot(self.y)
    }

    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag > 1e-9 {
            Self {
                x: self.x / mag,
                y: self.y / mag,
            }
        } else {
            Self { x: 0.0, y: 0.0 }
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPoint {
    pub position: Vector2,
    pub handle_in_offset: Vector2,
    pub handle_out_offset: Vector2,
    pub is_curved: bool,
    pub handles_aligned: bool,
    pub name: String,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PathPoint {
    pub x: f64,
    pub y: f64,
    pub s: f64,          // Cumulative distance (arc length)
    pub curvature: f64,
    pub velocity: Vector2,
    #[serde(default)]
    pub acceleration: f64,
    pub time: f64,
    #[serde(default)]
    pub heading: f64,
    #[serde(default)]
    pub rotational_velocity: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TrajectoryResult {
    pub total_time: f64,
    pub path_points: Vec<PathPoint>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ControlPoint {
    pub id: i64,
    pub u: f64,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub attributes: Vec<ControlPointAttribute>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ControlPointAttribute {
    Stop {
        #[serde(default = "default_zero")]
        duration: f64,
    },
    Rotate {
        #[serde(default = "default_zero")]
        heading: f64,
    },
    Command {
        #[serde(default = "default_false")]
        stopping: bool,
    },
    Loop {
        #[serde(default)]
        bounces: i64,
        #[serde(default)]
        target_loop_id: Option<i64>,
    },
    MotionLimits {
        #[serde(default = "default_zero")]
        velocity: f64,
        #[serde(default = "default_zero")]
        acceleration: f64,
    },
}