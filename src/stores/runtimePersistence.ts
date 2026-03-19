import type { InteractionZoneId } from '../systems/interactionZones';

export const RUNTIME_SNAPSHOT_KEY = 'ccu.runtime.snapshot.v1';
const MAX_TREND_POINTS = 24;
const MAX_REPLAY_HISTORY_POINTS = 6;

interface RuntimeMissionProgress {
    epochBriefingVerified: boolean;
    hazardMapPrepared: boolean;
    prioritizedZoneIds: InteractionZoneId[];
}

interface RuntimeDayStats {
    killed: number;
    arrested: number;
    injured: number;
    damage: number;
}

interface RuntimeTrendPoint {
    time: string;
    security: number;
    aggressors: number;
    support: number;
    civilian: number;
    panicRatioPercent: number;
}

interface RuntimeReplayState {
    mode: 'live' | 'rewind';
    rebuildStatus: 'idle' | 'reconstructed';
    rebuildEventCount: number;
    anchorTime: string;
    rebuildHistory: RuntimeReplayHistoryPoint[];
    quality: RuntimeReplayQuality;
}

interface RuntimeReplayHistoryPoint {
    mode: 'live' | 'rewind';
    anchorTime: string;
    rebuildEventCount: number;
    savedAtEpochMs: number;
}

interface RuntimeReplayQuality {
    windowMinutes: number;
    rebuildCount: number;
    avgRebuildEvents: number;
    deltaEventsPerCheckpoint: number;
    deltaDirection: 'up' | 'down' | 'flat';
    deltaHint: 'Replay-Eventlast steigt.' | 'Replay-Eventlast sinkt.' | 'Replay-Eventlast stabil.';
    deltaVolatilityBand: 'calm' | 'mixed' | 'volatile';
    deltaVolatilityHint: 'Delta-Verlauf stabil.' | 'Delta-Verlauf leicht wechselhaft.' | 'Delta-Verlauf oszilliert stark.';
    deltaHistory: number[];
    deltaMomentumScore: number;
    deltaMomentumDirection: 'up' | 'down' | 'flat';
    deltaMomentumBand: 'easing' | 'steady' | 'accelerating';
    deltaMomentumHint: 'Trendbeschleunigung gering.' | 'Trendbeschleunigung moderat.' | 'Trendbeschleunigung hoch.';
    deltaDriftScore: number;
    deltaDriftDirection: 'up' | 'down' | 'flat';
    deltaDriftBand: 'aligned' | 'offset' | 'diverging';
    deltaDriftHint: 'Delta-Basis stabil.' | 'Delta-Basis leicht versetzt.' | 'Delta-Basis driftet stark.';
    deltaAnomalyScore: number;
    deltaAnomalyDirection: 'up' | 'down' | 'flat';
    deltaAnomalyBand: 'normal' | 'watch' | 'spike';
    deltaAnomalyHint: 'Keine auffaellige Delta-Anomalie.' | 'Delta-Ausreisser beobachten.' | 'Delta-Ausreisser sofort pruefen.';
    stability: 'stable' | 'watch' | 'critical';
    recentStabilityTrend: Array<'stable' | 'watch' | 'critical'>;
    riskLevel: 'low' | 'medium' | 'high';
    riskHint: 'Stabiler Replay-Betrieb.' | 'Rewind-Takt reduzieren und grobere Spruenge nutzen.' | 'Replay-Risiko hoch: Rewind-Frequenz sofort senken.';
    riskLastHighAnchorTime: string | null;
    riskRecoveryMinutes: number | null;
    recoveryBand: 'hot' | 'cooling' | 'recovered' | 'unknown';
    recoveryHint:
        | 'Sofort entlasten: unter 30 Minuten seit HIGH.'
        | 'Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.'
        | 'Erholt: mehr als 90 Minuten seit letztem HIGH.'
        | 'Noch kein HIGH-Risiko erfasst.';
}

