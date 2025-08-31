# ecscd API リファレンス

## 概要

`ecscd`（ECS継続的デプロイメントツール）のREST API仕様書です。Next.js App Routerベースで構築されたAPIエンドポイントの詳細を記載しています。

## 認証

現在のバージョンでは認証機能は実装されていません。GitHub Personal Access TokenとAWS認証情報は環境変数で管理しています。

## ベースURL

```
http://localhost:3000
```

## Content-Type

すべてのリクエスト・レスポンスは `application/json` 形式です。

## エンドポイント一覧

### ヘルスチェック

#### アプリケーション状況確認

**エンドポイント**
```
GET /api/health
```

**説明**
アプリケーションとデータベースの状況を確認します。

**レスポンス**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**ステータスコード**
- `200` - 正常稼働中
- `500` - サービス異常

---

### アプリケーション管理

#### 全アプリケーション取得

**エンドポイント**
```
GET /api/apps
```

**説明**
登録されている全てのアプリケーションとその状態を取得します。

**レスポンス**
```json
{
  "applications": [
    {
      "metadata": {
        "name": "sample-app",
        "labels": {
          "app.kubernetes.io/name": "sample-app"
        }
      },
      "spec": {
        "name": "sample-app",
        "gitRepository": {
          "owner": "example",
          "repo": "sample-app",
          "branch": "main",
          "path": "task-definition.json"
        },
        "ecsCluster": "default-cluster",
        "ecsService": "sample-service",
        "taskDefinitionPath": "task-definition.json",
        "autoSync": false,
        "syncPolicy": {
          "automated": false,
          "selfHeal": false,
          "prune": false
        }
      },
      "status": {
        "health": "Healthy",
        "sync": {
          "status": "Synced",
          "revision": "abc123",
          "lastSyncedAt": "2024-01-01T00:00:00.000Z",
          "message": "Successfully synced"
        },
        "operationState": {
          "phase": "Succeeded",
          "message": "Deployment completed",
          "startedAt": "2024-01-01T00:00:00.000Z",
          "finishedAt": "2024-01-01T00:05:00.000Z"
        }
      }
    }
  ]
}
```

**ステータスコード**
- `200` - 成功
- `500` - サーバーエラー

---

#### アプリケーション作成

**エンドポイント**
```
POST /api/apps
```

**説明**
新しいアプリケーションを作成します。

**リクエストボディ**
```json
{
  "name": "my-app",
  "spec": {
    "source": {
      "repoURL": "https://github.com/owner/repo",
      "targetRevision": "main"
    },
    "taskDefinitionPath": "task-definition.json"
  },
  "metadata": {
    "name": "my-app",
    "labels": {
      "app.kubernetes.io/name": "my-app",
      "ecscd.io/cluster": "my-cluster",
      "ecscd.io/service": "my-service"
    }
  }
}
```

**パラメータ**
- `name` (string, required): アプリケーション名（一意、小文字・数字・ハイフンのみ）
- `spec.source.repoURL` (string, required): GitHubリポジトリURL
- `spec.source.targetRevision` (string, optional): ブランチ名（デフォルト: main）
- `spec.taskDefinitionPath` (string, required): タスクデフィニションファイルパス
- `metadata.labels["ecscd.io/cluster"]` (string, required): ECSクラスター名
- `metadata.labels["ecscd.io/service"]` (string, required): ECSサービス名

**レスポンス**
```json
{
  "application": {
    "metadata": {
      "name": "my-app",
      "labels": {
        "app.kubernetes.io/name": "my-app",
        "ecscd.io/cluster": "my-cluster",
        "ecscd.io/service": "my-service"
      }
    },
    "spec": {
      "name": "my-app",
      "gitRepository": {
        "owner": "owner",
        "repo": "repo",
        "branch": "main",
        "path": "task-definition.json"
      },
      "ecsCluster": "my-cluster",
      "ecsService": "my-service",
      "taskDefinitionPath": "task-definition.json",
      "autoSync": false,
      "syncPolicy": {
        "automated": false,
        "selfHeal": false,
        "prune": false
      }
    },
    "status": {
      "health": "Unknown",
      "sync": {
        "status": "OutOfSync",
        "revision": ""
      }
    }
  }
}
```

