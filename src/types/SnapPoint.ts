import { Vector2 } from "./Vector2";

export type SnapPointColor = 'blue' | 'red' | 'purple' | 'yellow' | 'cyan' | 'green' | 'orange';

/**
 * Represents a shared snap point on the field that paths can magnetically snap to.
 * Snap points are stored in the global project config and shared across all routines.
 */
export interface SnapPoint {
  /**
   * Unique identifier for the snap point
   */
  id: string;

  /**
   * Position on the field in inches
   */
  position: Vector2;

  /**
   * Display name for the snap point
   */
  name: string;

  /**
   * Visual color for the snap point
   */
  color?: SnapPointColor;

  /**
   * Whether this snap point is active for snapping
   */
  enabled: boolean;

  /**
   * Whether the position is locked from editing
   */
  locked: boolean;
}
