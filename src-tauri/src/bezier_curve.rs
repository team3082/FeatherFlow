use crate::types::Vector2;

#[derive(Debug, Clone, Copy)]
pub struct BezierCurve {
    p0: Vector2,
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
}

impl BezierCurve {
    pub fn new(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2) -> Self {
        Self { p0, p1, p2, p3 }
    }

    // Position on the curve at parameter t
    pub fn position(&self, t: f64) -> Vector2 {
        let t_inv = 1.0 - t;
        let t_inv_sq = t_inv * t_inv;
        let t_sq = t * t;

        self.p0 * (t_inv_sq * t_inv)
            + self.p1 * (3.0 * t_inv_sq * t)
            + self.p2 * (3.0 * t_inv * t_sq)
            + self.p3 * (t_sq * t)
    }

    // First derivative (velocity vector) at parameter t
    pub fn derivative(&self, t: f64) -> Vector2 {
        let t_inv = 1.0 - t;
        (self.p1 - self.p0) * (3.0 * t_inv * t_inv)
            + (self.p2 - self.p1) * (6.0 * t_inv * t)
            + (self.p3 - self.p2) * (3.0 * t * t)
    }

    // Second derivative (acceleration vector) at parameter t
    pub fn second_derivative(&self, t: f64) -> Vector2 {
        (self.p2 - self.p1 * 2.0 + self.p0) * (6.0 * (1.0 - t))
            + (self.p3 - self.p2 * 2.0 + self.p1) * (6.0 * t)
    }

    // Curvature at parameter t
    pub fn curvature(&self, t: f64) -> f64 {
        let d = self.derivative(t);
        let dd = self.second_derivative(t);
        let numerator = d.x * dd.y - d.y * dd.x;
        let denominator = d.magnitude().powi(3);

        if denominator.abs() < 1e-9 {
            0.0 // Avoid division by zero for straight lines or zero-velocity points
        } else {
            numerator / denominator
        }
    }
}
