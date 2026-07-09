export interface TaskDefinitionSpec {
  family?: string;
  taskRoleArn?: string;
  executionRoleArn?: string;
  networkMode?: string;
  cpu?: string;
  memory?: string;
  requiresCompatibilities?: string[];
  containerDefinitions?: Record<string, unknown>[];
  volumes?: Record<string, unknown>[];
  placementConstraints?: Record<string, unknown>[];
  runtimePlatform?: Record<string, unknown>;
  tags?: Record<string, unknown>[];
  pidMode?: string;
  ipcMode?: string;
  ephemeralStorage?: Record<string, unknown>;
  proxyConfiguration?: Record<string, unknown>;
  inferenceAccelerators?: Record<string, unknown>[];
  [key: string]: unknown;
}
