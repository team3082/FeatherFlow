import { AnchorPoint } from './AnchorPoint';
import { ControlPoint } from './ControlPoint';

/**
 * Represents an autonomous routine containing paths defined by anchor points and control points.
 * This is the core data structure for auto routines that can be saved, loaded, and executed.
 */
export interface AutoRoutine {
  /**
   * Unique identifier for this auto routine
   */
  id: string;

  /**
   * Human-readable name for the routine
   */
  name: string;

  /**
   * Optional description of what this routine does
   */
  description?: string;

  /**
   * Array of anchor points that define the spline path
   */
  anchorPoints: AnchorPoint[];

  /**
   * Array of control points that define behaviors along the path
   */
  controlPoints: ControlPoint[];

  /**
   * When this routine was first created
   */
  created: Date;

  /**
   * When this routine was last modified
   */
  lastModified: Date;

  /**
   * Format version of compiled artifact (if available)
   */
  compiledVersion?: number;

  /**
   * When compiled artifact was last generated
   */
  compiledAt?: Date;

  /**
   * Filename of compiled artifact
   */
  compiledFileName?: string;
}