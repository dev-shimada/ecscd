import { ApplicationDomain } from "../domain/application";

/**
 * 同期ステータスに応じたバッジの色を取得
 */
export function getSyncStatusColor(status: string) {
  switch (status) {
    case "InSync":
      return "success";
    case "OutOfSync":
      return "warning";
    case "Error":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * サービスステータスに応じたバッジの色を取得
 */
export function getServiceStatusColor(status: string) {
  switch (status) {
    case "Active":
      return "success";
    default:
      return "secondary";
  }
}

/**
 * デプロイメントステータスに応じたバッジの色を取得
 */
export function getDeploymentStatusColor(status: string) {
  switch (status) {
    case "PRIMARY":
      return "success";
    case "ACTIVE":
      return "success";
    case "PENDING":
    case "RUNNING":
      return "warning";
    case "DRAINING":
      return "warning";
    case "INACTIVE":
    case "STOPPED":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * ロールアウト状態に応じたバッジの色を取得
 */
export function getRolloutStateColor(rolloutState: string) {
  switch (rolloutState) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "FAILED":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * 最終同期時刻を相対的な時間表現にフォーマット
 */
export function formatLastSyncTime(date?: Date): string {
  if (!date) return "Never";

  const now = new Date();
  const dateObj = date instanceof Date ? date : new Date(date);
  const diff = now.getTime() - dateObj.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/**
 * タスク定義ARNからリビジョン番号を抽出
 */
export function extractRevisionFromArn(revision?: string): string | null {
  if (!revision) return null;

  // タスク定義ARNの場合、リビジョン番号を抽出
  if (revision.includes(":task-definition/")) {
    const parts = revision.split(":");
    const familyAndRevision = parts[parts.length - 1]; // e.g., "my-task:123"
    const revisionPart = familyAndRevision.split(":")[1]; // e.g., "123"
    return revisionPart || familyAndRevision;
  }

  // "deployment-"で始まる場合、最初の8文字を表示
  if (revision.startsWith("deployment-")) {
    return revision.substring(0, 8);
  }

  // その他の場合、最初の8文字を表示
  return revision.substring(0, 8);
}

/**
 * ECSコンソールのURLを生成
 */
export function getEcsConsoleUrl(application: ApplicationDomain): string {
  const region = application.awsConfig.region || "us-east-1";
  const cluster = application.ecsConfig.cluster;
  const service = application.ecsConfig.service;
  return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${encodeURIComponent(
    cluster
  )}/services/${encodeURIComponent(service)}/deployments?region=${region}`;
}
