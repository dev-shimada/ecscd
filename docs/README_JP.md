# ecscd - ECS継続的デプロイメントツール

`ecscd`は、Amazon ECS（Elastic Container Service）のタスクデフィニションをGitHubリポジトリから自動的にデプロイするための Next.js ベースのWebアプリケーションです。ArgoCD風の直感的なUIを提供し、GitOpsワークフローを実現します。

## 🚀 主な機能

- **GitOpsワークフロー**: GitHubリポジトリの変更に基づいた自動デプロイメント
- **リアルタイム監視**: デプロイメントの進捗とステータスをリアルタイムで追跡
- **差分表示**: 現在のECSタスクデフィニションと目標設定の詳細比較
- **デプロイメント履歴**: 過去のデプロイメント情報を保存・閲覧
- **データベース対応**: SQLiteとDynamoDBの両方をサポート
- **Webhook対応**: GitHubからの自動トリガー（プッシュ時の自動デプロイ）
- **ヘルスチェック**: アプリケーションとデプロイメント状況の監視

## 🏗️ アーキテクチャ

### フロントエンド層
- **Next.js 15**: React ベースのフルスタックフレームワーク
- **Tailwind CSS**: ユーティリティファーストCSSフレームワーク 
- **Lucide React**: モダンなアイコン
- **TypeScript**: 型安全性を提供

### API層（Next.js App Router）
- **REST API**: `/api/apps`, `/api/apps/{name}/diff`, `/api/apps/{name}/sync` など
- **アプリケーション管理**: CRUD操作とリアルタイム状況更新
- **デプロイメント管理**: 同期処理の実行と進捗追跡
- **差分計算**: 現在と目標のタスクデフィニション比較

### サービス層
- **DeploymentService**: ECSデプロイメントの実行と状況管理
- **AWSService**: ECS操作（サービス、タスクデフィニション、クラスター）
- **GitHubService**: リポジトリからのファイル取得とコミット情報
- **DiffService**: タスクデフィニションの差分計算

### データベース層
- **Factory Pattern**: データベースタイプに応じた実装の切り替え
- **SQLite**: ローカル開発・小規模環境向けの軽量データベース
- **DynamoDB**: 本番環境・スケーラブルな運用向けのNoSQLデータベース

## 📦 インストールとセットアップ

### 前提条件
- **Node.js 18以降**: Next.js 15の要件
- **AWS CLI設定済み**: ECS操作権限を持つIAMユーザーまたはロール
- **GitHub Personal Access Token**: リポジトリ読み取り用

### 1. プロジェクトのクローン
```bash
git clone <repository-url>
cd ecscd
```

### 2. 依存関係のインストール
```bash
npm install
```

アプリケーションで使用している主要なライブラリ：
- `@aws-sdk/client-ecs`: ECS操作用のSDK
- `@aws-sdk/client-dynamodb`: DynamoDB操作用のSDK  
- `@octokit/rest`: GitHub API クライアント
- `sqlite3`: SQLite データベース
- `uuid`: 一意識別子生成

### 3. 環境変数の設定
環境変数を設定してください（`.env.local`または環境に応じて）：

#### 設定項目

**データベース設定**
```bash
# データベースタイプ（sqlite または dynamodb）
DATABASE_TYPE=sqlite

# SQLite使用時
SQLITE_DB_PATH=./ecscd.db

# DynamoDB使用時
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ecscd
```

**AWS認証情報**
```bash
# AWS認証情報（IAMロール使用を推奨）
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
```

**GitHub設定**
```bash
# GitHub Personal Access Token（repo権限が必要）
GITHUB_TOKEN=your_github_token
```

### 4. データベースのセットアップ

#### SQLiteの場合
特別な設定は不要です。アプリケーション起動時に自動的にデータベースファイルが作成されます。

#### DynamoDBの場合
テーブルを作成してください：

```bash
node scripts/create-dynamodb-table.js
```

