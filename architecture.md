# システム・データベース設計 ＆ 最終物理配置図 (architecture.md)

本ドキュメントは、TownManagerシステム（共通アプリケーション型マルチテナントシステム）における、グローバル共通データベース（`common_db`）と各テナント個別データベース（`tenant DB`）の間で、各物理テーブル・スキーマおよび業務データをどのように分離・配置・管理するかの決定構成および、クリーンな新仕様アーキテクチャ図を示したものです。

---

## 1. データベース・テーブル物理配置ポリシー (最終構成)

### 司令塔データベース (`common_db`)
`common_db` に残すものは、**「テナントのアクセス（URLパスなど）が来た際に、どのデータベースに繋ぎ・どのバケットのファイルをロードするか」という、システムのブートストラップ（起動解決）と安全なマルチテナント隔離に必要な最低限の全体制御メタデータのみ**です。
これを行うことで、全テナント全体の共通司令塔（コントロールプレーン）として最軽量かつ最高の可用性を維持します。

####  **`common_db` に残す（格納する）テーブル・データ一覧**
1. **`public.company_db_routing`**
   * **役割**: テナントの検出キー（`tenant_path`/`company_id`）と、接続すべき物理テナントデータベース名（`db_name`）、および GCS の隔離バケット名（`storage_bucket_name`）を対応付ける、システムの最上流定義マスタ。
2. **`public.organizations` (※グローバルテナント管理用のみ)**
   * **役割**: テナントとしての存在、契約、親となる全体アカウントを司るテナントそのもののマスターデータ。
3. **`public.schema_migrations` (※common_db全体用スキーマ変更履歴)**
   * **役割**: 司令塔データベースにテーブルやカラム、インデックスの追加をバッチ適用する際、ダブりなどのエラーを防ぐための適用管理情報履歴。

---

### 各テナント個別データベース (`tenant DB`: `daitetsu_db`, `kosei_db`, `demo_db` 等)
全ての業務データ、実績データベース、マスターデータ、現場スタッフなどのユーザーは、該当テナントの固有データベース直下のみに配置され、**完全に独立したデータベースレベルのセキュリティ（ISOLATION）** を確立します。
共有アプリケーション（DashboodUI等）が、リクエスト段階で対象のテナントDBへ接続プールのバインドを透過的に切り替えることによって、完全にデータ混入・競合を防ぎます。

#### 🗳️ **`tenant DB` へ配置する（格納する）テーブル・データ一覧**
1. **`public.app_resource_routing`**
   * **役割**: 対象テナントごとの「テーブル案内板（ルーティングマスタ）」。プログラムが共通で参照する論理オブジェクト名を、物理テーブル実体（スキーマ、テーブル名）に置き換える。
2. **`master_data.users` / `public.users`** (移設完了)
   * **役割**: テナント固有の所属社員や責任者、一般ユーザーを対象にしたユーザー管理マスタ、およびそれらを媒介するロール（`public.roles`）、権限（`public.permissions`, `public.role_permissions`）、マッピング（`public.user_role_assignments`）などの全RBACマスタ。
3. **`public.sites` / `master_data.managements_offices` / `master_data.bases`**
   * **役割**: テナント内の各支店、営業所、および特定の「点検個所（基地・サイト）」を表す場所マスタ。
4. **`master_data.machines` / `master_data.machine_types`**
   * **役割**: 保守用車システム等のコアとなる、機械番号、仕様・型式（機種マスタ）定義。
5. **`operations.schedules` / `master_data.inspection_schedules`**
   * **役割**: 運転計画や保守周期、期間などの計画設定。
6. **業務データ・テーブル群 (運行・帳票・会計・入金・町内会データ・他)**
   * **役割**: 
     - **帳票 / 点検実績**: `operations.inspection_records` および `operations.inspection_record_items` 等の実績表。
     - **会計 / 入金**: テナント固有の財務伝票、入金ログ。
     - **町内会データ / その他業務データ**: 地域活動、会員管理、会費徴収、回覧板管理など、個々のテナントが運用する独立したあらゆる生活空間データ。

