import { describe, expect, it } from 'vitest';
import { NPCBehavior, NPCMood, NPCType, EmotionalState } from '../types/enums';
import { getHudTelemetry, getPhaseWindow, timeToMinutesSafe } from '../systems/hudTelemetry';
import type { NPCData } from '../stores/gameStore';
import type { MissionProgress } from '../systems/interactionZones';

const progressBase: MissionProgress = {
  epochBriefingVerified: false,
  hazardMapPrepared: false,
  prioritizedZoneIds: [],
};

const npc = (id: number, behavior: NPCBehavior, mood: NPCMood): NPCData => ({
  id,
  type: NPCType.CIVILIAN,
  position: [0, 1.2, 0],
  rotation: 0,
  outfitColor: '#fff',
  emotionalState: EmotionalState.NEUTRAL,
  mood,
  behavior,
});

describe('hud telemetry', () => {
  it('parses time safely and clamps invalid values', () => {
    expect(timeToMinutesSafe('12:34')).toBe(754);
    expect(timeToMinutesSafe('invalid')).toBe(0);
    expect(timeToMinutesSafe('99:99')).toBe(1439);
  });

  it('maps minute ranges into phase windows', () => {
    expect(getPhaseWindow(5 * 60 + 59)).toBe('NIGHT');
    expect(getPhaseWindow(6 * 60)).toBe('MORNING');
    expect(getPhaseWindow(12 * 60)).toBe('MIDDAY');
    expect(getPhaseWindow(18 * 60)).toBe('EVENING');
    expect(getPhaseWindow(21 * 60)).toBe('LATE');
  });

  it('calculates mission completion, hooks, and behavior counters', () => {
    const progress: MissionProgress = {
      epochBriefingVerified: true,
      hazardMapPrepared: true,
      prioritizedZoneIds: ['evacuation-board-north', 'evacuation-board-west', 'evacuation-board-south'],
    };

    const npcs: NPCData[] = [
      npc(1, NPCBehavior.GATHER, NPCMood.TENSE),
      npc(2, NPCBehavior.CLEANUP, NPCMood.PEACEFUL),
      npc(3, NPCBehavior.SHIELD_WALL, NPCMood.PANICKED),
      npc(4, NPCBehavior.FLEE, NPCMood.PANICKED),
      npc(5, NPCBehavior.RETREAT, NPCMood.RIOTING),
    ];

    const telemetry = getHudTelemetry('21:30', progress, npcs);

    expect(telemetry.phaseWindow).toBe('LATE');
    expect(telemetry.missionCompletionPercent).toBe(100);
    expect(telemetry.hookReadinessPercent).toBe(100);
    expect(telemetry.activeHooks).toBe(3);
    expect(telemetry.maxHooks).toBe(4);
    expect(telemetry.panicRatioPercent).toBe(60);
    expect(telemetry.behaviorCounts.gather).toBe(1);
    expect(telemetry.behaviorCounts.cleanup).toBe(1);
    expect(telemetry.behaviorCounts.shieldWall).toBe(1);
    expect(telemetry.behaviorCounts.flee).toBe(1);
    expect(telemetry.behaviorCounts.retreat).toBe(1);
  });

  it('returns zeroed ratios for empty npc lists', () => {
    const telemetry = getHudTelemetry('08:15', progressBase, []);

    expect(telemetry.panicRatioPercent).toBe(0);
    expect(telemetry.activeHooks).toBe(0);
    expect(telemetry.missionCompletionPercent).toBe(0);
    expect(telemetry.dominantRole).toBeNull();
    expect(telemetry.roleBalance.security).toBe(0);
    expect(telemetry.roleBalance.aggressors).toBe(0);
    expect(telemetry.roleBalance.support).toBe(0);
    expect(telemetry.roleBalance.civilian).toBe(0);
  });
});

const npcOfType = (id: number, type: NPCType): NPCData => ({
  id,
  type,
  position: [0, 1.2, 0],
  rotation: 0,
  outfitColor: '#fff',
  emotionalState: EmotionalState.NEUTRAL,
  mood: NPCMood.PEACEFUL,
  behavior: NPCBehavior.IDLE,
});

describe('hud telemetry — role breakdown', () => {
  it('builds npcTypeCounts from a mixed npc list', () => {
    const npcs: NPCData[] = [
      npcOfType(1, NPCType.POLICE),
      npcOfType(2, NPCType.POLICE),
      npcOfType(3, NPCType.RIOTER),
      npcOfType(4, NPCType.MEDIC),
    ];
    const telemetry = getHudTelemetry('12:00', progressBase, npcs);
    expect(telemetry.npcTypeCounts[NPCType.POLICE]).toBe(2);
    expect(telemetry.npcTypeCounts[NPCType.RIOTER]).toBe(1);
    expect(telemetry.npcTypeCounts[NPCType.MEDIC]).toBe(1);
  });

  it('identifies dominantRole as the type with the highest count', () => {
    const npcs: NPCData[] = [
      npcOfType(1, NPCType.EXTREMIST),
      npcOfType(2, NPCType.EXTREMIST),
      npcOfType(3, NPCType.EXTREMIST),
      npcOfType(4, NPCType.POLICE),
    ];
    const telemetry = getHudTelemetry('19:00', progressBase, npcs);
    expect(telemetry.dominantRole).toBe(NPCType.EXTREMIST);
  });

  it('computes roleBalance by security / aggressors / support / civilian groups', () => {
    const npcs: NPCData[] = [
      npcOfType(1, NPCType.POLICE),
      npcOfType(2, NPCType.RIOT_POLICE),
      npcOfType(3, NPCType.SEK),
      npcOfType(4, NPCType.RIOTER),
      npcOfType(5, NPCType.EXTREMIST),
      npcOfType(6, NPCType.MEDIC),
      npcOfType(7, NPCType.CIVILIAN),
    ];
    const telemetry = getHudTelemetry('21:00', progressBase, npcs);
    expect(telemetry.roleBalance.security).toBe(3);
    expect(telemetry.roleBalance.aggressors).toBe(2);
    expect(telemetry.roleBalance.support).toBe(1);
    expect(telemetry.roleBalance.civilian).toBe(1);
  });
});