export interface RuntimeSnapshot {
    version: 1;
    savedAtEpochMs: number;
    inGameTime: string;
    timeSpeed: number;
    playerReputation: number;
    moralScore: number;
    masterVolume: number;
    muted: boolean;
    missionProgress: RuntimeMissionProgress;
    dayStats: RuntimeDayStats;
    roleTrendHistory: RuntimeTrendPoint[];
    replayState: RuntimeReplayState;
}

const ALLOWED_ZONE_IDS = new Set<InteractionZoneId>([
    'epoch-terminal',
    'hazard-console',
    'evacuation-board-north',
    'evacuation-board-west',
    'evacuation-board-south',
]);

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getMinutesSinceAnchor = (referenceClock: string, anchorClock: string) => {
    const referenceParts = referenceClock.split(':').map(Number);
    const anchorParts = anchorClock.split(':').map(Number);
    const referenceMinutes = referenceParts[0] * 60 + referenceParts[1];
    const anchorMinutes = anchorParts[0] * 60 + anchorParts[1];
    let delta = referenceMinutes - anchorMinutes;
    if (delta < 0) {
        delta += 24 * 60;
    }
    return delta;
};

const normalizeClock = (value: unknown) => {
    if (typeof value !== 'string') return '06:00';
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return '06:00';
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '06:00';
    if (h < 0 || h > 23 || m < 0 || m > 59) return '06:00';
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const normalizeMissionProgress = (value: unknown): RuntimeMissionProgress => {
    const asObj = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const zoneIdsRaw = Array.isArray(asObj.prioritizedZoneIds) ? asObj.prioritizedZoneIds : [];
    const prioritizedZoneIds = zoneIdsRaw
        .filter((id): id is InteractionZoneId => typeof id === 'string' && ALLOWED_ZONE_IDS.has(id as InteractionZoneId))
        .slice(0, 3);

    return {
        epochBriefingVerified: Boolean(asObj.epochBriefingVerified),
        hazardMapPrepared: Boolean(asObj.hazardMapPrepared),
        prioritizedZoneIds,
    };
};

const normalizeDayStats = (value: unknown): RuntimeDayStats => {
    const asObj = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const toNumber = (raw: unknown) => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);

    return {
        killed: Math.max(0, Math.round(toNumber(asObj.killed))),
        arrested: Math.max(0, Math.round(toNumber(asObj.arrested))),
        injured: Math.max(0, Math.round(toNumber(asObj.injured))),
        damage: Math.max(0, Math.round(toNumber(asObj.damage))),
    };
};

const normalizeRoleTrendHistory = (value: unknown): RuntimeTrendPoint[] => {
    if (!Array.isArray(value)) return [];

    const toNumber = (raw: unknown, min: number, max: number) => {
        const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
        return clamp(Math.round(n), min, max);
    };

    return value
        .map((item) => {
            const asObj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
            if (!asObj) return null;
            return {
                time: normalizeClock(asObj.time),
                security: toNumber(asObj.security, 0, 999),
                aggressors: toNumber(asObj.aggressors, 0, 999),
                support: toNumber(asObj.support, 0, 999),
                civilian: toNumber(asObj.civilian, 0, 9999),
                panicRatioPercent: toNumber(asObj.panicRatioPercent, 0, 100),
            };
        })
        .filter((item): item is RuntimeTrendPoint => item !== null)
        .slice(-MAX_TREND_POINTS);
};

