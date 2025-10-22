import { Vector2 } from "./Vector2";

/**
 * Represents an anchor point on a spline, which may include handles
 * to define curved segments. Handles can be aligned or mirrored for continuous curves.
 */
export interface AnchorPoint {
  /**
   * Field position of the anchor point 
   */
  position: Vector2;

  /** 
   * Offset vector from position to incoming handle 
   */
  handleInOffset: Vector2;

  /** 
   * Offset vector from position to outgoing handle 
   */
  handleOutOffset: Vector2;

  /**
   * Whether this anchor creates curved segments
   */
  isCurved: boolean;

  /** 
   * Whether handles remain aligned (continuous tangent) 
   */
  handlesAligned: boolean;

  /** 
   * Optional label/name 
   */
  name: string;
  }
