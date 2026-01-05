import { Vector2 } from "./Vector2";

export interface PathPoint {
  x: number;
  y: number;
  s: number;
  curvature: number;
  velocity: Vector2;
  time: number;
}

export interface TrajectoryResult {
  totalTime: number;
  pathPoints: PathPoint[];
}