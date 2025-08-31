# ecscd デプロイメントガイド

## 概要

このガイドでは、`ecscd`（ECS継続的デプロイメントツール）を本番環境にデプロイするための手順を説明します。Docker、Amazon ECS、Kubernetesなど複数のデプロイメント方法とベストプラクティスを提供します。

## デプロイメント方法

### 1. Docker Compose（開発・テスト環境）

最も簡単な方法で、開発環境やテスト環境に適しています。

#### 前提条件
- Docker Engine 20.10+
- Docker Compose 2.0+

#### 手順

1. **プロジェクトに含まれているDocker Composeファイルを使用**

開発環境用：
```bash
docker-compose -f docker-compose.dev.yml up -d
```

本番環境用：
```bash
docker-compose up -d
```

2. **環境変数設定**
```bash
# .env.local を作成
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./ecscd.db
AWS_REGION=us-east-1
GITHUB_TOKEN=your_github_token
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

3. **プロジェクトに含まれているDockerfileの使用**

プロジェクトには既に以下のDockerfileが含まれています：
- `Dockerfile`: 本番用のマルチステージビルド
- `Dockerfile.dev`: 開発用の軽量ビルド

4. **DynamoDBテーブル作成（必要に応じて）**
```bash
# プロジェクトのスクリプトを使用
node scripts/create-dynamodb-table.js
```

5. **起動確認**
```bash
# ヘルスチェック
curl http://localhost:3000/api/health
```

---

### 2. Amazon ECS（推奨：本番環境）

AWS ECS上での本格的な本番運用に適した方法です。

#### 前提条件
- AWS CLI設定済み
- ECSクラスターが作成済み
- Application Load Balancer設定済み
- DynamoDBテーブル作成済み

#### 手順

1. **タスクデフィニション作成**
```json
{
  "family": "ecscd-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecscd-task-role",
  "containerDefinitions": [
    {
      "name": "ecscd",
      "image": "your-account.dkr.ecr.us-east-1.amazonaws.com/ecscd:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_TYPE",
          "value": "dynamodb"
        },
        {
          "name": "AWS_REGION",
          "value": "us-east-1"
        },
        {
          "name": "DYNAMODB_TABLE_NAME",
          "value": "ecscd-prod"
        }
      ],
      "secrets": [
        {
          "name": "GITHUB_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:ecscd/github-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ecscd",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

2. **IAMロール作成**

**タスク実行ロール（ecsTaskExecutionRole）**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

**タスクロール（ecscd-task-role）**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:ListTaskDefinitions",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "*"
    }
  ]
}
```

3. **DynamoDBテーブル作成**
```bash
aws dynamodb create-table \
  --table-name ecscd-prod \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

4. **ECRリポジトリ準備**
```bash
# リポジトリ作成
aws ecr create-repository --repository-name ecscd --region us-east-1

# ログイン
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# イメージビルドとプッシュ
docker build -t ecscd .
docker tag ecscd:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ecscd:latest
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ecscd:latest
```

5. **ECSサービス作成**
```bash
aws ecs create-service \
  --cluster your-cluster \
  --service-name ecscd-service \
  --task-definition ecscd-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:targetgroup/ecscd-tg/xxx,containerName=ecscd,containerPort=3000"
```

---

### 3. Kubernetes（Advanced）

Kubernetesクラスターでの運用方法です。

#### 前提条件
- Kubernetesクラスター（v1.20+）
- kubectl設定済み
- Ingress Controller設定済み

#### 手順

1. **Namespace作成**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecscd
```

2. **ConfigMap作成**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecscd-config
  namespace: ecscd
data:
  DATABASE_TYPE: "dynamodb"
  AWS_REGION: "us-east-1"
  DYNAMODB_TABLE_NAME: "ecscd-prod"
```

3. **Secret作成**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ecscd-secrets
  namespace: ecscd
type: Opaque
data:
  GITHUB_TOKEN: <base64-encoded-token>
  AWS_ACCESS_KEY_ID: <base64-encoded-key>
  AWS_SECRET_ACCESS_KEY: <base64-encoded-secret>