const normalizeReplayState = (value: unknown, fallbackAnchorTime: string): RuntimeReplayState => {
    const asObj = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const mode = asObj.mode === 'rewind' ? 'rewind' : 'live';
    const rebuildStatus = asObj.rebuildStatus === 'reconstructed' ? 'reconstructed' : 'idle';
    const anchorTime = normalizeClock(asObj.anchorTime ?? fallbackAnchorTime);
    const rebuildEventCountRaw =
        typeof asObj.rebuildEventCount === 'number' && Number.isFinite(asObj.rebuildEventCount)
            ? asObj.rebuildEventCount
            : 0;
    const rebuildHistory = Array.isArray(asObj.rebuildHistory)
        ? asObj.rebuildHistory
            .map((entry) => {
                const item = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
                if (!item) return null;
                const itemMode = item.mode === 'rewind' ? 'rewind' : 'live';
                const itemEventCountRaw =
                    typeof item.rebuildEventCount === 'number' && Number.isFinite(item.rebuildEventCount)
                        ? item.rebuildEventCount
                        : 0;
                const itemSavedAtRaw =
                    typeof item.savedAtEpochMs === 'number' && Number.isFinite(item.savedAtEpochMs)
                        ? item.savedAtEpochMs
                        : Date.now();
                return {
                    mode: itemMode,
                    anchorTime: normalizeClock(item.anchorTime),
                    rebuildEventCount: Math.max(0, Math.round(itemEventCountRaw)),
                    savedAtEpochMs: Math.max(0, Math.round(itemSavedAtRaw)),
                };
            })
            .filter((entry): entry is RuntimeReplayHistoryPoint => entry !== null)
            .slice(0, MAX_REPLAY_HISTORY_POINTS)
        : [];
    const qualityObj =
        typeof asObj.quality === 'object' && asObj.quality !== null
            ? (asObj.quality as Record<string, unknown>)
            : {};
    const qualityWindowRaw =
        typeof qualityObj.windowMinutes === 'number' && Number.isFinite(qualityObj.windowMinutes)
            ? qualityObj.windowMinutes
            : 90;
    const qualityRebuildCountRaw =
        typeof qualityObj.rebuildCount === 'number' && Number.isFinite(qualityObj.rebuildCount)
            ? qualityObj.rebuildCount
            : rebuildHistory.length;
    const qualityAvgEventsRaw =
        typeof qualityObj.avgRebuildEvents === 'number' && Number.isFinite(qualityObj.avgRebuildEvents)
            ? qualityObj.avgRebuildEvents
            : 0;
    const qualityDeltaEventsRaw =
        typeof qualityObj.deltaEventsPerCheckpoint === 'number' && Number.isFinite(qualityObj.deltaEventsPerCheckpoint)
            ? qualityObj.deltaEventsPerCheckpoint
            : 0;
    const qualityStability =
        qualityObj.stability === 'critical' || qualityObj.stability === 'watch'
            ? qualityObj.stability
            : 'stable';
    const qualityRiskLevel =
        qualityObj.riskLevel === 'high' || qualityObj.riskLevel === 'medium'
            ? qualityObj.riskLevel
            : 'low';
    const qualityDeltaDirection =
        qualityObj.deltaDirection === 'up' || qualityObj.deltaDirection === 'down' || qualityObj.deltaDirection === 'flat'
            ? qualityObj.deltaDirection
            : qualityDeltaEventsRaw > 0
                ? 'up'
                : qualityDeltaEventsRaw < 0
                    ? 'down'
                    : 'flat';
    const qualityDeltaHint =
        qualityObj.deltaHint === 'Replay-Eventlast steigt.' ||
        qualityObj.deltaHint === 'Replay-Eventlast sinkt.' ||
        qualityObj.deltaHint === 'Replay-Eventlast stabil.'
            ? qualityObj.deltaHint
            : qualityDeltaDirection === 'up'
                ? 'Replay-Eventlast steigt.'
                : qualityDeltaDirection === 'down'
                    ? 'Replay-Eventlast sinkt.'
                    : 'Replay-Eventlast stabil.';
    const qualityDeltaVolatilityBand: 'calm' | 'mixed' | 'volatile' =
        qualityObj.deltaVolatilityBand === 'calm' || qualityObj.deltaVolatilityBand === 'mixed' || qualityObj.deltaVolatilityBand === 'volatile'
            ? qualityObj.deltaVolatilityBand
            : 'calm';
    const qualityDeltaVolatilityHint: 'Delta-Verlauf stabil.' | 'Delta-Verlauf leicht wechselhaft.' | 'Delta-Verlauf oszilliert stark.' =
        qualityObj.deltaVolatilityHint === 'Delta-Verlauf stabil.' ||
        qualityObj.deltaVolatilityHint === 'Delta-Verlauf leicht wechselhaft.' ||
        qualityObj.deltaVolatilityHint === 'Delta-Verlauf oszilliert stark.'
            ? qualityObj.deltaVolatilityHint
            : qualityDeltaVolatilityBand === 'volatile'
                ? 'Delta-Verlauf oszilliert stark.'
                : qualityDeltaVolatilityBand === 'mixed'
                    ? 'Delta-Verlauf leicht wechselhaft.'
                    : 'Delta-Verlauf stabil.';
    const qualityRiskHint =
        qualityObj.riskHint === 'Replay-Risiko hoch: Rewind-Frequenz sofort senken.' ||
        qualityObj.riskHint === 'Rewind-Takt reduzieren und grobere Spruenge nutzen.'
            ? qualityObj.riskHint
            : 'Stabiler Replay-Betrieb.';
    let qualityRiskLastHighAnchorTime =
        typeof qualityObj.riskLastHighAnchorTime === 'string'
            ? normalizeClock(qualityObj.riskLastHighAnchorTime)
            : null;
    let qualityRiskRecoveryMinutes =
        typeof qualityObj.riskRecoveryMinutes === 'number' && Number.isFinite(qualityObj.riskRecoveryMinutes)
            ? clamp(Math.round(qualityObj.riskRecoveryMinutes), 0, 24 * 60)
            : null;

    if (qualityRiskLevel === 'high') {
        qualityRiskLastHighAnchorTime = anchorTime;
        qualityRiskRecoveryMinutes = 0;
    } else if (qualityRiskLastHighAnchorTime && qualityRiskRecoveryMinutes === null) {
        qualityRiskRecoveryMinutes = getMinutesSinceAnchor(anchorTime, qualityRiskLastHighAnchorTime);
    }
    const derivedRecoveryBand: 'hot' | 'cooling' | 'recovered' | 'unknown' = qualityRiskRecoveryMinutes === null
        ? 'unknown'
        : qualityRiskRecoveryMinutes < 30
            ? 'hot'
            : qualityRiskRecoveryMinutes <= 90
                ? 'cooling'
                : 'recovered';
    const qualityRecoveryBand =
        qualityObj.recoveryBand === 'hot' || qualityObj.recoveryBand === 'cooling' || qualityObj.recoveryBand === 'recovered'
            ? qualityObj.recoveryBand
            : derivedRecoveryBand;
    const qualityRecoveryHint =
        qualityObj.recoveryHint === 'Sofort entlasten: unter 30 Minuten seit HIGH.' ||
        qualityObj.recoveryHint === 'Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.' ||
        qualityObj.recoveryHint === 'Erholt: mehr als 90 Minuten seit letztem HIGH.'
            ? qualityObj.recoveryHint
            : qualityRecoveryBand === 'hot'
                ? 'Sofort entlasten: unter 30 Minuten seit HIGH.'
                : qualityRecoveryBand === 'cooling'
                    ? 'Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.'
                    : qualityRecoveryBand === 'recovered'
                        ? 'Erholt: mehr als 90 Minuten seit letztem HIGH.'
                        : 'Noch kein HIGH-Risiko erfasst.';

    const qualityTrend = Array.isArray(qualityObj.recentStabilityTrend)
        ? qualityObj.recentStabilityTrend
            .filter(
                (item): item is 'stable' | 'watch' | 'critical' =>
                    item === 'stable' || item === 'watch' || item === 'critical',
            )
            .slice(0, 3)
        : [];
    const qualityDeltaHistory = Array.isArray(qualityObj.deltaHistory)
        ? qualityObj.deltaHistory
            .filter((v): v is number => typeof v === 'number' && isFinite(v))
            .map(v => clamp(Math.round(v), -999, 999))
            .slice(0, 6)
        : [];
    const qualityDeltaMomentumScoreRaw =
        typeof qualityObj.deltaMomentumScore === 'number' && Number.isFinite(qualityObj.deltaMomentumScore)
            ? qualityObj.deltaMomentumScore
            : qualityDeltaHistory.length >= 2
                ? qualityDeltaHistory[0] - qualityDeltaHistory[1]
                : qualityDeltaHistory[0] ?? 0;
    const qualityDeltaMomentumScore = clamp(Math.round(qualityDeltaMomentumScoreRaw), -999, 999);
    const qualityDeltaMomentumDirection =
        qualityObj.deltaMomentumDirection === 'up' || qualityObj.deltaMomentumDirection === 'down' || qualityObj.deltaMomentumDirection === 'flat'
            ? qualityObj.deltaMomentumDirection
            : qualityDeltaMomentumScore > 0
                ? 'up'
                : qualityDeltaMomentumScore < 0
                    ? 'down'
                    : 'flat';
    const qualityDeltaMomentumAbs = Math.abs(qualityDeltaMomentumScore);
    const qualityDeltaMomentumBand: 'easing' | 'steady' | 'accelerating' =
        qualityObj.deltaMomentumBand === 'easing' || qualityObj.deltaMomentumBand === 'steady' || qualityObj.deltaMomentumBand === 'accelerating'
            ? qualityObj.deltaMomentumBand
            : qualityDeltaMomentumAbs >= 6
                ? 'accelerating'
                : qualityDeltaMomentumAbs >= 3
                    ? 'steady'
                    : 'easing';
    const qualityDeltaMomentumHint: 'Trendbeschleunigung gering.' | 'Trendbeschleunigung moderat.' | 'Trendbeschleunigung hoch.' =
        qualityObj.deltaMomentumHint === 'Trendbeschleunigung gering.' ||
        qualityObj.deltaMomentumHint === 'Trendbeschleunigung moderat.' ||
        qualityObj.deltaMomentumHint === 'Trendbeschleunigung hoch.'
            ? qualityObj.deltaMomentumHint
            : qualityDeltaMomentumBand === 'accelerating'
                ? 'Trendbeschleunigung hoch.'
                : qualityDeltaMomentumBand === 'steady'
                    ? 'Trendbeschleunigung moderat.'
                    : 'Trendbeschleunigung gering.';
    const qualityDeltaDriftScoreRaw =
        typeof qualityObj.deltaDriftScore === 'number' && Number.isFinite(qualityObj.deltaDriftScore)
            ? qualityObj.deltaDriftScore
            : qualityDeltaHistory.length >= 2
                ? qualityDeltaHistory[0] - Math.round(qualityDeltaHistory.slice(1).reduce((sum, value) => sum + value, 0) / Math.max(1, qualityDeltaHistory.length - 1))
                : qualityDeltaHistory[0] ?? 0;
    const qualityDeltaDriftScore = clamp(Math.round(qualityDeltaDriftScoreRaw), -999, 999);
    const qualityDeltaDriftDirection =
        qualityObj.deltaDriftDirection === 'up' || qualityObj.deltaDriftDirection === 'down' || qualityObj.deltaDriftDirection === 'flat'
            ? qualityObj.deltaDriftDirection
            : qualityDeltaDriftScore > 0
                ? 'up'
                : qualityDeltaDriftScore < 0
                    ? 'down'
                    : 'flat';
    const qualityDeltaDriftAbs = Math.abs(qualityDeltaDriftScore);
    const qualityDeltaDriftBand: 'aligned' | 'offset' | 'diverging' =
        qualityObj.deltaDriftBand === 'aligned' || qualityObj.deltaDriftBand === 'offset' || qualityObj.deltaDriftBand === 'diverging'
            ? qualityObj.deltaDriftBand
            : qualityDeltaDriftAbs >= 8
                ? 'diverging'
                : qualityDeltaDriftAbs >= 4
                    ? 'offset'
                    : 'aligned';
    const qualityDeltaDriftHint: 'Delta-Basis stabil.' | 'Delta-Basis leicht versetzt.' | 'Delta-Basis driftet stark.' =
        qualityObj.deltaDriftHint === 'Delta-Basis stabil.' ||
        qualityObj.deltaDriftHint === 'Delta-Basis leicht versetzt.' ||
        qualityObj.deltaDriftHint === 'Delta-Basis driftet stark.'
            ? qualityObj.deltaDriftHint
            : qualityDeltaDriftBand === 'diverging'
                ? 'Delta-Basis driftet stark.'
                : qualityDeltaDriftBand === 'offset'
                    ? 'Delta-Basis leicht versetzt.'
                    : 'Delta-Basis stabil.';
    const qualityDeltaAnomalyScoreRaw =
        typeof qualityObj.deltaAnomalyScore === 'number' && Number.isFinite(qualityObj.deltaAnomalyScore)
            ? qualityObj.deltaAnomalyScore
            : qualityDeltaHistory.length >= 2
                ? qualityDeltaHistory[0] - Math.round(qualityDeltaHistory.slice(1).reduce((sum, value) => sum + value, 0) / Math.max(1, qualityDeltaHistory.length - 1))
                : qualityDeltaHistory[0] ?? 0;
    const qualityDeltaAnomalyScore = clamp(Math.round(qualityDeltaAnomalyScoreRaw), -999, 999);
    const qualityDeltaAnomalyDirection =
        qualityObj.deltaAnomalyDirection === 'up' || qualityObj.deltaAnomalyDirection === 'down' || qualityObj.deltaAnomalyDirection === 'flat'
            ? qualityObj.deltaAnomalyDirection
            : qualityDeltaAnomalyScore > 0
                ? 'up'
                : qualityDeltaAnomalyScore < 0
                    ? 'down'
                    : 'flat';
    const qualityDeltaAnomalyAbs = Math.abs(qualityDeltaAnomalyScore);
    const qualityDeltaAnomalyBand: 'normal' | 'watch' | 'spike' =
        qualityObj.deltaAnomalyBand === 'normal' || qualityObj.deltaAnomalyBand === 'watch' || qualityObj.deltaAnomalyBand === 'spike'
            ? qualityObj.deltaAnomalyBand
            : qualityDeltaAnomalyAbs >= 10
                ? 'spike'
                : qualityDeltaAnomalyAbs >= 5
                    ? 'watch'
                    : 'normal';
    const qualityDeltaAnomalyHint: 'Keine auffaellige Delta-Anomalie.' | 'Delta-Ausreisser beobachten.' | 'Delta-Ausreisser sofort pruefen.' =
        qualityObj.deltaAnomalyHint === 'Keine auffaellige Delta-Anomalie.' ||
        qualityObj.deltaAnomalyHint === 'Delta-Ausreisser beobachten.' ||
        qualityObj.deltaAnomalyHint === 'Delta-Ausreisser sofort pruefen.'
            ? qualityObj.deltaAnomalyHint
            : qualityDeltaAnomalyBand === 'spike'
                ? 'Delta-Ausreisser sofort pruefen.'
                : qualityDeltaAnomalyBand === 'watch'
                    ? 'Delta-Ausreisser beobachten.'
                    : 'Keine auffaellige Delta-Anomalie.';

    return {
        mode,
        rebuildStatus,
        rebuildEventCount: Math.max(0, Math.round(rebuildEventCountRaw)),
        anchorTime,
        rebuildHistory,
        quality: {
            windowMinutes: clamp(Math.round(qualityWindowRaw), 15, 240),
            rebuildCount: Math.max(0, Math.round(qualityRebuildCountRaw)),
            avgRebuildEvents: Math.max(0, Math.round(qualityAvgEventsRaw)),
            deltaEventsPerCheckpoint: clamp(Math.round(qualityDeltaEventsRaw), -999, 999),
            deltaDirection: qualityDeltaDirection,
            deltaHint: qualityDeltaHint,
            deltaVolatilityBand: qualityDeltaVolatilityBand,
            deltaVolatilityHint: qualityDeltaVolatilityHint,
            deltaHistory: qualityDeltaHistory,
            deltaMomentumScore: qualityDeltaMomentumScore,
            deltaMomentumDirection: qualityDeltaMomentumDirection,
            deltaMomentumBand: qualityDeltaMomentumBand,
            deltaMomentumHint: qualityDeltaMomentumHint,
            deltaDriftScore: qualityDeltaDriftScore,
            deltaDriftDirection: qualityDeltaDriftDirection,
            deltaDriftBand: qualityDeltaDriftBand,
            deltaDriftHint: qualityDeltaDriftHint,
            deltaAnomalyScore: qualityDeltaAnomalyScore,
            deltaAnomalyDirection: qualityDeltaAnomalyDirection,
            deltaAnomalyBand: qualityDeltaAnomalyBand,
            deltaAnomalyHint: qualityDeltaAnomalyHint,
            stability: qualityStability,
            recentStabilityTrend: qualityTrend,
            riskLevel: qualityRiskLevel,
            riskHint: qualityRiskHint,
            riskLastHighAnchorTime: qualityRiskLastHighAnchorTime,
            riskRecoveryMinutes: qualityRiskRecoveryMinutes,
            recoveryBand: qualityRecoveryBand,
            recoveryHint: qualityRecoveryHint,
        },
    };
};

