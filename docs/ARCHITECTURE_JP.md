# ecscd システムアーキテクチャ

## 概要

`ecscd`は、GitOpsの原則に基づいてAmazon ECSへの継続的デプロイメントを実現するNext.js製のWebアプリケーションです。ArgoCD風のユーザーインターフェースを提供し、GitHubリポジトリの変更をECSサービスに自動反映します。

## アーキテクチャ図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Repo   │    │  ECS Cluster    │    │   Database      │
│                 │    │                 │    │  (SQLite/       │
│ task-def.json   │    │ ┌─────────────┐ │    │   DynamoDB)     │
└─────────────────┘    │ │   Service   │ │    └─────────────────┘
         │              │ │             │ │             │
         │              │ └─────────────┘ │             │
         │              └─────────────────┘             │
         │                        │                     │
         │                        │                     │
    ┌────▼────────────────────────▼─────────────────────▼────┐
    │                                                        │
    │            ECS継続的デプロイメントツール                  │
    │                                                        │
    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
    │  │   Frontend   │ │   API Layer  │ │Service Layer │   │
    │  │   (Next.js)  │ │   (Next.js)  │ │              │   │
    │  │              │ │              │ │              │   │
    │  │ - Dashboard  │ │ - Apps API   │ │ - Deployment │   │
    │  │ - App Cards  │ │ - Deploy API │ │ - AWS        │   │
    │  │ - Diff View  │ │ - Sync API   │ │ - GitHub     │   │
    │  │              │ │ - Webhook    │ │ - Database   │   │
    │  └──────────────┘ └──────────────┘ └──────────────┘   │
    └────────────────────────────────────────────────────────┘
```

## レイヤー構成

### 1. プレゼンテーション層（Frontend）

#### 技術スタック
- **Next.js 15**: Reactベースのフルスタックフレームワーク
- **Tailwind CSS**: ユーティリティファーストのCSSフレームワーク
- **Lucide React**: アイコンライブラリ

#### 主要コンポーネント
```
src/
├── app/
│   ├── page.tsx                    # メインダッシュボード
│   ├── layout.tsx                  # レイアウトコンポーネント
│   └── globals.css                 # グローバルスタイル
├── components/
│   ├── application-card.tsx        # アプリケーションカード
│   ├── diff-viewer.tsx            # 差分表示コンポーネント
│   ├── deployment-progress.tsx    # デプロイメント進捗表示
│   ├── new-application-dialog.tsx # 新規アプリ作成ダイアログ
│   ├── edit-application-dialog.tsx # アプリ編集ダイアログ
│   └── ui/                        # 基本UIコンポーネント（shadcn/ui）
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── badge.tsx
```

#### 状態管理
- React Hooks（useState, useEffect）によるローカル状態管理
- リアルタイム更新にはPollingパターンを採用
- デプロイメント進捗の監視と表示

### 2. API層（Backend API）

#### 技術スタック
- **Next.js API Routes**: サーバーサイドAPI
- **TypeScript**: 静的型付け

#### APIエンドポイント
```
src/app/api/
├── health/
│   └── route.ts                 # GET /api/health - ヘルスチェック
├── apps/
│   ├── route.ts                 # GET, POST, DELETE /api/apps
│   └── [name]/
│       ├── route.ts             # PUT /api/apps/{name} - アプリ更新
│       ├── deployments/
│       │   └── route.ts         # GET /api/apps/{name}/deployments
│       ├── diff/
│       │   └── route.ts         # GET /api/apps/{name}/diff
│       ├── sync/
│       │   └── route.ts         # POST /api/apps/{name}/sync
│       └── sync-stream/
│           └── route.ts         # GET /api/apps/{name}/sync-stream
└── webhooks/
    └── github/
        └── route.ts             # POST /api/webhooks/github
```

#### API特徴
- **TypeScript完全対応**: 型安全なAPIレスポンス
- **Next.js App Router**: 最新のファイルベースルーティング
- **エラーハンドリング**: 統一されたエラーレスポンス形式
- **リアルタイム更新**: デプロイメント状況のポーリング対応

### 3. サービス層（Business Logic）

#### 主要サービス

**DeploymentService (`src/lib/deployment.ts`)**
```typescript
class DeploymentService {
  // 同期デプロイメント実行
  async executeDeploymentSync(deploymentId, applicationId, cluster, service, taskDef): Promise<DeploymentResult>
  
  // デプロイメント状況取得
  async getDeploymentStatus(deploymentId): Promise<DeploymentStatus>
  
  // デプロイメントイベント記録
  async recordEvent(deploymentId, message, type): Promise<void>
}
```

**AWSService (`src/lib/aws.ts`)**
```typescript
class AWSService {
  // ECSサービス情報取得
  async getService(cluster, service): Promise<ECSService | null>
  