**ステータスコード**
- `201` - 作成成功
- `400` - リクエストパラメータエラー
- `409` - 同名のアプリケーションが既に存在
- `500` - サーバーエラー

---

#### アプリケーション更新

**エンドポイント**
```
PUT /api/apps/{app-name}
```

**説明**
既存のアプリケーション設定を更新します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**リクエストボディ**
```json
{
  "spec": {
    "source": {
      "repoURL": "https://github.com/owner/repo",
      "targetRevision": "main"
    },
    "taskDefinitionPath": "task-definition.json"
  },
  "metadata": {
    "labels": {
      "ecscd.io/cluster": "updated-cluster",
      "ecscd.io/service": "updated-service"
    }
  }
}
```

**レスポンス**
```json
{
  "message": "Application updated successfully"
}
```

**ステータスコード**
- `200` - 更新成功
- `400` - リクエストパラメータエラー
- `404` - アプリケーションが見つからない
- `500` - サーバーエラー

---

#### アプリケーション削除

**エンドポイント**
```
DELETE /api/apps?name={app-name}
```

**説明**
指定されたアプリケーションを削除します。関連するデプロイメント履歴も併せて削除されます。

**クエリパラメータ**
- `name` (string, required): アプリケーション名

**レスポンス**
```json
{
  "message": "Application deleted successfully"
}
```

**ステータスコード**
- `200` - 削除成功
- `400` - アプリケーション名が未指定
- `404` - アプリケーションが見つからない
- `500` - サーバーエラー

---

### 差分表示

#### タスクデフィニション差分取得

**エンドポイント**
```
GET /api/apps/{app-name}/diff
```

**説明**
現在のECSタスクデフィニションとGitHubリポジトリの目標設定の差分を表示します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**レスポンス**
```json
{
  "application": "my-app",
  "summary": "2 differences found",
  "diffs": [
    {
      "path": "containerDefinitions[0].image",
      "type": "modified",
      "currentValue": "nginx:1.20",
      "targetValue": "nginx:1.21",
      "message": "Container image version updated"
    },
    {
      "path": "containerDefinitions[0].environment[2]",
      "type": "added",
      "targetValue": {
        "name": "NEW_ENV_VAR",
        "value": "new_value"
      },
      "message": "New environment variable added"
    }
  ],
  "current": {
    "taskDefinition": { /* 現在のタスクデフィニション */ },
    "service": {
      "name": "my-service",
      "cluster": "my-cluster",
      "desiredCount": 2,
      "runningCount": 2
    }
  },
  "target": {
    "taskDefinition": { /* 目標のタスクデフィニション */ },
    "commit": {
      "sha": "abc123...",
      "message": "Update task definition"
    }
  },
  "syncStatus": "OutOfSync"
}
```

**ステータスコード**
- `200` - 成功
- `404` - アプリケーションが見つからない
- `500` - サーバーエラー

---

### デプロイメント管理

#### デプロイメント履歴取得

**エンドポイント**
```
GET /api/apps/{app-name}/deployments
```

**説明**
指定されたアプリケーションのデプロイメント履歴を取得します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**レスポンス**
```json
{
  "deployments": [
    {
      "id": "deployment-1234567890123",
      "status": "Successful",
      "message": "Deployment completed successfully",
      "startedAt": "2024-01-01T00:00:00.000Z",
      "finishedAt": "2024-01-01T00:05:00.000Z",
      "progress": {
        "current": 4,
        "total": 4,
        "message": "Deployment completed"
      },
      "taskDefinitionArn": "arn:aws:ecs:us-east-1:123456789012:task-definition/my-app:123",
      "revision": "123"
    }
  ]
}
```

**ステータスコード**
- `200` - 成功
- `404` - アプリケーションが見つからない
- `500` - サーバーエラー

---

#### 特定のデプロイメント状況取得

