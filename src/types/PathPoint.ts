import { Vector2 } from "./Vector2";

export interface PathPoint {
  x: number;
  y: number;
  s: number;
  curvature: number;
  velocity: Vector2;
  time: number;
  acceleration?: number;
  heading?: number;
  rotationalVelocity?: number;
}

export interface TrajectoryResult {
  totalTime: number;
  pathPoints: PathPoint[];
}