  // タスクデフィニション取得
  async getTaskDefinition(taskDefArn): Promise<ECSTaskDefinition | null>
  
  // タスクデフィニション登録
  async registerTaskDefinition(taskDefinition): Promise<string>
  
  // ECSサービス更新
  async updateService(cluster, service, taskDefinitionArn): Promise<void>
  
  // デプロイメント情報取得
  async getDeploymentInfo(cluster, service): Promise<DeploymentInfo[]>
}
```

**GitHubService (`src/lib/github.ts`)**
```typescript
class GitHubService {
  // ファイル内容取得
  async getFileContent(owner, repo, path, branch): Promise<string | null>
  
  // 最新コミット情報取得
  async getLatestCommit(owner, repo, branch): Promise<CommitInfo>
  
  // Webhook検証
  async verifyWebhookSignature(payload, signature): Promise<boolean>
}
```

**DiffService (`src/lib/diff.ts`)**
```typescript
class DiffService {
  // タスクデフィニション差分計算
  static compareTaskDefinitions(current, target): TaskDefinitionDiff[]
  
  // 差分サマリー生成
  static generateDiffSummary(diffs): string
  
  // 深度優先探索による差分検出
  private static deepCompare(obj1, obj2, path): TaskDefinitionDiff[]
}
```

### 4. データアクセス層（Database Layer）

#### データベース設計

**抽象化レイヤー (`src/lib/database/base.ts`)**
```typescript
interface DatabaseRepository {
  // アプリケーション操作
  createApplication(app): Promise<DatabaseApplication>
  getApplication(id): Promise<DatabaseApplication | null>
  getApplicationByName(name): Promise<DatabaseApplication | null>
  getAllApplications(): Promise<DatabaseApplication[]>
  updateApplication(id, updates): Promise<DatabaseApplication | null>
  deleteApplication(id): Promise<boolean>
  
  // デプロイメント操作
  createDeployment(deployment): Promise<DatabaseDeployment>
  getDeploymentsByApplication(appId): Promise<DatabaseDeployment[]>
  updateDeployment(id, updates): Promise<DatabaseDeployment | null>
  
  // 同期ステータス操作
  createOrUpdateSyncStatus(status): Promise<DatabaseSyncStatus>
  getSyncStatus(applicationId): Promise<DatabaseSyncStatus | null>
  
  // アプリケーションステータス操作
  createOrUpdateApplicationStatus(status): Promise<DatabaseApplicationStatus>
  getApplicationStatus(applicationId): Promise<DatabaseApplicationStatus | null>
  
  // ユーティリティ
  healthCheck(): Promise<boolean>
  close(): Promise<void>
}
```

**Factory Pattern (`src/lib/database/factory.ts`)**
```typescript
class DatabaseFactory {
  static getInstance(config?: DatabaseConfig): DatabaseRepository
  static create(config: DatabaseConfig): DatabaseRepository
}
```

**実装**
- **SQLiteRepository (`src/lib/database/sqlite.ts`)**: ローカル開発・小規模運用向け
- **DynamoDBRepository (`src/lib/database/dynamodb.ts`)**: 本番環境・スケール対応

#### データモデル

**SQLiteテーブル設計**
```sql
-- アプリケーション
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    git_owner TEXT NOT NULL,
    git_repo TEXT NOT NULL,
    git_branch TEXT,
    git_path TEXT,
    git_token TEXT,
    ecs_cluster TEXT NOT NULL,
    ecs_service TEXT NOT NULL,
    task_definition_path TEXT NOT NULL,
    auto_sync BOOLEAN DEFAULT FALSE,
    sync_policy_automated BOOLEAN DEFAULT FALSE,
    sync_policy_self_heal BOOLEAN DEFAULT FALSE,
    sync_policy_prune BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- デプロイメント
