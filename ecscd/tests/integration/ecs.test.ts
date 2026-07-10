/**
 * AWS (ECS) インフラ実装を ecs-sim の ECS API に対して検証する統合テスト。
 * registerTaskDefinition → describeTaskDefinition の正規化 (AWS 付与フィールドの除去)、
 * describeServices / updateService の一連の流れを本物の API 呼び出しで確認する。
 */
import { describe, beforeAll, expect, it } from "@jest/globals";
import { AWS } from "../../src/lib/infrastructure/aws";
import { TaskDefinitionSpec } from "../../src/lib/domain/task-definition";
import {
  BASE_TASK_DEFINITION,
  REGION,
  createClusterAndService,
  rawEcsClient,
  uniqueName,
  waitForEcsSim,
  waitForMinistack,
} from "./helpers";

const awsConfig = { region: REGION, roleArn: "", externalId: "integration-test" };

describe("AWS(ECS) repository (ecs-sim)", () => {
  const aws = new AWS();
  const family = uniqueName("td");
  const cluster = uniqueName("cluster");
  const service = uniqueName("service");
  let initialArn: string;

  const spec = (extraEnv?: { name: string; value: string }): TaskDefinitionSpec =>
    ({
      ...BASE_TASK_DEFINITION,
      family,
      containerDefinitions: [
        {
          ...BASE_TASK_DEFINITION.containerDefinitions[0],
          ...(extraEnv ? { environment: [extraEnv] } : {}),
        },
      ],
    }) as TaskDefinitionSpec;

  beforeAll(async () => {
    await waitForMinistack();
    await waitForEcsSim();
    initialArn = await aws.registerTaskDefinition(awsConfig, spec());
    await createClusterAndService(rawEcsClient(), cluster, service, initialArn);
  });

  it("registerTaskDefinition returns a task definition ARN", () => {
    expect(initialArn).toMatch(/^arn:aws:ecs:/);
    expect(initialArn).toContain(family);
  });

  it("describeTaskDefinition returns the normalized spec (AWS-generated fields stripped)", async () => {
    const described = await aws.describeTaskDefinition(awsConfig, initialArn);

    expect(described).toBeDefined();
    expect(described?.family).toBe(family);

    const containers = described?.containerDefinitions as
      | Array<Record<string, unknown>>
      | undefined;
    expect(containers?.[0]?.image).toBe("busybox:latest");

    // task-definition-normalizer が AWS 付与フィールドを剥がしていること
    // (剥がれていないと compareTaskDefinitions が常に OutOfSync になる)
    expect(described).not.toHaveProperty("taskDefinitionArn");
    expect(described).not.toHaveProperty("revision");
    expect(described).not.toHaveProperty("status");
    expect(described).not.toHaveProperty("registeredAt");
  });

  it("describeServices returns the service with its current task definition", async () => {
    const described = await aws.describeServices(awsConfig, {
      cluster,
      service,
    });

    expect(described).toBeDefined();
    expect(described?.taskDefinition).toBe(initialArn);
    expect(described?.status).toBe("ACTIVE");
  });

  it("updateService points the service at a new revision", async () => {
    const nextArn = await aws.registerTaskDefinition(
      awsConfig,
      spec({ name: "DEPLOYED_FROM", value: "integration-test" })
    );
    expect(nextArn).not.toBe(initialArn);

    await aws.updateService(awsConfig, { cluster, service }, nextArn);

    const described = await aws.describeServices(awsConfig, {
      cluster,
      service,
    });
    expect(described?.taskDefinition).toBe(nextArn);
  });

  it("describeServices returns undefined for a missing service", async () => {
    const described = await aws.describeServices(awsConfig, {
      cluster,
      service: "no-such-service",
    });
    expect(described).toBeUndefined();
  });
});
