// 統合テストのデフォルト接続先。compose 内では AWS_ENDPOINT_URL=http://ministack:4566 と
// AWS_ENDPOINT_URL_ECS=http://ecs-sim:8081 が注入され、ホストから直接実行する場合は
// それぞれの公開ポート (localhost:4566 / localhost:4600) に接続する。
// AWS SDK v3 は AWS_ENDPOINT_URL[_<SERVICE>] / 認証情報の環境変数を標準で解決するため、
// プロダクションコード側の変更は不要。
process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";
process.env.AWS_ENDPOINT_URL_ECS =
  process.env.AWS_ENDPOINT_URL_ECS || "http://localhost:4600";
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "test";
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "test";
process.env.AWS_REGION = process.env.AWS_REGION || "us-east-1";
