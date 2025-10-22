/**
 * Attribute components that can be added to control points (Unity-style).
 * Each attribute type has specific properties.
 */
export type ControlPointAttribute =
  | { type: 'stop'; duration: number }          // Stop for a duration (seconds)
  | { type: 'rotate'; heading: number }         // Set heading/rotation (degrees)
  | { type: 'command'; action: string }         // Execute a custom command/action
  | { type: 'loop'; bounces: number; targetLoopId: number | null }  // Loop back to a target point

/**
 * Represents a single control point along the spline with composable attributes.
 * Similar to Unity's component system, control points can have multiple attributes.
 */
export interface ControlPoint {
  /**
   * Unique identifier for this control point.
   */
  id: number;

  /**
   * Parameter value (u) along the entire spline (0 to 1).
   * Represents position along the complete path from start to end.
   */
  u: number;
                        
  /**
   * Optional label/name for the control point.
   */
  name: string;

  /**
   * Optional color theme for the control point.
   */
  color: 'blue' | 'red' | 'purple' | 'yellow' | 'cyan' | 'green' | 'orange';

  /**
   * Array of composable attributes defining the control point's behaviors.
   * Can be empty for a simple waypoint, or contain multiple components like Unity.
   * Each attribute type can only be added once (no duplicates).
   * Examples:
   * - [] → simple waypoint with no special behavior
   * - [{ type: 'stop', duration: 2 }] → stop for 2 seconds
   * - [{ type: 'rotate', heading: 90 }, { type: 'command', action: 'intake' }] → rotate and run command
   */
  attributes: ControlPointAttribute[];
}