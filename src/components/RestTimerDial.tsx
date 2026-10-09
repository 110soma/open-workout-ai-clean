export function restArcGeometry(progress: number) {
  const fraction = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) / 100 : 0;
  const angle = (135 + 270 * fraction) * Math.PI / 180;
  return { dash: `${75 * fraction} ${100 - 75 * fraction}`, x: 150 + 124 * Math.cos(angle), y: 150 + 124 * Math.sin(angle) };
}

export function RestTimerDial({ progress, minutes, seconds }: { progress: number; minutes: number; seconds: string }) {
  const arc = restArcGeometry(progress);
  return <div className="rest-ring">
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g transform="rotate(135 150 150)">
        <circle className="rest-arc-track" cx="150" cy="150" r="124" pathLength="100" strokeDasharray="75 25" />
        <circle className="rest-arc-progress" cx="150" cy="150" r="124" pathLength="100" strokeDasharray={arc.dash} />
      </g>
      <circle className="rest-light-point" cx={arc.x} cy={arc.y} r="3.5" />
    </svg>
    <div><strong className="rest-time" aria-label={`残り${minutes}分${Number(seconds)}秒`}>{minutes}<em>:</em>{seconds}</strong></div>
  </div>;
}
