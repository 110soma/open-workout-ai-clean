import { useSyncExternalStore } from "react";
import { getMetrics, subscribeMetrics } from "../performance";

const labels: Record<string, string> = {
  "db:initialize": "端末内データベース起動",
  "db:import": "履歴データ取込",
  "db:seed:local-only": "端末内データ確認",
  "app:initial:render": "初期画面表示",
  "query:month:sessions": "月間履歴取得",
  "query:day:sessions": "日別履歴取得",
  "query:day:sets": "日別セット取得",
  "query:day:exercises": "種目名取得",
  "ui:day:render": "日別履歴表示",
  "today:load": "今日のメニュー取得",
  "today:save": "途中保存",
  "today:set-complete-to-rest": "セット完了から休憩表示",
  "today:resume": "トレーニング再開"
};

export function PerformancePanel() {
  const metrics = useSyncExternalStore(subscribeMetrics, getMetrics, getMetrics);
  const recent = metrics.slice(-12).reverse();
  return (
    <details className="performance-panel">
      <summary>処理時間</summary>
      <p>開発確認用です。単位は ms（ミリ秒）です。</p>
      <ul>
        {recent.map((metric, index) => (
          <li key={`${metric.at}-${metric.name}-${index}`}>
            <span>{labels[metric.name] ?? metric.name}</span><strong>{metric.durationMs.toFixed(2)} ms</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}
