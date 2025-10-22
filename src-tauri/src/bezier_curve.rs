use crate::vector2::Vector2;

#[derive(Debug, Clone)]
pub struct BezierCurve {
    pub p0: Vector2,
    pub p1: Vector2,
    pub p2: Vector2,
    pub p3: Vector2,
}

impl BezierCurve {
    pub fn new(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2) -> Self {
        Self { p0, p1, p2, p3 }
    }

    /// Evaluates the Bézier curve at a given parameter t (0..=1)
    pub fn evaluate(&self, t: f64) -> Vector2 {
        let u = 1.0 - t;
        let tt = t * t;
        let uu = u * u;
        let uuu = uu * u;
        let ttt = tt * t;

        let x = uuu * self.p0.x
              + 3.0 * uu * t * self.p1.x
              + 3.0 * u * tt * self.p2.x
              + ttt * self.p3.x;
        let y = uuu * self.p0.y
              + 3.0 * uu * t * self.p1.y
              + 3.0 * u * tt * self.p2.y
              + ttt * self.p3.y;

        Vector2::new(x, y)
    }

    /// Splits the Bézier curve into two curves at parameter t
    pub fn split_at(&self, t: f64) -> (BezierCurve, BezierCurve) {
        let p01 = Vector2::lerp(self.p0, self.p1, t);
        let p12 = Vector2::lerp(self.p1, self.p2, t);
        let p23 = Vector2::lerp(self.p2, self.p3, t);

        let p012 = Vector2::lerp(p01, p12, t);
        let p123 = Vector2::lerp(p12, p23, t);

        let p0123 = Vector2::lerp(p012, p123, t);

        let first = BezierCurve::new(self.p0, p01, p012, p0123);
        let second = BezierCurve::new(p0123, p123, p23, self.p3);

        (first, second)
    }
}
