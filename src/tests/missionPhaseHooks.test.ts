import { describe, expect, it } from 'vitest';
import { EmotionalState, NPCBehavior, NPCMood, NPCType } from '../types/enums';
import { applyMissionPhaseHooks } from '../systems/missionPhaseHooks';
import type { MissionProgress } from '../systems/interactionZones';

const baseProgress: MissionProgress = {
  epochBriefingVerified: false,
  hazardMapPrepared: false,
  prioritizedZoneIds: [],
};

const npc = (id: number, type: NPCType, x: number, z: number, behavior = NPCBehavior.WANDER, mood = NPCMood.PEACEFUL) => ({
  id,
  type,
  position: [x, 1.2, z] as [number, number, number],
  behavior,
  mood,
  emotionalState: EmotionalState.PEACEFUL,
});

describe('mission phase hooks', () => {
  it('keeps npcs unchanged without mission progress', () => {
    const input = [npc(1, NPCType.CIVILIAN, 0, 10)];
    const output = applyMissionPhaseHooks(input, 12 * 60 + 10, baseProgress);

    expect(output[0].behavior).toBe(NPCBehavior.WANDER);
    expect(output[0].mood).toBe(NPCMood.PEACEFUL);
  });

  it('moves journalists to gather during midday after epoch verification', () => {
    const progress: MissionProgress = { ...baseProgress, epochBriefingVerified: true };
    const input = [npc(2, NPCType.JOURNALIST, 8, 12)];
    const output = applyMissionPhaseHooks(input, 13 * 60, progress);

    expect(output[0].behavior).toBe(NPCBehavior.GATHER);
    expect(output[0].mood).toBe(NPCMood.TENSE);
  });

  it('sets responders to cleanup after hazard prep in evening', () => {
    const progress: MissionProgress = { ...baseProgress, epochBriefingVerified: true, hazardMapPrepared: true };
    const input = [npc(3, NPCType.MEDIC, 7, -4, NPCBehavior.IDLE)];
    const output = applyMissionPhaseHooks(input, 18 * 60 + 5, progress);

    expect(output[0].behavior).toBe(NPCBehavior.CLEANUP);
    expect(output[0].mood).toBe(NPCMood.TENSE);
  });

  it('applies evacuation only to prioritized sectors', () => {
    const progress: MissionProgress = {
      ...baseProgress,
      epochBriefingVerified: true,
      hazardMapPrepared: true,
      prioritizedZoneIds: ['evacuation-board-north'],
    };

    const input = [
      npc(4, NPCType.CIVILIAN, -6, 14),
      npc(5, NPCType.CIVILIAN, 10, -14),
    ];

    const output = applyMissionPhaseHooks(input, 19 * 60, progress);

    expect(output[0].behavior).toBe(NPCBehavior.FLEE);
    expect(output[0].mood).toBe(NPCMood.PANICKED);
    expect(output[1].behavior).toBe(NPCBehavior.WANDER);
  });

  it('forces agitators into retreat in late phase after all sectors prioritized', () => {
    const progress: MissionProgress = {
      ...baseProgress,
      epochBriefingVerified: true,
      hazardMapPrepared: true,
      prioritizedZoneIds: ['evacuation-board-north', 'evacuation-board-west', 'evacuation-board-south'],
    };

    const input = [npc(6, NPCType.EXTREMIST, 2, -5, NPCBehavior.ATTACK, NPCMood.ANGRY)];
    const output = applyMissionPhaseHooks(input, 21 * 60 + 15, progress);

    expect(output[0].behavior).toBe(NPCBehavior.RETREAT);
    expect(output[0].mood).toBe(NPCMood.TENSE);
  });
});
