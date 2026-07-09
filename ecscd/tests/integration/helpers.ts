import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  CreateClusterCommand,
  CreateServiceCommand,
  ListClustersCommand,
  ECSClient,
} from "@aws-sdk/client-ecs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { ApplicationDomain } from "../../src/lib/domain/application";

export const ENDPOINT = process.env.AWS_ENDPOINT_URL!;
// ECS だけ ecs-sim (実際の ECS のような非同期ロールアウトを再現する) に向ける。
// 本番コードは AWS_ENDPOINT_URL_ECS を SDK が自動的に読むため未指定でも動くが、
// テストのセットアップ用 raw クライアントは明示的に指定する。
export const ECS_ENDPOINT =
  process.env.AWS_ENDPOINT_URL_ECS || process.env.AWS_ENDPOINT_URL!;
export const REGION = process.env.AWS_REGION || "us-east-1";

// テスト間・デモ環境との衝突を避けるため、リソース名は毎回ユニークにする
// (ministack のリセットは不要になり、動作確認用スタックと同居できる)。
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ministack が受け付け可能になるまで待つ (compose の init と同じ判定)
export async function waitForMinistack(timeoutMs = 60_000): Promise<void> {
  const sts = new STSClient({ region: REGION, endpoint: ENDPOINT });
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await sts.send(new GetCallerIdentityCommand({}));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(
    `ministack (${ENDPOINT}) not reachable: ${
      lastError instanceof Error ? lastError.message : lastError
    }`
  );
}

// ecs-sim が受け付け可能になるまで待つ (compose の init と同じ判定)
export async function waitForEcsSim(timeoutMs = 60_000): Promise<void> {
  const ecs = rawEcsClient();
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await ecs.send(new ListClustersCommand({}));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(
    `ecs-sim (${ECS_ENDPOINT}) not reachable: ${
      lastError instanceof Error ? lastError.message : lastError
    }`
  );
}

// テストのセットアップ用 raw クライアント。テスト対象のプロダクションコードは
// endpoint を明示せず環境変数 AWS_ENDPOINT_URL 経由で解決するのに対し、こちらは
// 明示指定してセットアップ自体の失敗要因を切り分ける。
export function rawDynamoDbClient(): DynamoDBClient {
  return new DynamoDBClient({ region: REGION, endpoint: ENDPOINT });
}

export function rawEcsClient(): ECSClient {
  return new ECSClient({ region: REGION, endpoint: ECS_ENDPOINT });
}

export async function createApplicationsTable(
  client: DynamoDBClient,
  tableName: string
): Promise<void> {
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: "name", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "name", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const described = await client.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    if (described.Table?.TableStatus === "ACTIVE") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`table ${tableName} did not become ACTIVE`);
}

export async function createClusterAndService(
  client: ECSClient,
  cluster: string,
  service: string,
  taskDefinitionArn: string
): Promise<void> {
  await client.send(new CreateClusterCommand({ clusterName: cluster }));
  await client.send(
    new CreateServiceCommand({
      cluster,
      serviceName: service,
      taskDefinition: taskDefinitionArn,
      desiredCount: 1,
    })
  );
}

export function buildApplication(overrides: {
  name: string;
  cluster: string;
  service: string;
  repo?: string;
  branch?: string;
  path?: string;
}): ApplicationDomain {
  const now = new Date();
  return {
    name: overrides.name,
    gitConfig: {
      repo: overrides.repo ?? "https://github.com/demo/app",
      branch: overrides.branch ?? "main",
      path: overrides.path ?? "task-definition.json",
    },
    ecsConfig: {
      cluster: overrides.cluster,
      service: overrides.service,
    },
    // roleArn を空にすると STS AssumeRole を経由せず環境変数の認証情報が使われる
    awsConfig: { region: REGION, roleArn: "", externalId: "integration-test" },
    createdAt: now,
    updatedAt: now,
  };
}

// DescribeTaskDefinition はサーバ側デフォルト (タスクレベル cpu/memory、空文字の
// taskRoleArn 等、コンテナレベル cpu: 0) を補完して返すため、Git 側 (=target) が
// それらを省略していると幻の "Removed" diff が出て OutOfSync になる。
// テストでは両辺を一致させるためデフォルト値まで明示した完全形を使う。
// (実 AWS でもコンテナ cpu: 0 などは補完されるため、この挙動は本番でも起こり得る)
export const BASE_TASK_DEFINITION = {
  family: "integration-demo",
  networkMode: "bridge",
  requiresCompatibilities: ["EC2"],
  taskRoleArn: "",
  executionRoleArn: "",
  cpu: "256",
  memory: "512",
  pidMode: "",
  ipcMode: "",
  containerDefinitions: [
    {
      name: "app",
      image: "busybox:latest",
      command: ["sleep", "3600"],
      cpu: 0,
      memory: 64,
      essential: true,
    },
  ],
};
