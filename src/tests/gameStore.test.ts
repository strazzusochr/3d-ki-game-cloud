import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketState = vi.hoisted(() => {
  const socket = {
    connected: false,
    connect: vi.fn(() => {
      socket.connected = true;
    }),
    on: vi.fn(),
    emit: vi.fn(),
  };
  return { socket };
});

const workerState = vi.hoisted(() => ({
  workerManager: {
    init: vi.fn(),
    startSimulation: vi.fn(),
    syncNpcs: vi.fn(),
    moveNpcsToTarget: vi.fn(),
    sendTension: vi.fn(),
    stopSimulation: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketState.socket),
}));

vi.mock('../managers/WorkerManager', () => workerState);

import { useGameStore } from '../stores/gameStore';
import { INITIAL_MISSION_PROGRESS } from '../systems/interactionZones';
import { NPCBehavior, NPCMood, NPCType, EmotionalState } from '../types/enums';
import { RUNTIME_SNAPSHOT_KEY } from '../stores/runtimePersistence';

const resetStore = () => {
  window.localStorage.clear();
  useGameStore.setState({
    npcs: [],
    firedEventKeys: [],
    roleTrendHistory: [],
    interactionState: {
      nearbyZoneId: null,
      lastMessage: null,
      missionProgress: {
        epochBriefingVerified: INITIAL_MISSION_PROGRESS.epochBriefingVerified,
        hazardMapPrepared: INITIAL_MISSION_PROGRESS.hazardMapPrepared,
        prioritizedZoneIds: [...INITIAL_MISSION_PROGRESS.prioritizedZoneIds],
      },
    },
    dayStats: { killed: 0, arrested: 0, injured: 0, damage: 0 },
    gameState: {
      isPlaying: false,
      isTimePaused: false,
      inGameTime: '06:00',
      tensionLevel: 10,
      timeSpeed: 1,
      currentPhaseLabel: 'start',
      replayMode: 'live',
      replayRebuildStatus: 'idle',
      replayRebuildEventCount: 0,
      replayAnchorTime: '06:00',
      replayRebuildHistory: [],
      replayQualityWindowMinutes: 90,
      replayQualityRebuildCount: 0,
      replayQualityAvgEvents: 0,
      replayQualityDeltaEventsPerCheckpoint: 0,
      replayQualityDeltaDirection: 'flat',
      replayQualityDeltaHint: 'Replay-Eventlast stabil.',
      replayQualityDeltaVolatilityBand: 'calm',
      replayQualityDeltaVolatilityHint: 'Delta-Verlauf stabil.',
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
      muted: false,
    },
  });
  socketState.socket.connected = false;
  socketState.socket.connect.mockClear();
  socketState.socket.on.mockClear();
  socketState.socket.emit.mockClear();
  workerState.workerManager.syncNpcs.mockClear();
  workerState.workerManager.moveNpcsToTarget.mockClear();
};

