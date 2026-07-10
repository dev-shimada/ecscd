#!/bin/sh
# ministack (DynamoDB) / ecs-sim (ECS) にデモ用リソースを投入する (冪等)。
#   - DynamoDB テーブル ECSCD
#   - ECS クラスタ demo-cluster / サービス demo-service (初期タスク定義: 環境変数なし)
#   - ecscd アプリケーション登録 (demo-app)
# github-stub 側のタスク定義には環境変数 DEPLOYED_FROM=git が入っているため、
# 起動直後の demo-app は OutOfSync になり、Sync ボタンでデプロイを試せる。
set -eu

EP="${AWS_ENDPOINT_URL:-http://ministack:4566}"
ECS_EP="${AWS_ENDPOINT_URL_ECS:-http://ecs-sim:8081}"
CLUSTER=demo-cluster
SERVICE=demo-service
FAMILY=ecscd-demo
TABLE="${DYNAMODB_TABLE_NAME:-ECSCD}"

echo "waiting for ministack at ${EP} ..."
i=0
until aws --endpoint-url "$EP" sts get-caller-identity >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "ministack did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done
echo "ministack is ready."

echo "waiting for ecs-sim at ${ECS_EP} ..."
i=0
until aws --endpoint-url "$ECS_EP" ecs list-clusters >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "ecs-sim did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done
echo "ecs-sim is ready."

# --- DynamoDB -----------------------------------------------------------
if aws --endpoint-url "$EP" dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  echo "table ${TABLE} already exists"
else
  aws --endpoint-url "$EP" dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=name,AttributeType=S \
    --key-schema AttributeName=name,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
  echo "created table ${TABLE}"
fi

# create-table は非同期なので、put-item を投げる前に ACTIVE になるまで待つ
i=0
until [ "$(aws --endpoint-url "$EP" dynamodb describe-table --table-name "$TABLE" \
  --query 'Table.TableStatus' --output text 2>/dev/null)" = "ACTIVE" ]; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "table ${TABLE} did not become ACTIVE in time" >&2
    exit 1
  fi
  sleep 1
done

# --- ECS (ecs-sim) --------------------------------------------------------
aws --endpoint-url "$ECS_EP" ecs create-cluster --cluster-name "$CLUSTER" >/dev/null
echo "cluster ${CLUSTER} is ready"

# 初期リビジョン: github-stub 側 (DEPLOYED_FROM=git あり) と意図的に差分を作る
if ! aws --endpoint-url "$ECS_EP" ecs describe-task-definition --task-definition "$FAMILY" >/dev/null 2>&1; then
  # DescribeTaskDefinition が補完するサーバ側デフォルト (cpu/memory 等) まで明示し、
  # github-stub 側との差分が「environment の有無」だけになるようにする
  aws --endpoint-url "$ECS_EP" ecs register-task-definition --cli-input-json '{
    "family": "'"$FAMILY"'",
    "networkMode": "bridge",
    "requiresCompatibilities": ["EC2"],
    "taskRoleArn": "",
    "executionRoleArn": "",
    "cpu": "256",
    "memory": "512",
    "pidMode": "",
    "ipcMode": "",
    "containerDefinitions": [
      {
        "name": "app",
        "image": "busybox:latest",
        "command": ["sleep", "3600"],
        "cpu": 0,
        "memory": 64,
        "essential": true
      }
    ]
  }' >/dev/null
  echo "registered task definition ${FAMILY}"
fi

SERVICE_STATUS="$(aws --endpoint-url "$ECS_EP" ecs describe-services \
  --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].status' --output text 2>/dev/null || echo NONE)"
if [ "$SERVICE_STATUS" != "ACTIVE" ]; then
  aws --endpoint-url "$ECS_EP" ecs create-service \
    --cluster "$CLUSTER" \
    --service-name "$SERVICE" \
    --task-definition "$FAMILY" \
    --desired-count 1 >/dev/null
  echo "created service ${SERVICE}"
else
  echo "service ${SERVICE} already exists"
fi

# --- ecscd application row ----------------------------------------------
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
aws --endpoint-url "$EP" dynamodb put-item --table-name "$TABLE" --item '{
  "name": {"S": "demo-app"},
  "item_type": {"S": "application"},
  "git_repo": {"S": "https://github.com/demo/app"},
  "git_branch": {"S": "main"},
  "git_path": {"S": "task-definition.json"},
  "ecs_cluster": {"S": "'"$CLUSTER"'"},
  "ecs_service": {"S": "'"$SERVICE"'"},
  "aws_region": {"S": "us-east-1"},
  "aws_role_arn": {"S": ""},
  "aws_external_id": {"S": "local-demo"},
  "created_at": {"S": "'"$NOW"'"},
  "updated_at": {"S": "'"$NOW"'"}
}' >/dev/null
echo "registered ecscd application demo-app"

echo "ministack init done."
