import { create } from 'zustand';
import { NPCType, EmotionalState, NPCMood, NPCBehavior } from '../types/enums';
import { DIALOG_TREE } from '../data/dialogs';
import { workerManager } from '../managers/WorkerManager';
import { EVENT_TIMELINE, TENSION_TIMELINE, PHASE_DESCRIPTIONS, NPC_COLORS, MAX_ACTIVE_NPCS, timeToMinutes } from '../systems/eventScheduler';
import { INITIAL_MISSION_PROGRESS, type InteractionZoneId, applyInteractionOutcome } from '../systems/interactionZones';
import { applyMissionPhaseHooks } from '../systems/missionPhaseHooks';
import { getOperationsInsight } from '../systems/operationsInsights';
import { getAdaptiveTriggerCurve } from '../systems/npcAdaptiveCurves';
import { loadRuntimeSnapshot, saveRuntimeSnapshot, type RuntimeSnapshot } from './runtimePersistence';
import { io } from 'socket.io-client';
import { webrtcManager } from '../managers/WebRTCManager';

declare global {
    interface Window {
        __GAME_STORE__?: any;
        socket?: any;
    }
}

export const isRenderer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderer') === 'true';
export const isCloudflare = typeof window !== 'undefined' && window.location.hostname.includes('pages.dev');
export const streamProfile = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('profile') || (isCloudflare ? 'low' : 'medium') 
    : 'medium';
const socketUrl = isRenderer 
    ? (window.location.protocol + '//' + window.location.hostname + ':7860') 
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const socket = io(socketUrl, { autoConnect: false });
(window as any).socket = socket;

export interface NPCData {
    id: number;
    type: NPCType;
    position: [number, number, number];
    rotation: number;
    outfitColor: string;
    emotionalState: EmotionalState;
    mood: NPCMood;
    behavior: NPCBehavior;
}

interface DayStats {
    killed: number;
    arrested: number;
    injured: number;
    damage: number;
}

export interface RoleTrendPoint {
    time: string;
    security: number;
    aggressors: number;
    support: number;
    civilian: number;
    panicRatioPercent: number;
}
interface ReplayRebuildHistoryEntry {
    mode: 'live' | 'rewind';
    anchorTime: string;
    rebuildEventCount: number;
    savedAtEpochMs: number;
}

type ReplayQualityStability = 'stable' | 'watch' | 'critical';
type ReplayQualityDeltaDirection = 'up' | 'down' | 'flat';
type ReplayQualityDeltaHint = 'Replay-Eventlast steigt.' | 'Replay-Eventlast sinkt.' | 'Replay-Eventlast stabil.';
type ReplayQualityDeltaVolatilityBand = 'calm' | 'mixed' | 'volatile';
type ReplayQualityDeltaVolatilityHint = 'Delta-Verlauf stabil.' | 'Delta-Verlauf leicht wechselhaft.' | 'Delta-Verlauf oszilliert stark.';
type ReplayQualityDeltaMomentumBand = 'easing' | 'steady' | 'accelerating';
type ReplayQualityDeltaMomentumHint = 'Trendbeschleunigung gering.' | 'Trendbeschleunigung moderat.' | 'Trendbeschleunigung hoch.';
type ReplayQualityDeltaDriftBand = 'aligned' | 'offset' | 'diverging';
type ReplayQualityDeltaDriftHint = 'Delta-Basis stabil.' | 'Delta-Basis leicht versetzt.' | 'Delta-Basis driftet stark.';
type ReplayQualityDeltaAnomalyBand = 'normal' | 'watch' | 'spike';
type ReplayQualityDeltaAnomalyHint = 'Keine auffaellige Delta-Anomalie.' | 'Delta-Ausreisser beobachten.' | 'Delta-Ausreisser sofort pruefen.';
const MAX_DELTA_HISTORY_POINTS = 6;
type ReplayRiskLevel = 'low' | 'medium' | 'high';
type ReplayRiskHint =
    | 'Stabiler Replay-Betrieb.'
    | 'Rewind-Takt reduzieren und grobere Spruenge nutzen.'
    | 'Replay-Risiko hoch: Rewind-Frequenz sofort senken.';
type ReplayRecoveryBand = 'hot' | 'cooling' | 'recovered' | 'unknown';
type ReplayRecoveryHint =
    | 'Sofort entlasten: unter 30 Minuten seit HIGH.'
    | 'Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.'
    | 'Erholt: mehr als 90 Minuten seit letztem HIGH.'
    | 'Noch kein HIGH-Risiko erfasst.';

interface ReplayQualityState {
    windowMinutes: number;
    rebuildCount: number;
    avgRebuildEvents: number;
    deltaEventsPerCheckpoint: number;
    deltaDirection: ReplayQualityDeltaDirection;
    deltaHint: ReplayQualityDeltaHint;
    deltaVolatilityBand: ReplayQualityDeltaVolatilityBand;
    deltaVolatilityHint: ReplayQualityDeltaVolatilityHint;
    deltaHistory: number[];
    deltaMomentumScore: number;
    deltaMomentumDirection: ReplayQualityDeltaDirection;
    deltaMomentumBand: ReplayQualityDeltaMomentumBand;
    deltaMomentumHint: ReplayQualityDeltaMomentumHint;
    deltaDriftScore: number;
    deltaDriftDirection: ReplayQualityDeltaDirection;
    deltaDriftBand: ReplayQualityDeltaDriftBand;
    deltaDriftHint: ReplayQualityDeltaDriftHint;
    deltaAnomalyScore: number;
    deltaAnomalyDirection: ReplayQualityDeltaDirection;
    deltaAnomalyBand: ReplayQualityDeltaAnomalyBand;
    deltaAnomalyHint: ReplayQualityDeltaAnomalyHint;
    stability: ReplayQualityStability;
    recentStabilityTrend: ReplayQualityStability[];
    riskLevel: ReplayRiskLevel;
    riskHint: ReplayRiskHint;
    riskLastHighAnchorTime: string | null;
    riskRecoveryMinutes: number | null;
    recoveryBand: ReplayRecoveryBand;
    recoveryHint: ReplayRecoveryHint;
}

interface GameStore {
    npcs: NPCData[];
    firedEventKeys: string[];
    roleTrendHistory: RoleTrendPoint[];
    interactionState: {
        nearbyZoneId: InteractionZoneId | null;
        lastMessage: string | null;
        missionProgress: typeof INITIAL_MISSION_PROGRESS;
    };
    gameState: { 
        cloudStreamUrl: string;
        isPlaying: boolean; 
        isTimePaused: boolean; 
        inGameTime: string; 
        tensionLevel: number;
        timeSpeed: number;
        currentPhaseLabel: string;
        replayMode: 'live' | 'rewind';
        replayRebuildStatus: 'idle' | 'reconstructed';
        replayRebuildEventCount: number;
        replayAnchorTime: string;
        replayRebuildHistory: ReplayRebuildHistoryEntry[];
        replayQualityWindowMinutes: number;
        replayQualityRebuildCount: number;
        replayQualityAvgEvents: number;
        replayQualityDeltaEventsPerCheckpoint: number;
        replayQualityDeltaDirection: ReplayQualityDeltaDirection;
        replayQualityDeltaHint: ReplayQualityDeltaHint;
        replayQualityDeltaVolatilityBand: ReplayQualityDeltaVolatilityBand;
        replayQualityDeltaVolatilityHint: ReplayQualityDeltaVolatilityHint;
        replayQualityDeltaHistory: number[];
        replayQualityDeltaMomentumScore: number;
        replayQualityDeltaMomentumDirection: ReplayQualityDeltaDirection;
        replayQualityDeltaMomentumBand: ReplayQualityDeltaMomentumBand;
        replayQualityDeltaMomentumHint: ReplayQualityDeltaMomentumHint;
        replayQualityDeltaDriftScore: number;
        replayQualityDeltaDriftDirection: ReplayQualityDeltaDirection;
        replayQualityDeltaDriftBand: ReplayQualityDeltaDriftBand;
        replayQualityDeltaDriftHint: ReplayQualityDeltaDriftHint;
        replayQualityDeltaAnomalyScore: number;
        replayQualityDeltaAnomalyDirection: ReplayQualityDeltaDirection;
        replayQualityDeltaAnomalyBand: ReplayQualityDeltaAnomalyBand;
        replayQualityDeltaAnomalyHint: ReplayQualityDeltaAnomalyHint;
        replayQualityStability: ReplayQualityStability;
        replayQualityRecentTrend: ReplayQualityStability[];
        replayRiskLevel: ReplayRiskLevel;
        replayRiskHint: ReplayRiskHint;
        replayRiskLastHighAnchorTime: string | null;
        replayRiskRecoveryMinutes: number | null;
        replayRecoveryBand: ReplayRecoveryBand;
        replayRecoveryHint: ReplayRecoveryHint;
        // === CHUNK 11: Dynamisches System ===
        playerReputation: number;  // -100 (brutal) bis +100 (fair)
        moralScore: number;        // 0 (böse) bis 100 (gut)
        lastTacticalOrder: string | null;
        showStatistics: boolean;   // Statistik-Screen bei 00:00
        masterVolume: number;
        muted: boolean;
    };
    streamProfile: string;
    isZeroFootprint: boolean;
    remotePlayers: Record<string, { position: [number, number, number], rotation: number }>;
    dayStats: DayStats;
    dialogState: {
        activeNodeId: string | null;
        history: string[];
    };
    startGame: () => void;
    updateTime: (time: string) => void;
    advanceHour: () => void;
    rewindHour: () => void;
    advanceMinute: () => void;
    rewindMinute: () => void;
    toggleTimePause: () => void;
    setTension: (level: number) => void;
    evaluateEvents: (currentTime: string) => void;
    resetDayCycle: () => void;
    setTimeSpeed: (speed: number) => void;
    adjustReputation: (delta: number) => void;
    showStatisticsPanel: () => void;
    dismissStatistics: () => void;
    setMasterVolume: (vol: number) => void;
    setMuted: (muted: boolean) => void;
    startDialog: (nodeId: string) => void;
    chooseDialogOption: (choiceIndex: number) => void;
    closeDialog: () => void;
    issueTacticalOrder: (type: NPCType, behavior: NPCBehavior, mood?: NPCMood) => void;
    setNearbyInteraction: (zoneId: InteractionZoneId | null) => void;
    triggerInteraction: () => void;
    initSocket: () => void;
    updateRemotePlayer: (id: string, data: { position: [number, number, number], rotation: number }) => void;
    removeRemotePlayer: (id: string) => void;
    isVoiceActive: boolean;
    toggleVoice: () => Promise<void>;
    broadcastMoveP2P: (data: any) => void;
}

let nextNpcId = 1000;
const MAX_ROLE_TREND_POINTS = 24;
const MAX_REPLAY_HISTORY_POINTS = 6;
const REPLAY_QUALITY_WINDOW_MINUTES = 90;

const cloneMissionProgress = (progress: typeof INITIAL_MISSION_PROGRESS) => ({
    epochBriefingVerified: progress.epochBriefingVerified,
    hazardMapPrepared: progress.hazardMapPrepared,
    prioritizedZoneIds: [...progress.prioritizedZoneIds],
});

const RUNTIME_DEFAULTS = {
    inGameTime: '06:00',
    timeSpeed: 1,
    playerReputation: 0,
    moralScore: 50,
    masterVolume: 0.5,
    muted: false,
} as const;

const persistedRuntimeSnapshot = loadRuntimeSnapshot();

const persistedMissionProgress = persistedRuntimeSnapshot
    ? cloneMissionProgress(persistedRuntimeSnapshot.missionProgress)
    : cloneMissionProgress(INITIAL_MISSION_PROGRESS);

