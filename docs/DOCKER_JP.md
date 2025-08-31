# ecscd Docker設定ガイド

## 概要

`ecscd`（ECS継続的デプロイメントツール）のDocker化設定について説明します。本番環境向けに最適化されたマルチステージビルドを採用し、セキュリティとパフォーマンスを重視した設計になっています。

## 構成ファイル

### プロダクション用ファイル
- `Dockerfile` - 本番用マルチステージビルド（Next.js Standalone対応）
- `docker-compose.yml` - 本番用Docker Compose設定
- `.dockerignore` - ビルドコンテキストから除外するファイル
- `scripts/docker-entrypoint.sh` - データベース初期化スクリプト

### 開発用ファイル
- `Dockerfile.dev` - 開発用軽量Dockerfile
- `docker-compose.dev.yml` - 開発用Docker Compose設定（ホットリロード対応）

### 管理用ファイル
- `Makefile` - ビルド/デプロイ用コマンド集
- `scripts/create-dynamodb-table.js` - DynamoDBテーブル作成スクリプト

## クイックスタート

### 1. 開発環境での起動
```bash
# 開発環境での起動（Docker Compose使用）
docker-compose -f docker-compose.dev.yml up -d

# ログ確認
docker-compose -f docker-compose.dev.yml logs -f
```

### 2. 本番環境での起動
```bash
# 環境変数設定
cp .env.example .env.local
# .env.localを編集して適切な値を設定

# 本番環境起動（Docker Compose使用）
docker-compose up -d

# ヘルスチェック
curl http://localhost:3000/api/health
```

### 3. Makefileを使用した起動（推奨）
```bash
# 利用可能なコマンド一覧
make help

# 開発環境
make dev

# 本番環境
make up

# クリーンアップ
make clean
```

## Dockerfile詳細

### マルチステージビルド構成

#### Stage 1: base
- ベースイメージ: `node:lts-trixie-slim`
- 軽量なDebian Trixieベース
- セキュリティを重視した最新LTSバージョン

#### Stage 2: deps
- 本番依存関係のみインストール
- `npm ci --only=production --no-audit --no-fund`で最適化
- キャッシュ効率を向上させる設計

#### Stage 3: builder
- 全依存関係をインストール（devDependencies含む）
- TypeScriptコンパイルとNext.jsビルド実行
- Next.js `standalone`出力を生成

#### Stage 4: runner (最終イメージ)
- 最小限のランタイム環境
- 非rootユーザー（nextjs:1001）での実行
- SQLite3ネイティブ依存関係とビルドツール
- ヘルスチェック機能内蔵
- カスタムエントリーポイントスクリプト対応

### 主要な特徴

1. **Next.js Standalone出力対応**
   - 本番最適化されたバンドル
   - 依存関係の最小化

2. **セキュリティ強化**
   - 非rootユーザーでの実行
   - 最小権限の原則

3. **SQLite3ネイティブサポート**
   - `python3`, `make`, `g++`による再ビルド環境
   - 本番環境でのSQLite動作保証

4. **ヘルスチェック統合**
   - `/api/health`エンドポイントによる自動監視
   - コンテナオーケストレーター対応

### 最適化のポイント

1. **レイヤーキャッシュ最適化**
   - package.jsonファイルを先にコピー
   - 依存関係の変更がない場合はキャッシュを活用

2. **マルチステージビルド**
   - ビルド時のみ必要なツールを除外
   - 最終イメージサイズを最小化

3. **セキュリティ強化**
   - 非rootユーザーでの実行
   - 不要なパッケージの除外

## 環境変数設定

### 必須環境変数
```bash
# データベース設定
DATABASE_TYPE=sqlite  # または dynamodb
SQLITE_DB_PATH=/app/data/ecscd.db

# GitHub認証
GITHUB_TOKEN=your_github_token

# AWS設定（DynamoDB使用時）
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TABLE_NAME=ecscd
```

### オプション環境変数
```bash
# アプリケーション設定
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# 監視設定
NEXT_TELEMETRY_DISABLED=1
```

## Docker Compose設定

