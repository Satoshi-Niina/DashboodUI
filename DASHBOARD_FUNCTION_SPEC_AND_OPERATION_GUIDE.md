# ダッシュボード 機能仕様・運用ガイド

## 1. 目的
本ドキュメントは、現在のダッシュボードの機能・仕様を整理し、日常運用および保守手順を明確化することを目的とします。

## 2. システム概要
ダッシュボードは、複数の子アプリを起動・管理するランチャー兼コントロールポイントです。
主な提供機能は以下です。
- ログイン認証とトークン発行
- 各アプリ起動URLの管理
- 共通トークンを用いた子アプリ連携
- 管理設定API
- GitHub Actions経由のCloud Runデプロイ

## 3. 現在のアプリ起動URLマッピング
ダッシュボードは、環境変数から起動URLを読み取り、`/api/config` を通じてフロントエンドへ渡します。

- URL_PLANNING
  - https://railway-client-800711608362.asia-northeast2.run.app
- URL_EQUIPMENT
  - https://operation-management-client-800711608362.asia-northeast2.run.app
- URL_EMERGENCY
  - https://emergency-client-800711608362.asia-northeast2.run.app
- URL_FAILURE
  - https://machine-failure-client-800711608362.asia-northeast2.run.app

互換性維持のため、旧変数名のフォールバックも一部保持しています。

## 4. 認証とトークン連携
### 4.1 ログイン
- ユーザーはダッシュボードでログインします。
- JWTは `localStorage` の `user_token` に保存されます。
- ユーザー情報は `user_info` に保存されます。

### 4.2 子アプリ起動時の引き渡し
ユーザーが子アプリを起動すると、次の処理を行います。
- ダッシュボードが子アプリURLにトークンをクエリとして付与
- 引き渡し方式は環境変数で制御

主な設定変数:
- AUTH_TRANSFER_MODE（既定: `url_param`）
- AUTH_TOKEN_PARAM_NAME（既定: `auth_token`）
- AUTH_TOKEN_PARAM_ALIASES（既定: `token,jwt,sso_token`）

これにより、子アプリ側は `auth_token` / `token` / `jwt` / `sso_token` のいずれかで受信できます。

### 4.3 共通シークレット
`JWT_SECRET` はCloud Run環境変数として注入され、関連サービス間でのトークン検証互換に利用します。

## 5. データベースと共通管理テーブル
Cloud SQLインスタンス:
- maint-vehicle-management:asia-northeast2:free-trial-first-project

接続方式:
- Unixソケット接続（`/cloudsql/<instance>`）

主なDB環境変数:
- CLOUD_SQL_INSTANCE
- DB_USER
- DB_PASSWORD
- DB_NAME
- JWT_SECRET

ダッシュボードは、`public` スキーマ内の共通管理テーブルおよびアプリ設定テーブルと連携可能です。

## 6. デプロイ仕様
デプロイは以下のGitHub Actionsワークフローで実行します。
- .github/workflows/deploy.yml

### 6.1 GCP認証
- `google-github-actions/auth` で `GCP_SA_KEY` を使用
- `gcloud` 認証コンテキストを検証
- Docker pushの未認証エラー対策としてアクセストークンで `docker login` を実施

### 6.2 Cloud Run環境変数注入
複雑な値（記号・カンマを含む値）でのパース失敗を回避するため、環境変数ファイル方式を使用します。
- 実行時に `cloudrun-env.yaml` を生成
- `gcloud run deploy --env-vars-file=cloudrun-env.yaml` で注入

回避できる代表的なエラー:
- `Bad syntax for dict arg`

## 7. 必須GitHub Secrets
リポジトリ設定で以下を登録します。

- GCP_PROJECT_ID
- GCP_SA_KEY
- CLOUD_SQL_INSTANCE
- DB_USER
- DB_PASSWORD
- DB_NAME
- JWT_SECRET

任意（プロジェクト運用に応じて）:
- URL_PLANNING
- URL_EQUIPMENT
- URL_EMERGENCY
- URL_FAILURE

注記:
現行ワークフローではURLを固定値注入する構成も可能です。Secrets駆動でURLを変更したい場合は、URLをすべてSecrets化して参照してください。

## 8. 日常運用手順
1. 子アプリURLとJWTポリシーを確認する。
2. 必要に応じて環境変数を更新する。
3. `main` ブランチへプッシュする。
4. GitHub Actionsのデプロイ結果を確認する。
5. Cloud Runのヘルスチェックを確認する。
6. ダッシュボードから各アプリを起動する。
7. 子アプリ側でトークン引き継ぎとアクセス可否を確認する。

## 9. トラブルシュート
### 9.1 gcloud run deploy の環境変数パースエラー
症状:
- `argument --set-env-vars: Bad syntax for dict arg`

対処:
- `--env-vars-file` 方式へ切り替える。

### 9.2 Docker push 未認証エラー
症状:
- `denied: Unauthenticated request`

対処:
- `GCP_SA_KEY` とサービスアカウント権限を確認する。
- 認証ステップが正常終了していることを確認する。
- `gcloud` のアクセストークンで `docker login` を実施する。

### 9.3 子アプリは開くがログインが引き継がれない
対処:
- ダッシュボードの `localStorage` に `user_token` が存在するか確認する。
- 起動URLにトークンクエリが付与されているか確認する。
- 子アプリが `auth_token` / `token` / `jwt` / `sso_token` のいずれかを受け付けるか確認する。
- 子アプリ側の共有シークレットと検証ロジックを確認する。

## 10. 変更管理メモ
子アプリのルーティングや認証連携を更新する際は、以下を遵守します。
- 環境変数優先設計を維持する。
- フロント/バックエンドにURLを直書きしない。
- 可能な範囲で後方互換性を維持する。
- 変更後はデプロイパイプラインとヘルスチェックを必ず検証する。