または、AWSコンソールで以下の設定でテーブルを作成：
- テーブル名: `ecscd`（または設定した名前）
- パーティションキー: `pk` (String)
- ソートキー: `sk` (String)
- 課金モード: オンデマンド

### 5. アプリケーションの起動

#### 開発環境（Turbopack使用）
```bash
npm run dev
```

開発サーバーは `http://localhost:3000` で起動します。

#### 本番環境
```bash
npm run build
npm start
```

#### Docker環境での起動
```bash
# 開発環境
docker-compose -f docker-compose.dev.yml up

# 本番環境
docker-compose up
```

アプリケーションは `http://localhost:3000` でアクセス可能です。

## 🔧 使い方

### アプリケーションの作成

1. ダッシュボードで「New Application」ボタンをクリック
2. アプリケーション作成ダイアログで以下の情報を入力：
   - **Application Name**: 一意の識別子（小文字・数字・ハイフンのみ）
   - **ECS Cluster**: デプロイ先のECSクラスター名
   - **ECS Service**: デプロイ先のECSサービス名  
   - **Git Repository**: GitHubリポジトリURL（`https://github.com/owner/repo`形式）
   - **Branch**: デプロイ対象のブランチ（デフォルト: main）
   - **Task Definition Path**: リポジトリ内のタスクデフィニションJSONファイルパス

### 差分の確認

1. アプリケーション一覧でアプリケーションカードの「View Diff」をクリック
2. 右パネルに現在のECS設定と目標設定の差分が表示されます
3. 変更内容の詳細を確認できます

### 手動同期（デプロイ）

1. アプリケーションカードの「Sync」ボタンをクリック
2. デプロイメントが開始され、進捗がリアルタイムで表示されます
3. デプロイメント完了後、アプリケーションの状態が自動更新されます

### アプリケーションの編集・削除

- **編集**: アプリケーションカードの「Edit」ボタンから設定を変更
- **削除**: アプリケーションカードの「Delete」ボタンから削除（確認ダイアログあり）

### 自動同期の設定

GitHubリポジトリにWebhookを設定することで、プッシュ時の自動デプロイが可能です：

1. GitHubリポジトリの Settings > Webhooks に移動  
2. Webhook URL: `https://your-domain.com/api/webhooks/github`
3. Content type: `application/json`
4. イベント: `push`を選択

## 📋 API仕様

### ヘルスチェック

#### アプリケーション状況確認
```http
GET /api/health
```

### アプリケーション管理

#### 全アプリケーション取得
```http
GET /api/apps
```

レスポンス例：
```json
{
  "applications": [
    {
      "metadata": {
        "name": "my-app",
        "labels": {
          "app.kubernetes.io/name": "my-app"
        }
      },
      "spec": {
        "name": "my-app",
        "gitRepository": {
          "owner": "owner",
          "repo": "repo",
          "branch": "main"
        },
        "ecsCluster": "my-cluster",
        "ecsService": "my-service",
        "taskDefinitionPath": "task-definition.json"
      },
      "status": {
        "health": "Healthy",
        "sync": {
          "status": "Synced",
          "revision": "arn:aws:ecs:...:123"
        }
      }
    }
  ]
}
```

#### アプリケーション作成
```http
POST /api/apps
Content-Type: application/json

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
      "ecscd.io/cluster": "my-cluster",
      "ecscd.io/service": "my-service"
    }
  }
}
```

#### アプリケーション更新
```http
PUT /api/apps/{app-name}
Content-Type: application/json

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

#### アプリケーション削除
```http
DELETE /api/apps?name={app-name}
```

### 差分表示

#### タスクデフィニション差分取得
```http
GET /api/apps/{app-name}/diff
```

レスポンス例：
```json
{
  "application": "my-app",
  "summary": "2 differences found",
  "diffs": [
    {
      "path": "containerDefinitions[0].image",
      "type": "modified",
      "currentValue": "nginx:1.20",
      "targetValue": "nginx:1.21"
    }
  ],
  "syncStatus": "OutOfSync"
}
```

### デプロイメント管理

#### デプロイメント履歴取得
```http
GET /api/apps/{app-name}/deployments
```

#### 同期実行（デプロイ）
```http
POST /api/apps/{app-name}/sync
Content-Type: application/json