const persistedRoleTrendHistory = persistedRuntimeSnapshot
    ? persistedRuntimeSnapshot.roleTrendHistory
    : [];

const persistedDayStats = persistedRuntimeSnapshot
    ? persistedRuntimeSnapshot.dayStats
    : { killed: 0, arrested: 0, injured: 0, damage: 0 };

const persistedInGameTime = persistedRuntimeSnapshot?.inGameTime ?? RUNTIME_DEFAULTS.inGameTime;

const persistedReplayState = persistedRuntimeSnapshot?.replayState ?? {
    mode: 'live' as const,
    rebuildStatus: 'idle' as const,
    rebuildEventCount: 0,
    anchorTime: persistedInGameTime,
    rebuildHistory: [] as ReplayRebuildHistoryEntry[],
    quality: {
        windowMinutes: REPLAY_QUALITY_WINDOW_MINUTES,
        rebuildCount: 0,
        avgRebuildEvents: 0,
        deltaEventsPerCheckpoint: 0,
        deltaDirection: 'flat' as ReplayQualityDeltaDirection,
        deltaHint: 'Replay-Eventlast stabil.' as ReplayQualityDeltaHint,
        deltaVolatilityBand: 'calm' as ReplayQualityDeltaVolatilityBand,
        deltaVolatilityHint: 'Delta-Verlauf stabil.' as ReplayQualityDeltaVolatilityHint,
        deltaHistory: [] as number[],
        deltaMomentumScore: 0,
        deltaMomentumDirection: 'flat' as ReplayQualityDeltaDirection,
        deltaMomentumBand: 'easing' as ReplayQualityDeltaMomentumBand,
        deltaMomentumHint: 'Trendbeschleunigung gering.' as ReplayQualityDeltaMomentumHint,
        deltaDriftScore: 0,
        deltaDriftDirection: 'flat' as ReplayQualityDeltaDirection,
        deltaDriftBand: 'aligned' as ReplayQualityDeltaDriftBand,
        deltaDriftHint: 'Delta-Basis stabil.' as ReplayQualityDeltaDriftHint,
        deltaAnomalyScore: 0,
        deltaAnomalyDirection: 'flat' as ReplayQualityDeltaDirection,
        deltaAnomalyBand: 'normal' as ReplayQualityDeltaAnomalyBand,
        deltaAnomalyHint: 'Keine auffaellige Delta-Anomalie.' as ReplayQualityDeltaAnomalyHint,
        stability: 'stable' as ReplayQualityStability,
        recentStabilityTrend: [] as ReplayQualityStability[],
        riskLevel: 'low' as ReplayRiskLevel,
        riskHint: 'Stabiler Replay-Betrieb.' as ReplayRiskHint,
        riskLastHighAnchorTime: null as string | null,
        riskRecoveryMinutes: null as number | null,
        recoveryBand: 'unknown' as ReplayRecoveryBand,
        recoveryHint: 'Noch kein HIGH-Risiko erfasst.' as ReplayRecoveryHint,
    },
};

const getMinutesSinceAnchor = (referenceClock: string, anchorClock: string) => {
    const referenceMinutes = timeToMinutes(referenceClock);
    const anchorMinutes = timeToMinutes(anchorClock);
    let delta = referenceMinutes - anchorMinutes;
    if (delta < 0) {
        delta += 24 * 60;
    }
    return delta;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pushReplayHistory = (
    history: ReplayRebuildHistoryEntry[],
    entry: ReplayRebuildHistoryEntry,
): ReplayRebuildHistoryEntry[] => {
    const [latest] = history;
    if (
        latest &&
        latest.anchorTime === entry.anchorTime &&
        latest.rebuildEventCount === entry.rebuildEventCount &&
        latest.mode === entry.mode
    ) {
        return history;
    }
    return [entry, ...history].slice(0, MAX_REPLAY_HISTORY_POINTS);
};

const pushReplayQualityDeltaHistory = (
    history: number[],
    nextDelta: number,
): number[] => {
    if (history[0] === nextDelta) return history;
    return [nextDelta, ...history].slice(0, MAX_DELTA_HISTORY_POINTS);
};

const pushReplayQualityTrend = (
    trend: ReplayQualityStability[],
    nextStability: ReplayQualityStability,
): ReplayQualityStability[] => {
    const [latest] = trend;
    if (latest === nextStability) {
        return trend;
    }
    return [nextStability, ...trend].slice(0, 3);
};

const getReplayQualityState = (
    history: ReplayRebuildHistoryEntry[],
    referenceClock: string,
    previousTrend: ReplayQualityStability[],
    previousLastHighAnchorTime: string | null,
    previousAvgRebuildEvents: number,
    previousDeltaHistory: number[],
): ReplayQualityState => {
    const referenceMinutes = timeToMinutes(referenceClock);
    const inWindow = history.filter((entry) => {
        let delta = referenceMinutes - timeToMinutes(entry.anchorTime);
        if (delta < 0) {
            delta += 24 * 60;
        }
        return delta <= REPLAY_QUALITY_WINDOW_MINUTES;
    });
    const rebuildCount = inWindow.length;
    const eventSum = inWindow.reduce((sum, entry) => sum + entry.rebuildEventCount, 0);
    const avgRebuildEvents = rebuildCount > 0 ? Math.round(eventSum / rebuildCount) : 0;
    const deltaEventsPerCheckpoint = avgRebuildEvents - previousAvgRebuildEvents;
    const deltaDirection: ReplayQualityDeltaDirection =
        deltaEventsPerCheckpoint > 0 ? 'up' : deltaEventsPerCheckpoint < 0 ? 'down' : 'flat';
    const deltaHint: ReplayQualityDeltaHint =
        deltaDirection === 'up'
            ? 'Replay-Eventlast steigt.'
            : deltaDirection === 'down'
                ? 'Replay-Eventlast sinkt.'
                : 'Replay-Eventlast stabil.';
    const recentEventCounts = inWindow.slice(0, 3).map((entry) => entry.rebuildEventCount);
    const fallbackAmplitude = Math.abs(deltaEventsPerCheckpoint);
    const d1 = recentEventCounts.length >= 2 ? recentEventCounts[0] - recentEventCounts[1] : 0;
    const d2 = recentEventCounts.length >= 3 ? recentEventCounts[1] - recentEventCounts[2] : 0;
    const hasDirectionFlip = (d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0);
    const oscillationAmplitude = Math.abs(d1) + Math.abs(d2);
    const volatilityScore = recentEventCounts.length >= 3 ? oscillationAmplitude : fallbackAmplitude;
    const deltaVolatilityBand: ReplayQualityDeltaVolatilityBand = hasDirectionFlip && volatilityScore >= 4
        ? 'volatile'
        : volatilityScore >= 3
            ? 'mixed'
            : 'calm';
    const deltaVolatilityHint: ReplayQualityDeltaVolatilityHint = deltaVolatilityBand === 'volatile'
        ? 'Delta-Verlauf oszilliert stark.'
        : deltaVolatilityBand === 'mixed'
            ? 'Delta-Verlauf leicht wechselhaft.'
            : 'Delta-Verlauf stabil.';
    const deltaHistory = pushReplayQualityDeltaHistory(previousDeltaHistory, deltaEventsPerCheckpoint);
    const shortMomentumWindow = deltaHistory.slice(0, 3);
    const mediumMomentumWindow = deltaHistory.slice(3, 6);
    const shortMomentumAvg = shortMomentumWindow.length > 0
        ? Math.round(shortMomentumWindow.reduce((sum, value) => sum + value, 0) / shortMomentumWindow.length)
        : 0;
    const mediumMomentumAvg = mediumMomentumWindow.length > 0
        ? Math.round(mediumMomentumWindow.reduce((sum, value) => sum + value, 0) / mediumMomentumWindow.length)
        : deltaHistory.length > 0
            ? Math.round(deltaHistory.reduce((sum, value) => sum + value, 0) / deltaHistory.length)
            : 0;
    const deltaMomentumScore = clamp(shortMomentumAvg - mediumMomentumAvg, -999, 999);
    const deltaMomentumDirection: ReplayQualityDeltaDirection =
        deltaMomentumScore > 0 ? 'up' : deltaMomentumScore < 0 ? 'down' : 'flat';
    const deltaMomentumAbs = Math.abs(deltaMomentumScore);
    const deltaMomentumBand: ReplayQualityDeltaMomentumBand = deltaMomentumAbs >= 6
        ? 'accelerating'
        : deltaMomentumAbs >= 3
            ? 'steady'
            : 'easing';
    const deltaMomentumHint: ReplayQualityDeltaMomentumHint = deltaMomentumBand === 'accelerating'
        ? 'Trendbeschleunigung hoch.'
        : deltaMomentumBand === 'steady'
            ? 'Trendbeschleunigung moderat.'
            : 'Trendbeschleunigung gering.';
    const driftBaselineWindow = deltaHistory.slice(1, 6);
    const driftBaselineAvg = driftBaselineWindow.length > 0
        ? Math.round(driftBaselineWindow.reduce((sum, value) => sum + value, 0) / driftBaselineWindow.length)
        : 0;
    const deltaDriftScore = clamp(deltaEventsPerCheckpoint - driftBaselineAvg, -999, 999);
    const deltaDriftDirection: ReplayQualityDeltaDirection =
        deltaDriftScore > 0 ? 'up' : deltaDriftScore < 0 ? 'down' : 'flat';
    const deltaDriftAbs = Math.abs(deltaDriftScore);
    const deltaDriftBand: ReplayQualityDeltaDriftBand = deltaDriftAbs >= 8
        ? 'diverging'
        : deltaDriftAbs >= 4
            ? 'offset'
            : 'aligned';
    const deltaDriftHint: ReplayQualityDeltaDriftHint = deltaDriftBand === 'diverging'
        ? 'Delta-Basis driftet stark.'
        : deltaDriftBand === 'offset'
            ? 'Delta-Basis leicht versetzt.'
            : 'Delta-Basis stabil.';
    const anomalyReferenceWindow = deltaHistory.slice(1, 6);
    const anomalyReferenceAvg = anomalyReferenceWindow.length > 0
        ? Math.round(anomalyReferenceWindow.reduce((sum, value) => sum + value, 0) / anomalyReferenceWindow.length)
        : 0;
    const deltaAnomalyScore = clamp(deltaEventsPerCheckpoint - anomalyReferenceAvg, -999, 999);
    const deltaAnomalyDirection: ReplayQualityDeltaDirection =
        deltaAnomalyScore > 0 ? 'up' : deltaAnomalyScore < 0 ? 'down' : 'flat';
    const deltaAnomalyAbs = Math.abs(deltaAnomalyScore);
    const deltaAnomalyBand: ReplayQualityDeltaAnomalyBand = deltaAnomalyAbs >= 10
        ? 'spike'
        : deltaAnomalyAbs >= 5
            ? 'watch'
            : 'normal';
    const deltaAnomalyHint: ReplayQualityDeltaAnomalyHint = deltaAnomalyBand === 'spike'
        ? 'Delta-Ausreisser sofort pruefen.'
        : deltaAnomalyBand === 'watch'
            ? 'Delta-Ausreisser beobachten.'
            : 'Keine auffaellige Delta-Anomalie.';
    const stability: ReplayQualityStability =
        rebuildCount >= 4 || avgRebuildEvents >= 20
            ? 'critical'
            : rebuildCount >= 2 || avgRebuildEvents >= 10
                ? 'watch'
                : 'stable';
    const riskLevel: ReplayRiskLevel =
        rebuildCount >= 5 || avgRebuildEvents >= 24
            ? 'high'
            : rebuildCount >= 3 || avgRebuildEvents >= 12
                ? 'medium'
                : 'low';
    const riskHint: ReplayRiskHint =
        riskLevel === 'high'
            ? 'Replay-Risiko hoch: Rewind-Frequenz sofort senken.'
            : riskLevel === 'medium'
                ? 'Rewind-Takt reduzieren und grobere Spruenge nutzen.'
                : 'Stabiler Replay-Betrieb.';
    const riskLastHighAnchorTime = riskLevel === 'high' ? referenceClock : previousLastHighAnchorTime;
    const riskRecoveryMinutes = riskLevel === 'high'
        ? 0
        : riskLastHighAnchorTime
            ? getMinutesSinceAnchor(referenceClock, riskLastHighAnchorTime)
            : null;
    const recoveryBand: ReplayRecoveryBand = riskRecoveryMinutes === null
        ? 'unknown'
        : riskRecoveryMinutes < 30
            ? 'hot'
            : riskRecoveryMinutes <= 90
                ? 'cooling'
                : 'recovered';
    const recoveryHint: ReplayRecoveryHint = recoveryBand === 'hot'
        ? 'Sofort entlasten: unter 30 Minuten seit HIGH.'
        : recoveryBand === 'cooling'
            ? 'Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.'
            : recoveryBand === 'recovered'
                ? 'Erholt: mehr als 90 Minuten seit letztem HIGH.'
                : 'Noch kein HIGH-Risiko erfasst.';

    return {
        windowMinutes: REPLAY_QUALITY_WINDOW_MINUTES,
        rebuildCount,
        avgRebuildEvents,
        deltaEventsPerCheckpoint,
        deltaDirection,
        deltaHint,
        deltaVolatilityBand,
        deltaVolatilityHint,
        deltaHistory,
        deltaMomentumScore,
        deltaMomentumDirection,
        deltaMomentumBand,
        deltaMomentumHint,
        deltaDriftScore,
        deltaDriftDirection,
        deltaDriftBand,
        deltaDriftHint,
        deltaAnomalyScore,
        deltaAnomalyDirection,
        deltaAnomalyBand,
        deltaAnomalyHint,
        stability,
        recentStabilityTrend: pushReplayQualityTrend(previousTrend, stability),
        riskLevel,
        riskHint,
        riskLastHighAnchorTime,
        riskRecoveryMinutes,
        recoveryBand,
        recoveryHint,
    };
};

const buildRuntimeSnapshot = (state: GameStore): RuntimeSnapshot => ({
    version: 1,
    savedAtEpochMs: Date.now(),
    inGameTime: state.gameState.inGameTime,
    timeSpeed: state.gameState.timeSpeed,
    playerReputation: state.gameState.playerReputation,
    moralScore: state.gameState.moralScore,
    masterVolume: state.gameState.masterVolume,
    muted: state.gameState.muted,
    missionProgress: cloneMissionProgress(state.interactionState.missionProgress),
    dayStats: { ...state.dayStats },
    roleTrendHistory: state.roleTrendHistory.slice(-MAX_ROLE_TREND_POINTS),
    replayState: {
        mode: state.gameState.replayMode,
        rebuildStatus: state.gameState.replayRebuildStatus,
        rebuildEventCount: state.gameState.replayRebuildEventCount,
        anchorTime: state.gameState.replayAnchorTime,
        rebuildHistory: state.gameState.replayRebuildHistory.slice(0, MAX_REPLAY_HISTORY_POINTS),
        quality: {
            windowMinutes: state.gameState.replayQualityWindowMinutes,
            rebuildCount: state.gameState.replayQualityRebuildCount,
            avgRebuildEvents: state.gameState.replayQualityAvgEvents,
            deltaEventsPerCheckpoint: state.gameState.replayQualityDeltaEventsPerCheckpoint,
            deltaDirection: state.gameState.replayQualityDeltaDirection,
            deltaHint: state.gameState.replayQualityDeltaHint,
            deltaVolatilityBand: state.gameState.replayQualityDeltaVolatilityBand,
            deltaVolatilityHint: state.gameState.replayQualityDeltaVolatilityHint,
            deltaHistory: state.gameState.replayQualityDeltaHistory,
            deltaMomentumScore: state.gameState.replayQualityDeltaMomentumScore,
            deltaMomentumDirection: state.gameState.replayQualityDeltaMomentumDirection,
            deltaMomentumBand: state.gameState.replayQualityDeltaMomentumBand,
            deltaMomentumHint: state.gameState.replayQualityDeltaMomentumHint,
            deltaDriftScore: state.gameState.replayQualityDeltaDriftScore,
            deltaDriftDirection: state.gameState.replayQualityDeltaDriftDirection,
            deltaDriftBand: state.gameState.replayQualityDeltaDriftBand,
            deltaDriftHint: state.gameState.replayQualityDeltaDriftHint,
            deltaAnomalyScore: state.gameState.replayQualityDeltaAnomalyScore,
            deltaAnomalyDirection: state.gameState.replayQualityDeltaAnomalyDirection,
            deltaAnomalyBand: state.gameState.replayQualityDeltaAnomalyBand,
            deltaAnomalyHint: state.gameState.replayQualityDeltaAnomalyHint,
            stability: state.gameState.replayQualityStability,
            recentStabilityTrend: state.gameState.replayQualityRecentTrend,
            riskLevel: state.gameState.replayRiskLevel,
            riskHint: state.gameState.replayRiskHint,
            riskLastHighAnchorTime: state.gameState.replayRiskLastHighAnchorTime,
            riskRecoveryMinutes: state.gameState.replayRiskRecoveryMinutes,
            recoveryBand: state.gameState.replayRecoveryBand,
            recoveryHint: state.gameState.replayRecoveryHint,
        },
    },
});

const persistCurrentRuntimeSnapshot = (state: GameStore) => {
    saveRuntimeSnapshot(buildRuntimeSnapshot(state));
};

const SECURITY_TYPES = new Set<NPCType>([NPCType.POLICE, NPCType.RIOT_POLICE, NPCType.SEK]);
const AGGRESSOR_TYPES = new Set<NPCType>([NPCType.RIOTER, NPCType.EXTREMIST]);
const SUPPORT_TYPES = new Set<NPCType>([NPCType.MEDIC, NPCType.FIREFIGHTER]);

interface WorldReplayState {
    npcs: NPCData[];
    dayStats: DayStats;
    firedSet: Set<string>;
}

const minutesToClock = (minutes: number) => {
    const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const buildRoleTrendPoint = (time: string, npcs: NPCData[]): RoleTrendPoint => {
    const security = npcs.filter((npc) => SECURITY_TYPES.has(npc.type)).length;
    const aggressors = npcs.filter((npc) => AGGRESSOR_TYPES.has(npc.type)).length;
    const support = npcs.filter((npc) => SUPPORT_TYPES.has(npc.type)).length;
    const civilian = npcs.length - security - aggressors - support;
    const panicCount = npcs.filter((npc) => npc.mood === NPCMood.PANICKED || npc.mood === NPCMood.RIOTING).length;

    return {
        time,
        security,
        aggressors,
        support,
        civilian,
        panicRatioPercent: npcs.length > 0 ? Math.round((panicCount / npcs.length) * 100) : 0,
    };
};

const upsertRoleTrendPoint = (
    history: RoleTrendPoint[],
    point: RoleTrendPoint,
    maxPoints: number = MAX_ROLE_TREND_POINTS,
) => {
    if (history.length === 0) {
        return [point];
    }

    const last = history[history.length - 1];
    if (last.time === point.time) {
        return [...history.slice(0, -1), point];
    }

    const next = [...history, point];
    if (next.length > maxPoints) {
        return next.slice(next.length - maxPoints);
    }

    return next;
};

/** Helper: create NPCs of a given type at a position with radius */
function createNpcs(
    type: NPCType, count: number, position: [number, number, number], radius: number,
    mood: NPCMood = NPCMood.PEACEFUL, behavior: NPCBehavior = NPCBehavior.IDLE
): NPCData[] {
    const color = NPC_COLORS[type] || '#888888';
    return Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const x = position[0] + Math.cos(angle) * r;
        const z = position[2] + Math.sin(angle) * r;
        nextNpcId++;
        return {
            id: nextNpcId,
            type,
            position: [x, 1.2, z] as [number, number, number],
            rotation: Math.random() * Math.PI * 2,
            outfitColor: color,
            emotionalState: mood === NPCMood.PEACEFUL ? EmotionalState.PEACEFUL : EmotionalState.NEUTRAL,
            mood,
            behavior
        };
    });
}