describe('gameStore core flow', () => {
  beforeEach(() => {
    resetStore();
  });

  it('initializes socket only once and registers listeners', () => {
    const state = useGameStore.getState();

    state.initSocket();
    state.initSocket();

    expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
    expect(socketState.socket.on).toHaveBeenCalledWith('init-state', expect.any(Function));
    expect(socketState.socket.on).toHaveBeenCalledWith('time-sync', expect.any(Function));
  });

  it('evaluates 06:00 timeline and spawns first wave', () => {
    useGameStore.getState().evaluateEvents('06:00');
    const state = useGameStore.getState();

    expect(state.gameState.inGameTime).toBe('06:00');
    // tension 8: last TENSION_TIMELINE entry matching 06:00 is { time:'05:00', level:8 } (dawn patrol)
    expect(state.gameState.tensionLevel).toBe(8);
    // STRESS-TEST: 06:00 spawnt 500 NPCs (250 West + 250 Ost) für Performance-Validierung
    // Overnight aftermath events werden durch MAX_ACTIVE_NPCS-Cap (500) überschrieben
    expect(state.npcs.length).toBe(500);
    expect(workerState.workerManager.syncNpcs).toHaveBeenCalled();
    expect(socketState.socket.emit).toHaveBeenCalledWith('update-time', '06:00');
  });

  it('resets the day cycle to midnight and clears dynamic entities', () => {
    useGameStore.getState().evaluateEvents('12:30');
    expect(useGameStore.getState().npcs.length).toBeGreaterThan(0);

    useGameStore.getState().resetDayCycle();
    const state = useGameStore.getState();

    expect(state.npcs.length).toBe(0);
    expect(state.firedEventKeys.length).toBe(0);
    expect(state.gameState.inGameTime).toBe('00:00');
  });

  it('applies interaction outcomes to mission state and game metrics', () => {
    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();

    const state = useGameStore.getState();

    expect(state.interactionState.missionProgress.epochBriefingVerified).toBe(true);
    expect(state.gameState.playerReputation).toBe(8);
    expect(state.gameState.moralScore).toBe(60);
    expect(state.gameState.tensionLevel).toBe(4);
    expect(state.interactionState.lastMessage).toContain('Einsatzstab');
  });

  it('does not double-count the same interaction twice', () => {
    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().setNearbyInteraction('hazard-console');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().triggerInteraction();

    const state = useGameStore.getState();

    expect(state.interactionState.missionProgress.hazardMapPrepared).toBe(true);
    expect(state.gameState.playerReputation).toBe(14);
    expect(state.interactionState.lastMessage).toContain('bereits');
  });

  it('persistiert Missionsfortschritt und Trendzustand als Runtime-Snapshot', () => {
    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();

    const rawSnapshot = window.localStorage.getItem(RUNTIME_SNAPSHOT_KEY);
    expect(rawSnapshot).not.toBeNull();

    const snapshot = JSON.parse(rawSnapshot as string) as {
      missionProgress: { epochBriefingVerified: boolean };
      inGameTime: string;
      roleTrendHistory: unknown[];
    };

    expect(snapshot.missionProgress.epochBriefingVerified).toBe(true);
    expect(snapshot.inGameTime).toBe('06:00');
    expect(Array.isArray(snapshot.roleTrendHistory)).toBe(true);
  });

  it('returns a locked message for mission steps out of order', () => {
    useGameStore.getState().setNearbyInteraction('evacuation-board-north');
    useGameStore.getState().triggerInteraction();

    const state = useGameStore.getState();

    expect(state.interactionState.missionProgress.prioritizedZoneIds).toHaveLength(0);
    expect(state.interactionState.lastMessage).toContain('Hazard');
  });

  it('applies hazard mission effects to responders and security units', () => {
    useGameStore.setState((state) => ({
      ...state,
      npcs: [
        {
          id: 9001,
          type: NPCType.MEDIC,
          position: [10, 1.2, 8],
          rotation: 0,
          outfitColor: '#ffffff',
          emotionalState: EmotionalState.NEUTRAL,
          mood: NPCMood.PEACEFUL,
          behavior: NPCBehavior.IDLE,
        },
        {
          id: 9002,
          type: NPCType.POLICE,
          position: [8, 1.2, 9],
          rotation: 0,
          outfitColor: '#1122aa',
          emotionalState: EmotionalState.NEUTRAL,
          mood: NPCMood.PEACEFUL,
          behavior: NPCBehavior.PATROL,
        },
      ],
    }));

    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().setNearbyInteraction('hazard-console');
    useGameStore.getState().triggerInteraction();

    const state = useGameStore.getState();
    const medic = state.npcs.find((npc) => npc.id === 9001)!;
    const police = state.npcs.find((npc) => npc.id === 9002)!;

    expect(medic.behavior).toBe(NPCBehavior.CLEANUP);
    expect(medic.mood).toBe(NPCMood.TENSE);
    expect(police.behavior).toBe(NPCBehavior.SHIELD_WALL);
    expect(police.mood).toBe(NPCMood.TENSE);
  });

  it('applies evacuation board effects only to the addressed zone sector', () => {
    useGameStore.setState((state) => ({
      ...state,
      npcs: [
        {
          id: 9101,
          type: NPCType.CIVILIAN,
          position: [-12, 1.2, 18],
          rotation: 0,
          outfitColor: '#bbbbbb',
          emotionalState: EmotionalState.PEACEFUL,
          mood: NPCMood.PEACEFUL,
          behavior: NPCBehavior.WANDER,
        },
        {
          id: 9102,
          type: NPCType.CIVILIAN,
          position: [14, 1.2, -16],
          rotation: 0,
          outfitColor: '#bbbbbb',
          emotionalState: EmotionalState.PEACEFUL,
          mood: NPCMood.PEACEFUL,
          behavior: NPCBehavior.WANDER,
        },
      ],
    }));

    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().setNearbyInteraction('hazard-console');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().setNearbyInteraction('evacuation-board-north');
    useGameStore.getState().triggerInteraction();

    const state = useGameStore.getState();
    const northCivilian = state.npcs.find((npc) => npc.id === 9101)!;
    const southCivilian = state.npcs.find((npc) => npc.id === 9102)!;

    expect(northCivilian.behavior).toBe(NPCBehavior.FLEE);
    expect(northCivilian.mood).toBe(NPCMood.PANICKED);
    expect(southCivilian.behavior).toBe(NPCBehavior.WANDER);
    expect(southCivilian.mood).toBe(NPCMood.PEACEFUL);
  });

  it('applies phase hooks during evaluateEvents for completed mission chain', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          epochBriefingVerified: true,
          hazardMapPrepared: false,
          prioritizedZoneIds: [],
        },
      },
      npcs: [
        {
          id: 9201,
          type: NPCType.ORGANIZER,
          position: [4, 1.2, 10],
          rotation: 0,
          outfitColor: '#222',
          emotionalState: EmotionalState.PEACEFUL,
          mood: NPCMood.PEACEFUL,
          behavior: NPCBehavior.IDLE,
        },
      ],
    }));

    useGameStore.getState().evaluateEvents('13:00');
    const organizer = useGameStore.getState().npcs.find((n) => n.id === 9201)!;

    expect(organizer.behavior).toBe(NPCBehavior.GATHER);
    expect(organizer.mood).toBe(NPCMood.TENSE);
  });

  it('opens and dismisses statistics overlay explicitly', () => {
    const state = useGameStore.getState();

    state.showStatisticsPanel();
    expect(useGameStore.getState().gameState.showStatistics).toBe(true);

    state.dismissStatistics();
    expect(useGameStore.getState().gameState.showStatistics).toBe(false);
  });

  it('shows statistics overlay automatically when time crosses midnight', () => {
    useGameStore.setState((state) => ({
      ...state,
      gameState: {
        ...state.gameState,
        inGameTime: '23:59',
        showStatistics: false,
      },
    }));

    useGameStore.getState().evaluateEvents('00:00');

    expect(useGameStore.getState().gameState.showStatistics).toBe(true);
  });

  it('fills dayStats while timeline events are evaluated', () => {
    useGameStore.getState().evaluateEvents('12:20');
    const stats = useGameStore.getState().dayStats;

    expect(stats.injured).toBeGreaterThan(0);
    expect(stats.damage).toBeGreaterThan(0);
    expect(stats.arrested).toBeGreaterThanOrEqual(0);
  });

  it('reduces dayStats pressure after mission interactions', () => {
    useGameStore.setState((state) => ({
      ...state,
      dayStats: { killed: 0, arrested: 3, injured: 6, damage: 20000 },
    }));

    useGameStore.getState().setNearbyInteraction('epoch-terminal');
    useGameStore.getState().triggerInteraction();
    useGameStore.getState().setNearbyInteraction('hazard-console');
    useGameStore.getState().triggerInteraction();

    const stats = useGameStore.getState().dayStats;

    expect(stats.arrested).toBe(3);
    expect(stats.injured).toBe(3);
    expect(stats.damage).toBe(8500);
  });

  it('spawns rioter plunderers at 00:30 in overnight aftermath', () => {
    useGameStore.getState().evaluateEvents('00:30');
    const npcs = useGameStore.getState().npcs;
    const rioters = npcs.filter((n) => n.type === NPCType.RIOTER);
    expect(rioters.length).toBe(3);
  });

  it('records arrests for plunderers despawned at 03:30 overnight', () => {
    useGameStore.getState().evaluateEvents('03:30');
    const stats = useGameStore.getState().dayStats;
    // 03:30 DESPAWN RIOTER count 3 → arrested += ceil(3 * 0.75) = 3
    expect(stats.arrested).toBeGreaterThanOrEqual(3);
    // Rioters should be gone after despawn
    const rioters = useGameStore.getState().npcs.filter((n) => n.type === NPCType.RIOTER);
    expect(rioters.length).toBe(0);
  });

  it('activates evening reinforcement when aggressors outnumber security forces', () => {
    useGameStore.getState().evaluateEvents('18:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-evening-reinforcement');
    expect(state.npcs.filter((npc) => npc.type === NPCType.RIOT_POLICE).length).toBeGreaterThanOrEqual(6);
    expect(state.dayStats.damage).toBeGreaterThan(0);
  });

  it('activates late triage corridor when panic pressure stays high', () => {
    useGameStore.getState().evaluateEvents('21:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-evening-reinforcement');
    expect(state.firedEventKeys).toContain('dyn-late-triage');
    expect(state.npcs.filter((npc) => npc.type === NPCType.MEDIC).length).toBeGreaterThanOrEqual(5);
  });

  it('triggers high-priority medical relief from correlation engine', () => {
    useGameStore.getState().evaluateEvents('19:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-high-medical-relief');
    expect(state.npcs.filter((npc) => npc.type === NPCType.MEDIC).length).toBeGreaterThanOrEqual(2);
  });

  it('triggers critical lockdown reinforcement from correlation engine', () => {
    useGameStore.getState().evaluateEvents('21:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-critical-lockdown');
    expect(state.npcs.filter((npc) => npc.type === NPCType.SEK).length).toBeGreaterThanOrEqual(29);
  });

  it('triggers mission media branch after epoch verification', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          epochBriefingVerified: true,
        },
      },
    }));

    useGameStore.getState().evaluateEvents('12:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-epoch-media');
    expect(state.npcs.filter((npc) => npc.type === NPCType.JOURNALIST).length).toBeGreaterThanOrEqual(3);
  });

  it('triggers mission press corridor as second epoch wave', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          epochBriefingVerified: true,
        },
      },
    }));

    useGameStore.getState().evaluateEvents('14:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-epoch-media');
    expect(state.firedEventKeys).toContain('dyn-mission-epoch-press-corridor');
    expect(state.npcs.filter((npc) => npc.type === NPCType.POLICE).length).toBeGreaterThanOrEqual(7);
  });

  it('triggers epoch misinformation fallback when briefing is missing', () => {
    useGameStore.getState().evaluateEvents('15:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-epoch-misinformation');
    expect(state.npcs.filter((npc) => npc.type === NPCType.DEMONSTRATOR).length).toBeGreaterThanOrEqual(3);
  });

  it('triggers mission hazard branch after hazard map preparation', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          hazardMapPrepared: true,
        },
      },
    }));

    useGameStore.getState().evaluateEvents('18:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-hazard-shield');
    expect(state.npcs.filter((npc) => npc.type === NPCType.POLICE).length).toBeGreaterThanOrEqual(9);
  });

  it('triggers mission firebreak as second hazard wave', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          hazardMapPrepared: true,
        },
      },
    }));

    useGameStore.getState().evaluateEvents('19:30');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-hazard-shield');
    expect(state.firedEventKeys).toContain('dyn-mission-hazard-firebreak');
    expect(state.npcs.filter((npc) => npc.type === NPCType.FIREFIGHTER).length).toBeGreaterThanOrEqual(2);
  });

  it('triggers hazard surge fallback when hazard map is missing', () => {
    useGameStore.getState().evaluateEvents('20:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-hazard-surge');
    expect(state.npcs.filter((npc) => npc.type === NPCType.RIOTER).length).toBeGreaterThanOrEqual(4);
  });

  it('triggers fullchain mission deescalation after three priorities are set', () => {
    useGameStore.getState().evaluateEvents('21:00');
    const baseline = useGameStore.getState().dayStats;

    resetStore();

    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          prioritizedZoneIds: ['evacuation-board-north', 'evacuation-board-west', 'evacuation-board-south'],
        },
      },
    }));

    useGameStore.getState().evaluateEvents('21:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-fullchain-deescalation');
    expect(state.dayStats.damage).toBeLessThanOrEqual(baseline.damage - 1700);
    expect(state.dayStats.injured).toBeLessThanOrEqual(baseline.injured - 2);
  });

  it('triggers fullchain recovery as second late wave', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          ...state.interactionState.missionProgress,
          prioritizedZoneIds: ['evacuation-board-north', 'evacuation-board-west', 'evacuation-board-south'],
        },
      },
    }));

    useGameStore.getState().evaluateEvents('22:00');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-fullchain-deescalation');
    expect(state.firedEventKeys).toContain('dyn-mission-fullchain-recovery');
    expect(state.npcs.filter((npc) => npc.type === NPCType.MEDIC).length).toBeGreaterThanOrEqual(4);
  });

  it('triggers trend synchronization branch for strong weighted mission path', () => {
    useGameStore.setState((state) => ({
      ...state,
      interactionState: {
        ...state.interactionState,
        missionProgress: {
          epochBriefingVerified: true,
          hazardMapPrepared: true,
          prioritizedZoneIds: ['evacuation-board-north', 'evacuation-board-west', 'evacuation-board-south'],
        },
      },
    }));

    useGameStore.getState().evaluateEvents('20:30');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-trend-synchronization');
  });

  it('triggers trend fracture wave for weak weighted mission path', () => {
    useGameStore.getState().evaluateEvents('21:30');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-trend-fracture-wave');
    expect(state.npcs.filter((npc) => npc.type === NPCType.RIOTER).length).toBeGreaterThanOrEqual(3);
  });

  it('triggers fragmented command fallback when priorities stay too low', () => {
    useGameStore.getState().evaluateEvents('22:30');
    const state = useGameStore.getState();

    expect(state.firedEventKeys).toContain('dyn-mission-fragmented-command');
    expect(state.npcs.filter((npc) => npc.type === NPCType.EXTREMIST).length).toBeGreaterThanOrEqual(2);
  });

  it('rebuilds dynamic role responses correctly when rewinding', () => {
    useGameStore.getState().evaluateEvents('21:00');
    useGameStore.getState().rewindHour();

    const state = useGameStore.getState();

    expect(state.gameState.inGameTime).toBe('20:00');
    expect(state.firedEventKeys).toContain('dyn-evening-reinforcement');
    expect(state.firedEventKeys).toContain('dyn-high-medical-relief');
    expect(state.firedEventKeys).not.toContain('dyn-late-triage');
    expect(state.npcs.filter((npc) => npc.type === NPCType.MEDIC).length).toBeGreaterThanOrEqual(2);
    expect(state.roleTrendHistory.length).toBeGreaterThan(0);
    expect(state.roleTrendHistory.at(-1)?.time).toBe('20:00');
    expect(state.gameState.replayMode).toBe('rewind');
    expect(state.gameState.replayRebuildStatus).toBe('reconstructed');
    expect(state.gameState.replayRebuildEventCount).toBeGreaterThan(0);
    expect(state.gameState.replayAnchorTime).toBe('20:00');
    expect(state.gameState.replayRebuildHistory.length).toBeGreaterThan(0);
    expect(state.gameState.replayRebuildHistory[0].anchorTime).toBe('20:00');
    expect(state.gameState.replayQualityWindowMinutes).toBe(90);
    expect(state.gameState.replayQualityRebuildCount).toBeGreaterThan(0);
    expect(state.gameState.replayQualityAvgEvents).toBeGreaterThanOrEqual(0);
    expect(Math.abs(state.gameState.replayQualityDeltaEventsPerCheckpoint)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(state.gameState.replayQualityDeltaDirection);
    expect(state.gameState.replayQualityDeltaHint.length).toBeGreaterThan(0);
    expect(['calm', 'mixed', 'volatile']).toContain(state.gameState.replayQualityDeltaVolatilityBand);
    expect(state.gameState.replayQualityDeltaVolatilityHint.length).toBeGreaterThan(0);
    expect(Array.isArray(state.gameState.replayQualityDeltaHistory)).toBe(true);
    expect(Math.abs(state.gameState.replayQualityDeltaMomentumScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(state.gameState.replayQualityDeltaMomentumDirection);
    expect(['easing', 'steady', 'accelerating']).toContain(state.gameState.replayQualityDeltaMomentumBand);
    expect(state.gameState.replayQualityDeltaMomentumHint.length).toBeGreaterThan(0);
    expect(Math.abs(state.gameState.replayQualityDeltaDriftScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(state.gameState.replayQualityDeltaDriftDirection);
    expect(['aligned', 'offset', 'diverging']).toContain(state.gameState.replayQualityDeltaDriftBand);
    expect(state.gameState.replayQualityDeltaDriftHint.length).toBeGreaterThan(0);
    expect(Math.abs(state.gameState.replayQualityDeltaAnomalyScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(state.gameState.replayQualityDeltaAnomalyDirection);
    expect(['normal', 'watch', 'spike']).toContain(state.gameState.replayQualityDeltaAnomalyBand);
    expect(state.gameState.replayQualityDeltaAnomalyHint.length).toBeGreaterThan(0);
    expect(['stable', 'watch', 'critical']).toContain(state.gameState.replayQualityStability);
    expect(state.gameState.replayQualityRecentTrend.length).toBeGreaterThan(0);
    expect(['stable', 'watch', 'critical']).toContain(state.gameState.replayQualityRecentTrend[0]);
    expect(['low', 'medium', 'high']).toContain(state.gameState.replayRiskLevel);
    expect(state.gameState.replayRiskHint.length).toBeGreaterThan(0);
    expect(state.gameState.replayRiskRecoveryMinutes === null || state.gameState.replayRiskRecoveryMinutes >= 0).toBe(true);

    const rawSnapshot = window.localStorage.getItem(RUNTIME_SNAPSHOT_KEY);
    expect(rawSnapshot).not.toBeNull();

    const snapshot = JSON.parse(rawSnapshot as string) as {
      replayState: {
        mode: 'live' | 'rewind';
        rebuildStatus: 'idle' | 'reconstructed';
        rebuildEventCount: number;
        anchorTime: string;
        rebuildHistory: Array<{
          mode: 'live' | 'rewind';
          anchorTime: string;
          rebuildEventCount: number;
          savedAtEpochMs: number;
        }>;
        quality: {
          windowMinutes: number;
          rebuildCount: number;
          avgRebuildEvents: number;
          deltaEventsPerCheckpoint: number;
          deltaDirection: 'up' | 'down' | 'flat';
          deltaHint: string;
          deltaVolatilityBand: 'calm' | 'mixed' | 'volatile';
          deltaVolatilityHint: string;
          deltaHistory: number[];
          deltaMomentumScore: number;
          deltaMomentumDirection: 'up' | 'down' | 'flat';
          deltaMomentumBand: 'easing' | 'steady' | 'accelerating';
          deltaMomentumHint: string;
          deltaDriftScore: number;
          deltaDriftDirection: 'up' | 'down' | 'flat';
          deltaDriftBand: 'aligned' | 'offset' | 'diverging';
          deltaDriftHint: string;
          deltaAnomalyScore: number;
          deltaAnomalyDirection: 'up' | 'down' | 'flat';
          deltaAnomalyBand: 'normal' | 'watch' | 'spike';
          deltaAnomalyHint: string;
          stability: 'stable' | 'watch' | 'critical';
          recentStabilityTrend: Array<'stable' | 'watch' | 'critical'>;
          riskLevel: 'low' | 'medium' | 'high';
          riskHint: string;
          riskLastHighAnchorTime: string | null;
          riskRecoveryMinutes: number | null;
          recoveryBand: 'hot' | 'cooling' | 'recovered' | 'unknown';
          recoveryHint: string;
        };
      };
    };

    expect(snapshot.replayState.mode).toBe('rewind');
    expect(snapshot.replayState.rebuildStatus).toBe('reconstructed');
    expect(snapshot.replayState.rebuildEventCount).toBeGreaterThan(0);
    expect(snapshot.replayState.anchorTime).toBe('20:00');
    expect(snapshot.replayState.rebuildHistory.length).toBeGreaterThan(0);
    expect(snapshot.replayState.rebuildHistory[0].anchorTime).toBe('20:00');
    expect(snapshot.replayState.quality.windowMinutes).toBe(90);
    expect(snapshot.replayState.quality.rebuildCount).toBeGreaterThan(0);
    expect(snapshot.replayState.quality.avgRebuildEvents).toBeGreaterThanOrEqual(0);
    expect(Math.abs(snapshot.replayState.quality.deltaEventsPerCheckpoint)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(snapshot.replayState.quality.deltaDirection);
    expect(snapshot.replayState.quality.deltaHint.length).toBeGreaterThan(0);
    expect(['calm', 'mixed', 'volatile']).toContain(snapshot.replayState.quality.deltaVolatilityBand);
    expect(snapshot.replayState.quality.deltaVolatilityHint.length).toBeGreaterThan(0);
    expect(Array.isArray(snapshot.replayState.quality.deltaHistory)).toBe(true);
    expect(Math.abs(snapshot.replayState.quality.deltaMomentumScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(snapshot.replayState.quality.deltaMomentumDirection);
    expect(['easing', 'steady', 'accelerating']).toContain(snapshot.replayState.quality.deltaMomentumBand);
    expect(snapshot.replayState.quality.deltaMomentumHint.length).toBeGreaterThan(0);
    expect(Math.abs(snapshot.replayState.quality.deltaDriftScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(snapshot.replayState.quality.deltaDriftDirection);
    expect(['aligned', 'offset', 'diverging']).toContain(snapshot.replayState.quality.deltaDriftBand);
    expect(snapshot.replayState.quality.deltaDriftHint.length).toBeGreaterThan(0);
    expect(Math.abs(snapshot.replayState.quality.deltaAnomalyScore)).toBeLessThanOrEqual(999);
    expect(['up', 'down', 'flat']).toContain(snapshot.replayState.quality.deltaAnomalyDirection);
    expect(['normal', 'watch', 'spike']).toContain(snapshot.replayState.quality.deltaAnomalyBand);
    expect(snapshot.replayState.quality.deltaAnomalyHint.length).toBeGreaterThan(0);
    expect(snapshot.replayState.quality.recentStabilityTrend.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(snapshot.replayState.quality.riskLevel);
    expect(snapshot.replayState.quality.riskHint.length).toBeGreaterThan(0);
    expect(snapshot.replayState.quality.riskRecoveryMinutes === null || snapshot.replayState.quality.riskRecoveryMinutes >= 0).toBe(true);
    expect(['hot', 'cooling', 'recovered', 'unknown']).toContain(snapshot.replayState.quality.recoveryBand);
    expect(snapshot.replayState.quality.recoveryHint.length).toBeGreaterThan(0);
  });

  it('tracks replay recovery minutes since last high risk anchor', () => {
    useGameStore.setState((state) => ({
      ...state,
      gameState: {
        ...state.gameState,
        inGameTime: '21:00',
        replayRebuildHistory: [],
        replayRiskLevel: 'low',
        replayRiskHint: 'Stabiler Replay-Betrieb.',
        replayRiskLastHighAnchorTime: '20:00',
        replayRiskRecoveryMinutes: 0,
        replayRecoveryBand: 'hot',
        replayRecoveryHint: 'Sofort entlasten: unter 30 Minuten seit HIGH.',
      },
    }));

    useGameStore.getState().evaluateEvents('21:30');
    const state = useGameStore.getState();

    expect(state.gameState.replayRiskLevel).toBe('low');
    expect(state.gameState.replayRiskLastHighAnchorTime).toBe('20:00');
    expect(state.gameState.replayRiskRecoveryMinutes).toBe(90);
    expect(state.gameState.replayRecoveryBand).toBe('cooling');
    expect(state.gameState.replayRecoveryHint).toBe('Stabilisierung laeuft: 30 bis 90 Minuten seit HIGH.');
  });

  it('maps replay recovery band to recovered above 90 minutes', () => {
    useGameStore.setState((state) => ({
      ...state,
      gameState: {
        ...state.gameState,
        inGameTime: '21:00',
        replayRebuildHistory: [],
        replayRiskLevel: 'low',
        replayRiskHint: 'Stabiler Replay-Betrieb.',
        replayRiskLastHighAnchorTime: '19:00',
        replayRiskRecoveryMinutes: 0,
        replayRecoveryBand: 'hot',
        replayRecoveryHint: 'Sofort entlasten: unter 30 Minuten seit HIGH.',
      },
    }));

    useGameStore.getState().evaluateEvents('21:00');
    const state = useGameStore.getState();

    expect(state.gameState.replayRiskRecoveryMinutes).toBe(120);
    expect(state.gameState.replayRecoveryBand).toBe('recovered');
    expect(state.gameState.replayRecoveryHint).toBe('Erholt: mehr als 90 Minuten seit letztem HIGH.');
  });

  it('records role trend snapshots while time progresses', () => {
    useGameStore.getState().evaluateEvents('18:00');
    useGameStore.getState().evaluateEvents('19:00');
    const history = useGameStore.getState().roleTrendHistory;

    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history.at(-1)?.time).toBe('19:00');
    expect(history.some((point) => point.aggressors > 0)).toBe(true);
  });

  it('clears role trend history on day reset', () => {
    useGameStore.getState().evaluateEvents('21:00');
    expect(useGameStore.getState().roleTrendHistory.length).toBeGreaterThan(0);

    useGameStore.getState().resetDayCycle();

    expect(useGameStore.getState().roleTrendHistory).toHaveLength(0);
  });
});
