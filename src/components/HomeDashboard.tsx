import { useEffect, useState } from "react";
import type { DayHistory as DayHistoryData, WorkoutSession } from "../types";
import { Calendar } from "./Calendar";
import { DayHistory } from "./DayHistory";
import { HistoryWorkoutEditor } from "./HistoryWorkoutEditor";
import { TodayStatusCard } from "./TodayWorkout";
import { getDayHistory, getMonthlySessions, getRecentSessionSummaries, type RecentSessionSummary } from "../repository";

export function HomeDashboard({ onOpenToday }: { onOpenToday: () => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [history, setHistory] = useState<DayHistoryData | null>(null);
  const [recent, setRecent] = useState<RecentSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  useEffect(() => { void getMonthlySessions(month.getFullYear(), month.getMonth()).then(setSessions); }, [month]);
  useEffect(() => { void getRecentSessionSummaries(3).then(setRecent); }, []);

  async function chooseDate(date: string) {
    const [year, monthNumber] = date.split("-").map(Number);
    if (year !== month.getFullYear() || monthNumber - 1 !== month.getMonth()) setMonth(new Date(year, monthNumber - 1, 1));
    setSelectedDate(date);
    setEditingSessionId(null);
    setLoading(true);
    try { setHistory(await getDayHistory(date)); } finally { setLoading(false); }
  }

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDate(null);
    setHistory(null);
  }

  function goToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    void chooseDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  }

  return <section className="home-dashboard">
    <TodayStatusCard onOpenToday={onOpenToday} onOpenHistory={() => document.getElementById("home-calendar")?.scrollIntoView({ behavior: "smooth" })} />
    <div id="home-calendar">
      <Calendar month={month} sessions={sessions} selectedDate={selectedDate} onChangeMonth={moveMonth} onToday={goToday} onSelectDate={(date) => void chooseDate(date)} />
    </div>
    {selectedDate && <div className="home-day-detail">{editingSessionId
      ? <HistoryWorkoutEditor sessionId={editingSessionId} onCancel={() => setEditingSessionId(null)} onSaved={() => { setEditingSessionId(null); void chooseDate(selectedDate); }} />
      : <DayHistory date={selectedDate} history={history} loading={loading} clickedAt={null} onEditSession={setEditingSessionId} />}</div>}
    <section className="recent-workouts">
      <div className="section-heading"><div><span className="eyebrow">端末内履歴</span><h2>最近のトレーニング</h2></div></div>
      {recent.map((item) => <button key={item.session_id} onClick={() => void chooseDate(item.date)}>
        <time>{item.date.slice(5).replace("-", "/")}</time><strong>{item.bodypart}</strong><span>{item.exerciseCount ? `${item.exerciseCount}種目・` : ""}{item.setCount}セット</span>
      </button>)}
    </section>
  </section>;
}
