import { dateKey, formatMonth } from "../date";
import type { WorkoutSession } from "../types";

interface CalendarProps {
  month: Date;
  sessions: WorkoutSession[];
  selectedDate: string | null;
  onChangeMonth: (delta: number) => void;
  onToday: () => void;
  onSelectDate: (date: string) => void;
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export function Calendar({
  month,
  sessions,
  selectedDate,
  onChangeMonth,
  onToday,
  onSelectDate
}: CalendarProps) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const sundayOffset = first.getDay();
  const activity = new Map<string, number>();
  sessions.forEach((session) => activity.set(session.date, (activity.get(session.date) ?? 0) + 1));
  const today = dateKey(new Date());

  return (
    <section className="calendar-card" aria-label="月間カレンダー">
      <div className="calendar-toolbar">
        <button className="icon-button" onClick={() => onChangeMonth(-1)} aria-label="前月">‹</button>
        <h2>{formatMonth(month)}</h2>
        <button className="icon-button" onClick={() => onChangeMonth(1)} aria-label="次月">›</button>
      </div>
      <button className="today-button" onClick={onToday}>今日へ戻る</button>
      <div className="calendar-grid weekday-row" aria-hidden="true">
        {weekdays.map((day, index) => <span className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""} key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: sundayOffset }).map((_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }).map((_, index) => {
          const day = index + 1;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const weekday = new Date(month.getFullYear(), month.getMonth(), day).getDay();
          const count = activity.get(key) ?? 0;
          return (
            <button
              key={key}
              className={`day-button ${weekday === 0 ? "sunday" : weekday === 6 ? "saturday" : ""} ${count ? "has-workout" : ""} ${key === selectedDate ? "selected" : ""} ${key === today ? "today" : ""}`}
              onClick={() => onSelectDate(key)}
              aria-label={`${key}${count ? `、${count}セッション` : "、記録なし"}`}
              aria-pressed={key === selectedDate}
            >
              <span>{day}</span>
              {count > 0 && <i aria-hidden="true">{count > 1 ? count : ""}</i>}
            </button>
          );
        })}
      </div>
      <p className="calendar-summary">この月：{sessions.length}セッション</p>
    </section>
  );
}