**エンドポイント**
```
GET /api/apps/{app-name}/deployments?id={deployment-id}
```

**説明**
特定のデプロイメントの詳細情報を取得します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**クエリパラメータ**
- `id` (string, required): デプロイメントID

**レスポンス**
```json
{
  "deployment": {
    "id": "deployment-1234567890123",
    "status": "InProgress",
    "message": "Updating ECS service...",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "progress": {
      "current": 3,
      "total": 4,
      "message": "Updating ECS service..."
    },
    "events": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "message": "Deployment initiated",
        "type": "info"
      },
      {
        "timestamp": "2024-01-01T00:01:00.000Z",
        "message": "Validating task definition...",
        "type": "info"
      },
      {
        "timestamp": "2024-01-01T00:02:00.000Z",
        "message": "Registering new task definition...",
        "type": "info"
      },
      {
        "timestamp": "2024-01-01T00:03:00.000Z",
        "message": "Updating ECS service...",
        "type": "info"
      }
    ]
  }
}
```

**ステータスコード**
- `200` - 成功
- `404` - デプロイメントが見つからない
- `500` - サーバーエラー

---

#### デプロイメント停止

**エンドポイント**
```
DELETE /api/apps/{app-name}/deployments?id={deployment-id}
```

**説明**
実行中のデプロイメントを停止します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**クエリパラメータ**
- `id` (string, required): デプロイメントID

**レスポンス**
```json
{
  "message": "Deployment stopped successfully"
}
```

**ステータスコード**
- `200` - 停止成功
- `400` - デプロイメントIDが未指定
- `404` - デプロイメントが見つからないか、停止不可能
- `500` - サーバーエラー

---

### 同期処理

#### 手動同期実行

**エンドポイント**
```
POST /api/apps/{app-name}/sync
```

**説明**
指定されたアプリケーションの手動同期を実行します。GitHubリポジトリから最新のタスクデフィニションを取得し、ECSサービスを更新します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**リクエストボディ**
```json
{
  "dryRun": false
}
```

**パラメータ**
- `dryRun` (boolean, optional): ドライラン実行フラグ（デフォルト: false）

**レスポンス（通常実行）**
```json
{
  "application": "my-app",
  "deploymentId": "deployment-1234567890123",
  "status": "InProgress",
  "message": "Deployment started successfully",
  "startedAt": "2024-01-01T00:00:00.000Z"
}
```

**レスポンス（ドライラン）**
```json
{
  "application": "my-app",
  "dryRun": true,
  "message": "Dry run completed successfully",
  "changes": "Would deploy new task definition and update service"
}
```

**ステータスコード**
- `200` - 同期開始成功
- `400` - タスクデフィニション形式エラー
- `404` - アプリケーションまたはファイルが見つからない
- `500` - サーバーエラー

---

#### 差分表示

**エンドポイント**
```
GET /api/apps/{app-name}/diff
```

**説明**
現在のECSタスクデフィニションとGitHubリポジトリの設定の差分を表示します。

**パスパラメータ**
- `app-name` (string, required): アプリケーション名

**レスポンス**
```json
{
  "application": "my-app",
  "differences": [
    {
      "path": "containerDefinitions[0].image",
      "type": "modified",
      "currentValue": "nginx:1.20",
      "targetValue": "nginx:1.21",
      "message": "Container image version updated"
    },
    {
      "path": "containerDefinitions[0].environment[0]",
      "type": "added",
      "targetValue": {
        "name": "NEW_ENV_VAR",
        "value": "new_value"
      },
      "message": "New environment variable added"
    }
  ],
  "summary": {
    "hasChanges": true,
    "totalChanges": 2,
    "changeTypes": {
      "added": 1,
      "modified": 1,
      "removed": 0
    }
  }
}
```

**差分タイプ**
- `added`: 新規追加
- `modified`: 変更
- `removed`: 削除

**ステータスコード**
- `200` - 成功
- `404` - アプリケーションが見つからない
- `500` - サーバーエラー

---

### Webhook

#### GitHubウェブフック