/** Helper: remove N npcs of a type from an array (returns new array) */
function removeNpcs(npcs: NPCData[], type: NPCType, count: number): NPCData[] {
    if (count === -1) {
        return npcs.filter(n => n.type !== type);
    }
    const targets = npcs.filter(n => n.type === type);
    const toRemoveIds = new Set(
        targets.sort(() => Math.random() - 0.5).slice(0, count).map(n => n.id)
    );
    return npcs.filter(n => !toRemoveIds.has(n.id));
}

const moodToEmotionalState = (mood: NPCMood): EmotionalState => {
    switch (mood) {
        case NPCMood.PEACEFUL:
            return EmotionalState.PEACEFUL;
        case NPCMood.ANGRY:
        case NPCMood.RIOTING:
            return EmotionalState.ANGRY;
        case NPCMood.PANICKED:
            return EmotionalState.SCARED;
        case NPCMood.ENTHUSIASTIC:
            return EmotionalState.HAPPY;
        case NPCMood.TENSE:
        default:
            return EmotionalState.NEUTRAL;
    }
};

const normalizeDayStats = (dayStats: DayStats): DayStats => ({
    killed: Math.max(0, Math.round(dayStats.killed)),
    arrested: Math.max(0, Math.round(dayStats.arrested)),
    injured: Math.max(0, Math.round(dayStats.injured)),
    damage: Math.max(0, Math.round(dayStats.damage)),
});

const applyDayStatsDelta = (dayStats: DayStats, delta: Partial<DayStats>): DayStats => normalizeDayStats({
    killed: dayStats.killed + (delta.killed ?? 0),
    arrested: dayStats.arrested + (delta.arrested ?? 0),
    injured: dayStats.injured + (delta.injured ?? 0),
    damage: dayStats.damage + (delta.damage ?? 0),
});

const getTensionLevelForMinutes = (currentMinutes: number) => {
    let tensionLevel = 10;
    for (const t of TENSION_TIMELINE) {
        if (timeToMinutes(t.time) <= currentMinutes) {
            tensionLevel = t.level;
        }
    }
    return tensionLevel;
};

const getPhaseLabelForMinutes = (currentMinutes: number, fallbackLabel: string) => {
    let currentPhaseLabel = fallbackLabel;
    for (const p of PHASE_DESCRIPTIONS) {
        if (timeToMinutes(p.time) <= currentMinutes) {
            currentPhaseLabel = p.label;
        }
    }
    return currentPhaseLabel;
};

const applyNpcState = (
    npc: NPCData,
    targetMood?: NPCMood,
    targetBehavior?: NPCBehavior,
): NPCData => ({
    ...npc,
    mood: targetMood ?? npc.mood,
    behavior: targetBehavior ?? npc.behavior,
    emotionalState: targetMood ? moodToEmotionalState(targetMood) : npc.emotionalState,
});

const getMissionCompletionPercent = (progress: typeof INITIAL_MISSION_PROGRESS) => {
    const completed =
        (progress.epochBriefingVerified ? 1 : 0) +
        (progress.hazardMapPrepared ? 1 : 0) +
        Math.min(progress.prioritizedZoneIds.length, 3);
    return Math.round((completed / 5) * 100);
};

