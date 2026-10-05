import { useEffect, useLayoutEffect, useState } from "react";
import { CompactCloudStatus } from "./components/CompactCloudStatus";
import { ExerciseLibrary } from "./components/ExerciseLibrary";
import { HomeDashboard } from "./components/HomeDashboard";
import { TodayWorkout } from "./components/TodayWorkout";
import { initializeDatabase, seedFromStaticBundle } from "./db";
import { recordMetric } from "./performance";
import { startCloudSync } from "./sync/cloudSync";
import { isDemoMode } from './runtimeMode';
import { prepareDemo } from './demo';

type Tab = "home" | "today" | "exercises";

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(isDemoMode ? 'today' : 'home');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await initializeDatabase();
        if (isDemoMode) await prepareDemo();
        else await seedFromStaticBundle();
        if (active) setReady(true);
      } catch (reason) {
        console.error(reason);
        if (active) setError(reason instanceof Error ? reason.message : "初期化に失敗しました");
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    return startCloudSync();
  }, [ready]);

  useLayoutEffect(() => {
    if (ready && window.__WORKOUT_BOOT_AT__ !== undefined) {
      recordMetric("app:initial:render", performance.now() - window.__WORKOUT_BOOT_AT__);
      window.__WORKOUT_BOOT_AT__ = undefined;
    }
  }, [ready]);

  if (error) {
    return <main className="splash error-screen"><div className="brand-mark">AI</div><h1>読み込みエラー</h1><p>{error}</p><button onClick={() => location.reload()}>再読み込み</button></main>;
  }

  if (!ready) {
    return <main className="splash"><div className="brand-mark">AI</div><h1>Open Workout AI</h1><p>ローカル履歴を準備しています…</p></main>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div><h1>Open Workout AI <b>v0.1</b></h1></div>
        {isDemoMode ? <span className="demo-status">デモ・送信なし</span> : <CompactCloudStatus />}
      </header>

      <main className="main-content">
        {isDemoMode && <aside className="demo-banner">架空データで操作確認できます。実績・クラウドには保存しません。<button onClick={() => void prepareDemo(true).then(() => location.reload())}>デモをやり直す</button></aside>}
        {tab === "home" ? (
          <HomeDashboard onOpenToday={() => setTab("today")} />
        ) : tab === "today" ? (
          <TodayWorkout onOpenHistory={() => setTab("home")} />
        ) : (
          <ExerciseLibrary />
        )}
      </main>

      <nav className="bottom-nav" aria-label="メインメニュー">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><span>⌂</span>ホーム</button>
        <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}><span>●</span>今日のトレーニング</button>
        <button className={tab === "exercises" ? "active" : ""} onClick={() => setTab("exercises")}><span>▤</span>種目</button>
      </nav>
    </div>
  );
}

export default App;
