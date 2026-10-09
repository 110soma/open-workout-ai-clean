# Windowsではじめる Open Workout AI v0.1.1

上から進めると架空のトレーニングを試せます。Gitやプログラミングの知識は不要です。**最初はDemoだけを試してください。**

このページのPhase A → [Phase B〜D：自分のクラウドを作る](supabase-setup-ja.md) → [困ったとき](troubleshooting.md)。

Demo（操作見本）は端末内だけに保存します。Supabase（自分用のクラウド保管庫）への接続は後から行います。**既存のPrivate版や日常利用中のデータベースには一切操作しないでください。**

必要なもの：Windows PC、ネット接続、EdgeまたはChrome、空き容量のある作業フォルダ。PC内のURLは同じPC用です。スマートフォンへの公開・インストールはこの基本手順に含みません。

<a id="phase-a"></a>
## Phase A：アカウントなしでDemoを試す

### A1. ファイルを入手する

- **目的：** 公開済みv0.1.1をPCへ保存します。
- **操作場所：** [GitHubのファイル置き場](https://github.com/110soma/open-workout-ai-clean) → [v0.1.1のRelease（公開版）](https://github.com/110soma/open-workout-ai-clean/releases/tag/v0.1.1)。
- **入力・操作：** **Assets → Source code (zip)** をクリック。[ZIP直接リンク](https://github.com/110soma/open-workout-ai-clean/archive/refs/tags/v0.1.1.zip)でも同じ版です。緑のCodeボタンのZIPは最新版なので今回は使いません。
- **正常：** ダウンロードフォルダにZIPができます。
- **失敗：** ネット接続を確認しReleaseを開き直します。GitHubへのログインは不要です。

### A2. ZIPを展開する

- **目的：** ZIPを実行できる普通のフォルダにします。
- **操作場所：** エクスプローラーの「ダウンロード」。ZIPを右クリック → **すべて展開**。
- **入力・操作：** 「参照」でドキュメント内など自分で分かる場所を選び「展開」。中の `open-workout-ai-clean-0.1.1` フォルダを開きます。ZIPの中から直接実行しません。
- **正常：** 同じ階層に `package.json`、`package-lock.json`、`src`、`scripts`、`supabase` が見えます。この階層を「アプリフォルダ」と呼びます。`.env.example` もあります。拡張子は「表示 → 表示 → ファイル名拡張子」で表示できます（Windows 10は「表示 → ファイル名拡張子」）。
- **失敗：** `package.json` がなければ、もう一段内側を開きます。[フォルダ違い](troubleshooting.md#folder)。

### A3. Node.jsを入れる

- **目的：** アプリを動かすソフトを入れます。Node.jsは実行用ソフト、付属のnpmは必要な部品を入れる道具です。
- **操作場所：** [Node.js公式ダウンロード](https://nodejs.org/en/download)。
- **入力・操作：** **LTS（長期サポート版）で22以上**、Windows、Windows Installer（`.msi`）を選びます。通常はx64。ARMのPCはWindows「設定 → システム → バージョン情報 → システムの種類」で確認します。インストーラーを開き、利用条件を確認しNext → Install → Finish。追加開発ツールの自動インストールは不要です。
- **正常：** インストール完了画面が出ます。既に入っていても次のバージョン確認を行います。
- **失敗：** インストール禁止のPCは管理者へ相談します。非公式サイトからは入れません。

### A4. 正しい場所でPowerShellを開く

- **目的：** アプリに操作指示を送る窓を開きます。PowerShellはWindows付属のコマンド入力画面です。
- **操作場所：** A2のアプリフォルダをエクスプローラーで開き、上部のアドレス欄をクリック。
- **入力：** アドレス欄へ `powershell` → Enter。開いたPowerShellへ次を1行ずつ貼り、毎回Enter。`PS ...>` は入力しません。

```powershell
Get-Location
Test-Path .\package.json
node --version
npm.cmd --version
```

- **正常：** 場所はアプリフォルダ、次は `True`、Nodeは `v22...` 以上、npmも数字が出ます。PowerShell自体は5でも構いません。
- **失敗：** `C:\WINDOWS\System32` や `False` なら[場所を直す](troubleshooting.md#folder)。Nodeが見つからなければインストール後にPowerShellを開き直します。**`npm.cmd`** を使うので実行ポリシー変更は不要です。

### A5. 部品を入れる

- **目的：** 公開版が指定した部品をまとめて入れます。
- **操作場所：** A4のアプリフォルダのPowerShell。
- **入力：**

```powershell
npm.cmd ci
```

- **正常：** 数分後に `added ... packages` 等が出て、`PS ...>` に戻ります。`node_modules` フォルダができます。
- **失敗：** [インストール失敗](troubleshooting.md#install)。`package-lock.json` を削除しないでください。

### A6. 起動する

- **目的：** PC内でアプリを動かします。
- **操作場所：** 同じアプリフォルダのPowerShell。
- **入力：**

```powershell
npm.cmd run dev
```

- **正常：** `Local: http://127.0.0.1:4174/` のような表示。**実際に出たLocalのURL**をEdge/Chromeのアドレス欄へ貼ります。4174が使用中なら数字が変わります。PowerShellは閉じずにおきます。
- **失敗：** [URLを開けない](troubleshooting.md#server)。別のPCからは開けません。

### A7. 入力・復元・終了を試す

- **目的：** 本物の実績を作らず操作を確認します。
- **操作場所：** ブラウザのアプリ。**「デモ・送信なし」** と架空データの案内を確認。
- **入力・操作：** Demoは操作途中の見本が開きます。開始ボタンを探す必要はありません。休憩画面なら「次のセットへ」、下部「今日のトレーニング」を開きます。「実際の重量」「実際の回数」をクリックして数字を入力、または＋/－。「セット完了」でRIRを選びます。RIRは「あと何回できそうか」の自己評価。分からなければ **「未入力」**。次のセットへ進みます。
- **正常：** 完了セットに値が出ます。F5で再読み込みし入力が残ることを確認。「トレーニング終了」→ **「デモを終了（送信なし）」** → **「デモ完了・外部送信なし」**。再読み込みして終了状態も残れば成功。「デモをやり直す」はDemoの端末記録をリセットするボタンです。
- **失敗：** [モードの確認](troubleshooting.md#mode)。実施していないセットを完了にする必要はありません。架空の値だけを使います。

### A8. 停止・再開する

- **目的：** PC内のアプリを停止します。
- **操作場所：** 起動中のPowerShell。
- **入力・操作：** **Ctrl+C**。確認が出たときだけ `Y` → Enter。
- **正常：** `PS ...>` に戻ります。次回はA4 → `npm.cmd run dev` → 同じURL。毎回の `npm.cmd ci` は不要。記録は同じブラウザ・同じURLに残ります。
- **失敗：** 停止後にURLが開けないのは正常です。再起動します。URLのポートやブラウザを変えると保存場所も変わります。ブラウザデータの削除で端末記録は消えます。

## 次に進む

Demoだけなら完了。[Phase B〜Dへ](supabase-setup-ja.md)。[データ保管・バックアップ](data-management.md)の既存説明は英語です。日本語の基本説明は次のガイド末尾にもあります。

## 開発者向け確認（通常の導入には不要）

アプリフォルダのPowerShellでCtrl+Cでサーバーを止めてから実行。

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run audit:public
```

テスト成功、`dist/sw.js` と `dist/manifest.webmanifest` の生成が正常です。`audit:history` と `verify` はGit履歴も調べるためZIPではなくGitで取得した開発者向けです。