const getActiveHooks = (minutes: number, progress: typeof INITIAL_MISSION_PROGRESS) => {
    let active = 0;
    if (minutes >= 12 * 60 && minutes < 18 * 60 && progress.epochBriefingVerified) active += 1;
    if (minutes >= 18 * 60 && progress.hazardMapPrepared) active += 1;
    if (minutes >= 18 * 60 && progress.prioritizedZoneIds.length > 0) active += 1;
    if (minutes >= 21 * 60 && progress.prioritizedZoneIds.length >= 3) active += 1;
    return active;
};

const getPanicRatioPercent = (npcs: NPCData[]) => {
    const panicCount = npcs.filter((npc) => npc.mood === NPCMood.PANICKED || npc.mood === NPCMood.RIOTING).length;
    return npcs.length > 0 ? Math.round((panicCount / npcs.length) * 100) : 0;
};

const spawnDynamicWave = (
    npcs: NPCData[],
    type: NPCType,
    count: number,
    position: [number, number, number],
    radius: number,
    mood: NPCMood,
    behavior: NPCBehavior,
) => {
    const maxCanSpawn = Math.max(0, MAX_ACTIVE_NPCS - npcs.length);
    const effectiveCount = Math.min(count, maxCanSpawn);

    if (effectiveCount <= 0) {
        return npcs;
    }

    return [...npcs, ...createNpcs(type, effectiveCount, position, radius, mood, behavior)];
};

const scaleWaveCount = (baseCount: number, scale: number, minCount: number = 1) =>
    Math.max(minCount, Math.round(baseCount * scale));

const applyDynamicRoleResponses = (
    npcs: NPCData[],
    dayStats: DayStats,
    firedSet: Set<string>,
    currentMinutes: number,
    missionProgress: typeof INITIAL_MISSION_PROGRESS,
    roleTrendHistory: RoleTrendPoint[],
): WorldReplayState => {
    let nextNpcs = npcs;
    let nextDayStats = dayStats;

    if (
        currentMinutes >= 18 * 60 &&
        !firedSet.has('dyn-evening-reinforcement')
    ) {
        const spawned = spawnDynamicWave(nextNpcs, NPCType.RIOT_POLICE, 6, [0, 0, 58], 9, NPCMood.TENSE, NPCBehavior.SHIELD_WALL);
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -1600 });
            firedSet.add('dyn-evening-reinforcement');
        }
    }

    if (
        currentMinutes >= 21 * 60 &&
        !firedSet.has('dyn-late-triage')
    ) {
        const spawned = spawnDynamicWave(nextNpcs, NPCType.MEDIC, 2, [42, 0, 24], 7, NPCMood.TENSE, NPCBehavior.CLEANUP);
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -2, damage: -900 });
            firedSet.add('dyn-late-triage');
        }
    }

    const insightHistory = upsertRoleTrendPoint(
        roleTrendHistory,
        buildRoleTrendPoint(minutesToClock(currentMinutes), nextNpcs),
        MAX_ROLE_TREND_POINTS,
    );

    const insight = getOperationsInsight({
        trendHistory: insightHistory,
        dayStats: nextDayStats,
        missionCompletionPercent: getMissionCompletionPercent(missionProgress),
        panicRatioPercent: getPanicRatioPercent(nextNpcs),
        activeHooks: getActiveHooks(currentMinutes, missionProgress),
        maxHooks: 4,
        activeDynamicResponses: [
            'dyn-evening-reinforcement',
            'dyn-late-triage',
            'dyn-high-medical-relief',
            'dyn-critical-lockdown',
            'dyn-mission-epoch-media',
            'dyn-mission-epoch-press-corridor',
            'dyn-mission-epoch-misinformation',
            'dyn-mission-hazard-shield',
            'dyn-mission-hazard-firebreak',
            'dyn-mission-hazard-surge',
            'dyn-mission-fullchain-deescalation',
            'dyn-mission-fullchain-recovery',
            'dyn-mission-fragmented-command',
            'dyn-trend-synchronization',
            'dyn-trend-fracture-wave',
        ]
            .filter((key) => firedSet.has(key)).length,
    });

    const latestTrend = insightHistory.at(-1);
    const aggressorPressure = latestTrend ? latestTrend.aggressors - latestTrend.security : 0;
    const supportReserve = latestTrend ? latestTrend.support : 0;

    const phaseScaleProfile = insight.phaseBand === 'MORNING'
        ? { positive: 1.08, fallback: 0.92, syncThreshold: 102, fractureThreshold: 93 }
        : insight.phaseBand === 'MIDDAY'
            ? { positive: 1.12, fallback: 0.9, syncThreshold: 103, fractureThreshold: 92 }
            : insight.phaseBand === 'EVENING'
                ? { positive: 0.94, fallback: 1.12, syncThreshold: 106, fractureThreshold: 96 }
                : insight.phaseBand === 'LATE'
                    ? { positive: 0.9, fallback: 1.2, syncThreshold: 108, fractureThreshold: 98 }
                    : { positive: 1.03, fallback: 0.97, syncThreshold: 103, fractureThreshold: 94 };

    let positiveWaveScale = 1;
    if (insight.missionPathWeightPercent >= 120) {
        positiveWaveScale = 1.35;
    } else if (insight.missionPathWeightPercent >= 110) {
        positiveWaveScale = 1.2;
    } else if (insight.missionPathWeightPercent <= 85) {
        positiveWaveScale = 0.85;
    }

    let fallbackWaveScale = 1;
    if (insight.missionPathWeightPercent <= 85) {
        fallbackWaveScale = 1.35;
    } else if (insight.missionPathWeightPercent <= 95) {
        fallbackWaveScale = 1.15;
    } else if (insight.missionPathWeightPercent >= 120) {
        fallbackWaveScale = 0.8;
    }

    if (aggressorPressure >= 5) {
        fallbackWaveScale += 0.2;
    }

    if (supportReserve >= 10) {
        fallbackWaveScale = Math.max(0.75, fallbackWaveScale - 0.1);
    }

    if (insight.trendMomentumScore <= -8) {
        positiveWaveScale += 0.08;
        fallbackWaveScale = Math.max(0.7, fallbackWaveScale - 0.08);
    } else if (insight.trendMomentumScore >= 8) {
        fallbackWaveScale += 0.1;
        positiveWaveScale = Math.max(0.75, positiveWaveScale - 0.06);
    }

    positiveWaveScale *= phaseScaleProfile.positive;
    fallbackWaveScale *= phaseScaleProfile.fallback;

    const adaptiveCurve = getAdaptiveTriggerCurve({
        aggressorPressure,
        supportReserve,
        trendSignal: insight.trendSignal,
        trendMomentumScore: insight.trendMomentumScore,
        trendTurbulenceScore: insight.trendTurbulenceScore,
    });

    const adaptiveSyncThreshold = Math.max(96, Math.min(116, phaseScaleProfile.syncThreshold + adaptiveCurve.syncThresholdDelta));
    const adaptiveFractureThreshold = Math.max(88, Math.min(104, phaseScaleProfile.fractureThreshold + adaptiveCurve.fractureThresholdDelta));

    positiveWaveScale *= adaptiveCurve.positiveScaleFactor;
    fallbackWaveScale *= adaptiveCurve.fallbackScaleFactor;

    if (
        currentMinutes >= 20 * 60 + 30 &&
        getMissionCompletionPercent(missionProgress) >= 80 &&
        insight.missionPathWeightPercent >= adaptiveSyncThreshold &&
        (insight.trendSignal === 'stabilizing' || (insight.trendSignal === 'flat' && insight.trendMomentumScore <= 2)) &&
        !firedSet.has('dyn-trend-synchronization')
    ) {
        const policeWave = spawnDynamicWave(
            nextNpcs,
            NPCType.POLICE,
            scaleWaveCount(2, positiveWaveScale, 1),
            [2, 0, 32],
            7,
            NPCMood.TENSE,
            NPCBehavior.SHIELD_WALL,
        );
        const supportWave = spawnDynamicWave(
            policeWave,
            NPCType.MEDIC,
            scaleWaveCount(1, positiveWaveScale, 1),
            [16, 0, 24],
            6,
            NPCMood.TENSE,
            NPCBehavior.CLEANUP,
        );
        if (supportWave !== nextNpcs) {
            nextNpcs = supportWave;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -850 });
            firedSet.add('dyn-trend-synchronization');
        }
    }

    if (
        currentMinutes >= 21 * 60 + 30 &&
        getMissionCompletionPercent(missionProgress) < 60 &&
        insight.missionPathWeightPercent <= adaptiveFractureThreshold &&
        insight.trendSignal !== 'stabilizing' &&
        insight.trendMomentumScore >= -1 &&
        !firedSet.has('dyn-trend-fracture-wave')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.RIOTER,
            scaleWaveCount(3, fallbackWaveScale, 2),
            [10, 0, 40],
            8,
            NPCMood.RIOTING,
            NPCBehavior.THROW,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: 1, damage: 1100 });
            firedSet.add('dyn-trend-fracture-wave');
        }
    }

    if (
        insight.priority !== 'low' &&
        currentMinutes >= 17 * 60 &&
        !firedSet.has('dyn-high-medical-relief')
    ) {
        const spawned = spawnDynamicWave(nextNpcs, NPCType.MEDIC, 2, [34, 0, 22], 8, NPCMood.TENSE, NPCBehavior.CLEANUP);
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -700 });
            firedSet.add('dyn-high-medical-relief');
        }
    }

    if (
        insight.priority === 'critical' &&
        currentMinutes >= 20 * 60 &&
        !firedSet.has('dyn-critical-lockdown')
    ) {
        const spawned = spawnDynamicWave(nextNpcs, NPCType.SEK, 4, [6, 0, 44], 7, NPCMood.TENSE, NPCBehavior.SURROUND);
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -2, damage: -1200 });
            firedSet.add('dyn-critical-lockdown');
        }
    }

    if (
        missionProgress.epochBriefingVerified &&
        currentMinutes >= 12 * 60 &&
        !firedSet.has('dyn-mission-epoch-media')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.JOURNALIST,
            scaleWaveCount(3, positiveWaveScale, 2),
            [-4, 0, 14],
            6,
            NPCMood.TENSE,
            NPCBehavior.GATHER,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { damage: -350 });
            firedSet.add('dyn-mission-epoch-media');
        }
    }

    if (
        missionProgress.epochBriefingVerified &&
        firedSet.has('dyn-mission-epoch-media') &&
        currentMinutes >= 14 * 60 &&
        !firedSet.has('dyn-mission-epoch-press-corridor')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.POLICE,
            scaleWaveCount(2, positiveWaveScale, 1),
            [-6, 0, 18],
            6,
            NPCMood.TENSE,
            NPCBehavior.SHIELD_WALL,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { damage: -300 });
            firedSet.add('dyn-mission-epoch-press-corridor');
        }
    }

    if (
        !missionProgress.epochBriefingVerified &&
        currentMinutes >= 15 * 60 &&
        !firedSet.has('dyn-mission-epoch-misinformation')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.DEMONSTRATOR,
            scaleWaveCount(3, fallbackWaveScale, 2),
            [-10, 0, 20],
            7,
            NPCMood.ANGRY,
            NPCBehavior.CHANT,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: 1, damage: 900 });
            firedSet.add('dyn-mission-epoch-misinformation');
        }
    }

    if (
        missionProgress.hazardMapPrepared &&
        currentMinutes >= 18 * 60 &&
        !firedSet.has('dyn-mission-hazard-shield')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.POLICE,
            scaleWaveCount(4, positiveWaveScale, 3),
            [0, 0, 36],
            10,
            NPCMood.TENSE,
            NPCBehavior.SHIELD_WALL,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -550 });
            firedSet.add('dyn-mission-hazard-shield');
        }
    }

    if (
        missionProgress.hazardMapPrepared &&
        firedSet.has('dyn-mission-hazard-shield') &&
        currentMinutes >= 19 * 60 + 30 &&
        !firedSet.has('dyn-mission-hazard-firebreak')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.FIREFIGHTER,
            scaleWaveCount(3, positiveWaveScale, 2),
            [18, 0, 30],
            9,
            NPCMood.TENSE,
            NPCBehavior.CLEANUP,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -600 });
            firedSet.add('dyn-mission-hazard-firebreak');
        }
    }

    if (
        !missionProgress.hazardMapPrepared &&
        currentMinutes >= 20 * 60 &&
        !firedSet.has('dyn-mission-hazard-surge')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.RIOTER,
            scaleWaveCount(4, fallbackWaveScale, 3),
            [12, 0, 34],
            9,
            NPCMood.RIOTING,
            NPCBehavior.THROW,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: 2, damage: 1800 });
            firedSet.add('dyn-mission-hazard-surge');
        }
    }

    if (
        missionProgress.prioritizedZoneIds.length >= 3 &&
        currentMinutes >= 21 * 60 &&
        !firedSet.has('dyn-mission-fullchain-deescalation')
    ) {
        nextNpcs = nextNpcs.map((npc) => {
            if (
                (npc.type === NPCType.DEMONSTRATOR || npc.type === NPCType.RIOTER) &&
                (npc.behavior === NPCBehavior.COMBAT || npc.behavior === NPCBehavior.THROW || npc.behavior === NPCBehavior.CHANT)
            ) {
                return applyNpcState(npc, NPCMood.PANICKED, NPCBehavior.RETREAT);
            }
            return npc;
        });
        nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -2, damage: -1700 });
        firedSet.add('dyn-mission-fullchain-deescalation');
    }

    if (
        missionProgress.prioritizedZoneIds.length >= 3 &&
        firedSet.has('dyn-mission-fullchain-deescalation') &&
        currentMinutes >= 22 * 60 &&
        !firedSet.has('dyn-mission-fullchain-recovery')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.MEDIC,
            scaleWaveCount(2, positiveWaveScale, 1),
            [26, 0, 18],
            8,
            NPCMood.TENSE,
            NPCBehavior.CLEANUP,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned.map((npc) => {
                if (
                    npc.type === NPCType.RIOTER &&
                    (npc.behavior === NPCBehavior.COMBAT || npc.behavior === NPCBehavior.THROW)
                ) {
                    return applyNpcState(npc, NPCMood.PANICKED, NPCBehavior.RETREAT);
                }
                return npc;
            });
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: -1, damage: -1000 });
            firedSet.add('dyn-mission-fullchain-recovery');
        }
    }

    if (
        missionProgress.prioritizedZoneIds.length < 2 &&
        currentMinutes >= 22 * 60 + 30 &&
        !firedSet.has('dyn-mission-fragmented-command')
    ) {
        const spawned = spawnDynamicWave(
            nextNpcs,
            NPCType.EXTREMIST,
            scaleWaveCount(2, fallbackWaveScale, 1),
            [24, 0, 52],
            6,
            NPCMood.RIOTING,
            NPCBehavior.COMBAT,
        );
        if (spawned !== nextNpcs) {
            nextNpcs = spawned;
            nextDayStats = applyDayStatsDelta(nextDayStats, { injured: 2, damage: 1400 });
            firedSet.add('dyn-mission-fragmented-command');
        }
    }

    return { npcs: nextNpcs, dayStats: nextDayStats, firedSet };
};

