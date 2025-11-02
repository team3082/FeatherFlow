use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Vector2 {
    pub x: f64,
    pub y: f64,
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


#[derive(Clone, Debug)]
pub struct PathPoint {
    x: f64,
    y: f64,
    s: f64,
    curvature: f64,
    velocity: f64,
    time: f64,
}
