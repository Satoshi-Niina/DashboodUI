# Cloud DBの接続設定ガイド

## 現在のDB構造（ご提供情報より）

### スキーマ構成
```
スキーマ名          用途
─────────────────────────────────────
master_data        共通マスターデータ
operations         チャット・運用データ
maintenance        保守・点検データ
emergency          緊急対応データ
public             システム設定
```

### テーブル配置
```
スキーマ            テーブル名                  用途
──────────────────────────────────────────────────
master_data        documents                   マニュアル・資料
master_data        base_documents              基本規約・テンプレート
master_data        managements_offices (推定)  事業所マスタ
master_data        vehicles (推定)             保守用車マスタ
master_data        machines (推定)             機械番号マスタ
master_data        machine_types (推定)        機種マスタ
master_data        bases (推定)                保守基地マスタ
master_data        users (推定)                ユーザー管理

operations         chats                       チャットセッション
operations         chat_history                チャット発言ログ
operations         chat_exports                チャットエクスポート

maintenance        fault_history               故障履歴
maintenance        fault_history_images        故障画像

emergency          emergency_flows             緊急対応フロー

public             app_resource_routing        ルーティング定義
public             access_token_policy         認証ポリシー
```

## 問題診断手順

### 1. データベース構造の確認
以下のSQLファイルを実行して、現在のDB構造を確認してください：
```bash
# Cloud SQLに接続
gcloud sql connect free-trial-first-project --user=postgres --database=webappdb

# 構造確認SQLを実行
\i check-current-db-structure.sql
```

### 2. テーブルの存在確認
上記のSQLで以下を確認：
- ✅ master_dataスキーマが存在するか
- ✅ 必要なテーブル（users, managements_offices, vehicles, machines, machine_types, bases）が存在するか
- ✅ どのスキーマに配置されているか

### 3. app_resource_routingテーブルの確認
```sql
-- ルーティングテーブルの存在確認
SELECT * FROM public.app_resource_routing 
WHERE app_id = 'dashboard-ui';
```

**結果が空の場合**: ルーティングデータが登録されていません
**結果がある場合**: physical_schemaとphysical_tableが正しいか確認

## 修正方法

### ケース1: テーブルが存在しない場合
```bash
# database-setup.sqlを実行してテーブルを作成
\i database-setup.sql
```

### ケース2: ルーティングデータが未登録の場合
```bash
# ルーティングデータを登録
\i setup-dashboard-routing.sql
```

### ケース3: 異なるスキーマに配置されている場合

**例**: vehiclesテーブルがpublicスキーマにある場合
```sql
-- ルーティング情報を修正
UPDATE public.app_resource_routing 
SET physical_schema = 'public'
WHERE app_id = 'dashboard-ui' 
  AND logical_resource_name = 'vehicles';
```

## ブラウザでの確認方法

サーバー起動後、以下のURLにアクセス：

### デバッグエンドポイント
```
http://localhost:3000/debug/tables
```

このエンドポイントで以下が確認できます：
- 各テーブルの存在
- テーブルのカラム情報
- ルーティング設定

### 期待される正常な応答
```json
{
  "success": true,
  "tables": {
    "users": {
      "exists": true,
      "columns": [...]
    },
    "managements_offices": {
      "exists": true,
      "columns": [...]
    },
    "_routing": [
      {
        "logical_resource_name": "users",
        "physical_schema": "master_data",
        "physical_table": "users",
        "is_active": true
      },
      ...
    ]
  }
}
```

## トラブルシューティング

### エラー: "relation does not exist"
**原因**: テーブルが存在しないか、スキーマが間違っている
**対策**: 
1. check-current-db-structure.sqlで実際の配置を確認
2. database-setup.sqlでテーブルを作成
3. ルーティング情報を正しいスキーマに修正

### エラー: "column does not exist"
**原因**: テーブル構造が古いか、カラムが不足している
**対策**: 
1. fix-office-fk.sqlで不足カラムを追加
2. database-setup.sqlを再実行

### エラー: 500 Internal Server Error
**原因**: 複数の可能性あり
**対策**: 
1. サーバーのターミナル出力でエラーログを確認
2. /debug/tablesエンドポイントで構造を確認
3. ログに表示されるクエリとエラーコードを確認

## 推奨設定

### ダッシュボードUIが使用するテーブル
すべて **master_data** スキーマに配置することを推奨：

```
master_data.users
master_data.managements_offices
master_data.bases
master_data.vehicles
master_data.machines
master_data.machine_types
```

### ルーティング設定
```sql
-- dashboard-ui用のルーティング
app_id: 'dashboard-ui'
logical_resource_name → physical_schema.physical_table
────────────────────────────────────────────────
users                 → master_data.users
managements_offices   → master_data.managements_offices
bases                 → master_data.bases
vehicles              → master_data.vehicles
machines              → master_data.machines
machine_types         → master_data.machine_types
```

## 次のアクション

1. ✅ check-current-db-structure.sqlを実行
2. ✅ 結果を確認してテーブルの配置を把握
3. ✅ 必要に応じてdatabase-setup.sqlを実行
4. ✅ setup-dashboard-routing.sqlでルーティングを設定
5. ✅ サーバーを再起動
6. ✅ /debug/tablesで最終確認