const replayWorldStateToMinutes = (currentMinutes: number): WorldReplayState => {
    nextNpcId = 1000;
    const firedSet = new Set<string>();
    let npcs: NPCData[] = [];
    let dayStats: DayStats = { killed: 0, arrested: 0, injured: 0, damage: 0 };

    EVENT_TIMELINE.forEach((event, index) => {
        const eventKey = `evt-${index}`;
        const eventMinutes = timeToMinutes(event.time);

        if (eventMinutes <= currentMinutes) {
            firedSet.add(eventKey);

            const countForStats = event.count === -1
                ? npcs.filter((npc) => npc.type === event.npcType).length
                : Math.max(0, event.count);
            dayStats = applyDayStatsDelta(dayStats, getEventDayStatsDelta(event, countForStats));

            if (event.action === 'SPAWN' && event.position) {
                const maxCanSpawn = Math.max(0, MAX_ACTIVE_NPCS - npcs.length);
                const count = Math.min(event.count, maxCanSpawn);
                if (count > 0) {
                    npcs = [...npcs, ...createNpcs(event.npcType, count, event.position, event.radius || 5, event.mood, event.behavior)];
                }
            } else if (event.action === 'DESPAWN') {
                npcs = removeNpcs(npcs, event.npcType, event.count);
            } else if (event.action === 'MOVE' && event.position) {
                const movePosition = event.position;
                npcs = npcs.map((npc) => (npc.type === event.npcType ? { ...npc, position: movePosition } : npc));
            } else if (event.action === 'MOOD_CHANGE') {
                npcs = npcs.map((npc) => (npc.type === event.npcType ? applyNpcState(npc, event.targetMood, event.targetBehavior) : npc));
            } else if (event.action === 'BEHAVIOR_CHANGE') {
                npcs = npcs.map((npc) => (npc.type === event.npcType ? applyNpcState(npc, undefined, event.targetBehavior) : npc));
            }
        }
    });

    return { npcs, dayStats, firedSet };
};

const buildRoleTrendHistoryToMinutes = (
    currentMinutes: number,
    missionProgress: typeof INITIAL_MISSION_PROGRESS,
): RoleTrendPoint[] => {
    const checkpoints = new Set<number>([currentMinutes]);
    EVENT_TIMELINE.forEach((event) => {
        const eventMinutes = timeToMinutes(event.time);
        if (eventMinutes <= currentMinutes) {
            checkpoints.add(eventMinutes);
        }
    });

    const sorted = Array.from(checkpoints).sort((a, b) => a - b);
    let history: RoleTrendPoint[] = [];

    sorted.forEach((minutes) => {
        const replay = replayWorldStateToMinutes(minutes);
        const hooked = applyMissionPhaseHooks(replay.npcs, minutes, missionProgress);
        const dynamic = applyDynamicRoleResponses(hooked, replay.dayStats, replay.firedSet, minutes, missionProgress, history);
        history = upsertRoleTrendPoint(history, buildRoleTrendPoint(minutesToClock(minutes), dynamic.npcs));
    });

    return history;
};

const getInteractionDayStatsDelta = (zoneId: InteractionZoneId): Partial<DayStats> => {
    if (zoneId === 'epoch-terminal') {
        return { injured: -1, damage: -2500 };
    }

    if (zoneId === 'hazard-console') {
        return { injured: -2, damage: -9000 };
    }

    return { injured: -1, damage: -3000 };
};

const getEventDayStatsDelta = (
    event: { action: string; npcType: NPCType; targetMood?: NPCMood; targetBehavior?: NPCBehavior },
    effectiveCount: number,
): Partial<DayStats> => {
    const units = Math.max(0, effectiveCount);

    if (event.action === 'SPAWN') {
        if (event.npcType === NPCType.RIOTER || event.npcType === NPCType.EXTREMIST) {
            return { injured: Math.ceil(units / 4), damage: units * 2200 };
        }
        if (event.npcType === NPCType.DEMONSTRATOR) {
            return { damage: units * 120 };
        }
        if (event.npcType === NPCType.MEDIC || event.npcType === NPCType.FIREFIGHTER) {
            return { injured: -Math.ceil(units / 3), damage: -units * 250 };
        }
    }

    if (event.action === 'DESPAWN') {
        if (event.npcType === NPCType.RIOTER || event.npcType === NPCType.EXTREMIST || event.npcType === NPCType.DEMONSTRATOR) {
            return { arrested: Math.ceil(units * 0.75) };
        }
        if (event.npcType === NPCType.POLICE || event.npcType === NPCType.RIOT_POLICE || event.npcType === NPCType.SEK) {
            return { injured: Math.ceil(units * 0.6) };
        }
    }

    if (event.action === 'MOOD_CHANGE') {
        if (event.targetMood === NPCMood.RIOTING) {
            return { injured: Math.max(1, Math.ceil(units * 0.18)), damage: Math.max(1000, units * 800) };
        }
        if (event.targetMood === NPCMood.ANGRY) {
            return { damage: Math.max(500, units * 220) };
        }
        if (event.targetMood === NPCMood.PEACEFUL) {
            return { damage: -Math.max(300, units * 80) };
        }
    }

    if (event.action === 'BEHAVIOR_CHANGE') {
        if (event.targetBehavior === NPCBehavior.COMBAT || event.targetBehavior === NPCBehavior.THROW) {
            return { injured: Math.max(1, Math.ceil(units * 0.14)), damage: Math.max(800, units * 550) };
        }
        if (event.targetBehavior === NPCBehavior.CLEANUP || event.targetBehavior === NPCBehavior.RETREAT) {
            return { damage: -Math.max(400, units * 150) };
        }
    }

    return {};
};

const applyMissionNpcEffects = (npcs: NPCData[], zoneId: InteractionZoneId): NPCData[] => {
    const updateNpc = (npc: NPCData, behavior: NPCBehavior, mood: NPCMood): NPCData => ({
        ...npc,
        behavior,
        mood,
        emotionalState: moodToEmotionalState(mood),
    });

    const isResponder = (npc: NPCData) =>
        npc.type === NPCType.MEDIC || npc.type === NPCType.FIREFIGHTER;

    const isSecurity = (npc: NPCData) =>
        npc.type === NPCType.POLICE || npc.type === NPCType.RIOT_POLICE || npc.type === NPCType.SEK;

    const isPopulation = (npc: NPCData) =>
        npc.type === NPCType.CIVILIAN || npc.type === NPCType.TOURIST || npc.type === NPCType.JOURNALIST;

    if (zoneId === 'epoch-terminal') {
        return npcs.map((npc) => {
            if (npc.type === NPCType.JOURNALIST || npc.type === NPCType.ORGANIZER) {
                return updateNpc(npc, NPCBehavior.GATHER, NPCMood.TENSE);
            }
            if (npc.type === NPCType.DEMONSTRATOR && npc.behavior === NPCBehavior.IDLE) {
                return updateNpc(npc, NPCBehavior.GATHER, NPCMood.TENSE);
            }
            return npc;
        });
    }

    if (zoneId === 'hazard-console') {
        return npcs.map((npc) => {
            if (isResponder(npc)) {
                return updateNpc(npc, NPCBehavior.CLEANUP, NPCMood.TENSE);
            }
            if (isSecurity(npc) && npc.behavior === NPCBehavior.PATROL) {
                return updateNpc(npc, NPCBehavior.SHIELD_WALL, NPCMood.TENSE);
            }
            return npc;
        });
    }

    const zoneFilter = (npc: NPCData) => {
        const x = npc.position[0];
        const z = npc.position[2];
        if (zoneId === 'evacuation-board-north') return z >= 0;
        if (zoneId === 'evacuation-board-west') return x < 0 && z < 0;
        return x >= 0 && z < 0;
    };

    return npcs.map((npc) => {
        if (!zoneFilter(npc)) {
            return npc;
        }

        if (isPopulation(npc)) {
            return updateNpc(npc, NPCBehavior.FLEE, NPCMood.PANICKED);
        }

        if (isResponder(npc)) {
            return updateNpc(npc, NPCBehavior.CLEANUP, NPCMood.TENSE);
        }

        return npc;
    });
};

