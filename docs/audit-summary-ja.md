# 初心者向け OSS準備まとめ

## 1. 今できていること

PWA、端末への即時保存、Prescription読込、Workout入力、休憩タイマー、途中復元、オフライン保持、Supabase同期、クラウド復元、重複防止、入力検証、履歴、種目画面、Demoがあります。Private版ではGoogle Sheetsへの正式保存まで実Workoutで確認済みです。

## 2. そのまま公開すると危険だったもの

実Workout/Prescription JSON、固定Spreadsheet ID、個人用の修復スクリプト・Deployment情報、Secret用ローカルフォルダです。Git履歴はPrivateフォルダ自体に存在しませんでした。

## 3. そのまま使えた部分

React/TypeScript/Vite/PWA、IndexedDB、Workout UI、Prescription Adapter、Session復元、Supabase migrations、validation、duplicate protection、Demo、テストです。

## 4. 修正した部分

名称と端末DB名を汎用化し、Supabase未設定時は安全なDemoを既定にしました。固定Spreadsheet IDをサーバー専用設定へ変更し、実データと個人用運用ファイルを除外しました。

## 5. 応募前に絶対必要

名称・License承認、Public Repository作成、v0.1.0公開、第三者のclean setup確認、export/削除/Backup手順、最終Secret監査です。

## 6. あると採択上有利

実際の利用者、実Issue、その修正、複数Release、継続的なPull Request/Issue管理です。数値は自然に得た実数だけを使います。

## 7. 応募後でよい

正式PR、Progression強化、AI Feedback、AI Prescription、Preference、Superset高度化などです。

## 8. Private Production化の流れ

保護されたPreviewで数回通常利用し、保存・復元・offline・重複防止・Sheets読み戻しを確認後、明示承認でProductionへ昇格します。失敗時は現在のPreview/Deploymentへ戻します。

## 9. OSS化の流れ

独立候補 → clean setup → 名前/License承認 → 新しいPrivate Repositoryで確認 → Public化承認 → v0.1.0 Release → 実利用/Issue対応、の順です。元Private履歴は持ち込みません。

## 10. 最短スケジュール

1日3〜4時間作業し、GitHub操作と名前/Licenseをすぐ承認できる前提で、応募可能な最短は3〜5日程度です。採択材料を増やすには、2〜4週間の実利用とIssue/修正/追加Releaseを推奨します。OpenAI側の審査結果や採択は保証できません。

