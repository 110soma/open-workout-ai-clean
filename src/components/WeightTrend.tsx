import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkoutSet } from '../types';
import { dateKey } from '../date';
import { rangeStart, weightAxis, weightDays, weightSide, type TrendRange, type WeightSeries } from '../weightTrend';

const ranges: [TrendRange, string][] = [['six', '直近6回'], ['3m', '3か月'], ['6m', '半年'], ['1y', '1年']];
const series: WeightSeries[] = ['left', 'right', 'both', 'unknown'];
const names = { left: '左', right: '右', both: '左右同時', unknown: '左右未記載' };
const display = (value: number | string | null) => value === null ? '—' : String(value);
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

export function WeightTrend({ history, unilateral }: { history: WorkoutSet[]; unilateral: boolean | null }) {
  const [range, setRange] = useState<TrendRange>('six');
  const [selection, setSelection] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const plot = useRef<HTMLDivElement>(null);
  const today = dateKey(new Date());
  const days = useMemo(() => weightDays(history, unilateral, range, today), [history, unilateral, range, today]);
  const chosen = days.find(d => d.date === selection) ?? days.at(-1);
  const activeSeries = series.filter(side => days.some(day => day.weights[side] !== undefined));
  const values = days.flatMap(day => Object.values(day.weights));
  const axis = values.length ? weightAxis(values) : { min: 0, max: 1, ticks: [] };
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(plot.current); return () => observer.disconnect();
  }, [values.length > 0]);
  const left = 48, right = Math.max(left + 10, width - 20), top = 28, bottom = 190;
  const first = range === 'six' ? days[0]?.date ?? today : rangeStart(today, range);
  const last = range === 'six' ? days.at(-1)?.date ?? today : today;
  const from = Date.parse(`${first}T00:00:00Z`), until = Date.parse(`${last}T00:00:00Z`);
  const x = (date: string) => from === until ? (left + right) / 2 : left + (Date.parse(`${date}T00:00:00Z`) - from) / (until - from) * (right - left);
  const y = (weight: number) => bottom - (weight - axis.min) / (axis.max - axis.min) * (bottom - top);
  const ticks = from === until ? [first] : Array.from({ length: 3 }, (_, i) => new Date(from + (until - from) * i / 2).toISOString().slice(0, 10));
  const label = (side: WeightSeries) => activeSeries.length === 1 && side === 'both' ? '重量' : names[side];
  const paths = (side: WeightSeries) => {
    const parts: string[] = []; let current = '';
    for (const day of days) {
      const value = day.weights[side];
      if (value === undefined) { if (current) parts.push(current); current = ''; }
      else current += `${current ? ' L' : 'M'}${x(day.date)},${y(value)}`;
    }
    if (current) parts.push(current); return parts;
  };
  return <section className="weight-trend" aria-label="重量推移">
    <div className="weight-range" aria-label="表示期間">{ranges.map(([key, text]) => <button key={key} aria-pressed={range === key} onClick={() => { setRange(key); setSelection(null); }}>{text}</button>)}</div>
    <div className="weight-summary"><small>表示期間の最高重量</small><strong>{values.length ? `${Math.max(...values)} kg` : '—'}</strong></div>
    <h3>日ごとの最高重量</h3>
    {values.length > 0 ? <>
      <div className="weight-legend">{activeSeries.map(side => <span key={side} className={`weight-series-${side}`}><i />{label(side)}</span>)}</div>
      <div ref={plot} className="weight-plot">
        <svg viewBox={`0 0 ${width} 238`} role="img" aria-label={`日ごとの最高重量。縦軸${axis.min}から${axis.max}kg。横軸${first}から${last}。記録日は下の選択欄でも選べます。`}>
          <text x="0" y="14">重量（kg）</text>
          {axis.ticks.map(tick => <g key={tick}><line className="weight-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} /><text x={left - 7} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
          {chosen && <line className="weight-guide" x1={x(chosen.date)} x2={x(chosen.date)} y1={top} y2={bottom} />}
          {activeSeries.map(side => <g key={side} className={`weight-series-${side}`}>
            {paths(side).map((path, i) => <path key={i} d={path} className="weight-line" />)}
            {days.filter(day => day.weights[side] !== undefined).map(day => side === 'right' ? <rect key={day.date} className="weight-point" x={x(day.date) - 4} y={y(day.weights[side]!) - 4} width="8" height="8" /> : <circle key={day.date} className="weight-point" cx={x(day.date)} cy={y(day.weights[side]!)} r={day.date === chosen?.date ? 5 : 3.5} />)}
          </g>)}
          {ticks.map((date, i) => <text key={date} x={x(date)} y="213" textAnchor={i === 0 && ticks.length > 1 ? 'start' : i === ticks.length - 1 && ticks.length > 1 ? 'end' : 'middle'}>{shortDate(date)}</text>)}
          <text x={(left + right) / 2} y="234" textAnchor="middle">トレーニング日</text>
          <rect x={left} y={top} width={right - left} height={bottom - top} fill="transparent" onClick={event => {
            const target = (event.clientX - event.currentTarget.ownerSVGElement!.getBoundingClientRect().left);
            const nearest = days.reduce((a, b) => Math.abs(x(a.date) - target) <= Math.abs(x(b.date) - target) ? a : b);
            setSelection(nearest.date);
          }} />
        </svg>
      </div>
      <p className="weight-note">縦軸 {axis.min}–{axis.max} kg{axis.min > 0 ? '（0始まりではありません）' : ''}。日付間隔は実際の日数です。</p>
    </> : <p className="weight-note">この期間の重量記録はありません。未入力の重量は0kgとして表示しません。</p>}
    {chosen && <>
      <label className="weight-date-picker">記録日<select aria-label="記録日" value={chosen.date} onChange={event => setSelection(event.target.value)}>{days.map(day => <option key={day.date} value={day.date}>{day.date.replaceAll('-', '/')}</option>)}</select></label>
      <div className="weight-day-detail" aria-live="polite"><h4>{chosen.date.replaceAll('-', '/')} の記録</h4>
        {activeSeries.filter(side => chosen.weights[side] !== undefined).map(side => <p className="weight-day-max" key={side}>{label(side)}：最高 {chosen.weights[side]} kg</p>)}
        {chosen.sets.map((set, i) => <div className="weight-set-row" key={set.set_id}>
          {i === 0 || chosen.sets[i - 1].session_id !== set.session_id ? <small className="weight-session-label">トレーニング {new Set(chosen.sets.slice(0, i + 1).map(s => s.session_id)).size}</small> : null}
          <span>{set.set_no ?? '—'}セット目 · {names[weightSide(set.side, unilateral)]}</span><strong>{display(set.load_kg)} kg × {display(set.reps)}回</strong><small>RIR {display(set.RIR)}{set.set_type === null ? ' · セット種別未記載' : ''}</small>
        </div>)}
      </div>
    </>}
    <p className="weight-note">実績のみ表示。重量だけで成長を断定せず、回数・RIRも確認してください。明示されたウォームアップは集計対象外です。</p>
  </section>;
}
