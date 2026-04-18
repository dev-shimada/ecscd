import { TaskDefinitionSpec } from "../domain/task-definition";

const AWS_GENERATED_TASK_DEFINITION_FIELDS = [
  "revision",
  "taskDefinitionArn",
  "registeredAt",
  "registeredBy",
  "status",
  "requiresAttributes",
  "compatibilities",
] as const;

export function toTaskDefinitionSpec(
  taskDefinition: Record<string, unknown>,
): TaskDefinitionSpec {
  const spec: Record<string, unknown> = { ...taskDefinition };

  for (const field of AWS_GENERATED_TASK_DEFINITION_FIELDS) {
    delete spec[field];
  }

  return spec as TaskDefinitionSpec;
}