{
  "dryRun": false
}
```

#### ドライラン実行
```http
POST /api/apps/{app-name}/sync
Content-Type: application/json

{
  "dryRun": true
}
```

#### ストリーミング同期（リアルタイム進捗）
```http
GET /api/apps/{app-name}/sync-stream
```

### Webhook

#### GitHub Webhook受信
```http
POST /api/webhooks/github
Content-Type: application/json

{
  "repository": {
    "full_name": "owner/repo"
  },
  "ref": "refs/heads/main"
}
```

## 🗄️ データベーススキーマ

### アプリケーション (applications)
| フィールド | 型 | 説明 |
|------------|----|----|
| id | String | 一意識別子 |
| name | String | アプリケーション名 |
| gitRepository | Object | Git設定 |
| ecsCluster | String | ECSクラスター名 |
| ecsService | String | ECSサービス名 |
| taskDefinitionPath | String | タスクデフィニションファイルパス |
| autoSync | Boolean | 自動同期設定 |
| syncPolicy | Object | 同期ポリシー |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

### デプロイメント (deployments)
| フィールド | 型 | 説明 |
|------------|----|----|
| id | String | デプロイメントID |
| applicationId | String | アプリケーションID |
| status | String | ステータス（InProgress/Successful/Failed/Stopped） |
| message | String | ステータスメッセージ |
| startedAt | DateTime | 開始日時 |
| finishedAt | DateTime | 終了日時 |
| progress | Object | 進捗情報 |
| taskDefinitionArn | String | タスクデフィニションARN |
| revision | String | リビジョン |

### デプロイメントイベント (deployment_events)
| フィールド | 型 | 説明 |
|------------|----|----|
| id | String | イベントID |
| deploymentId | String | デプロイメントID |
| timestamp | DateTime | タイムスタンプ |
| message | String | イベントメッセージ |
| type | String | イベント種別（info/warning/error） |

## 🔍 トラブルシューティング

### よくある問題

#### 1. データベース接続エラー
**症状**: アプリケーション起動時にデータベースエラーが発生
**解決策**: 
- 環境変数の設定を確認
- SQLiteの場合：ファイルの書き込み権限を確認
- DynamoDBの場合：AWS認証情報とテーブル存在を確認

#### 2. ECS権限エラー
**症状**: デプロイメント時に権限エラーが発生
**解決策**: 
- AWS認証情報のECS操作権限を確認
- 必要な権限：`ecs:UpdateService`, `ecs:RegisterTaskDefinition`, `ecs:DescribeServices`

#### 3. GitHub認証エラー
**症状**: リポジトリアクセス時にエラーが発生
**解決策**: 
- GitHub Personal Access Tokenの有効性を確認
- リポジトリへの読み取り権限を確認

### ログ確認
```bash
# アプリケーションログ
npm run dev

# データベースヘルスチェック
curl http://localhost:3000/api/health
```

## 🔐 セキュリティ考慮事項

- GitHub tokenは環境変数で管理し、コードに直接記述しない
- AWS認証情報はIAMロールまたは環境変数で管理
- データベース接続情報は適切に保護
- 本番環境では適切なネットワークセキュリティを設定

## 🚀 本番環境での運用

### 推奨設定
- DynamoDBを使用（スケーラビリティと可用性）
- ECSまたはEKSでのコンテナ運用
- Application Load Balancerでの負荷分散
- CloudWatchでのモニタリング

### スケーリング
- 複数のアプリケーションインスタンスでの実行
- データベース読み取り専用レプリカの使用
- キャッシュ層の導入（Redis等）

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🤝 コントリビューション

1. フォークしてください
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesでお知らせください。