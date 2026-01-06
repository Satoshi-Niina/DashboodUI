# DashboardUI データベース接続 - 改善ロードマップ

**バージョン**: 1.0  
**作成日**: 2026年1月6日  
**対象**: search_path 依存の段階的排除と保守性向上

---

## 🎯 ロードマップ概要

### 現状（v1.0）: 二重防御方式
```
search_path 設定 + 完全修飾名SQL
├─ 第一防御: 全接続で search_path 自動設定
└─ 第二防御: routing 経由で完全修飾名生成
```

**評価**: 堅牢だが search_path 依存が残る

---

## 📅 Phase 1: 安定化期（現在〜1ヶ月）

### 目標
本番運用の安定化と監視体制の確立

### 実施事項

#### 1-1. モニタリング体制の構築
- [ ] Cloud Logging でエラーアラート設定
  ```
  severity>=ERROR
  textPayload=~"DynamicDB.*error"
  ```
- [ ] ヘルスチェックエンドポイント追加
  ```javascript
  app.get('/health', async (req, res) => {
    const dbCheck = await pool.query('SELECT 1');
    res.json({ status: 'healthy', db: 'connected' });
  });
  ```
- [ ] Uptime Monitoring 設定（5分間隔）

#### 1-2. ドキュメント整備
- [x] PRODUCTION_TROUBLESHOOTING.md
- [x] FINAL_REVIEW.md
- [ ] API仕様書の更新
- [ ] 運用手順書の作成

#### 1-3. 運用ルールの確立
- [ ] デプロイチェックリストの運用開始
- [ ] 週次での本番ログレビュー
- [ ] インシデント対応フローの確立

**完了条件**:
- 2週間以上、本番エラーなしで運用できる
- モニタリングで異常を即検知できる

---

## 📅 Phase 2: リファクタリング期（1〜3ヶ月）

### 目標
search_path 依存の段階的排除

### 実施事項

#### 2-1. 完全修飾名の徹底
**対象箇所**: 直接SQLを記述している箇所

**現状**:
```javascript
// ❌ 直接SQL（一部に残存）
const query = 'SELECT * FROM master_data.bases WHERE base_id = $1';
```

**改善後**:
```javascript
// ✅ routing 経由
const route = await resolveTablePath('bases');
const query = `SELECT * FROM ${route.fullPath} WHERE base_id = $1`;
```

**作業手順**:
1. 直接SQL記述箇所を grep で洗い出し
   ```bash
   grep -r "FROM master_data\." server.js
   grep -r "JOIN master_data\." server.js
   ```
2. 1箇所ずつ動的SQL生成関数に置き換え
3. ローカル＋本番で動作確認
4. 完了後、search_path 設定を削除

**予想工数**: 2週間

#### 2-2. テストカバレッジの向上
- [ ] ユニットテスト導入（Jest）
- [ ] routing 解決のテストケース作成
- [ ] 環境差異のテストケース作成

**予想工数**: 1週間

#### 2-3. コードレビュー基準の明文化
- [ ] 新規SQL記述時は routing 経由を必須とする
- [ ] PRテンプレートに DB関連チェック項目を追加

**完了条件**:
- すべてのSQLが routing 経由または完全修飾名
- search_path 設定を削除してもエラーが出ない

---

## 📅 Phase 3: モダナイゼーション期（3〜6ヶ月）

### 目標
クエリビルダー導入とTypeScript化

### 実施事項

#### 3-1. TypeScript化の準備
- [ ] tsconfig.json 作成
- [ ] 型定義ファイルの準備
- [ ] 段階的な .ts 移行

**予想工数**: 3週間

#### 3-2. Prisma 導入検討
**メリット**:
- タイプセーフなDB操作
- スキーマ定義の一元管理
- マイグレーション管理

**導入手順**:
1. Prisma スキーマ定義作成
   ```prisma
   model User {
     id          Int     @id @default(autoincrement())
     username    String  @unique
     displayName String? @map("display_name")
     role        String
     @@map("users")
     @@schema("master_data")
   }
   ```
2. 既存DBからスキーマをイントロスペクト
   ```bash
   npx prisma db pull
   ```
3. 1テーブルずつPrisma クエリに置き換え
4. 動作確認＆パフォーマンス測定

**予想工数**: 4週間

#### 3-3. GraphQL API検討（オプション）
- [ ] Apollo Server 導入
- [ ] REST API と GraphQL の併存
- [ ] フロントエンドの段階的移行

**予想工数**: 6週間

