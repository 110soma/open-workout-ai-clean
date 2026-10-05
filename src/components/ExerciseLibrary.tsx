import { useEffect, useMemo, useState } from "react";
import type { WorkoutSet } from "../types";
import { getExerciseHistory, getExerciseLibrary, type ExerciseLibraryItem } from "../repository";

const groups = ["すべて", "胸", "背中", "肩", "腕", "脚", "腹"];
const equipmentLabels: Record<string, string> = {
  plate_loaded: "プレートロード", machine: "マシン", selectorized: "ピン式マシン",
  dumbbell: "ダンベル", barbell: "バーベル", cable: "ケーブル", bodyweight: "自重",
  smith: "スミスマシン", ez_bar: "EZバー"
};
export const groupFor = (exercise: ExerciseLibraryItem): string => {
  if (exercise.primary_bodypart && groups.includes(exercise.primary_bodypart)) return exercise.primary_bodypart;
  const text = `${exercise.movement ?? ""} ${exercise.exercise_name}`;
  if (/肩|shoulder|delt/i.test(text)) return "肩";
  if (/胸|chest|pec/i.test(text)) return "胸";
  if (/背|back|row|pull|lat_|lat\s/i.test(text)) return "背中";
  if (/腕|biceps|triceps|curl|extension/i.test(text)) return "腕";
  if (/脚|足|leg|squat|calf|hamstring|quad/i.test(text)) return "脚";
  if (/腹|core|abdom/i.test(text)) return "腹";
  return "その他";
};
const shown = (value: number | null): string => value === null ? "—" : String(value);

export function ExerciseLibrary() {
  const [items, setItems] = useState<ExerciseLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("すべて");
  const [selected, setSelected] = useState<ExerciseLibraryItem | null>(null);
  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [detailTab, setDetailTab] = useState<"成長" | "履歴" | "やり方">("成長");
  useEffect(() => { void getExerciseLibrary().then(setItems); }, []);
  useEffect(() => { if (selected) void getExerciseHistory(selected.exercise_id).then(setHistory); }, [selected]);

  const filtered = useMemo(() => items.filter((item) =>
    (group === "すべて" || groupFor(item) === group) && item.exercise_name.toLowerCase().includes(query.toLowerCase())
  ), [group, items, query]);
  const recorded = history.filter((set) => set.completed !== false && (set.load_kg !== null || set.reps !== null));
  const maxLoad = recorded.reduce<number | null>((max, set) => set.load_kg === null ? max : Math.max(max ?? set.load_kg, set.load_kg), null);
  const existingOneRm = recorded.filter((set) => set.estimated_1RM !== null).reduce<number | null>((max, set) => Math.max(max ?? set.estimated_1RM!, set.estimated_1RM!), null);

  if (selected) return <section className="exercise-detail">
    <button className="text-back" onClick={() => setSelected(null)}>‹ 種目一覧</button>
    <span className="eyebrow">{groupFor(selected)}</span><h2>{selected.exercise_name}</h2>
    <div className="detail-tabs">{(["成長", "履歴", "やり方"] as const).map((tab) => <button className={detailTab === tab ? "active" : ""} onClick={() => setDetailTab(tab)} key={tab}>{tab}</button>)}</div>
    {detailTab === "成長" && <div className="exercise-growth">
      <div><small>直近最高重量</small><strong>{maxLoad === null ? "—" : `${maxLoad} kg`}</strong></div>
      {existingOneRm !== null && <div><small>記録済み推定1RM最高</small><strong>{existingOneRm} kg</strong></div>}
      <h3>直近の使用重量</h3>
      <div className="mini-trend">{recorded.slice(0, 12).reverse().map((set) => <i key={set.set_id} style={{ height: `${maxLoad ? Math.max(12, (set.load_kg ?? 0) / maxLoad * 100) : 12}%` }} title={`${set.session_date} ${shown(set.load_kg)}kg`} />)}</div>
      <p>既存実績だけを表示しています。未登録のPRや1RMは推測しません。</p>
    </div>}
    {detailTab === "履歴" && <div className="exercise-history-list">{recorded.slice(0, 60).map((set) => <article key={set.set_id}><time>{set.session_date.replaceAll("-", "/")}</time><strong>{shown(set.load_kg)} kg × {shown(set.reps)}回</strong><span>{set.side && set.side !== "両" ? `${set.side}・` : ""}{set.RIR === null ? "RIR —" : `RIR ${set.RIR}`}</span></article>)}</div>}
    {detailTab === "やり方" && <dl className="exercise-guide">
      {selected.primary_bodypart && <div><dt>狙う部位</dt><dd>{selected.primary_bodypart}</dd></div>}
      {selected.equipment && <div><dt>器具</dt><dd>{equipmentLabels[selected.equipment] ?? selected.equipment}</dd></div>}
      {selected.movement && <div><dt>動作</dt><dd>{selected.movement}</dd></div>}
      {selected.unilateral !== null && <div><dt>左右</dt><dd>{selected.unilateral ? "左右別" : "両側"}</dd></div>}
      {selected.aliases && <div><dt>別名</dt><dd>{selected.aliases}</dd></div>}
    </dl>}
  </section>;

  return <section className="exercise-library">
    <span className="eyebrow">種目・成長・履歴・やり方</span><h2>種目</h2>
    <input type="search" placeholder="種目を検索" aria-label="種目を検索" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="exercise-filters">{groups.map((item) => <button className={group === item ? "active" : ""} onClick={() => setGroup(item)} key={item}>{item}</button>)}</div>
    <div className="exercise-list">{filtered.map((item) => <button key={item.exercise_id} onClick={() => setSelected(item)}><span><strong>{item.exercise_name}</strong><small>{groupFor(item)}{item.equipment ? `・${equipmentLabels[item.equipment] ?? item.equipment}` : ""}</small></span><em>{item.lastUsedDate ? `最終 ${item.lastUsedDate.slice(5).replace("-", "/")}` : "記録なし"}</em></button>)}</div>
  </section>;
}
