import { describe, expect, it } from 'vitest';
import { NPCType } from '../types/enums';
import { getSpawnMarkerView, getSpawnUrgency, isInSpawnPreviewWindow, type SpawnUrgency } from '../systems/spawnMarkerLogic';
import type { GameEvent } from '../systems/eventScheduler';

const spawnEvent = (overrides: Partial<GameEvent>): GameEvent => ({
  time: '10:00',
  action: 'SPAWN',
  npcType: NPCType.POLICE,
  count: 1,
  position: [0, 0, 0],
  radius: 5,
  description: 'test',
  ...overrides,
});

describe('spawnMarkerLogic', () => {
  it('applies strict preview window T-10..T-5', () => {
    expect(isInSpawnPreviewWindow(10)).toBe(true);
    expect(isInSpawnPreviewWindow(5)).toBe(true);
    expect(isInSpawnPreviewWindow(11)).toBe(false);
    expect(isInSpawnPreviewWindow(4)).toBe(false);
  });

  it('classifies urgency stages by remaining minutes', () => {
    const cases: Array<[number, SpawnUrgency]> = [
      [10, 'watch'],
      [9, 'watch'],
      [8, 'ready'],
      [7, 'ready'],
      [6, 'imminent'],
      [5, 'imminent'],
    ];

    cases.forEach(([minutes, urgency]) => {
      expect(getSpawnUrgency(minutes)).toBe(urgency);
    });
  });

  it('groups same time/position spawns and accumulates totalCount', () => {
    const events: GameEvent[] = [
      spawnEvent({ time: '10:00', position: [1.2, 0, 1.4], count: 3, npcType: NPCType.POLICE }),
      spawnEvent({ time: '10:00', position: [1.4, 0, 1.3], count: 2, npcType: NPCType.MEDIC }),
      spawnEvent({ time: '09:55', position: [5, 0, 5], count: 1, npcType: NPCType.CIVILIAN }),
      spawnEvent({ time: '10:01', position: [7, 0, 7], count: 9, npcType: NPCType.SEK }),
    ];

    const { markers } = getSpawnMarkerView('09:50', 8, events);

    expect(markers.length).toBe(2);
    const grouped = markers.find((m) => m.time === '10:00');
    expect(grouped).toBeTruthy();
    expect(grouped?.totalCount).toBe(5);
    expect(grouped?.details.length).toBe(2);
  });

  it('caps visible markers at max and keeps highest priority markers', () => {
    const events: GameEvent[] = Array.from({ length: 12 }, (_, i) =>
      spawnEvent({
        time: '09:50',
        position: [i * 2, 0, i * 2 + 1],
        count: i + 1,
        npcType: NPCType.POLICE,
      }),
    );

    const { markers, visibleMarkers, hiddenMarkerCount } = getSpawnMarkerView('09:40', 8, events);

    expect(markers.length).toBe(12);
    expect(visibleMarkers.length).toBe(8);
    expect(hiddenMarkerCount).toBe(4);

    const visibleCounts = visibleMarkers.map((m) => m.totalCount);
    expect(Math.min(...visibleCounts)).toBe(5);
    expect(visibleCounts[0]).toBe(12);
  });
});
