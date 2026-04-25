import { Vector2 } from './Vector2';

/**
 * Top-level container for a compiled trajectory artifact.
 * Generated at save time and ready to load into WPILib without further math.
 */
export interface CompiledTrajectoryFile {
  formatVersion: number;
  sourceRoutineId: string;
  sourceRoutineName: string;
  generatedAtUtc: string;
  generatorVersion: string;
  coordinateFrame: CoordinateFrameMetadata;
  variants: CompiledVariants;
}

/**
 * Metadata about the coordinate frame used in this trajectory.
 */
export interface CoordinateFrameMetadata {
  units: string; // e.g., "meters"
  origin: string; // e.g., "bottomLeft"
  headingConvention: string; // e.g., "degrees_input_radians_output"
}

/**
 * Container for normal and flipped trajectory variants.
 */
export interface CompiledVariants {
  normal: CompiledTrajectoryVariant;
  flipped: CompiledTrajectoryVariant;
}

/**
 * A fully precomputed trajectory variant (either normal or flipped field coordinates).
 */
export interface CompiledTrajectoryVariant {
  totalTime: number;
  totalDistance: number;
  segments: CompiledSegment[];
  events: CompiledEvent[];
  metadata: VariantMetadata;
}

/**
 * A contiguous segment of the path between two split points (e.g., between stops).
 */
export interface CompiledSegment {
  segmentIndex: number;
  startT: number; // normalized path parameter [0, 1]
  endT: number; // normalized path parameter [0, 1]
  startTime: number; // cumulative seconds from trajectory start
  endTime: number; // cumulative seconds from trajectory start
  pathPoints: CompiledPathPoint[];
}

/**
 * A precomputed point on the trajectory with full kinematic state.
 */
export interface CompiledPathPoint {
  x: number; // position in units
  y: number; // position in units
  s: number; // cumulative arc-length distance
  curvature: number; // 1/radius of curvature
  velocity: Vector2; // units/sec in x,y
  acceleration: number; // units/sec²
  time: number; // cumulative seconds from trajectory start
  heading: number; // radians
  rotationalVelocity: number; // rad/sec
}

/**
 * An event (stop, command, rotate, motion limit) with precomputed absolute time.
 */
export interface CompiledEvent {
  type: 'stop' | 'command' | 'rotate' | 'motionLimits';
  t: number; // normalized path parameter [0, 1]
  time: number; // absolute cumulative time in trajectory
  payload: Record<string, any>; // type-specific data
}

/**
 * Metadata about the variant (sample count, split points).
 */
export interface VariantMetadata {
  sampleCount: number;
  splitTs: number[]; // normalized t values where path was split
}
