export interface AdaptiveCurveInput {
    aggressorPressure: number;
    supportReserve: number;
    trendSignal: 'stabilizing' | 'deteriorating' | 'volatile' | 'flat';
    trendMomentumScore: number;
    trendTurbulenceScore: number;
}

export interface AdaptiveCurveOutput {
    syncThresholdDelta: number;
    fractureThresholdDelta: number;
    positiveScaleFactor: number;
    fallbackScaleFactor: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getAdaptiveTriggerCurve = (input: AdaptiveCurveInput): AdaptiveCurveOutput => {
    const pressure = clamp(input.aggressorPressure, -10, 15);
    const turbulence = clamp((input.trendTurbulenceScore - 20) / 40, 0, 1);

    const syncBaseDelta =
        pressure > 0
            ? Math.round(pressure * 0.6) + Math.round(turbulence * 4)
            : Math.round(pressure * 0.3);

    const fractureBaseDelta =
        pressure > 0
            ? Math.round(pressure * 0.4) + Math.round(turbulence * 3)
            : Math.round(pressure * 0.4);

    const stabilizingBonus = input.trendSignal === 'stabilizing' ? 0.08 : 0;
    const volatilePenalty = input.trendSignal === 'volatile' ? 0.1 : 0;

    const positiveScaleRaw =
        1 - pressure * 0.03 - turbulence * 0.08 + stabilizingBonus + (input.trendMomentumScore <= -8 ? 0.05 : 0);

    const fallbackScaleRaw =
        1 + pressure * 0.04 + turbulence * 0.12 + volatilePenalty + (input.trendMomentumScore >= 8 ? 0.08 : 0);

    const supportRelief = input.supportReserve >= 10 ? 0.06 : 0;

    return {
        syncThresholdDelta: clamp(syncBaseDelta, -4, 8),
        fractureThresholdDelta: clamp(fractureBaseDelta - (input.supportReserve >= 8 ? 2 : 0), -5, 6),
        positiveScaleFactor: clamp(Number(positiveScaleRaw.toFixed(3)), 0.75, 1.2),
        fallbackScaleFactor: clamp(Number((fallbackScaleRaw - supportRelief).toFixed(3)), 0.8, 1.45),
    };
};

export interface AdaptiveFactionThresholdInput {
    faction: string;
    tension: number;
    supportNearby: number;
    trendSignal: 'stabilizing' | 'deteriorating' | 'volatile' | 'flat';
    trendMomentumScore: number;
}

export const getAdaptiveFactionThreshold = (input: AdaptiveFactionThresholdInput): number => {
    // Adaptive Schwelle für Fraktionsreaktion
    let base = 50;
    if (input.faction === 'POLICE') {
        base += input.supportNearby * 2;
        if (input.trendSignal === 'stabilizing') base -= 5;
        if (input.trendSignal === 'deteriorating') base += 8;
    }
    if (input.faction === 'DEMONSTRATOR') {
        base -= input.supportNearby * 3;
        if (input.trendSignal === 'volatile') base += 10;
        if (input.trendSignal === 'stabilizing') base -= 7;
    }
    if (input.faction === 'AGGRESSOR') {
        base += input.trendMomentumScore * 1.5;
        if (input.trendSignal === 'deteriorating') base += 12;
    }
    if (input.faction === 'SUPPORT') {
        base -= input.supportNearby * 4;
        if (input.trendSignal === 'stabilizing') base -= 10;
    }
    // Clamp
    return Math.max(10, Math.min(90, Math.round(base)));
};