**完了条件**:
- TypeScript化率 80%以上
- Prisma 移行率 50%以上
- 型安全性によるバグ減少

---

## 📅 Phase 4: 最適化期（6ヶ月〜）

### 目標
パフォーマンス最適化とスケーラビリティ向上

### 実施事項

#### 4-1. キャッシュ戦略の見直し
- [ ] Redis 導入検討
- [ ] ルーティング情報のキャッシュ時間最適化
- [ ] マスタデータのキャッシュ戦略

#### 4-2. DB接続プールの最適化
- [ ] 接続数の監視と調整
- [ ] スロークエリの検出と改善
- [ ] インデックスの最適化

#### 4-3. マイクロサービス化検討
- [ ] 認証サービスの分離
- [ ] マスタ管理サービスの分離
- [ ] API Gateway の導入

**完了条件**:
- レスポンスタイム 500ms 以下（P95）
- エラーレート 0.1% 以下

---

## 🚫 やらないこと（Not To-Do List）

### 1. スキーマの public への統合
**理由**: 
- 論理的な分離が失われる
- 他システムとの名前衝突リスク
- メリットよりデメリットが大きい

### 2. ORM の完全移行（Sequelize, TypeORM）
**理由**:
- Prisma の方が現代的で学習コストが低い
- 既存の動的SQL生成との相性が悪い

### 3. NoSQL への移行
**理由**:
- マスタデータは RDB が最適
- トランザクション要件がある
- 移行コストが極めて高い

---

## 📊 KPI と成功指標

### フェーズ別 KPI

| Phase | KPI | 目標値 | 測定方法 |
|-------|-----|--------|---------|
| Phase 1 | エラー率 | <0.5% | Cloud Logging |
| Phase 1 | MTTR（平均復旧時間） | <10分 | インシデント記録 |
| Phase 2 | 完全修飾名化率 | 100% | コードレビュー |
| Phase 2 | テストカバレッジ | >70% | Jest カバレッジ |
| Phase 3 | TypeScript化率 | >80% | コード比率 |
| Phase 3 | 型エラー検出数 | >20件 | tsc ビルド |
| Phase 4 | P95レスポンス | <500ms | APM ツール |
| Phase 4 | DB接続数 | <80% | Cloud SQL メトリクス |

### 全体目標

**技術的目標**:
- [ ] search_path 依存完全排除
- [ ] 型安全性の確保
- [ ] テストカバレッジ 80%以上

**ビジネス目標**:
- [ ] 本番障害ゼロ（6ヶ月間）
- [ ] デプロイ頻度 週1回以上
- [ ] 新機能開発速度 2倍

---

## 🔄 レビューサイクル

### 週次レビュー
- 本番ログの確認
- エラー発生状況の確認
- KPI の進捗確認

### 月次レビュー
- フェーズ進捗の確認
- ロードマップの見直し
- 次月の計画策定

### 四半期レビュー
- 全体的な技術方針の見直し
- リソース配分の調整
- 次フェーズの詳細計画

---

## ⚠️ リスクと対策

### リスク1: Phase 2 でのレグレッション
**発生確率**: 中  
**影響度**: 高  
**対策**:
- 段階的な移行（1箇所ずつ）
- 十分なテスト期間
- ロールバック計画の準備

### リスク2: Prisma 導入時のパフォーマンス劣化
**発生確率**: 低  
**影響度**: 中  
**対策**:
- 導入前のベンチマーク測定
- スロークエリの監視
- 必要に応じて生SQLを併用

### リスク3: リソース不足
**発生確率**: 中  
**影響度**: 中  
**対策**:
- フェーズごとの優先度明確化
- 必要に応じてスケジュール調整
- 外部リソースの活用検討

---

## 📝 意思決定記録

| 日付 | 決定事項 | 理由 | 決定者 |
|-----|---------|------|-------|
| 2026-01-06 | 二重防御方式を採用 | 堅牢性と実装容易性 | - |
| 2026-01-06 | Prisma を ORM 候補に選定 | 現代的で TypeScript 親和性高 | - |
| TBD | Phase 2 開始判断 | Phase 1 の安定運用確認後 | - |

---

## 🔗 関連ドキュメント

- [PRODUCTION_TROUBLESHOOTING.md](./PRODUCTION_TROUBLESHOOTING.md) - トラブルシューティングガイド
- [FINAL_REVIEW.md](./FINAL_REVIEW.md) - 最終実装レビュー
- [CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md) - 変更サマリー

---

**策定者**: GitHub Copilot  
**承認者**: [記入]  
**次回見直し**: 2026年2月6日
