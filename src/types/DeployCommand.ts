/**
 * Parameter metadata for a command exposed from a deploy manifest.
 */
export interface DeployCommandParameter {
  name: string;
  type: string;
}

/**
 * Command metadata parsed from a JSON manifest in src/main/deploy.
 */
export interface DeployCommandDefinition {
  name: string;
  parameters: DeployCommandParameter[];
  sourceFile?: string;
}