### 本番環境 (docker-compose.yml)
```yaml
services:
  ecscd:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_TYPE=sqlite
      - SQLITE_DB_PATH=/app/data/ecscd.db
    volumes:
      - ecscd_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 開発環境 (docker-compose.dev.yml)
```yaml
services:
  ecscd-dev:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app  # ソースコードマウント
      - /app/node_modules
    command: npm run dev
```

## Makefileコマンド

### 基本コマンド
```bash
make help           # ヘルプ表示
make build          # 本番イメージビルド
make build-dev      # 開発イメージビルド
make run            # 本番環境起動
make run-dev        # 開発環境起動
make clean          # クリーンアップ
```

### 開発支援コマンド
```bash
make dev-setup      # 開発環境セットアップ
make logs           # ログ表示
make shell          # コンテナシェルアクセス
make health         # ヘルスチェック
```

### デプロイメントコマンド
```bash
make tag            # イメージタグ付け
make push           # レジストリプッシュ
make security-scan  # セキュリティスキャン
make image-size     # イメージサイズ確認
```

## ヘルスチェック

### エンドポイント
```
GET /api/health
```

### レスポンス例
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "database": {
    "type": "sqlite",
    "healthy": true
  },
  "uptime": 3600.5,
  "memory": {
    "used": 128,
    "total": 256,
    "external": 32
  }
}
```

## データ永続化

### SQLite
```yaml
volumes:
  - ecscd_data:/app/data
```

### DynamoDB
- AWS DynamoDBサービスを使用
- ローカル開発用にDynamoDB Localコンテナを提供

## セキュリティ設定

### コンテナセキュリティ
1. **非rootユーザー実行**
   - UID/GID 1001のnextjsユーザー
   - セキュリティリスクの軽減

2. **最小権限の原則**
   - 必要最小限のシステムパッケージ
   - 読み取り専用ファイルシステム

3. **ヘルスチェック**
   - 自動的な異常検知
   - コンテナオーケストレーターとの連携

### ネットワークセキュリティ
```yaml
networks:
  ecscd_network:
    driver: bridge
```

## 監視・ログ

### ログ出力
```bash
# リアルタイムログ表示
make logs

# 開発環境ログ
make logs-dev

# 特定サービスのログ
docker-compose logs -f ecscd
```

### メトリクス
- ヘルスチェックエンドポイント
- メモリ使用量
- アップタイム
- データベース状態

## トラブルシューティング

### よくある問題

#### 1. ビルドエラー
```bash
# キャッシュクリア
docker builder prune

# 完全リビルド
docker-compose build --no-cache
```

#### 2. 権限エラー
```bash
# ファイル権限確認
docker-compose exec ecscd ls -la /app/data

# 権限修正
docker-compose exec ecscd chown -R nextjs:nodejs /app/data
```

#### 3. ネットワークエラー
```bash
# ネットワーク確認
docker network ls

# ネットワーク再作成
docker-compose down
docker-compose up -d
```

#### 4. データベース接続エラー
```bash
# ヘルスチェック
make health

# データベースファイル確認（SQLite）
docker-compose exec ecscd ls -la /app/data/

# DynamoDB接続確認
docker-compose exec ecscd env | grep AWS
```

## 本番環境デプロイ

### AWS ECS
```bash
# ECRログイン
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# イメージビルドとプッシュ
make build
docker tag ecscd:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ecscd:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ecscd:latest
```

### Kubernetes
```bash
# イメージビルド
make build

# Kubernetesマニフェスト適用
kubectl apply -f k8s/
```

## パフォーマンス最適化

### イメージサイズ最適化
- マルチステージビルドの活用
- .dockerignoreの適切な設定
- 不要なパッケージの除外

### ランタイム最適化
- Next.js standalone出力
- Node.jsメモリ設定
- ガベージコレクション調整

### キャッシュ最適化
- Docker layer caching
- npm ci の使用
- 依存関係の最適化

## 開発ワークフロー

### 推奨フロー
1. `make dev-setup` - 初期設定
2. `.env`ファイル設定
3. `make run-dev` - 開発環境起動
4. コード編集（ホットリロード有効）
5. `make test` - テスト実行
6. `make build` - 本番ビルド確認
7. `make clean` - クリーンアップ

この設定により、開発から本番まで一貫したDocker環境での運用が可能になります。