**エンドポイント**
```
POST /api/webhooks/github
```

**説明**
GitHubからのプッシュイベントを受信し、対象のアプリケーションの自動同期を実行します。

**ヘッダー**
- `X-GitHub-Event`: プッシュイベントの場合は `push`
- `X-Hub-Signature-256`: リクエストの署名（検証用）

**リクエストボディ（GitHub Push Event）**
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "owner/repo",
    "name": "repo",
    "owner": {
      "name": "owner"
    }
  },
  "head_commit": {
    "id": "abc123...",
    "message": "Update task definition",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**レスポンス**
```json
{
  "message": "Webhook processed successfully",
  "applications": [
    {
      "name": "my-app",
      "deploymentId": "deployment-1234567890123",
      "status": "triggered"
    }
  ]
}
```

**ステータスコード**
- `200` - 処理成功
- `400` - 無効なイベントタイプまたはリクエスト
- `500` - サーバーエラー

---

## エラーレスポンス

全てのエラーレスポンスは以下の形式で返されます：

```json
{
  "error": "エラーメッセージ"
}
```

### よくあるエラー

#### 400 Bad Request
```json
{
  "error": "Missing required fields"
}
```

#### 404 Not Found
```json
{
  "error": "Application not found"
}
```

#### 409 Conflict
```json
{
  "error": "Application with this name already exists"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to fetch applications"
}
```

## データ型定義

### Application
```typescript
interface Application {
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
  spec: {
    name: string;
    gitRepository: {
      owner: string;
      repo: string;
      branch?: string;
      path?: string;
    };
    ecsCluster: string;
    ecsService: string;
    taskDefinitionPath: string;
    autoSync?: boolean;
    syncPolicy?: {
      automated?: boolean;
      selfHeal?: boolean;
      prune?: boolean;
    };
  };
  status?: {
    health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown' | 'Error';
      revision: string;
      lastSyncedAt?: string;
      message?: string;
    };
    operationState?: {
      phase: 'Running' | 'Error' | 'Failed' | 'Succeeded' | 'Terminating';
      message?: string;
      startedAt?: string;
      finishedAt?: string;
    };
  };
}
```

### Deployment
```typescript
interface Deployment {
  id: string;
  status: 'InProgress' | 'Successful' | 'Failed' | 'Stopped';
  message: string;
  startedAt: string;
  finishedAt?: string;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  events: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'warning' | 'error';
  }>;
}
```

### TaskDefinitionDiff
```typescript
interface TaskDefinitionDiff {
  path: string;
  type: 'added' | 'removed' | 'modified';
  currentValue?: any;
  targetValue?: any;
  message?: string;
}
```

## 使用例

### cURLでのAPI呼び出し例

#### アプリケーション一覧取得
```bash
curl -X GET http://localhost:3000/api/apps
```

#### アプリケーション作成
```bash
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "spec": {
      "source": {
        "repoURL": "https://github.com/owner/repo",
        "targetRevision": "main"
      }
    },
    "metadata": {
      "labels": {
        "ecscd.io/cluster": "my-cluster",
        "ecscd.io/service": "my-service"
      }
    }
  }'
```

#### 同期実行
```bash
curl -X POST http://localhost:3000/api/apps/my-app/sync \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

#### デプロイメント状況確認
```bash
curl -X GET "http://localhost:3000/api/apps/my-app/deployments?id=deployment-1234567890123"
```

### JavaScriptでの使用例

```javascript
// アプリケーション一覧取得
const response = await fetch('/api/apps');
const data = await response.json();
console.log(data.applications);

// 新しいアプリケーション作成
const createResponse = await fetch('/api/apps', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'my-app',
    spec: {
      source: {
        repoURL: 'https://github.com/owner/repo',
        targetRevision: 'main'
      }
    },
    metadata: {
      labels: {
        'ecscd.io/cluster': 'my-cluster',
        'ecscd.io/service': 'my-service'
      }
    }
  })
});

// 同期実行
const syncResponse = await fetch('/api/apps/my-app/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ dryRun: false })
});
```