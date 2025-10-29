/* eslint-disable @typescript-eslint/no-namespace */
import { Vector2 } from "./Vector2";

/**
 * A standard cubic Bézier curve, defined by four control points.
 */
export interface BezierCurve  {
    p0: Vector2;
    p1: Vector2;
    p2: Vector2;
    p3: Vector2;
}

/**
 * Provides utility functions for working with cubic Bézier curves in 2D space.
 * 
 * Each curve is defined by four control points: `p0`, `p1`, `p2`, and `p3`.
 * 
 * This namespace supports:
 * - Evaluating a curve position at a parameter `t` (`evaluateAtT`)
 * - Splitting a curve into two sub-curves at a given `t` (`splitAtT`)
 * 
 * Example:
 * ```ts
 * const curve: BezierCurve = {
 *   p0: { x: 0, y: 0 },
 *   p1: { x: 1, y: 2 },
 *   p2: { x: 2, y: 2 },
 *   p3: { x: 3, y: 0 },
 * };
 * 
 * const point = BezierCurve.evaluateAtT(curve, 0.5);
 * const [left, right] = BezierCurve.splitAtT(curve, 0.5);
 * ```
 */
export namespace BezierCurve {

    /**
     * Evaluate a Bézier curve at parameter t.
     * Renamed from evaluate -> evaluateQuadraticBezier to be explicit.
     * @param curve The quadratic bezier curve
     * @param t Parameter in [0,1]
     */
    export function evaluateAtT(curve: BezierCurve, t: number): Vector2 {
        if (t < 0 || t > 1) {
            throw new RangeError(`t must be between 0 and 1 (inclusive). Received: ${t}`);
        }
        const { p0, p1, p2, p3 } = curve;
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

        return { x, y };
    }

    /**
     * Splits a Bézier curve at parameter t and returns the two sub-curves.
     * Keeps the same naming as requested: splitAt (parameter t).
     * Validates t and throws descriptive errors for invalid inputs.
     */
    export function splitAtT(curve: BezierCurve, t: number): [BezierCurve, BezierCurve] {
        if (t < 0 || t > 1) {
            throw new RangeError(`t must be between 0 and 1 (inclusive). Received: ${t}`);
        }

        const { p0, p1, p2, p3 } = curve;

        const p01 = Vector2.lerp(p0, p1, t);
        const p12 = Vector2.lerp(p1, p2, t);
        const p23 = Vector2.lerp(p2, p3, t);

        const p012 = Vector2.lerp(p01, p12, t);
        const p123 = Vector2.lerp(p12, p23, t);

        const p0123 = Vector2.lerp(p012, p123, t);

        const first: BezierCurve = { p0, p1: p01, p2: p012, p3: p0123 };
        const second: BezierCurve = { p0: p0123, p1: p123, p2: p23, p3 };

        return [first, second];
    }
}