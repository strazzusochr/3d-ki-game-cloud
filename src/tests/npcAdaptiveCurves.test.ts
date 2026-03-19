import { describe, expect, it } from 'vitest';

import { getAdaptiveTriggerCurve } from '../systems/npcAdaptiveCurves';

describe('npc adaptive trigger curves', () => {
    it('erhoeht Schwellen bei hohem Aggressordruck und Volatilitaet', () => {
        const curve = getAdaptiveTriggerCurve({
            aggressorPressure: 9,
            supportReserve: 2,
            trendSignal: 'volatile',
            trendMomentumScore: 10,
            trendTurbulenceScore: 42,
        });

        expect(curve.syncThresholdDelta).toBeGreaterThan(0);
        expect(curve.fractureThresholdDelta).toBeGreaterThan(0);
        expect(curve.fallbackScaleFactor).toBeGreaterThan(1);
        expect(curve.positiveScaleFactor).toBeLessThanOrEqual(1);
    });

    it('entschaerft Fracture-Pfad bei stabilisierender Lage mit hoher Support-Reserve', () => {
        const curve = getAdaptiveTriggerCurve({
            aggressorPressure: -3,
            supportReserve: 12,
            trendSignal: 'stabilizing',
            trendMomentumScore: -10,
            trendTurbulenceScore: 12,
        });

        expect(curve.syncThresholdDelta).toBeLessThanOrEqual(0);
        expect(curve.fractureThresholdDelta).toBeLessThanOrEqual(0);
        expect(curve.positiveScaleFactor).toBeGreaterThanOrEqual(1);
        expect(curve.fallbackScaleFactor).toBeLessThanOrEqual(1);
    });

    it('begrenzt Faktoren und Deltas auf harte Sicherheitsgrenzen', () => {
        const curve = getAdaptiveTriggerCurve({
            aggressorPressure: 99,
            supportReserve: 0,
            trendSignal: 'volatile',
            trendMomentumScore: 99,
            trendTurbulenceScore: 99,
        });

        expect(curve.syncThresholdDelta).toBeLessThanOrEqual(8);
        expect(curve.fractureThresholdDelta).toBeLessThanOrEqual(6);
        expect(curve.positiveScaleFactor).toBeGreaterThanOrEqual(0.75);
        expect(curve.fallbackScaleFactor).toBeLessThanOrEqual(1.45);
    });
});
