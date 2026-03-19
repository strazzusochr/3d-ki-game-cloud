import { describe, expect, it } from 'vitest';
import {
  INITIAL_MISSION_PROGRESS,
  applyInteractionOutcome,
  getInteractionAvailability,
  getMissionChecklist,
  getInteractionZoneById,
  isZoneCompleted,
} from '../systems/interactionZones';

describe('interaction zone helpers', () => {
  it('resolves zone metadata by id', () => {
    const zone = getInteractionZoneById('epoch-terminal');

    expect(zone?.title).toContain('Epoch-2');
    expect(zone?.radius).toBeGreaterThan(3);
  });

  it('marks mission progress when epoch terminal is used', () => {
    const outcome = applyInteractionOutcome(INITIAL_MISSION_PROGRESS, 'epoch-terminal');

    expect(outcome.wasApplied).toBe(true);
    expect(outcome.missionProgress.epochBriefingVerified).toBe(true);
    expect(outcome.reputationDelta).toBeGreaterThan(0);
    expect(outcome.phaseLabel).toContain('Epoch-2');
  });

  it('blocks hazard-console before epoch terminal is complete', () => {
    const blocked = applyInteractionOutcome(INITIAL_MISSION_PROGRESS, 'hazard-console');

    expect(blocked.wasApplied).toBe(false);
    expect(blocked.message).toContain('Epoch-2');
  });

  it('does not award duplicate progress for already completed terminal actions', () => {
    const epoch = applyInteractionOutcome(INITIAL_MISSION_PROGRESS, 'epoch-terminal');
    const once = applyInteractionOutcome(epoch.missionProgress, 'hazard-console');
    const twice = applyInteractionOutcome(once.missionProgress, 'hazard-console');

    expect(twice.wasApplied).toBe(false);
    expect(twice.reputationDelta).toBe(0);
    expect(twice.message).toContain('bereits');
  });

  it('tracks all three population boards independently', () => {
    const epoch = applyInteractionOutcome(INITIAL_MISSION_PROGRESS, 'epoch-terminal');
    const hazard = applyInteractionOutcome(epoch.missionProgress, 'hazard-console');
    const first = applyInteractionOutcome(hazard.missionProgress, 'evacuation-board-north');
    const second = applyInteractionOutcome(first.missionProgress, 'evacuation-board-west');
    const third = applyInteractionOutcome(second.missionProgress, 'evacuation-board-south');

    expect(third.missionProgress.prioritizedZoneIds).toHaveLength(3);
    expect(isZoneCompleted(third.missionProgress, 'evacuation-board-west')).toBe(true);
  });

  it('builds a mission checklist from progress data', () => {
    const progress = {
      epochBriefingVerified: true,
      hazardMapPrepared: false,
      prioritizedZoneIds: ['evacuation-board-north'],
    };

    const checklist = getMissionChecklist(progress);

    expect(checklist[0]).toMatchObject({ completed: true });
    expect(checklist[1].label).toContain('0/1');
    expect(checklist[2].label).toContain('1/3');
  });

  it('reports availability status for locked and unlocked zones', () => {
    const locked = getInteractionAvailability(INITIAL_MISSION_PROGRESS, 'evacuation-board-west');
    const afterEpoch = applyInteractionOutcome(INITIAL_MISSION_PROGRESS, 'epoch-terminal');
    const afterHazard = applyInteractionOutcome(afterEpoch.missionProgress, 'hazard-console');
    const unlocked = getInteractionAvailability(afterHazard.missionProgress, 'evacuation-board-west');

    expect(locked.available).toBe(false);
    expect(locked.reason).toContain('Hazard');
    expect(unlocked.available).toBe(true);
  });
});