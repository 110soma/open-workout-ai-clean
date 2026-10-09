export function restArcGeometry(progress: number) {
  const fraction = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) / 100 : 0;
  const angle = (135 + 270 * fraction) * Math.PI / 180;
  return { dash: `${75 * fraction} ${100 - 75 * fraction}`, x: 150 + 124 * Math.cos(angle), y: 150 + 124 * Math.sin(angle) };
}

export function RestTimerDial({ progress, minutes, seconds, endAt, duration }: { progress: number; minutes: number; seconds: string; endAt?: string; duration?: number }) {
  const line = useRef<SVGCircleElement>(null);
  const point = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (!endAt || !duration) return;
    const deadline = new Date(endAt).getTime();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const draw = () => {
      if (!motion.matches) {
        const geometry = restArcGeometry((deadline - Date.now()) / (duration * 1000) * 100);
        line.current?.setAttribute('stroke-dasharray', geometry.dash);
        point.current?.setAttribute('cx', String(geometry.x));
        point.current?.setAttribute('cy', String(geometry.y));
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [endAt, duration]);
  const arc = restArcGeometry(progress);
  return <div className="rest-ring">
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g transform="rotate(135 150 150)">
        <circle className="rest-arc-track" cx="150" cy="150" r="124" pathLength="100" strokeDasharray="75 25" />
        <circle ref={line} className="rest-arc-progress" cx="150" cy="150" r="124" pathLength="100" strokeDasharray={arc.dash} />
      </g>
      <circle ref={point} className="rest-light-point" cx={arc.x} cy={arc.y} r="3.5" />
    </svg>
    <div><strong className="rest-time" aria-label={`残り${minutes}分${Number(seconds)}秒`}><span>{minutes}</span><em>:</em><span>{seconds}</span></strong></div>
  </div>;
}
import { useEffect, useRef } from 'react';
