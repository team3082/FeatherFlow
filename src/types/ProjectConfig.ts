import { SnapPoint } from "./SnapPoint";

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
}

/**
 * Default project configuration
 */
export const defaultProjectConfig: ProjectConfig = {
  snapPoints: [],
  snapSettings: {
    enabled: true,
    radius: 6
  }
};