---

## 2. アーキテクチャ最終構成図 (Architecture Diagram)

本システムの「共通アプリケーション（Dashboard-UI他） ＆ テナントごとの個別独立DB」の接続確立ライフサイクル、および本構成図が示すデータの隔離（アイソレーション）構造です。

```mermaid
flowchart TD
    subgraph Client [クライアント層: ブラウザ / 外部UIアプリ]
        URL[大鉄環境: /daitetsu/<br>近鉄環境: /kintetsu/]
        Header[HTTP Header:<br>X-Tenant-Id: daitetsu]
    end

    subgraph AppServer [共通アプリケーションサーバー層: Cloud Run 共通アプリ]
        Middleware{テナント解決ミドルウェア}
        AsyncStorage[(AsyncLocalStorage Context)]
        Gateway[Database Gateway Route Resolver]
    end

    subgraph ControlPlane [コントロールプレーン: 司令塔]
        subgraph common_db [common_db]
            RouteTable[public.company_db_routing]
            Orgs[public.organizations]
        end
    end

    subgraph TenantDBS [マルチテナント・データベース層 (テナント別DBに完全隔離)]
        subgraph daitetsu_db [大鉄専用: daitetsu_db]
            D_Route[public.app_resource_routing]
            D_Users[master_data.users & RBAC]
            D_Offices[master_data.managements_offices]
            D_Business[大鉄固有業務テーブル<br>帳票・財務会計・入金・点検実績]
        end

        subgraph kintetsu_db [近鉄専用: kintetsu_db]
            K_Route[public.app_resource_routing]
            K_Users[master_data.users & RBAC]
            K_Offices[master_data.managements_offices]
            K_Business[近鉄固有業務テーブル<br>運行管理・帳票・点検実績]
        end

        subgraph demo_db [デモ専用: demo_db]
            M_Route[public.app_resource_routing]
            M_Users[master_data.users & RBAC]
            M_Business[デモ用模擬テーブル群<br>点検状況・模擬町内会データ]
        end
    end

    %% リクエスト解決の流れ
    URL & Header --> |① 接続要求送信| Middleware
    Middleware --> |② ルーティング検索| RouteTable
    RouteTable --> |③ 接続情報返却| Middleware
    Middleware --> |④ 接続プール・コンテキストバインド| AsyncStorage
    AsyncStorage --> |⑤ テナントDBへクエリを直結| TenantDBS
    
    %% テーブル解決の動的な流れ
    Gateway -.-> |⑥ テーブル案内板をロード| D_Route & K_Route & M_Route
    D_Route -.-> |⑦ 物理リソースパスを動的マッピング| D_Users & D_Offices & D_Business
```

---

## 3. 分離・隔離による利点

1. **データ漏洩のリスクを極小化 (ZERO Leak Risk)**:
   企業ごとの個人情報（users、連絡先）、財務データ（入金、会計）、地域的なセンシティブデータ（町内会関連、名簿）がデータベースそのものの物理的な隔壁（隔離プール）で遮断されているため、クエリの誤記述による他テナントデータへの意図せぬ混入や表示漏洩が完全に排除されます。
2. **バックアップ・リストアの独立性 (High Maintainability)**:
   「A町内会（またはA企業）のデータだけを昨日の時点に巻き戻したい（リストア）」といった現場要望に対し、他の全テナントに1秒の瞬断も悪影響も与えることなく、独立してバックアップの復元、抽出、移行が行えるようになります。
3. **USBクローズ動作（ローカル開発）との完全な親和性**:
   `company_db_routing` による接続先の宣言だけで、ローカル（127.0.0.1:5432）内の各スキーマ・データベースへのスイッチが機能するため、開発用PCへの移行性やUSBだけで全システムがシミュレートできる柔軟性を失いません。