export const useGameStore = create<GameStore>((set, get) => ({
    npcs: [],
    firedEventKeys: [],
    roleTrendHistory: persistedRoleTrendHistory,
    streamProfile,
    isZeroFootprint: typeof window !== 'undefined' && window.location.search.includes('stream=true'), // Default: Local Rendering (Cloudflare Native)
    isVoiceActive: false,
    remotePlayers: {},
    interactionState: {
        nearbyZoneId: null,
        lastMessage: null,
        missionProgress: persistedMissionProgress,
    },
    dayStats: persistedDayStats,
    dialogState: {
        activeNodeId: null,
        history: [],
    },
    gameState: { 
        cloudStreamUrl: 'https://wrzzzrzr-jetbrain.hf.space',
        isPlaying: true, isTimePaused: false, inGameTime: persistedInGameTime,
        tensionLevel: getTensionLevelForMinutes(timeToMinutes(persistedInGameTime)),
        timeSpeed: persistedRuntimeSnapshot?.timeSpeed ?? RUNTIME_DEFAULTS.timeSpeed,
        currentPhaseLabel: '🌅 Tagesbeginn — Stadt erwacht',
        replayMode: persistedReplayState.mode,
        replayRebuildStatus: persistedReplayState.rebuildStatus,
        replayRebuildEventCount: persistedReplayState.rebuildEventCount,
        replayAnchorTime: persistedReplayState.anchorTime,
        replayRebuildHistory: persistedReplayState.rebuildHistory,
        replayQualityWindowMinutes: persistedReplayState.quality.windowMinutes,
        replayQualityRebuildCount: persistedReplayState.quality.rebuildCount,
        replayQualityAvgEvents: persistedReplayState.quality.avgRebuildEvents,
        replayQualityDeltaEventsPerCheckpoint: persistedReplayState.quality.deltaEventsPerCheckpoint,
        replayQualityDeltaDirection: persistedReplayState.quality.deltaDirection,
        replayQualityDeltaHint: persistedReplayState.quality.deltaHint,
        replayQualityDeltaVolatilityBand: persistedReplayState.quality.deltaVolatilityBand,
        replayQualityDeltaVolatilityHint: persistedReplayState.quality.deltaVolatilityHint,
        replayQualityDeltaHistory: persistedReplayState.quality.deltaHistory,
        replayQualityDeltaMomentumScore: persistedReplayState.quality.deltaMomentumScore,
        replayQualityDeltaMomentumDirection: persistedReplayState.quality.deltaMomentumDirection,
        replayQualityDeltaMomentumBand: persistedReplayState.quality.deltaMomentumBand,
        replayQualityDeltaMomentumHint: persistedReplayState.quality.deltaMomentumHint,
        replayQualityDeltaDriftScore: persistedReplayState.quality.deltaDriftScore,
        replayQualityDeltaDriftDirection: persistedReplayState.quality.deltaDriftDirection,
        replayQualityDeltaDriftBand: persistedReplayState.quality.deltaDriftBand,
        replayQualityDeltaDriftHint: persistedReplayState.quality.deltaDriftHint,
        replayQualityDeltaAnomalyScore: persistedReplayState.quality.deltaAnomalyScore,
        replayQualityDeltaAnomalyDirection: persistedReplayState.quality.deltaAnomalyDirection,
        replayQualityDeltaAnomalyBand: persistedReplayState.quality.deltaAnomalyBand,
        replayQualityDeltaAnomalyHint: persistedReplayState.quality.deltaAnomalyHint,
        replayQualityStability: persistedReplayState.quality.stability,
        replayQualityRecentTrend: persistedReplayState.quality.recentStabilityTrend,
        replayRiskLevel: persistedReplayState.quality.riskLevel,
        replayRiskHint: persistedReplayState.quality.riskHint,
        replayRiskLastHighAnchorTime: persistedReplayState.quality.riskLastHighAnchorTime,
        replayRiskRecoveryMinutes: persistedReplayState.quality.riskRecoveryMinutes,
        replayRecoveryBand: persistedReplayState.quality.recoveryBand,
        replayRecoveryHint: persistedReplayState.quality.recoveryHint,
        playerReputation: persistedRuntimeSnapshot?.playerReputation ?? RUNTIME_DEFAULTS.playerReputation,
        moralScore: persistedRuntimeSnapshot?.moralScore ?? RUNTIME_DEFAULTS.moralScore,
        lastTacticalOrder: null,
        showStatistics: false,
        masterVolume: persistedRuntimeSnapshot?.masterVolume ?? RUNTIME_DEFAULTS.masterVolume,
        muted: persistedRuntimeSnapshot?.muted ?? RUNTIME_DEFAULTS.muted,
    },
    toggleVoice: async () => {}, // Placeholder, will be overriden by implementation below
    broadcastMoveP2P: () => {},  // Placeholder

    initSocket: () => {
        if (socket.connected) return;
        
        // Cloudflare Native: No socket connection to old HF space to avoid 400 errors
        const isCloudflare = typeof window !== 'undefined' && window.location.hostname.includes('pages.dev');
        if (isCloudflare && !get().isZeroFootprint) {
            console.log('[Socket] Cloudflare Native Mode: Skipping legacy socket connection.');
            return;
        }

        socket.connect();
        
        socket.on('init-state', (state: any) => {
            get().evaluateEvents(state.inGameTime);
        });

        socket.on('time-sync', (time: string) => {
            get().evaluateEvents(time);
        });

        socket.on('player-moved', (data: { id: string, position: [number, number, number], rotation: number }) => {
            get().updateRemotePlayer(data.id, { position: data.position, rotation: data.rotation });
        });

        socket.on('player-left', (id: string) => {
            get().removeRemotePlayer(id);
        });

        // WebRTC Signaling
        socket.on('peer-id', (data: { id: string, peerId: string }) => {
            if (data.id !== socket.id) {
                console.log('[Socket] Received Peer ID from:', data.id);
                webrtcManager.connectToPeer(data.peerId);
            }
        });

        const myPeerId = socket.id || 'local-' + Math.random().toString(36).substr(2, 5);
        webrtcManager.init(myPeerId);
        socket.emit('register-peer', myPeerId);
    },

    updateRemotePlayer: (id, data) => set((state) => ({
        remotePlayers: {
            ...state.remotePlayers,
            [id]: data
        }
    })),

    removeRemotePlayer: (id) => set((state) => {
        const next = { ...state.remotePlayers };
        delete next[id];
        return { remotePlayers: next };
    }),

    startGame: () => {
        nextNpcId = 1000;
        set({ 
            npcs: [],
            firedEventKeys: [],
            roleTrendHistory: [],
            interactionState: {
                nearbyZoneId: null,
                lastMessage: null,
                missionProgress: cloneMissionProgress(INITIAL_MISSION_PROGRESS),
            },
            dayStats: { killed: 0, arrested: 0, injured: 0, damage: 0 },
            gameState: { 
                cloudStreamUrl: get().gameState.cloudStreamUrl,
                isPlaying: true, isTimePaused: false, inGameTime: '06:00', 
                tensionLevel: 10, timeSpeed: 1, 
                currentPhaseLabel: '🌅 Tagesbeginn — Stadt erwacht',
                lastTacticalOrder: null,
                replayMode: 'live',
                replayRebuildStatus: 'idle',
                replayRebuildEventCount: 0,
                replayAnchorTime: '06:00',
                replayRebuildHistory: [],
                replayQualityWindowMinutes: REPLAY_QUALITY_WINDOW_MINUTES,
                replayQualityRebuildCount: 0,
                replayQualityAvgEvents: 0,
                replayQualityDeltaEventsPerCheckpoint: 0,
                replayQualityDeltaDirection: 'flat',
                replayQualityDeltaHint: 'Replay-Eventlast stabil.',
                replayQualityDeltaVolatilityBand: 'calm' as ReplayQualityDeltaVolatilityBand,
                replayQualityDeltaVolatilityHint: 'Delta-Verlauf stabil.' as ReplayQualityDeltaVolatilityHint,
                replayQualityDeltaHistory: [],
                replayQualityDeltaMomentumScore: 0,
                replayQualityDeltaMomentumDirection: 'flat',
                replayQualityDeltaMomentumBand: 'easing',
                replayQualityDeltaMomentumHint: 'Trendbeschleunigung gering.',
                replayQualityDeltaDriftScore: 0,
                replayQualityDeltaDriftDirection: 'flat',
                replayQualityDeltaDriftBand: 'aligned',
                replayQualityDeltaDriftHint: 'Delta-Basis stabil.',
                replayQualityDeltaAnomalyScore: 0,
                replayQualityDeltaAnomalyDirection: 'flat',
                replayQualityDeltaAnomalyBand: 'normal',
                replayQualityDeltaAnomalyHint: 'Keine auffaellige Delta-Anomalie.',
                replayQualityStability: 'stable',
                replayQualityRecentTrend: [],
                replayRiskLevel: 'low',
                replayRiskHint: 'Stabiler Replay-Betrieb.',
                replayRiskLastHighAnchorTime: null,
                replayRiskRecoveryMinutes: null,
                replayRecoveryBand: 'unknown',
                replayRecoveryHint: 'Noch kein HIGH-Risiko erfasst.',
                playerReputation: 0, 
                moralScore: 50, 
                showStatistics: false,
                masterVolume: 0.5, 
                muted: false
            },
            toggleVoice: async () => {
                const success = await webrtcManager.startVoice();
                if (success) {
                    set({ isVoiceActive: true });
                    console.log('[GameStore] Voice Chat enabled');
                } else {
                    set({ isVoiceActive: false });
                }
            },
            broadcastMoveP2P: (data) => {
                webrtcManager.broadcastMove(data);
            }
        });
        persistCurrentRuntimeSnapshot(get());
        setTimeout(() => get().evaluateEvents('06:00'), 200);
    },

    /**
     * ATOMIC evaluateEvents: ALL changes in ONE set() call.
     * No race conditions, no stale state.
     */
    evaluateEvents: (currentTime: string) => {
        set((state) => {
            const currentMinutes = timeToMinutes(currentTime);
            const previousMinutes = timeToMinutes(state.gameState.inGameTime);
            const firedSet = new Set(state.firedEventKeys);
            let npcs = [...state.npcs];
            let dayStats = { ...state.dayStats };
            const moveCommands: { ids: number[], target: [number, number, number] }[] = [];

            // Process all events up to current time
            EVENT_TIMELINE.forEach((event, index) => {
                const eventKey = `evt-${index}`;
                const eventMinutes = timeToMinutes(event.time);

                if (eventMinutes <= currentMinutes && !firedSet.has(eventKey)) {
                    console.log(`[Store] Firing event: ${eventKey} (${event.time}) - ${event.description}`);
                    firedSet.add(eventKey);

                    const countForStats = event.count === -1
                        ? npcs.filter((npc) => npc.type === event.npcType).length
                        : Math.max(0, event.count);
                    dayStats = applyDayStatsDelta(dayStats, getEventDayStatsDelta(event, countForStats));

                    if (event.action === 'SPAWN' && event.position) {
                        const maxCanSpawn = Math.max(0, MAX_ACTIVE_NPCS - npcs.length);
                        const count = Math.min(event.count, maxCanSpawn);
                        if (count > 0) {
                            const newNpcs = createNpcs(event.npcType, count, event.position, event.radius || 5, event.mood, event.behavior);
                            npcs = [...npcs, ...newNpcs];
                        }
                    } else if (event.action === 'DESPAWN') {
                        npcs = removeNpcs(npcs, event.npcType, event.count);
                    } else if (event.action === 'MOVE' && event.position) {
                        const ids = npcs.filter(n => n.type === event.npcType).map(n => n.id);
                        moveCommands.push({ ids, target: event.position });
                    } else if (event.action === 'MOOD_CHANGE') {
                        npcs = npcs.map(n => {
                            if (n.type === event.npcType) {
                                return applyNpcState(n, event.targetMood, event.targetBehavior);
                            }
                            return n;
                        });
                    } else if (event.action === 'BEHAVIOR_CHANGE') {
                        npcs = npcs.map(n => {
                            if (n.type === event.npcType) {
                                return applyNpcState(n, undefined, event.targetBehavior);
                            }
                            return n;
                        });
                    }
                }
            });

            const tensionLevel = getTensionLevelForMinutes(currentMinutes);
            const currentPhaseLabel = getPhaseLabelForMinutes(currentMinutes, state.gameState.currentPhaseLabel);

            npcs = applyMissionPhaseHooks(npcs, currentMinutes, state.interactionState.missionProgress);
            const dynamicState = applyDynamicRoleResponses(
                npcs,
                dayStats,
                firedSet,
                currentMinutes,
                state.interactionState.missionProgress,
                state.roleTrendHistory,
            );
            npcs = dynamicState.npcs;
            dayStats = dynamicState.dayStats;

            // Sync worker AFTER computing final NPC list
            workerManager.startSimulation(MAX_ACTIVE_NPCS, npcs);
            moveCommands.forEach(cmd => workerManager.moveNpcsToTarget(cmd.ids, cmd.target));

            if (state.firedEventKeys.length !== Array.from(firedSet).length) {
                socket.emit('update-time', currentTime);
            }

            const crossedMidnight = previousMinutes > currentMinutes;
            const trendPoint = buildRoleTrendPoint(currentTime, npcs);
            const roleTrendHistory = crossedMidnight
                ? [trendPoint]
                : upsertRoleTrendPoint(state.roleTrendHistory, trendPoint);
            const replayQuality = getReplayQualityState(
                state.gameState.replayRebuildHistory,
                currentTime,
                state.gameState.replayQualityRecentTrend,
                state.gameState.replayRiskLastHighAnchorTime,
                state.gameState.replayQualityAvgEvents,
                state.gameState.replayQualityDeltaHistory,
            );

            return {
                npcs,
                dayStats,
                firedEventKeys: Array.from(firedSet),
                roleTrendHistory,
                gameState: {
                    ...state.gameState,
                    inGameTime: currentTime,
                    tensionLevel,
                    currentPhaseLabel,
                    replayMode: 'live',
                    replayRebuildStatus: 'idle',
                    replayRebuildEventCount: 0,
                    replayAnchorTime: currentTime,
                    replayRebuildHistory: state.gameState.replayRebuildHistory,
                    replayQualityWindowMinutes: replayQuality.windowMinutes,
                    replayQualityRebuildCount: replayQuality.rebuildCount,
                    replayQualityAvgEvents: replayQuality.avgRebuildEvents,
                    replayQualityDeltaEventsPerCheckpoint: replayQuality.deltaEventsPerCheckpoint,
                    replayQualityDeltaDirection: replayQuality.deltaDirection,
                    replayQualityDeltaHint: replayQuality.deltaHint,
                    replayQualityDeltaVolatilityBand: replayQuality.deltaVolatilityBand,
                    replayQualityDeltaVolatilityHint: replayQuality.deltaVolatilityHint,
                    replayQualityDeltaHistory: replayQuality.deltaHistory,
                    replayQualityDeltaMomentumScore: replayQuality.deltaMomentumScore,
                    replayQualityDeltaMomentumDirection: replayQuality.deltaMomentumDirection,
                    replayQualityDeltaMomentumBand: replayQuality.deltaMomentumBand,
                    replayQualityDeltaMomentumHint: replayQuality.deltaMomentumHint,
                    replayQualityDeltaDriftScore: replayQuality.deltaDriftScore,
                    replayQualityDeltaDriftDirection: replayQuality.deltaDriftDirection,
                    replayQualityDeltaDriftBand: replayQuality.deltaDriftBand,
                    replayQualityDeltaDriftHint: replayQuality.deltaDriftHint,
                    replayQualityDeltaAnomalyScore: replayQuality.deltaAnomalyScore,
                    replayQualityDeltaAnomalyDirection: replayQuality.deltaAnomalyDirection,
                    replayQualityDeltaAnomalyBand: replayQuality.deltaAnomalyBand,
                    replayQualityDeltaAnomalyHint: replayQuality.deltaAnomalyHint,
                    replayQualityStability: replayQuality.stability,
                    replayQualityRecentTrend: replayQuality.recentStabilityTrend,
                    replayRiskLevel: replayQuality.riskLevel,
                    replayRiskHint: replayQuality.riskHint,
                    replayRiskLastHighAnchorTime: replayQuality.riskLastHighAnchorTime,
                    replayRiskRecoveryMinutes: replayQuality.riskRecoveryMinutes,
                    replayRecoveryBand: replayQuality.recoveryBand,
                    replayRecoveryHint: replayQuality.recoveryHint,
                    showStatistics: crossedMidnight ? true : state.gameState.showStatistics,
                }
            };
        });
        persistCurrentRuntimeSnapshot(get());
    },

    updateTime: (time) => {
        get().evaluateEvents(time);
    },

    advanceHour: () => {
        const state = get();
        let [h, m] = state.gameState.inGameTime.split(':').map(Number);
        h = (h + 1) % 24;
        const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        get().evaluateEvents(newTime);
    },

    rewindHour: () => {
        const state = get();
        let [h, m] = state.gameState.inGameTime.split(':').map(Number);
        h = (h - 1 + 24) % 24;
        const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const currentMinutes = timeToMinutes(newTime);
        const rebuilt = replayWorldStateToMinutes(currentMinutes);
        const npcs = applyMissionPhaseHooks(rebuilt.npcs, currentMinutes, state.interactionState.missionProgress);
        const dynamicState = applyDynamicRoleResponses(
            npcs,
            rebuilt.dayStats,
            rebuilt.firedSet,
            currentMinutes,
            state.interactionState.missionProgress,
            [],
        );
        const tensionLevel = getTensionLevelForMinutes(currentMinutes);
        const currentPhaseLabel = getPhaseLabelForMinutes(currentMinutes, state.gameState.currentPhaseLabel);
        const roleTrendHistory = buildRoleTrendHistoryToMinutes(currentMinutes, state.interactionState.missionProgress);
        const replayEntry: ReplayRebuildHistoryEntry = {
            mode: 'rewind',
            anchorTime: newTime,
            rebuildEventCount: dynamicState.firedSet.size,
            savedAtEpochMs: Date.now(),
        };
        const replayRebuildHistory = pushReplayHistory(state.gameState.replayRebuildHistory, replayEntry);
        const replayQuality = getReplayQualityState(
            replayRebuildHistory,
            newTime,
            state.gameState.replayQualityRecentTrend,
            state.gameState.replayRiskLastHighAnchorTime,
            state.gameState.replayQualityAvgEvents,
            state.gameState.replayQualityDeltaHistory,
        );

        workerManager.syncNpcs(dynamicState.npcs);
        set({
            npcs: dynamicState.npcs,
            dayStats: dynamicState.dayStats,
            firedEventKeys: Array.from(dynamicState.firedSet),
            roleTrendHistory,
            gameState: {
                ...state.gameState,
                inGameTime: newTime,
                tensionLevel,
                currentPhaseLabel,
                replayMode: 'rewind',
                replayRebuildStatus: 'reconstructed',
                replayRebuildEventCount: dynamicState.firedSet.size,
                replayAnchorTime: newTime,
                replayRebuildHistory,
                replayQualityWindowMinutes: replayQuality.windowMinutes,
                replayQualityRebuildCount: replayQuality.rebuildCount,
                replayQualityAvgEvents: replayQuality.avgRebuildEvents,
                replayQualityDeltaEventsPerCheckpoint: replayQuality.deltaEventsPerCheckpoint,
                replayQualityDeltaDirection: replayQuality.deltaDirection,
                replayQualityDeltaHint: replayQuality.deltaHint,
                replayQualityDeltaVolatilityBand: replayQuality.deltaVolatilityBand,
                replayQualityDeltaVolatilityHint: replayQuality.deltaVolatilityHint,
                replayQualityDeltaHistory: replayQuality.deltaHistory,
                replayQualityDeltaMomentumScore: replayQuality.deltaMomentumScore,
                replayQualityDeltaMomentumDirection: replayQuality.deltaMomentumDirection,
                replayQualityDeltaMomentumBand: replayQuality.deltaMomentumBand,
                replayQualityDeltaMomentumHint: replayQuality.deltaMomentumHint,
                replayQualityDeltaDriftScore: replayQuality.deltaDriftScore,
                replayQualityDeltaDriftDirection: replayQuality.deltaDriftDirection,
                replayQualityDeltaDriftBand: replayQuality.deltaDriftBand,
                replayQualityDeltaDriftHint: replayQuality.deltaDriftHint,
                replayQualityDeltaAnomalyScore: replayQuality.deltaAnomalyScore,
                replayQualityDeltaAnomalyDirection: replayQuality.deltaAnomalyDirection,
                replayQualityDeltaAnomalyBand: replayQuality.deltaAnomalyBand,
                replayQualityDeltaAnomalyHint: replayQuality.deltaAnomalyHint,
                replayQualityStability: replayQuality.stability,
                replayQualityRecentTrend: replayQuality.recentStabilityTrend,
                replayRiskLevel: replayQuality.riskLevel,
                replayRiskHint: replayQuality.riskHint,
                replayRiskLastHighAnchorTime: replayQuality.riskLastHighAnchorTime,
                replayRiskRecoveryMinutes: replayQuality.riskRecoveryMinutes,
                replayRecoveryBand: replayQuality.recoveryBand,
                replayRecoveryHint: replayQuality.recoveryHint,
            }
        });
        persistCurrentRuntimeSnapshot(get());
    },

    advanceMinute: () => {
        const state = get();
        let [h, m] = state.gameState.inGameTime.split(':').map(Number);
        m += 1;
        if (m >= 60) {
            m -= 60;
            h = (h + 1) % 24;
        }
        const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        get().evaluateEvents(newTime);
    },

    rewindMinute: () => {
        const state = get();
        let [h, m] = state.gameState.inGameTime.split(':').map(Number);
        m -= 1;
        if (m < 0) {
            m += 60;
            h = (h - 1 + 24) % 24;
        }
        const newTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const currentMinutes = timeToMinutes(newTime);
        const rebuilt = replayWorldStateToMinutes(currentMinutes);
        const npcs = applyMissionPhaseHooks(rebuilt.npcs, currentMinutes, state.interactionState.missionProgress);
        const dynamicState = applyDynamicRoleResponses(
            npcs,
            rebuilt.dayStats,
            rebuilt.firedSet,
            currentMinutes,
            state.interactionState.missionProgress,
            [],
        );
        const tensionLevel = getTensionLevelForMinutes(currentMinutes);
        const currentPhaseLabel = getPhaseLabelForMinutes(currentMinutes, state.gameState.currentPhaseLabel);
        const roleTrendHistory = buildRoleTrendHistoryToMinutes(currentMinutes, state.interactionState.missionProgress);
        const replayEntry: ReplayRebuildHistoryEntry = {
            mode: 'rewind',
            anchorTime: newTime,
            rebuildEventCount: dynamicState.firedSet.size,
            savedAtEpochMs: Date.now(),
        };
        const replayRebuildHistory = pushReplayHistory(state.gameState.replayRebuildHistory, replayEntry);
        const replayQuality = getReplayQualityState(
            replayRebuildHistory,
            newTime,
            state.gameState.replayQualityRecentTrend,
            state.gameState.replayRiskLastHighAnchorTime,
            state.gameState.replayQualityAvgEvents,
            state.gameState.replayQualityDeltaHistory,
        );

        workerManager.syncNpcs(dynamicState.npcs);
        set({
            npcs: dynamicState.npcs,
            dayStats: dynamicState.dayStats,
            firedEventKeys: Array.from(dynamicState.firedSet),
            roleTrendHistory,
            gameState: {
                ...state.gameState,
                inGameTime: newTime,
                tensionLevel,
                currentPhaseLabel,
                replayMode: 'rewind',
                replayRebuildStatus: 'reconstructed',
                replayRebuildEventCount: dynamicState.firedSet.size,
                replayAnchorTime: newTime,
                replayRebuildHistory,
                replayQualityWindowMinutes: replayQuality.windowMinutes,
                replayQualityRebuildCount: replayQuality.rebuildCount,
                replayQualityAvgEvents: replayQuality.avgRebuildEvents,
                replayQualityDeltaEventsPerCheckpoint: replayQuality.deltaEventsPerCheckpoint,
                replayQualityDeltaDirection: replayQuality.deltaDirection,
                replayQualityDeltaHint: replayQuality.deltaHint,
                replayQualityDeltaVolatilityBand: replayQuality.deltaVolatilityBand,
                replayQualityDeltaVolatilityHint: replayQuality.deltaVolatilityHint,
                replayQualityDeltaHistory: replayQuality.deltaHistory,
                replayQualityDeltaMomentumScore: replayQuality.deltaMomentumScore,
                replayQualityDeltaMomentumDirection: replayQuality.deltaMomentumDirection,
                replayQualityDeltaMomentumBand: replayQuality.deltaMomentumBand,
                replayQualityDeltaMomentumHint: replayQuality.deltaMomentumHint,
                replayQualityDeltaDriftScore: replayQuality.deltaDriftScore,
                replayQualityDeltaDriftDirection: replayQuality.deltaDriftDirection,
                replayQualityDeltaDriftBand: replayQuality.deltaDriftBand,
                replayQualityDeltaDriftHint: replayQuality.deltaDriftHint,
                replayQualityDeltaAnomalyScore: replayQuality.deltaAnomalyScore,
                replayQualityDeltaAnomalyDirection: replayQuality.deltaAnomalyDirection,
                replayQualityDeltaAnomalyBand: replayQuality.deltaAnomalyBand,
                replayQualityDeltaAnomalyHint: replayQuality.deltaAnomalyHint,
                replayQualityStability: replayQuality.stability,
                replayQualityRecentTrend: replayQuality.recentStabilityTrend,
                replayRiskLevel: replayQuality.riskLevel,
                replayRiskHint: replayQuality.riskHint,
                replayRiskLastHighAnchorTime: replayQuality.riskLastHighAnchorTime,
                replayRiskRecoveryMinutes: replayQuality.riskRecoveryMinutes,
                replayRecoveryBand: replayQuality.recoveryBand,
                replayRecoveryHint: replayQuality.recoveryHint,
            }
        });
        persistCurrentRuntimeSnapshot(get());
    },

    toggleTimePause: () => set((state) => ({
        gameState: { ...state.gameState, isTimePaused: !state.gameState.isTimePaused }
    })),

    setTension: (level) => set((state) => {
        workerManager.sendTension(level);
        return { gameState: { ...state.gameState, tensionLevel: level } };
    }),

    resetDayCycle: () => {
        nextNpcId = 1000;
        set({
            npcs: [],
            firedEventKeys: [],
            roleTrendHistory: [],
            interactionState: {
                nearbyZoneId: null,
                lastMessage: null,
                missionProgress: cloneMissionProgress(INITIAL_MISSION_PROGRESS),
            },
            dayStats: { killed: 0, arrested: 0, injured: 0, damage: 0 },
            gameState: { 
                cloudStreamUrl: get().gameState.cloudStreamUrl,
                isPlaying: true, isTimePaused: false, inGameTime: '00:00', 
                tensionLevel: 10, timeSpeed: get().gameState.timeSpeed, 
                currentPhaseLabel: '🌅 Tagesbeginn — Stadt erwacht',
                replayMode: 'live',
                replayRebuildStatus: 'idle',
                replayRebuildEventCount: 0,
                replayAnchorTime: '00:00',
                replayRebuildHistory: [],
                replayQualityWindowMinutes: REPLAY_QUALITY_WINDOW_MINUTES,
                replayQualityRebuildCount: 0,
                replayQualityAvgEvents: 0,
                replayQualityDeltaEventsPerCheckpoint: 0,
                replayQualityDeltaDirection: 'flat',
                replayQualityDeltaHint: 'Replay-Eventlast stabil.',
                replayQualityDeltaVolatilityBand: 'calm' as ReplayQualityDeltaVolatilityBand,
                replayQualityDeltaVolatilityHint: 'Delta-Verlauf stabil.' as ReplayQualityDeltaVolatilityHint,
                replayQualityDeltaHistory: [],
                replayQualityDeltaMomentumScore: 0,
                replayQualityDeltaMomentumDirection: 'flat',
                replayQualityDeltaMomentumBand: 'easing',
                replayQualityDeltaMomentumHint: 'Trendbeschleunigung gering.',
                replayQualityDeltaDriftScore: 0,
                replayQualityDeltaDriftDirection: 'flat',
                replayQualityDeltaDriftBand: 'aligned',
                replayQualityDeltaDriftHint: 'Delta-Basis stabil.',
                replayQualityDeltaAnomalyScore: 0,
                replayQualityDeltaAnomalyDirection: 'flat',
                replayQualityDeltaAnomalyBand: 'normal',
                replayQualityDeltaAnomalyHint: 'Keine auffaellige Delta-Anomalie.',
                replayQualityStability: 'stable',
                replayQualityRecentTrend: [],
                replayRiskLevel: 'low',
                replayRiskHint: 'Stabiler Replay-Betrieb.',
                replayRiskLastHighAnchorTime: null,
                replayRiskRecoveryMinutes: null,
                replayRecoveryBand: 'unknown',
                replayRecoveryHint: 'Noch kein HIGH-Risiko erfasst.',
                playerReputation: get().gameState.playerReputation,
                moralScore: get().gameState.moralScore,
                showStatistics: false,
                masterVolume: get().gameState.masterVolume,
                muted: get().gameState.muted,
                lastTacticalOrder: null
            }
        });
        persistCurrentRuntimeSnapshot(get());
    },

    setTimeSpeed: (speed) => {
        set((state) => ({
            gameState: { ...state.gameState, timeSpeed: speed }
        }));
        persistCurrentRuntimeSnapshot(get());
    },

    adjustReputation: (delta) => {
        set((state) => ({
            gameState: {
                ...state.gameState,
                playerReputation: Math.max(-100, Math.min(100, state.gameState.playerReputation + delta))
            }
        }));
        persistCurrentRuntimeSnapshot(get());
    },

    showStatisticsPanel: () => set((state) => ({
        gameState: { ...state.gameState, showStatistics: true }
    })),

    dismissStatistics: () => set((state) => ({
        gameState: { ...state.gameState, showStatistics: false }
    })),

    setMasterVolume: (val) => {
        set((state) => ({
            gameState: { ...state.gameState, masterVolume: val }
        }));
        persistCurrentRuntimeSnapshot(get());
    },

    setMuted: (muted) => {
        set((state) => ({
            gameState: { ...state.gameState, muted }
        }));
        persistCurrentRuntimeSnapshot(get());
    },

    startDialog: (nodeId) => {
        const node = DIALOG_TREE[nodeId];
        if (!node) return;
        set((state) => ({
            dialogState: {
                ...state.dialogState,
                activeNodeId: nodeId,
                history: [...state.dialogState.history, nodeId]
            }
        }));
        if (node.duration && (!node.choices || node.choices.length === 0)) {
            setTimeout(() => {
                const current = get().dialogState.activeNodeId;
                if (current === nodeId) get().closeDialog();
            }, node.duration);
        }
    },

    chooseDialogOption: (index) => {
        const state = get();
        const currentNode = state.dialogState.activeNodeId ? DIALOG_TREE[state.dialogState.activeNodeId] : null;
        if (!currentNode || !currentNode.choices || !currentNode.choices[index]) return;

        const choice = currentNode.choices[index];
        
        // Effekte anwenden
        if (choice.reputationDelta) state.adjustReputation(choice.reputationDelta);
        if (choice.moralDelta) {
            set((s) => ({
                gameState: { 
                    ...s.gameState, 
                    moralScore: Math.max(0, Math.min(100, s.gameState.moralScore + (choice.moralDelta || 0)))
                }
            }));
        }

        // Zum nächsten Knoten springen
        get().startDialog(choice.nextNodeId);
    },

    closeDialog: () => set((state) => ({
        dialogState: {
            ...state.dialogState,
            activeNodeId: null
        }
    })),

    // --- Taktik-System (Taste C) ---
    issueTacticalOrder: (type: NPCType, behavior: NPCBehavior, mood?: NPCMood) => {
        set((state) => {
            const nextNpcs = state.npcs.map(npc => {
                if (npc.type === type) {
                    return {
                        ...npc,
                        behavior,
                        mood: mood ?? npc.mood
                    };
                }
                return npc;
            });
            
            workerManager.syncNpcs(nextNpcs);
            
            return {
                npcs: nextNpcs,
                gameState: {
                    ...state.gameState,
                    lastTacticalOrder: `${type}: ${behavior}`
                }
            };
        });
        persistCurrentRuntimeSnapshot(get());
    },

    setNearbyInteraction: (zoneId) => set((state) => ({
        interactionState: {
            ...state.interactionState,
            nearbyZoneId: zoneId,
        }
    })),

    triggerInteraction: () => {
        set((state) => {
            const zoneId = state.interactionState.nearbyZoneId;
            if (!zoneId) {
                return state;
            }

            const outcome = applyInteractionOutcome(state.interactionState.missionProgress, zoneId);
            const nextReputation = Math.max(-100, Math.min(100, state.gameState.playerReputation + outcome.reputationDelta));
            const nextMoral = Math.max(0, Math.min(100, state.gameState.moralScore + outcome.moralDelta));
            const nextTension = Math.max(0, Math.min(100, state.gameState.tensionLevel + outcome.tensionDelta));
            const nextNpcs = outcome.wasApplied ? applyMissionNpcEffects(state.npcs, zoneId) : state.npcs;
            const nextDayStats = outcome.wasApplied
                ? applyDayStatsDelta(state.dayStats, getInteractionDayStatsDelta(zoneId))
                : state.dayStats;

            if (outcome.wasApplied && nextNpcs !== state.npcs) {
                workerManager.syncNpcs(nextNpcs);
            }

            return {
                npcs: nextNpcs,
                dayStats: nextDayStats,
                interactionState: {
                    ...state.interactionState,
                    lastMessage: outcome.message,
                    missionProgress: outcome.missionProgress,
                },
                gameState: {
                    ...state.gameState,
                    playerReputation: nextReputation,
                    moralScore: nextMoral,
                    tensionLevel: nextTension,
                    currentPhaseLabel: outcome.phaseLabel ?? state.gameState.currentPhaseLabel,
                },
            };
        });
        persistCurrentRuntimeSnapshot(get());
    }
}));

if (typeof window !== 'undefined') {
    window.__GAME_STORE__ = useGameStore;
}