CREATE TABLE deployments (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    progress_current INTEGER NOT NULL,
    progress_total INTEGER NOT NULL,
    progress_message TEXT NOT NULL,
    task_definition_arn TEXT,
    revision TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- デプロイメントイベント
CREATE TABLE deployment_events (
    id TEXT PRIMARY KEY,
    deployment_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
);

-- 同期ステータス
CREATE TABLE sync_status (
    id TEXT PRIMARY KEY,
    application_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    revision TEXT NOT NULL,
    last_synced_at DATETIME,
    message TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- アプリケーションステータス
CREATE TABLE application_status (
    id TEXT PRIMARY KEY,
    application_id TEXT UNIQUE NOT NULL,
    health TEXT NOT NULL,
    operation_phase TEXT,
    operation_message TEXT,
    operation_started_at DATETIME,
    operation_finished_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
```

**DynamoDBテーブル設計**
```
Primary Key: pk (Partition Key), sk (Sort Key)

データパターン:
- アプリケーション: pk=APP#{id}, sk=APP#{id}
- デプロイメント: pk=APP#{appId}, sk=DEPLOY#{deployId}
- デプロイメントイベント: pk=DEPLOY#{deployId}, sk=EVENT#{eventId}
- 同期ステータス: pk=APP#{appId}, sk=SYNC#{statusId}
- アプリケーションステータス: pk=APP#{appId}, sk=STATUS#{statusId}

GSI（Global Secondary Index）:
- アプリケーション名でのクエリ用
- デプロイメント状況でのフィルタリング用
```

## データフロー

### 1. アプリケーション作成フロー
```
1. ユーザーがNew Application Dialogでフォーム入力
2. POST /api/apps でアプリケーション作成リクエスト
3. リポジトリURL解析とバリデーション
4. DatabaseRepository.createApplication() でアプリケーション保存
5. DatabaseRepository.createOrUpdateSyncStatus() で初期同期ステータス作成
6. DatabaseRepository.createOrUpdateApplicationStatus() で初期ヘルスステータス作成
7. 作成されたアプリケーション情報をレスポンス
8. フロントエンドでアプリケーション一覧を更新
```

### 2. 差分確認フロー
```
1. GET /api/apps/{name}/diff でリクエスト
2. AWSService.getService() で現在のECSサービス情報取得
3. AWSService.getTaskDefinition() で現在のタスクデフィニション取得
4. GitHubService.getFileContent() で目標のタスクデフィニション取得
5. DiffService.compareTaskDefinitions() で差分計算
6. DiffService.generateDiffSummary() で差分サマリー生成
7. 差分情報をレスポンス
8. フロントエンドのDiff Viewerに表示
```

### 3. デプロイメント（同期）フロー
```
1. POST /api/apps/{name}/sync でトリガー
2. データベースからアプリケーション設定取得
3. GitHubService.getFileContent() で目標のタスクデフィニション取得
4. DeploymentService.executeDeploymentSync() で同期実行開始
5. DatabaseRepository.createDeployment() でデプロイメント記録作成
6. AWSService.registerTaskDefinition() でタスクデフィニション登録
7. AWSService.updateService() でECSサービス更新
8. デプロイメント完了まで監視
9. DatabaseRepository.createOrUpdateSyncStatus() で同期ステータス更新
10. デプロイメント結果をレスポンス
11. フロントエンドでステータス更新
```

### 4. リアルタイム状況監視フロー
```
1. GET /api/apps でアプリケーション一覧取得
2. 各アプリケーションに対して現在のECS状況を並行取得
3. DatabaseRepository.getSyncStatus() でDB上の同期ステータス取得
4. AWSService.getService() で最新のECS情報取得
5. DiffService.compareTaskDefinitions() で現在の同期状況判定
6. 必要に応じてデータベースの同期ステータス更新
7. アプリケーション一覧を統合された状況でレスポンス
8. フロントエンドで定期的なポーリング更新
```

### 5. GitHub Webhookフロー
```
1. POST /api/webhooks/github でWebhook受信
2. GitHubService.verifyWebhookSignature() で署名検証
3. プッシュされたリポジトリに該当するアプリケーション検索
4. 自動同期が有効な場合、同期処理をトリガー
5. イベントログ記録
6. レスポンス返却
```

## セキュリティアーキテクチャ

### 認証・認可
- GitHub Personal Access Token による認証
- AWS IAM による ECS リソースアクセス制御
- 環境変数による機密情報管理

### データ保護
- データベース接続の暗号化
- API通信のHTTPS強制
- 入力値検証とサニタイゼーション

## 可用性・拡張性

### 可用性
- データベースレプリケーション（DynamoDB使用時）
- ヘルスチェックエンドポイント
- エラーハンドリングとリトライ機構

### 拡張性
- 水平スケーリング対応（ステートレス設計）
- データベース分離による独立性
- マイクロサービス分割の準備

## 監視・運用

### ログ出力
```typescript
// 構造化ログ出力例
console.log({
  level: 'info',
  message: 'Deployment started',
  deploymentId: 'deploy-123',
  applicationId: 'app-456',
  timestamp: new Date().toISOString()
});
```

### メトリクス
- デプロイメント成功率
- デプロイメント時間
- エラー発生率
- レスポンス時間

### アラート
- デプロイメント失敗
- データベース接続エラー
- AWS API エラー

## 技術的制約・前提

### 制約
- Node.js 18以降が必要
- AWS ECS環境が必要
- GitHub リポジトリアクセスが必要

### 前提
- タスクデフィニションはJSON形式
- 1つのリポジトリに1つのアプリケーション
- ECSサービスは事前に作成済み

## 今後の拡張計画

### 短期
- マルチリージョン対応
- ロールベースアクセス制御
- Slack/Teams通知

### 中期
- Kubernetes対応
- Blue/Greenデプロイメント
- カナリアデプロイメント

### 長期
- マルチクラウド対応
- AIベースの異常検知
- 自動ロールバック機能