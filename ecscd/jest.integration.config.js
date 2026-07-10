/**
 * ministack (DynamoDB/STS) と ecs-sim (ECS) に対して実際に API を発行する
 * 統合テスト用設定。
 * 事前に `docker compose up -d ministack ecs-sim` (または compose --profile test) が必要。
 * 実行: npm run test:integration
 * @type {import('jest').Config}
 */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/integration/setup-env.js'],
  // エミュレータ相手の実 API 呼び出しのため余裕を持たせる
  testTimeout: 120000,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // @octokit v22 は ESM-only のため、CJS で動く jest でも読めるよう
  // ts-jest (allowJs) で該当パッケージ群だけ変換する
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        allowJs: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|universal-user-agent|before-after-hook|fast-content-type-parse|universal-github-app-jwt)/)',
  ],
};

module.exports = config;