const normalizeSnapshot = (value: unknown): RuntimeSnapshot => {
    const asObj = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const inGameTime = normalizeClock(asObj.inGameTime);

    return {
        version: 1,
        savedAtEpochMs: typeof asObj.savedAtEpochMs === 'number' && Number.isFinite(asObj.savedAtEpochMs)
            ? Math.max(0, Math.round(asObj.savedAtEpochMs))
            : Date.now(),
        inGameTime,
        timeSpeed: clamp(
            typeof asObj.timeSpeed === 'number' && Number.isFinite(asObj.timeSpeed) ? asObj.timeSpeed : 1,
            0.25,
            10,
        ),
        playerReputation: clamp(
            typeof asObj.playerReputation === 'number' && Number.isFinite(asObj.playerReputation)
                ? Math.round(asObj.playerReputation)
                : 0,
            -100,
            100,
        ),
        moralScore: clamp(
            typeof asObj.moralScore === 'number' && Number.isFinite(asObj.moralScore)
                ? Math.round(asObj.moralScore)
                : 50,
            0,
            100,
        ),
        masterVolume: clamp(
            typeof asObj.masterVolume === 'number' && Number.isFinite(asObj.masterVolume) ? asObj.masterVolume : 0.5,
            0,
            1,
        ),
        muted: Boolean(asObj.muted),
        missionProgress: normalizeMissionProgress(asObj.missionProgress),
        dayStats: normalizeDayStats(asObj.dayStats),
        roleTrendHistory: normalizeRoleTrendHistory(asObj.roleTrendHistory),
        replayState: normalizeReplayState(asObj.replayState, inGameTime),
    };
};

export const loadRuntimeSnapshot = (): RuntimeSnapshot | null => {
    if (!hasStorage()) return null;

    try {
        const raw = window.localStorage.getItem(RUNTIME_SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return normalizeSnapshot(parsed);
    } catch {
        return null;
    }
};

export const saveRuntimeSnapshot = (snapshot: RuntimeSnapshot) => {
    if (!hasStorage()) return;

    try {
        window.localStorage.setItem(RUNTIME_SNAPSHOT_KEY, JSON.stringify(normalizeSnapshot(snapshot)));
    } catch {
        // no-op
    }
};

export const clearRuntimeSnapshot = () => {
    if (!hasStorage()) return;
    try {
        window.localStorage.removeItem(RUNTIME_SNAPSHOT_KEY);
    } catch {
        // no-op
    }
};
