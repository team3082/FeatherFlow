use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
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

#[derive(Clone, Debug, Default)]
pub struct PathPoint {
    pub x: f64,
    pub y: f64,
    pub s: f64,          // Cumulative distance (arc length)
    pub curvature: f64,
    pub velocity: f64,
    pub time: f64,
}