```

4. **Deployment作成**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecscd
  namespace: ecscd
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ecscd
  template:
    metadata:
      labels:
        app: ecscd
    spec:
      containers:
      - name: ecscd
        image: your-registry/ecscd:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: ecscd-config
        - secretRef:
            name: ecscd-secrets
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

5. **Service作成**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: ecscd-service
  namespace: ecscd
spec:
  selector:
    app: ecscd
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

6. **Ingress作成**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecscd-ingress
  namespace: ecscd
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - ecscd.your-domain.com
    secretName: ecscd-tls
  rules:
  - host: ecscd.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ecscd-service
            port:
              number: 80
```

---

## 環境別設定

### 開発環境
```bash
# .env.development
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./dev.db
AWS_REGION=us-east-1
NODE_ENV=development
```

### ステージング環境
```bash
# .env.staging
DATABASE_TYPE=dynamodb
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ecscd-staging
NODE_ENV=production
```

### 本番環境
```bash
# .env.production
DATABASE_TYPE=dynamodb
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ecscd-prod
NODE_ENV=production
```

## 監視・ログ設定

### CloudWatch Logs（ECS）
```json
{
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/ecs/ecscd",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "ecs"
    }
  }
}
```

### アプリケーションメトリクス

**ヘルスチェックエンドポイント**

アプリケーションには `/api/health` エンドポイントが実装済みです：

```bash
# ヘルスチェック確認
curl http://localhost:3000/api/health

# 期待されるレスポンス
{
  "status": "healthy",
  "database": "connected", 
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### CloudWatch アラーム設定
```bash
# アプリケーションエラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name ecscd-error-rate \
  --alarm-description "ECSCD Error Rate" \
  --metric-name Errors \
  --namespace ECS/ContainerInsights \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# CPU使用率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name ecscd-cpu-utilization \
  --alarm-description "ECSCD CPU Utilization" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## セキュリティ設定

### AWS Security Groups
```bash
# セキュリティグループ作成
aws ec2 create-security-group \
  --group-name ecscd-sg \
  --description "Security group for ECSCD application"

# HTTPSトラフィック許可
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# ALBからの3000ポートアクセス許可
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp \
  --port 3000 \
  --source-group sg-alb-xxx
```

### WAF設定
```json
{
  "Name": "ecscd-web-acl",
  "Scope": "REGIONAL",
  "DefaultAction": {
    "Allow": {}
  },
  "Rules": [
    {
      "Name": "AWS-AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "OverrideAction": {
        "None": {}
      },
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSetMetric"
      }
    }
  ]
}
```

## バックアップ・災害復旧

### DynamoDBバックアップ
```bash
# ポイントインタイムリカバリ有効化
aws dynamodb put-backup-policy \
  --table-name ecscd-prod \
  --backup-policy PointInTimeRecoveryEnabled=true

# 手動バックアップ
aws dynamodb create-backup \
  --table-name ecscd-prod \
  --backup-name ecscd-backup-$(date +%Y%m%d)
```

### SQLiteバックアップ
```bash
# 定期バックアップスクリプト
#!/bin/bash
DB_PATH="./ecscd.db"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/ecscd_backup_$DATE.db

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -name "ecscd_backup_*.db" -mtime +30 -delete
```

## パフォーマンス最適化

### Next.js最適化
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
}

module.exports = nextConfig
```

### Docker最適化
```dockerfile
# マルチステージビルド
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー
```bash
# DynamoDBアクセス確認
aws dynamodb describe-table --table-name ecscd-prod

# IAMロール権限確認
aws sts get-caller-identity
```

#### 2. ECRプッシュ失敗
```bash
# ECRログイン更新
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# イメージサイズ確認
docker images | grep ecscd
```

#### 3. ECSタスク起動失敗
```bash
# タスク詳細確認
aws ecs describe-tasks --cluster your-cluster --tasks task-id

# ログ確認
aws logs get-log-events --log-group-name /ecs/ecscd --log-stream-name stream-name
```

## 本番運用のベストプラクティス

1. **リソース監視**: CloudWatchでCPU、メモリ、ネットワーク使用量を監視
2. **自動スケーリング**: ECS Service Auto Scalingを設定
3. **セキュリティ更新**: 定期的なベースイメージとライブラリの更新
4. **バックアップ戦略**: データベースの定期バックアップと復旧テスト
5. **ロードテスト**: 本番投入前の負荷テスト実施
6. **ログ分析**: CloudWatch InsightsやElkスタックでのログ分析
7. **アラート設定**: 重要メトリクスのしきい値アラート設定