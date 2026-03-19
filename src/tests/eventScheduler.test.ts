import { describe, expect, it } from 'vitest';
import {
  EVENT_TIMELINE,
  MAX_ACTIVE_NPCS,
  PHASE_DESCRIPTIONS,
  TENSION_TIMELINE,
  timeToMinutes,
} from '../systems/eventScheduler';

describe('eventScheduler basics', () => {
  it('converts HH:MM to absolute minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('06:00')).toBe(360);
    expect(timeToMinutes('12:34')).toBe(754);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('contains a large 24h event plan with spawn/mood actions', () => {
    expect(EVENT_TIMELINE.length).toBeGreaterThan(60);
    expect(EVENT_TIMELINE.some((e) => e.action === 'SPAWN')).toBe(true);
    expect(EVENT_TIMELINE.some((e) => e.action === 'MOOD_CHANGE')).toBe(true);
    expect(EVENT_TIMELINE.some((e) => e.time === '21:00')).toBe(true);
  });

  it('defines non-empty tension and phase timelines', () => {
    expect(TENSION_TIMELINE.length).toBeGreaterThan(10);
    expect(PHASE_DESCRIPTIONS.length).toBeGreaterThan(10);
    expect(TENSION_TIMELINE[0]?.time).toBe('06:00');
    expect(PHASE_DESCRIPTIONS[0]?.time).toBe('06:00');
  });

  it('caps active NPC count for performance', () => {
    expect(MAX_ACTIVE_NPCS).toBe(500);
  });
});
