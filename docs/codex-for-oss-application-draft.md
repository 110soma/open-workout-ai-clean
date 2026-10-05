# Codex for Open Source application draft

Official program page: <https://openai.com/form/codex-for-oss/>

The current official form requires a public GitHub profile and public repository URL. OpenAI says active open-source maintainers may apply and evaluates meaningful usage, adoption, ecosystem importance, and evidence of active maintenance. This candidate is therefore **not yet eligible to submit**.

## English draft / 日本語訳

### Repository URL

`TBD after approved public repository creation`

承認後にPublic Repositoryを作成して記入。

### Project summary

Open Workout AI is a local-first PWA that turns machine- or human-generated workout prescriptions into recoverable, validated workout records, with optional cloud sync and an auditable official-record adapter.

Open Workout AIは、AIまたは人が作成したトレーニング処方を、復元・検証できる実施記録へ変換するLocal-First PWAです。

### What problem does this project solve?

Workout plans and workout logs are often disconnected. The project provides a safe execution layer between planning and trustworthy records, including offline recovery, stable IDs, duplicate protection, and validation.

メニュー作成と実績記録が分断される問題を、オフライン復元・固定ID・重複防止・検証でつなぎます。

### Why is it useful to the OSS ecosystem?

It offers reusable building blocks for prescription-driven fitness tools without requiring a proprietary tracking platform. Demo mode and Supabase migrations make the core flow reproducible.

特定の有料記録サービスに依存せず、処方から実績までの再利用可能な部品を提供します。

### Maintainer role

Primary maintainer: product direction, real-workout validation, issue triage, release decisions, and safety review.

Primary maintainerとして、方針決定、実Workout検証、Issue整理、Release判断、安全確認を担当。

### Current users / usage / releases / issues

`TBD after public release; do not estimate or invent numbers.`

公開後の実数だけを記載。推測や水増しは禁止。

### How Codex will be used

Codex will help maintain tests, review pull requests, reproduce issues, prepare safe migrations, and keep setup/security documentation aligned with the code.

テスト保守、Pull Request確認、Issue再現、安全なmigration作成、説明書とコードの整合に使用。

### How API credits will be used

API credits would support maintenance automation, regression analysis, structured issue triage, and opt-in experiments for prescription feedback without exposing private workout data.

保守自動化、回帰分析、Issue整理、個人データを外部公開しない任意の処方フィードバック実験に使用。

