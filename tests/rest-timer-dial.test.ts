import { expect, test } from 'vitest';
import { restArcGeometry } from '../src/components/RestTimerDial';

test('270 degree arc shrinks and light stays on its endpoint', () => {
  expect(restArcGeometry(100).dash).toBe('75 25');
  expect(restArcGeometry(50).dash).toBe('37.5 62.5');
  expect(restArcGeometry(0).dash).toBe('0 100');
  expect(restArcGeometry(50).x).toBeCloseTo(150);
  expect(restArcGeometry(50).y).toBeCloseTo(26);
  for (const progress of [0, 25, 50, 75, 100]) {
    const { x, y } = restArcGeometry(progress);
    expect(Math.hypot(x - 150, y - 150)).toBeCloseTo(124);
  }
});

test('invalid and out of range display values cannot escape the arc', () => {
  expect(restArcGeometry(-1)).toEqual(restArcGeometry(0));
  expect(restArcGeometry(101)).toEqual(restArcGeometry(100));
  expect(restArcGeometry(NaN)).toEqual(restArcGeometry(0));
});
