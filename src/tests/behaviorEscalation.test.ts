import { describe, expect, it } from 'vitest';
import { computeAdaptiveBehavior, getBaselineBehaviorForType } from '../systems/ai/behaviorEscalation';

describe('behavior escalation rules', () => {
  it('keeps guard behavior non-interruptible', () => {
    const next = computeAdaptiveBehavior({
      type: 'POLICE',
      behavior: 'GUARD',
      tension: 95,
      hostileNearby: 4,
      policeNearby: 2,
      agitatorNearby: 2,
      panicNearby: 3,
    });

    expect(next).toBe('GUARD');
  });

  it('escalates civilians to flee under local hostile pressure', () => {
    const next = computeAdaptiveBehavior({
      type: 'CIVILIAN',
      behavior: 'WANDER',
      tension: 65,
      hostileNearby: 2,
      policeNearby: 0,
      agitatorNearby: 2,
      panicNearby: 1,
    });

    expect(next).toBe('FLEE');
  });

  it('escalates police to shield wall when panic and agitators cluster', () => {
    const next = computeAdaptiveBehavior({
      type: 'POLICE',
      behavior: 'PATROL',
      tension: 72,
      hostileNearby: 2,
      policeNearby: 1,
      agitatorNearby: 3,
      panicNearby: 3,
    });

    expect(next).toBe('SHIELD_WALL');
  });

  it('escalates agitators to combat when police are close at high tension', () => {
    const next = computeAdaptiveBehavior({
      type: 'EXTREMIST',
      behavior: 'FOLLOW',
      tension: 80,
      hostileNearby: 1,
      policeNearby: 1,
      agitatorNearby: 2,
      panicNearby: 0,
    });

    expect(next).toBe('COMBAT');
  });

  it('lets agitators attack when tension rises without nearby police', () => {
    const next = computeAdaptiveBehavior({
      type: 'RIOTER',
      behavior: 'FOLLOW',
      tension: 60,
      hostileNearby: 0,
      policeNearby: 0,
      agitatorNearby: 2,
      panicNearby: 0,
    });

    expect(next).toBe('ATTACK');
  });

  it('de-escalates adaptive civilian behavior back to baseline when calm', () => {
    const next = computeAdaptiveBehavior({
      type: 'CIVILIAN',
      behavior: 'FLEE',
      tension: 30,
      hostileNearby: 0,
      policeNearby: 0,
      agitatorNearby: 0,
      panicNearby: 0,
    });

    expect(next).toBe('WANDER');
  });

  it('returns expected baselines for key archetypes', () => {
    expect(getBaselineBehaviorForType('RIOT_POLICE', 'IDLE')).toBe('SHIELD_WALL');
    expect(getBaselineBehaviorForType('DEMONSTRATOR', 'IDLE')).toBe('GATHER');
    expect(getBaselineBehaviorForType('EXTREMIST', 'IDLE')).toBe('FOLLOW');
  });
});
