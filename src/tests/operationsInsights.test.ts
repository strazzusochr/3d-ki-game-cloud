import { describe, expect, it } from 'vitest';
import { getOperationsInsight } from '../systems/operationsInsights';
import type { RoleTrendPoint } from '../stores/gameStore';

const baseTrend = (items: Array<Partial<RoleTrendPoint>>): RoleTrendPoint[] =>
  items.map((item, index) => ({
    time: item.time ?? `1${index}:00`,
    security: item.security ?? 10,
    aggressors: item.aggressors ?? 10,
    support: item.support ?? 4,
    civilian: item.civilian ?? 20,
    panicRatioPercent: item.panicRatioPercent ?? 20,
  }));

describe('operations insights', () => {
  it('returns critical priority for very high panic and damage pressure', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { aggressors: 12, panicRatioPercent: 48 },
        { aggressors: 15, panicRatioPercent: 68 },
      ]),
      dayStats: { killed: 0, arrested: 4, injured: 31, damage: 62000 },
      missionCompletionPercent: 70,
      panicRatioPercent: 68,
      activeHooks: 3,
      maxHooks: 4,
      activeDynamicResponses: 2,
    });

    expect(insight.priority).toBe('critical');
    expect(insight.recommendation).toContain('Kritisch');
    expect(insight.confidencePercent).toBeGreaterThanOrEqual(60);
    expect(insight.missionPathWeightPercent).toBeLessThan(100);
    expect(insight.trendSignal).toBe('deteriorating');
    expect(insight.phaseBand).toBe('MORNING');
    expect(insight.trendMomentumScore).toBeGreaterThan(0);
  });

  it('returns medium priority when mission progress and support are weak', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { support: 5, aggressors: 9, panicRatioPercent: 22 },
        { support: 2, aggressors: 10, panicRatioPercent: 24 },
      ]),
      dayStats: { killed: 0, arrested: 1, injured: 4, damage: 6000 },
      missionCompletionPercent: 42,
      panicRatioPercent: 24,
      activeHooks: 1,
      maxHooks: 4,
      activeDynamicResponses: 0,
    });

    expect(insight.priority).toBe('medium');
    expect(insight.recommendation).toContain('Mittel');
    expect(insight.correlationLine).toContain('Hook-Auslastung');
    expect(insight.correlationLine).toContain('Pfadgewicht');
    expect(insight.correlationLine).toContain('Fenster');
    expect(insight.correlationLine).toContain('Momentum');
    expect(insight.missionPathWeightPercent).toBeLessThanOrEqual(100);
    expect(insight.trendSignal).not.toBe('stabilizing');
  });

  it('returns low priority for stable trends', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { security: 12, aggressors: 8, support: 4, panicRatioPercent: 14 },
        { security: 12, aggressors: 8, support: 4, panicRatioPercent: 14 },
      ]),
      dayStats: { killed: 0, arrested: 0, injured: 1, damage: 1200 },
      missionCompletionPercent: 88,
      panicRatioPercent: 14,
      activeHooks: 4,
      maxHooks: 4,
      activeDynamicResponses: 2,
    });

    expect(insight.priority).toBe('low');
    expect(insight.recommendation).toContain('stabil');
    expect(insight.missionPathWeightPercent).toBeGreaterThanOrEqual(95);
    expect(insight.trendSignal).toBe('flat');
    expect(insight.phaseBand).toBe('MORNING');
    expect(Math.abs(insight.trendMomentumScore)).toBeLessThanOrEqual(2);
  });

  it('raises mission path weight for high completion and hook utilization', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { security: 13, aggressors: 7, support: 6, panicRatioPercent: 12 },
        { security: 14, aggressors: 6, support: 7, panicRatioPercent: 10 },
      ]),
      dayStats: { killed: 0, arrested: 3, injured: 2, damage: 1800 },
      missionCompletionPercent: 92,
      panicRatioPercent: 10,
      activeHooks: 4,
      maxHooks: 4,
      activeDynamicResponses: 4,
    });

    expect(insight.priority).toBe('low');
    expect(insight.missionPathWeightPercent).toBeGreaterThan(110);
    expect(insight.correlationLine).toContain('Trend');
    expect(insight.phaseBand).toBe('MORNING');
    expect(insight.trendMomentumScore).toBeLessThan(0);
  });

  it('reports stabilizing trend when aggressors and panic drop', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { security: 8, aggressors: 14, support: 4, panicRatioPercent: 42 },
        { security: 11, aggressors: 10, support: 5, panicRatioPercent: 36 },
      ]),
      dayStats: { killed: 0, arrested: 2, injured: 5, damage: 11000 },
      missionCompletionPercent: 74,
      panicRatioPercent: 36,
      activeHooks: 3,
      maxHooks: 4,
      activeDynamicResponses: 3,
    });

    expect(insight.trendSignal).toBe('stabilizing');
  });

  it('applies evening/late phase weighting to path score', () => {
    const midday = getOperationsInsight({
      trendHistory: baseTrend([
        { time: '13:00', security: 11, aggressors: 9, support: 5, panicRatioPercent: 20 },
        { time: '13:30', security: 11, aggressors: 9, support: 5, panicRatioPercent: 20 },
      ]),
      dayStats: { killed: 0, arrested: 1, injured: 3, damage: 5000 },
      missionCompletionPercent: 70,
      panicRatioPercent: 20,
      activeHooks: 2,
      maxHooks: 4,
      activeDynamicResponses: 2,
    });

    const late = getOperationsInsight({
      trendHistory: baseTrend([
        { time: '22:00', security: 11, aggressors: 9, support: 5, panicRatioPercent: 20 },
        { time: '22:30', security: 11, aggressors: 9, support: 5, panicRatioPercent: 20 },
      ]),
      dayStats: { killed: 0, arrested: 1, injured: 3, damage: 5000 },
      missionCompletionPercent: 70,
      panicRatioPercent: 20,
      activeHooks: 2,
      maxHooks: 4,
      activeDynamicResponses: 2,
    });

    expect(midday.phaseBand).toBe('MIDDAY');
    expect(late.phaseBand).toBe('LATE');
    expect(late.missionPathWeightPercent).toBeLessThan(midday.missionPathWeightPercent);
  });

  it('detects volatility from multi-point oscillation even when first/last are similar', () => {
    const insight = getOperationsInsight({
      trendHistory: baseTrend([
        { time: '18:00', security: 10, aggressors: 10, support: 4, panicRatioPercent: 20 },
        { time: '18:05', security: 8, aggressors: 14, support: 3, panicRatioPercent: 29 },
        { time: '18:10', security: 11, aggressors: 9, support: 5, panicRatioPercent: 19 },
        { time: '18:15', security: 9, aggressors: 13, support: 3, panicRatioPercent: 28 },
        { time: '18:20', security: 10, aggressors: 10, support: 4, panicRatioPercent: 20 },
      ]),
      dayStats: { killed: 0, arrested: 1, injured: 5, damage: 8200 },
      missionCompletionPercent: 66,
      panicRatioPercent: 20,
      activeHooks: 2,
      maxHooks: 4,
      activeDynamicResponses: 2,
    });

    expect(insight.trendSignal).toBe('volatile');
    expect(Math.abs(insight.trendMomentumScore)).toBeLessThanOrEqual(8);
    expect(insight.trendTurbulenceScore).toBeGreaterThanOrEqual(25);
  });
});
