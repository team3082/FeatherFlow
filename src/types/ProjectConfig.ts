import { SnapPoint } from "./SnapPoint";

export interface MotionSettings {
  /**
   * Maximum translational speed (units/sec)
   */
  maxTranslationalVelocity: number;

  /**
   * Maximum rotational speed (rad/sec)
   */
  maxRotationalVelocity: number;

  /**
   * Maximum wheel speed (units/sec)
   */
  maxWheelSpeed: number;

  /**
   * Maximum linear acceleration (units/sec^2)
   */
  maxAcceleration: number;

  /**
   * Maximum lateral acceleration (units/sec^2)
   */
  maxLateralAcceleration: number;

  /**
   * Distance from robot center to wheel (units)
   */
  swerveRadius: number;
}

/**
 * Global project configuration file structure
 * Stored at: {projectPath}/src/main/deploy/FeatherFlow/config.json
 */
export interface ProjectConfig {
  /**
   * Array of snap points shared across all routines in the project
   */
  snapPoints: SnapPoint[];

  /**
   * Global snap settings
   */
  snapSettings?: {
    /**
     * Whether snapping is globally enabled
     */
    enabled: boolean;

    /**
     * Snap radius in inches (default: 6)
     */
    radius: number;
  };

  /**
   * Global motion limits used by trajectory preview and compile.
   */
  motionSettings?: MotionSettings;
}

/**
 * Default project configuration
 */
export const defaultProjectConfig: ProjectConfig = {
  snapPoints: [],
  snapSettings: {
    enabled: true,
    radius: 6
  },
  motionSettings: {
    maxTranslationalVelocity: 170,
    maxRotationalVelocity: 5,
    maxWheelSpeed: 170,
    maxAcceleration: 170,
    maxLateralAcceleration: 170,
    swerveRadius: 14
  }
};

export const defaultMotionSettings: MotionSettings = {
  maxTranslationalVelocity: 170,
  maxRotationalVelocity: 5,
  maxWheelSpeed: 170,
  maxAcceleration: 170,
  maxLateralAcceleration: 170,
  swerveRadius: 14,
};
