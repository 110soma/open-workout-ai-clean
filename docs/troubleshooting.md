# 困ったとき（Windows／v0.1.0）

[最初から](setup.md)／[Supabase接続](supabase-setup-ja.md)。失敗しても実績や表を削除しません。画面やエラーを公開するときはメール、UID、キー、パスワード、実記録を隠します。

<a id="folder"></a>
## PowerShellがSystem32／スクリプトが見つからない

1. エクスプローラーで **`package.json` が見えるアプリフォルダ**を開く。
2. 上部のアドレス欄に `powershell` → Enter。
3. 新しい窓で次を実行。`True` ならそこで再実行します。

```powershell
Get-Location
Test-Path .\package.json
Test-Path .\scripts\example-prescription-sql.mjs
```

今の窓の場所を直す場合は、エクスプローラーのアドレス欄をクリックして実際のフォルダパスをコピーし、次の入力待ちへ貼ります（自分のパスを公開する必要はありません）。

```powershell
Set-Location -LiteralPath (Read-Host 'アプリフォルダのパスを貼ってEnter')
Test-Path .\package.json
```

<a id="install"></a>
## node／npm.cmdがない・npm ciに失敗する

Node.js公式のWindowsインストーラーで22以上を入れ、PowerShellを開き直し `node --version`、`npm.cmd --version`。`ENOENT package.json` は上のフォルダ違い。通信エラーはネット・PCのプロキシ設定を確認し `npm.cmd ci` を再実行。実行ポリシーエラーは `npm` でなく `npm.cmd` を使います。`npm audit fix --force` やロックファイル削除で無理に直しません。

<a id="server"></a>
## URLが開かない

起動用PowerShellで `npm.cmd run dev` が動いているか確認。ログの **Local URL** を正確に開きます。Ctrl+C／窓を閉じると停止します。`4174` が使用中なら別ポートが出ることがあります。既存サーバーを勝手に終了せず、自分の起動した窓だけ停止します。再開時も記録を残すには同じURL・ブラウザを使います。

<a id="env"></a>
## .env.localを作れない

アプリフォルダのPowerShellで `Test-Path .\.env.example` がTrueか確認。Falseならフォルダ違い。`.env.local` がない場合のみ：

```powershell
Copy-Item -LiteralPath .\.env.example -Destination .\.env.local
notepad .\.env.local
```

メモ帳はCtrl+Sで保存。エクスプローラーで拡張子を表示し `.env.local.txt` なら `.env.local` に名前を直します。既存 `.env.local` を見本で上書きしません。

<a id="mode"></a>
## 接続設定を入れたのにDemoのまま

`.env.local` がアプリフォルダにあるか確認。`VITE_DEMO_MODE=false`、URLとPublishable keyが空でないか、見本の文字が残っていないか確認。Ctrl+S → 起動PowerShellでCtrl+C → `npm.cmd run dev` → Local URLを開き直す。URLの `?demo=1` はDemoを強制するので削除。設定変更はブラウザの再読み込みだけでは不十分です。逆にDemoを試したいならサーバー停止後 `VITE_DEMO_MODE=true` に戻し再起動します。

<a id="sql"></a>
## SQLの警告・赤いError

警告と成功は別です。新規Project名とファイル名を確認。0001〜0005を1つずつ順番に実行します。正しい全文にはルール・制約を置換する操作があるため警告が出る場合がありますが、知らないSQLや既存実績があるProjectでは承認しません。`already exists` は再実行の可能性、`foreign key` は順番／User UID／利用者未作成、`syntax error` はコピー途中の可能性。**赤いエラーを残したまま次へ進まず、表を削除して直しません。** 成功済み番号と機密情報を隠したエラーを記録します。

<a id="permissions"></a>
## permission denied／データが読めない

自分のProjectでData API有効、0001〜0005成功、ログイン利用者とメニューの `user_id` 一致を確認。RLSをOFFにしたりブラウザへSecret keyを入れたりしません。Data APIの自動公開をONにする代わりに、付属SQLの明示的権限を使います。

<a id="login"></a>
## ログインできない

Authentication → Usersに作った利用者がいるか、メール確認済みか確認。アプリ利用者のパスワードを使います（DashboardやDatabase passwordではありません）。設定URLとキーがその同じProjectのものか確認。Emailログインが有効かも確認。キー／パスワードをIssueへ貼りません。

<a id="clipboard"></a>
## Set-Clipboard／SQL生成が失敗

`Set-Clipboard` を手入力せずガイドからコピー。PowerShell（コマンドプロンプトではない）で実行します。UIDはAuthenticationのUIDをコピー、日付は `YYYY-MM-DD`。スクリプトが見つからないなら上のフォルダ確認。失敗後に古いクリップボードをSQLへ貼らず、生成からやり直します。アプリフォルダの同じPowerShellで再コピーする場合：

```powershell
$sampleSql | Set-Clipboard
```

これはD1の生成が成功済みのときだけ使います。クリップボードを使えない場合、D1の成功後に `$sampleSql` を実行して表示された **SQL全文だけ**を選択してコピーします。

<a id="menu"></a>
## 今日のメニューがない

空の初期状態は正常。D1〜D2を実行し `prescriptions` の `user_id` とログインUID、`prescription_date` とPCの今日を照合。見本JSONの固定日付をそのまま使いません。アプリを再読み込み。日付が変わったらその日のSQLを生成。既存active／completed Sessionは新メニューで上書きしません。完了済みWorkoutを繰り返し新規開始して確認しないでください。

<a id="restore"></a>
## 再読み込みで入力が見えない

同じブラウザ、Local URLのポート、同じ利用者か確認。「ホーム → 続きから」も確認。Demoと接続モードは別の保管庫です。プライベートブラウズ終了やサイトデータ削除で端末記録が消えます。test実績は別端末へのクラウド復元対象外なので、復元確認のため端末データを消しません。

<a id="sync"></a>
## 終了後の同期エラー

端末記録を残してネット接続、ログイン、同じProjectの設定を確認。右上の状態を開いてエラーを確認し、通信回復後の同期を待ちます。新しいSessionを作って同じ実績を再入力しません。保存待ちのままブラウザデータを消しません。「クラウド保存済み・正式記録は確認待ち」は本ガイドでは正常です。Sheetsを設定しないので「正式保存済み」を目標にしません。
