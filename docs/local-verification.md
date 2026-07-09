# ローカル動作確認 / 統合テスト (MiniStack + ecs-sim)

[MiniStack](https://github.com/ministackorg/ministack)(LocalStack 互換のローカル AWS エミュレータ)を使い、
実 AWS アカウントなしで ecscd の動作確認と自動テストを行うための構成です。
**すべてコンテナで完結し、ローカル環境には何もインストールしません。**

## 構成

`compose.yaml` に以下のサービスが定義されています(ネットワーク: `ecscd-local`)。

| サービス | 役割 |
| --- | --- |
| `ministack` | AWS エミュレータ (DynamoDB / STS)。ホストの `localhost:4566` にも公開 |
| `ecs-sim` | ECS シミュレータ。実際の ECS のような非同期ロールアウト遷移とロールバックを再現する自作サーバ (下記参照)。ホストの `localhost:4600` にも公開 |
| `github-stub` | GitHub REST API の最小スタブ。`tools/github-stub/data/` をタスク定義の取得元として返す |
| `ministack-init` | デモ用リソース投入のワンショットジョブ(冪等)。DynamoDB テーブル `ECSCD`(ministack)、ECS `demo-cluster`/`demo-service`(ecs-sim)、アプリケーション `demo-app` を作成 |
| `ecscd` | ecscd 本体(ルートの `Dockerfile` でビルド)。`http://localhost:3000` |
| `integration-test` | 統合テストランナー(profile `test`。通常の `up` では起動しない) |

ecscd 側に必要だった変更は「Octokit の baseUrl を `GITHUB_API_URL` で差し替え可能にする」ことのみです。
AWS SDK v3 は `AWS_ENDPOINT_URL` / サービス単位の `AWS_ENDPOINT_URL_<SERVICE>` を標準サポートしているため、
AWS クライアントはコード変更なしで DynamoDB/STS は ministack、ECS は ecs-sim を向きます。

## ecs-sim: 実際の ECS のような非同期デプロイを再現する

MiniStack の ECS 実装は `UpdateService` が同期的に `COMPLETED` を返し、`ListServiceDeployments` も
未実装(常に空配列)のため、実際の ECS のように「デプロイ直後は `IN_PROGRESS`、数秒〜数十秒後に
`COMPLETED`/`FAILED` へ遷移する」挙動やロールバックを試すことができませんでした。
`tools/ecs-sim/server.js`(依存パッケージなし)はこのギャップを埋めるため、ecscd が使う ECS API
(RegisterTaskDefinition / DescribeTaskDefinition / DescribeServices / UpdateService /
ListServiceDeployments / StopServiceDeployment など)をインメモリで実装し、経過時間ベースで
ロールアウト状態を計算します。

**Sync するたびに、ロールアウトはランダムに 3 パターンのいずれかになります**(`ECS_SIM_OUTCOME_WEIGHTS` で調整可能。デフォルト `success:0.7,hang:0.2,failed:0.1`):

- `success`(70%): `ECS_SIM_ROLLOUT_MIN_MS`〜`ECS_SIM_ROLLOUT_MAX_MS`(デフォルト 8〜25 秒)かけて
  `IN_PROGRESS` → `COMPLETED` に遷移します。ダッシュボードの "Deploying..." アニメーションと
  ポーリングによるステータス遷移を確認できます。
- `hang`(20%): 進捗が 40% 前後でスタックしたまま `IN_PROGRESS` から進まなくなります(タスクが
  健全化できず止まったケースの再現)。この間 **Rollback** ボタンが表示され、押すと
  `StopServiceDeployment` が呼ばれて旧タスク定義に戻ります(数秒で `COMPLETED` に遷移)。
- `failed`(10%): 所要時間経過後に `FAILED` のまま停止します("Failed" 表示の確認用)。

結果を固定して確実に試したい場合は、`ecs-sim` の制御用エンドポイント(AWS プロトコルとは別、
非 AWS の素の HTTP)で次回のロールアウトを強制できます:

```bash
# 次に demo-service に対して UpdateService が呼ばれたとき、hang (ロールバック演習用) を強制する
curl -X POST http://localhost:4600/_sim/next-deployment \
  -H "Content-Type: application/json" \
  -d '{"cluster":"demo-cluster","service":"demo-service","outcome":"hang","durationMs":3000}'

# 現在の全サービスの状態をダンプ (デバッグ用)
curl http://localhost:4600/_sim/state
```

`outcome` は `success` / `hang` / `failed` のいずれか。フォースした設定は次回の Sync 1 回分だけ有効です。

## 動作確認

```bash
docker compose up -d --build
open http://localhost:3000
```

初期状態では `demo-app` が **OutOfSync** で表示されます。
これは Git 側(github-stub)のタスク定義にだけ環境変数 `DEPLOYED_FROM=git` が入っているためです。

- **Sync** を押すと、Git 側のタスク定義が新リビジョンとして登録され、`demo-service` に反映されます
- `tools/github-stub/data/task-definition.json` を編集すると「Git 上の望ましい状態」を変更でき、
  ダッシュボードの差分表示が追随します(github-stub はリクエストごとにファイルを読み直すため再起動不要)

状態をリセットしたいときは:

```bash
docker compose down -v && docker compose up -d
```

## 自動テスト(統合テスト)

統合テスト(`ecscd/tests/integration/`)は MiniStack に対して実際に AWS API を発行します。
ユニットテスト(`npm test`)からは分離されており、jest 設定も別です(`ecscd/jest.integration.config.js`)。

### コンテナで実行(推奨・CI 向け)

```bash
docker compose --profile test run --rm integration-test
```

`node_modules` は名前付きボリュームに隔離されるため、ホストの `node_modules` には影響しません。

### ホストから実行(開発時の反復向け)

```bash
docker compose up -d ministack          # エミュレータだけ起動
cd ecscd && npm run test:integration    # localhost:4566 に接続
```

### テスト内容

| スイート | 検証内容 |
| --- | --- |
| `dynamodb.test.ts` | DynamoDB リポジトリの CRUD、重複作成の拒否、フィルタ CRUD、フィルタ行がアプリ一覧に混入しないこと |
| `ecs.test.ts` | タスク定義の register → describe 往復と正規化(AWS 付与フィールドの除去)、describeServices、updateService |
| `observe.test.ts` | observe → sync のエンドツーエンド(InSync → Git 側変更で OutOfSync → syncService で InSync に復帰)、不正 URL のエラーハンドリング |

テストはリソース名を毎回ユニークに生成するため、デモ用スタックと同居でき、
MiniStack のリセットも不要です。

## 既知の制限

- **サーバ側デフォルトによる幻の差分**: DescribeTaskDefinition はタスクレベル `cpu`/`memory` や
  空文字の `taskRoleArn` 等を補完して返します(ecs-sim もこれを再現します)。Git 側のタスク定義が
  これらを省略していると「Removed」差分が出て OutOfSync になるため、デモ用フィクスチャはデフォルト
  値まで明示しています(実 AWS でもコンテナレベル `cpu: 0` の補完などで同種の現象が起こり得ます)
- **ecs-sim の状態はプロセス内メモリのみ**: `docker compose down` や `ecs-sim` の再起動で
  クラスタ・サービス・タスク定義・ロールアウト履歴はすべて失われます。再度 `up` すると
  `ministack-init` が demo 用リソースを作り直します
- **rolloutState が IN_PROGRESS のときのみ Rollback ボタンが表示される**: 現行 UI 実装
  (`hasActiveDeployment = status === "Deploying"`)の仕様で、`FAILED` になった後は
  ロールバックできません(Sync をやり直すことで新しいロールアウトとして上書きは可能)
