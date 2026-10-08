# 自分のSupabaseへ接続する（Windows／v0.1.0）

[Demo起動ガイド](setup.md)が終わった方の続きです。Supabaseはトレーニングのメニューと記録を保存するクラウドです。

**必ず自分の新しいテスト専用Projectを作ります。Private版、既存の本番環境、実WorkoutのあるProjectにはこのSQLを実行しません。** Google Sheets、Secret Key、課金プランは基本導入に不要です。設定は `test`（テスト）と自動正式保存OFFのままにします。

画面の名称・配置はSupabaseの更新で変わる場合があります。以下は実装・公式資料との照合済みですが、この改訂手順による新規Projectの作成操作は未実地確認です。開発者による支援付き導入の成功報告と、第三者が説明だけで導入できたことは別です。

<a id="phase-b"></a>
## Phase B：新しい保管庫を作る

### B1. アカウントとOrganizationを作る

- **目的：** 自分のクラウドを管理できるようにします。
- **操作場所：** [Supabase Dashboard](https://supabase.com/dashboard) → Sign up（登録）。
- **入力・操作：** メールまたはGitHubで登録し、確認メールが届いたら認証します。Organization（Projectをまとめる箱）を求められたら自分で分かる名前、**Free（無料）**を選びます。Projectはアプリ専用のデータベースです。OrganizationとProjectは別です。
- **正常：** 自分のOrganizationのProject一覧が開きます。
- **失敗：** メールが届かなければ迷惑メールを確認。料金の支払いが必須に見える場合は有料契約せずFreeの選択に戻ります。

### B2. テスト専用Projectを作る

- **目的：** 既存環境とは独立した保存先を作ります。
- **操作場所：** Dashboard → **New project**。選択Organizationが自分のものか確認。
- **入力・操作：** Project nameは例 `workout-learning`。Database password（データベース管理用パスワード）はGenerateで作り、安全なパスワード管理ソフトに保存します。後で作るアプリ利用者のパスワードとは別です。Region（保存場所）は自分に近い地域。無料のOrganization／Free planを選び、**Create new project**。パスワードをチャットやGitHubに貼りません。
- **正常：** 数分後にProjectのDashboardが開き、準備中表示が消えます。
- **失敗：** Provisioning（準備中）は待ちます。名前とProjectを確認できないままSQLを実行しません。

### B3. データの公開範囲を確認する

- **目的：** アプリが自分の記録だけを読めるようにします。
- **操作場所：** 作成画面に該当項目があればそこで設定。作成後は **Integrations → Data API** で確認します。
- **入力・操作：** **Enable Data APIはON**（アプリの通信入口）。**Automatically expose new tables and functionsはOFF**（新しい表すべてを自動公開しない）。**Enable automatic RLS** が表示される場合はON。RLSは「ログインした本人の行だけを許可する仕組み」です。このアプリのSQLもRLSと必要最小限の権限を設定します。項目がない場合は探し続けずB4へ進みますが、Data APIを無効にしてはいけません。
- **正常：** Data APIが有効。表を作る前なのでメニューや実績はまだありません。
- **失敗：** 接続後に権限エラーが出てもRLSをOFFにしません。[権限の確認](troubleshooting.md#permissions)。[公式Data API説明](https://supabase.com/docs/guides/api)、[公式RLS説明](https://supabase.com/docs/guides/database/postgres/row-level-security)。

### B4. 5つのSQLファイルを順番に実行する

- **目的：** 保存用の表と本人確認のルールを作ります。SQLはデータベースへの指示文、migrationは設計を再現する番号付きファイルです。
- **操作場所：** PCのアプリフォルダ → `supabase` → `migrations`。ブラウザは**新しい自分のProject → SQL Editor → New query**。
- **入力・操作：** 下の順で**1ファイルずつ**メモ帳で開き、Ctrl+A → Ctrl+C。SQL Editorの空の入力欄にCtrl+V → **Run**。次のファイルは新しい空のqueryへ貼ります。SQLをPowerShellへ貼りません。

1. `0001_initial_schema.sql`：メニュー・Session・Setとアクセス制限。
2. `0002_prescription_import_grant.sql`：管理用メニュー登録権限。
3. `0003_workout_record_mode.sql`：テストと本番の識別。
4. `0004_official_commit_gate.sql`：任意の正式保存処理の二重実行防止。今回は利用OFFですが設計は作成。
5. `0005_set_session_owner.sql`：別利用者のSessionへSetを紐付けない制約。

- **正常：** 各ファイルで **`Success. No rows returned`** 等の成功表示。終わった番号をメモして次へ進みます。空の結果は失敗ではありません。
- **失敗・警告：** 「destructive operation（既存定義を変更する操作）」の警告は、0001の既存ルール置換、0003の制約置換などで出る可能性があります。**新規の空のProject／正しいファイル全文／順番**を再確認できた場合だけ実行確認します。既存実績がある、知らないSQL、`DROP TABLE`・`TRUNCATE`・実績の`DELETE`、赤いError、`permission denied`、`already exists`、`foreign key`等があれば停止。[SQLエラー](troubleshooting.md#sql)。成功済みファイルを繰り返し実行したり表を削除して直したりしません。

### B5. 表ができたことを確認する

- **目的：** 5ファイルが正しく終了したか確認します。
- **操作場所：** 同じ新規Project → **Table Editor** → schema `public`。
- **入力・操作：** `prescriptions`、`workout_sessions`、`workout_sets`、`workout_commit_requests`、`workout_commit_mutex` の5表を探します。
- **正常：** 5表が存在。最初の3表に実績はありません。mutexには処理制御用の行があっても正常です。
- **失敗：** 表不足ならSQLの成功済み番号を確認し、未実行ファイルを順に進めます。作成に失敗した番号を飛ばしません。

<a id="phase-c"></a>
## Phase C：利用者を作りアプリへ接続する

### C1. テスト利用者を作る

- **目的：** 自分の記録を持つアプリ利用者を作ります。
- **操作場所：** 同じProject → **Authentication → Users → Add user → Create new user**（画面更新でCreate user表記の場合もあります）。Invite userではなく作成を選びます。
- **入力・操作：** 自分が管理できるメールと、このテスト用の十分長いパスワードを入力。**Auto Confirm User** があればONでCreate user。Dashboardのログイン情報・Database passwordとは別です。AuthenticationのSign In / ProvidersでEmailのログインが有効であることも確認します。
- **正常：** Users一覧に作った利用者が表示されます。メール認証待ちではありません。
- **失敗：** 既存の同じメールを二重作成しません。未認証ならその利用者の確認状態を解決してから進みます。[ログイン失敗](troubleshooting.md#login)。

### C2. User UIDを控える

- **目的：** サンプルメニューの宛先を決めます。User UIDは利用者ごとの識別番号（UUID形式）です。
- **操作場所：** Authentication → Usersで作った利用者の行／詳細。
- **入力・操作：** **User UID / UID / ID** のコピーアイコンを使い、手元に控えます。メールアドレスやProject IDではありません。
- **正常：** ハイフンで区切られた長い識別番号がコピーされます。
- **失敗：** キーボードで写すよりコピーを使います。ここで取得した自分のUIDは後のPowerShell入力にだけ使い、公開文書には貼りません。

### C3. 設定ファイルを作る

- **目的：** アプリに自分の接続先を教えます。`.env.example` は見本、`.env.local` は自分のPCだけの設定です。
- **操作場所：** 起動中PowerShellはCtrl+Cで停止。アプリフォルダでPowerShellを開き直します。
- **入力：** 最初の作成時だけ次を実行。既に `.env.local` があればコピーせずメモ帳で開きます。

```powershell
Test-Path .\.env.local
```

`False` の場合だけ：

```powershell
Copy-Item -LiteralPath .\.env.example -Destination .\.env.local
notepad .\.env.local
```

`True` の場合は `notepad .\.env.local` のみ。

- **正常：** メモ帳に5つの `VITE_...` 設定が見えます。`.env.local.txt` ではありません。
- **失敗：** [設定ファイルの作成](troubleshooting.md#env)。見本は編集せず、自分の設定をGitHubへアップロードしません。

### C4. URLと公開用キーを入れる

- **目的：** ブラウザで使ってよい情報だけを設定します。
- **操作場所：** 自分のProjectの上部 **Connect** → React等のアプリ向け説明で **Project URL**。キーは **Settings → API Keys → Publishable key**。URLは **Integrations → Data API** でも確認できます。
- **入力：** メモ帳を次の形に変更。`YOUR_PROJECT_URL` と `YOUR_PUBLISHABLE_KEY` は**文字どおり使わず、自分の値に置換**します。URLは `https://...supabase.co`、末尾に `/rest/v1` を付けません。引用符は不要です。

```dotenv
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=YOUR_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
VITE_WORKOUT_RECORD_MODE=test
VITE_AUTO_FINALIZE=false
```

- **正常：** **Ctrl+S**で保存。`ANON_KEY`という設定名は既存実装の名前で、ここには新しい **Publishable key（公開用キー）**を入れて構いません。通常の接頭辞は `sb_publishable_`。秘密のキーは不要です。
- **失敗・安全：** **Secret key（`sb_secret_`）と旧service_roleは絶対に入れません。** `VITE_` の値はブラウザから見えます。公開用キーでも本人確認とRLSが必要です。間違った秘密キーを入れた場合は起動せず削除し、外部共有したならProject側で無効化を検討します。[公式キー説明](https://supabase.com/docs/guides/getting-started/api-keys)。

### C5. 再起動してログインする

- **目的：** 保存した設定を反映します。
- **操作場所：** アプリフォルダのPowerShell。
- **入力：**

```powershell
npm.cmd run dev
```

出たLocal URLをブラウザで開き、`?demo=1` が付いていれば削除します。メールアドレス・パスワードにC1の利用者情報を入力して **「ログイン」**。右上「ログインが必要」がある画面ではそのボタンを開きます。

- **正常：** 「デモ・送信なし」が消え、ログイン後に「同期済み」等の表示。最初は **「今日のメニューはまだありません」** で正常です。
- **失敗：** [Demoのまま](troubleshooting.md#mode)、[ログイン失敗](troubleshooting.md#login)。キーを見せるスクリーンショットは共有しません。

<a id="phase-d"></a>
## Phase D：架空メニューを入れ保存を確認する

### D1. 今日のサンプルメニューのSQLを作る

- **目的：** 空の利用者に、架空の練習メニューを1件用意します。元ファイルの日付は見本であり、スクリプトが指定日に置換します。
- **操作場所：** アプリフォルダの `scripts/example-prescription-sql.mjs`。起動中PowerShellはそのままにして、**同じフォルダで2つ目のPowerShell**をA4と同じ方法で開きます。
- **入力：** 最初の1行だけをコピーしてEnter。UIDを聞かれたらC2の自分のUIDを貼ってEnter。その入力が終わってから、次のブロックをコピーします。日付はPCの今日です。

```powershell
$sampleUserId = Read-Host 'AuthenticationのUser UIDを貼り付けてEnter'
```

UIDの入力後、同じPowerShellへ次を貼ります：

```powershell
$sampleDate = Get-Date -Format 'yyyy-MM-dd'
$sampleSql = & node .\scripts\example-prescription-sql.mjs --user-id $sampleUserId --date $sampleDate
if ($LASTEXITCODE -ne 0) { throw 'SQL生成に失敗しました。UIDと日付を確認してください。' }
$sampleSql | Set-Clipboard
```

別の日付を使う場合は `$sampleDate` の行だけ `$sampleDate = '2030-01-15'` のように変更（架空の例）。今日のメニューを試すときは今日の日付にします。

- **正常：** エラーなく入力待ちに戻り、クリップボードにSQLが入ります。SQL生成だけではクラウドへ送信しません。
- **失敗：** `Set-Clipboard` はハイフン込みでそのままコピー。[スペル・UID・場所の解決](troubleshooting.md#clipboard)。

### D2. SQLを自分のProjectへ入れる

- **目的：** 架空メニューだけを保存します。Workout実績はまだ作りません。
- **操作場所：** 同じテストProject → SQL Editor → New query。
- **入力・操作：** Ctrl+Vで貼り、`insert into public.prescriptions`、先頭の架空データのコメント、自分のUIDがあることを確認 → Run。
- **正常：** 結果に `prescription_id` が1件。Table Editor → `prescriptions` で同じID、`user_id`、今日の `prescription_date` を確認。`payload`には2種目の見本、`status=issued` の処方行が含まれます。片手種目は左右別の行が作られるため画面セット数とDB行数は同じとは限りません。
- **失敗：** UID不一致・利用者未作成は[SQLエラー](troubleshooting.md#sql)。同じ利用者・日付なら再生成は同じメニューを更新し、別メニューを増やしません。知らないProjectへ貼りません。

### D3. メニューを開き入力・復元する

- **目的：** 自分のアカウントのメニューを実施する操作を試します。
- **操作場所：** PWA（ブラウザで動くアプリ）。ログイン済み画面を再読み込み。
- **入力・操作：** 今日のカード／「今日のトレーニング」に見本 **Example Press（架空プレス）／Example One-arm Row（架空片手ロー）** が出たら **「トレーニングを始める」**。架空の重量・回数で「セット完了」、RIRは値か「未入力」。休憩から「次のセットへ」。途中でタブを閉じ、同じブラウザ・同じURLで開き直して「続きから」を確認します。
- **正常：** 同じSession（1回のトレーニング）の入力が復元。別のSessionを新しく始めません。左右種目は右・左をそれぞれ確認します。
- **失敗：** [メニューがない](troubleshooting.md#menu)、[記録復元](troubleshooting.md#restore)。途中の記録はまず端末内に保存され、完了後にクラウド同期されます。

### D4. 終了して保存を照合する

- **目的：** 架空の実績が自分のクラウドへ保存されたことを確認します。
- **操作場所：** PWA → 「トレーニング終了」→ 確認画面。
- **入力・操作：** **「送信して終了」** を押し、通信完了を待ちます。Supabase Table Editor → `workout_sessions` で自分の `user_id` と今日の `session_date` の行を開き、その `session_id` で `workout_sets` を絞ります。
- **正常：** PWAは **「クラウド保存済み・正式記録は確認待ち」**。これはSupabaseへ保存できたが、Google Sheetsへの正式保存は行っていない意味です。今回 `VITE_AUTO_FINALIZE=false` なので想定どおりです。Sessionの **`record_mode=test`**、Setの `actual_weight_kg`（実際の重量）、`actual_reps`（回数）、`actual_rir`（RIR）、`completed` を入力と照合します。RIR未入力は `NULL`（値なし）。`target_...` はメニューの指定値なので混同しません。
- **失敗：** 「同期エラー・端末には保存済み」なら記録を消さず[同期エラー](troubleshooting.md#sync)。右上の「同期済み」だけで実績の保存完了と判断せず、終了画面と表で確認します。Supabaseの `status=committed` はクラウド同期状態で、Sheets正式保存の証明ではありません。

### D5. 二人目と記録が混ざらないことを確認する

- **目的：** 同じPCでも利用者ごとに記録が分かれることを確認します。
- **操作場所：** 同じテストProjectでC1を繰り返し、別のメールで利用者Bを作成。PWA右上「同期済み」等 → **「ログアウト」**。
- **入力・操作：** 利用者Bでログイン。Aの途中記録・メニューが表示されないことを確認。Bにメニューが必要ならD1〜D2を **BのUID** で実行します。BでログアウトしAへ戻り、Aの記録が残っていることを確認。未同期のAの記録をBとして送信しません。
- **正常：** Bは最初空。Aへ戻るとAの端末記録が復元。Table Editorは管理者画面なので全利用者が見えるのは正常、PWAは本人のみです。
- **失敗：** 別利用者の記録がPWAに見えるなら送信を停止。RLSを緩めず、利用者ID・0005の成功を確認し、機密情報を除いて問題報告します。

## 保存場所と完了チェック

- Demo：そのブラウザのIndexedDB（端末内保管庫）だけ。実Supabase／Sheetsへ送信しません。
- 接続モード：利用者別の端末内保管庫＋終了後の自分のSupabase。Google Sheetsは基本導入では使いません。
- **テスト実績は別端末へのクラウド復元対象外**です。ブラウザ再読み込みによる同じ端末での復元と、別端末への復元は別です。テスト完了までブラウザデータを消さないでください。
- ブラウザデータ削除は端末記録を消します。先にクラウド表の照合を済ませます。バックアップや削除の詳細は[データ管理](data-management.md)（英語）。本番利用への設定変更はこの検証の完了後、別の判断です。

完了条件：Demo復元・終了／5ファイル成功／ログイン／今日の見本／入力復元／クラウド表一致／`test`／RIR空欄維持／アカウント分離。**このガイドでは `production` や自動正式保存を有効にしません。**
