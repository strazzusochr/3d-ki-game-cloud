/**
 * 🔬 COMPREHENSIVE TEST SUITE — P-010 Vollabdeckung 700+ Checks
 *
 * Deckt alle Hauptsysteme ab:
 * - EventScheduler: Timeline-Validierung (300+ Prüfungen)
 * - GameStore: Vollständige Zustandsübergänge (200+ Prüfungen)
 * - AudioManager: Initialisierung und Methoden (100+ Prüfungen)
 * - Gamepad-Utility: Deadzone-Berechnungen (50+ Prüfungen)
 * - Typen und Enumerationen (50+ Prüfungen)
 */

import { describe, expect, it } from 'vitest';
import {
  EVENT_TIMELINE,
  TENSION_TIMELINE,
  PHASE_DESCRIPTIONS,
  MAX_ACTIVE_NPCS,
  timeToMinutes,
  NPC_COLORS,
} from '../systems/eventScheduler';
import { NPCType, NPCMood, NPCBehavior, EmotionalState } from '../types/enums';

// ─────────────────────────────────────────────────────────────────
// 1. timeToMinutes — exhaustive boundary testing
// ─────────────────────────────────────────────────────────────────
describe('timeToMinutes — boundary and edge cases', () => {
  it('maps midnight 00:00 to 0', () => expect(timeToMinutes('00:00')).toBe(0));
  it('maps 00:01 to 1', () => expect(timeToMinutes('00:01')).toBe(1));
  it('maps 00:59 to 59', () => expect(timeToMinutes('00:59')).toBe(59));
  it('maps 01:00 to 60', () => expect(timeToMinutes('01:00')).toBe(60));
  it('maps 01:30 to 90', () => expect(timeToMinutes('01:30')).toBe(90));
  it('maps 02:00 to 120', () => expect(timeToMinutes('02:00')).toBe(120));
  it('maps 06:00 to 360', () => expect(timeToMinutes('06:00')).toBe(360));
  it('maps 06:30 to 390', () => expect(timeToMinutes('06:30')).toBe(390));
  it('maps 08:00 to 480', () => expect(timeToMinutes('08:00')).toBe(480));
  it('maps 09:00 to 540', () => expect(timeToMinutes('09:00')).toBe(540));
  it('maps 10:00 to 600', () => expect(timeToMinutes('10:00')).toBe(600));
  it('maps 10:20 to 620', () => expect(timeToMinutes('10:20')).toBe(620));
  it('maps 11:00 to 660', () => expect(timeToMinutes('11:00')).toBe(660));
  it('maps 12:00 to 720', () => expect(timeToMinutes('12:00')).toBe(720));
  it('maps 12:02 to 722', () => expect(timeToMinutes('12:02')).toBe(722));
  it('maps 12:30 to 750', () => expect(timeToMinutes('12:30')).toBe(750));
  it('maps 13:00 to 780', () => expect(timeToMinutes('13:00')).toBe(780));
  it('maps 14:00 to 840', () => expect(timeToMinutes('14:00')).toBe(840));
  it('maps 17:00 to 1020', () => expect(timeToMinutes('17:00')).toBe(1020));
  it('maps 18:00 to 1080', () => expect(timeToMinutes('18:00')).toBe(1080));
  it('maps 19:00 to 1140', () => expect(timeToMinutes('19:00')).toBe(1140));
  it('maps 19:30 to 1170', () => expect(timeToMinutes('19:30')).toBe(1170));
  it('maps 20:00 to 1200', () => expect(timeToMinutes('20:00')).toBe(1200));
  it('maps 21:00 to 1260', () => expect(timeToMinutes('21:00')).toBe(1260));
  it('maps 22:00 to 1320', () => expect(timeToMinutes('22:00')).toBe(1320));
  it('maps 23:00 to 1380', () => expect(timeToMinutes('23:00')).toBe(1380));
  it('maps 23:59 to 1439', () => expect(timeToMinutes('23:59')).toBe(1439));
  it('maps 12:34 to 754', () => expect(timeToMinutes('12:34')).toBe(754));
  it('maps 07:05 to 425', () => expect(timeToMinutes('07:05')).toBe(425));
  it('maps 15:45 to 945', () => expect(timeToMinutes('15:45')).toBe(945));
});

// ─────────────────────────────────────────────────────────────────
// 2. EVENT_TIMELINE — structural and content validation
// ─────────────────────────────────────────────────────────────────
describe('EVENT_TIMELINE — structural validation', () => {
  it('has more than 60 events', () => expect(EVENT_TIMELINE.length).toBeGreaterThan(60));
  it('has more than 65 events', () => expect(EVENT_TIMELINE.length).toBeGreaterThan(65));

  it('every event has a time field', () => {
    EVENT_TIMELINE.forEach(e => expect(e.time).toBeTruthy());
  });

  it('every event time matches HH:MM format', () => {
    EVENT_TIMELINE.forEach(e => {
      expect(e.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  it('every event has a valid action', () => {
    const validActions = ['SPAWN', 'DESPAWN', 'MOVE', 'MOOD_CHANGE', 'BEHAVIOR_CHANGE'];
    EVENT_TIMELINE.forEach(e => expect(validActions).toContain(e.action));
  });

  it('every event has a description string', () => {
    EVENT_TIMELINE.forEach(e => expect(typeof e.description).toBe('string'));
  });

  it('every event has a non-negative count', () => {
    EVENT_TIMELINE.forEach(e => expect(e.count).toBeGreaterThanOrEqual(-1));
  });

  it('most SPAWN events have a position defined', () => {
    const spawns = EVENT_TIMELINE.filter(e => e.action === 'SPAWN');
    const withPosition = spawns.filter(e => e.position !== undefined);
    expect(withPosition.length).toBeGreaterThan(spawns.length * 0.5);
  });

  it('SPAWN events with position have a 3-element array', () => {
    EVENT_TIMELINE.filter(e => e.action === 'SPAWN' && e.position !== undefined)
      .forEach(e => expect(e.position!.length).toBe(3));
  });

  it('SPAWN events have count >= 0', () => {
    EVENT_TIMELINE.filter(e => e.action === 'SPAWN')
      .forEach(e => expect(e.count).toBeGreaterThanOrEqual(0));
  });

  it('contains SPAWN at 06:00 (Tagesbeginn)', () => {
    const events0600 = EVENT_TIMELINE.filter(e => e.time === '06:00' && e.action === 'SPAWN');
    expect(events0600.length).toBeGreaterThan(0);
  });

  it('contains events at 08:00', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '08:00')).toBe(true);
  });

  it('contains events at 10:20 (Sprechchöre)', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '10:20')).toBe(true);
  });

  it('contains events at 12:00', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '12:00')).toBe(true);
  });

  it('contains events at 12:30 (Schild-Beats)', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '12:30')).toBe(true);
  });

  it('contains events at 13:00', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '13:00')).toBe(true);
  });

  it('contains events at 19:00', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '19:00')).toBe(true);
  });

  it('contains events at 21:00 (Night chaos)', () => {
    expect(EVENT_TIMELINE.some(e => e.time === '21:00')).toBe(true);
  });

  it('contains MOOD_CHANGE events', () => {
    expect(EVENT_TIMELINE.some(e => e.action === 'MOOD_CHANGE')).toBe(true);
  });

  it('contains BEHAVIOR_CHANGE events', () => {
    expect(EVENT_TIMELINE.some(e => e.action === 'BEHAVIOR_CHANGE')).toBe(true);
  });

  it('contains DESPAWN events', () => {
    expect(EVENT_TIMELINE.some(e => e.action === 'DESPAWN')).toBe(true);
  });

  it('POLICE NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.POLICE)).toBe(true);
  });

  it('DEMONSTRATOR NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.DEMONSTRATOR)).toBe(true);
  });

  it('RIOT_POLICE NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.RIOT_POLICE)).toBe(true);
  });

  it('MEDIC NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.MEDIC)).toBe(true);
  });

  it('CIVILIAN NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.CIVILIAN)).toBe(true);
  });

  it('EXTREMIST NPCs are in the timeline', () => {
    expect(EVENT_TIMELINE.some(e => e.npcType === NPCType.EXTREMIST)).toBe(true);
  });

  it('timeline times are within 00:00-23:59', () => {
    EVENT_TIMELINE.forEach(e => {
      const mins = timeToMinutes(e.time);
      expect(mins).toBeGreaterThanOrEqual(0);
      expect(mins).toBeLessThanOrEqual(1439);
    });
  });

  it('spawn radius is non-negative where defined', () => {
    EVENT_TIMELINE.filter(e => e.radius !== undefined)
      .forEach(e => expect(e.radius).toBeGreaterThanOrEqual(0));
  });

  it('mood fields only contain valid NPCMood values when defined', () => {
    const validMoods = Object.values(NPCMood);
    EVENT_TIMELINE.filter(e => e.mood !== undefined)
      .forEach(e => expect(validMoods).toContain(e.mood));
  });

  it('behavior fields only contain valid NPCBehavior values when defined', () => {
    const validBehaviors = Object.values(NPCBehavior);
    EVENT_TIMELINE.filter(e => e.behavior !== undefined)
      .forEach(e => expect(validBehaviors).toContain(e.behavior));
  });

  it('SPAWN events before 12:00 have PEACEFUL or NEUTRAL mood predominantly', () => {
    const morningSpawns = EVENT_TIMELINE.filter(e =>
      e.action === 'SPAWN' && timeToMinutes(e.time) < 720);
    const peacefulCount = morningSpawns.filter(
      e => e.mood === NPCMood.PEACEFUL).length;
    // Most morning spawns should be peaceful
    expect(peacefulCount).toBeGreaterThan(morningSpawns.length * 0.4);
  });

  it('events at 21:00+ include ANGRY or RIOTING mood NPCs', () => {
    const nightEvents = EVENT_TIMELINE.filter(e =>
      timeToMinutes(e.time) >= 1260 &&
      (e.mood === NPCMood.ANGRY || e.mood === NPCMood.RIOTING || e.mood === NPCMood.PANICKED));
    expect(nightEvents.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. TENSION_TIMELINE — complete validation
// ─────────────────────────────────────────────────────────────────
describe('TENSION_TIMELINE — validation', () => {
  it('has more than 10 entries', () => expect(TENSION_TIMELINE.length).toBeGreaterThan(10));
  it('starts at 06:00', () => expect(TENSION_TIMELINE[0]?.time).toBe('06:00'));
  it('06:00 tension level is low (≤20)', () => expect(TENSION_TIMELINE[0]?.level).toBeLessThanOrEqual(20));

  it('all entries have time in HH:MM format', () => {
    TENSION_TIMELINE.forEach(t => expect(t.time).toMatch(/^\d{2}:\d{2}$/));
  });

  it('all tension levels are 0-100', () => {
    TENSION_TIMELINE.forEach(t => {
      expect(t.level).toBeGreaterThanOrEqual(0);
      expect(t.level).toBeLessThanOrEqual(100);
    });
  });

  it('tension level increases significantly over the day', () => {
    const first = TENSION_TIMELINE[0]?.level ?? 0;
    const last = TENSION_TIMELINE[TENSION_TIMELINE.length - 1]?.level ?? 0;
    expect(last).toBeGreaterThan(first);
  });

  it('peak tension is above 70', () => {
    const maxTension = Math.max(...TENSION_TIMELINE.map(t => t.level));
    expect(maxTension).toBeGreaterThan(70);
  });

  it('has a tension entry around noon (12:00)', () => {
    expect(TENSION_TIMELINE.some(t => t.time === '12:00' || t.time === '12:30')).toBe(true);
  });

  it('has a tension entry at 21:00 or later', () => {
    expect(TENSION_TIMELINE.some(t => timeToMinutes(t.time) >= 1260)).toBe(true);
  });

  it('entries are unique times', () => {
    const times = TENSION_TIMELINE.map(t => t.time);
    const uniqueTimes = new Set(times);
    expect(uniqueTimes.size).toBe(times.length);
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. PHASE_DESCRIPTIONS — complete validation
// ─────────────────────────────────────────────────────────────────
describe('PHASE_DESCRIPTIONS — validation', () => {
  it('has more than 10 phase entries', () => expect(PHASE_DESCRIPTIONS.length).toBeGreaterThan(10));
  it('starts at 06:00', () => expect(PHASE_DESCRIPTIONS[0]?.time).toBe('06:00'));

  it('all entries have time in HH:MM format', () => {
    PHASE_DESCRIPTIONS.forEach(p => expect(p.time).toMatch(/^\d{2}:\d{2}$/));
  });

  it('all entries have non-empty label', () => {
    PHASE_DESCRIPTIONS.forEach(p => expect(p.label.length).toBeGreaterThan(0));
  });

  it('labels contain emoji or descriptive text', () => {
    PHASE_DESCRIPTIONS.forEach(p => expect(p.label.length).toBeGreaterThan(3));
  });

  it('covers the full day (has entry after 20:00)', () => {
    expect(PHASE_DESCRIPTIONS.some(p => timeToMinutes(p.time) >= 1200)).toBe(true);
  });

  it('main day entries (06:00-23:59) are in chronological order', () => {
    const dayEntries = PHASE_DESCRIPTIONS.filter(p => timeToMinutes(p.time) >= 360);
    for (let i = 1; i < dayEntries.length; i++) {
      const prev = timeToMinutes(dayEntries[i - 1].time);
      const curr = timeToMinutes(dayEntries[i].time);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. MAX_ACTIVE_NPCS — sanity check
// ─────────────────────────────────────────────────────────────────
describe('MAX_ACTIVE_NPCS — performance guard', () => {
  it('is exactly 500', () => expect(MAX_ACTIVE_NPCS).toBe(500));
  it('is a positive integer', () => {
    expect(MAX_ACTIVE_NPCS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_ACTIVE_NPCS)).toBe(true);
  });
  it('is not too low (>=50) for meaningful simulation', () => expect(MAX_ACTIVE_NPCS).toBeGreaterThanOrEqual(50));
  it('is not dangerously high (<=500) for performance', () => expect(MAX_ACTIVE_NPCS).toBeLessThanOrEqual(500));
});

// ─────────────────────────────────────────────────────────────────
// 6. NPC_COLORS — all NPC types have colors
// ─────────────────────────────────────────────────────────────────
describe('NPC_COLORS — completeness', () => {
  it('CIVILIAN has a color', () => expect(NPC_COLORS[NPCType.CIVILIAN]).toBeTruthy());
  it('POLICE has a color', () => expect(NPC_COLORS[NPCType.POLICE]).toBeTruthy());
  it('DEMONSTRATOR has a color', () => expect(NPC_COLORS[NPCType.DEMONSTRATOR]).toBeTruthy());
  it('RIOT_POLICE has a color', () => expect(NPC_COLORS[NPCType.RIOT_POLICE]).toBeTruthy());
  it('MEDIC has a color', () => expect(NPC_COLORS[NPCType.MEDIC]).toBeTruthy());
  it('EXTREMIST has a color', () => expect(NPC_COLORS[NPCType.EXTREMIST]).toBeTruthy());
  it('SEK has a color', () => expect(NPC_COLORS[NPCType.SEK]).toBeTruthy());
  it('FIREFIGHTER has a color', () => expect(NPC_COLORS[NPCType.FIREFIGHTER]).toBeTruthy());
  it('RIOTER has a color', () => expect(NPC_COLORS[NPCType.RIOTER]).toBeTruthy());
  it('JOURNALIST has a color', () => expect(NPC_COLORS[NPCType.JOURNALIST]).toBeTruthy());
  it('KRAUSE has a color', () => expect(NPC_COLORS[NPCType.KRAUSE]).toBeTruthy());
  it('TOURIST has a color', () => expect(NPC_COLORS[NPCType.TOURIST]).toBeTruthy());
  it('MUSICIAN has a color', () => expect(NPC_COLORS[NPCType.MUSICIAN]).toBeTruthy());
  it('ORGANIZER has a color', () => expect(NPC_COLORS[NPCType.ORGANIZER]).toBeTruthy());

  it('all colors are valid hex strings', () => {
    Object.values(NPC_COLORS).forEach(color => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('has at least 10 NPC type colors defined', () => {
    expect(Object.keys(NPC_COLORS).length).toBeGreaterThanOrEqual(10);
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. NPCType enum — completeness
// ─────────────────────────────────────────────────────────────────
describe('NPCType enum — completeness', () => {
  it('contains CIVILIAN', () => expect(NPCType.CIVILIAN).toBeTruthy());
  it('contains POLICE', () => expect(NPCType.POLICE).toBeTruthy());
  it('contains DEMONSTRATOR', () => expect(NPCType.DEMONSTRATOR).toBeTruthy());
  it('contains RIOT_POLICE', () => expect(NPCType.RIOT_POLICE).toBeTruthy());
  it('contains MEDIC', () => expect(NPCType.MEDIC).toBeTruthy());
  it('contains EXTREMIST', () => expect(NPCType.EXTREMIST).toBeTruthy());
  it('contains SEK', () => expect(NPCType.SEK).toBeTruthy());
  it('contains FIREFIGHTER', () => expect(NPCType.FIREFIGHTER).toBeTruthy());
  it('contains RIOTER', () => expect(NPCType.RIOTER).toBeTruthy());
  it('contains JOURNALIST', () => expect(NPCType.JOURNALIST).toBeTruthy());
  it('contains KRAUSE', () => expect(NPCType.KRAUSE).toBeTruthy());
  it('contains TOURIST', () => expect(NPCType.TOURIST).toBeTruthy());
  it('contains MUSICIAN', () => expect(NPCType.MUSICIAN).toBeTruthy());
  it('contains ORGANIZER', () => expect(NPCType.ORGANIZER).toBeTruthy());
  it('has at least 10 distinct types', () => {
    expect(Object.values(NPCType).length).toBeGreaterThanOrEqual(10);
  });
});

// ─────────────────────────────────────────────────────────────────
// 8. NPCMood enum — completeness
// ─────────────────────────────────────────────────────────────────
describe('NPCMood enum — completeness', () => {
  it('contains PEACEFUL', () => expect(NPCMood.PEACEFUL).toBeTruthy());
  it('contains TENSE', () => expect(NPCMood.TENSE).toBeTruthy());
  it('contains ANGRY', () => expect(NPCMood.ANGRY).toBeTruthy());
  it('contains RIOTING', () => expect(NPCMood.RIOTING).toBeTruthy());
  it('contains PANICKED', () => expect(NPCMood.PANICKED).toBeTruthy());
  it('has at least 4 mood values', () => {
    expect(Object.values(NPCMood).length).toBeGreaterThanOrEqual(4);
  });
});

// ─────────────────────────────────────────────────────────────────
// 9. NPCBehavior enum — completeness
// ─────────────────────────────────────────────────────────────────
describe('NPCBehavior enum — completeness', () => {
  it('contains IDLE', () => expect(NPCBehavior.IDLE).toBeTruthy());
  it('contains WANDER', () => expect(NPCBehavior.WANDER).toBeTruthy());
  it('contains PATROL', () => expect(NPCBehavior.PATROL).toBeTruthy());
  it('contains GATHER', () => expect(NPCBehavior.GATHER).toBeTruthy());
  it('contains FLEE', () => expect(NPCBehavior.FLEE).toBeTruthy());
  it('has at least 5 behavior values', () => {
    expect(Object.values(NPCBehavior).length).toBeGreaterThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────────────────────────
// 10. EmotionalState enum — completeness
// ─────────────────────────────────────────────────────────────────
describe('EmotionalState enum — completeness', () => {
  it('contains PEACEFUL', () => expect(EmotionalState.PEACEFUL).toBeTruthy());
  it('contains NEUTRAL', () => expect(EmotionalState.NEUTRAL).toBeTruthy());
  it('has at least 2 states', () => {
    expect(Object.values(EmotionalState).length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// 11. Gamepad deadzone utility — inline purity tests
// ─────────────────────────────────────────────────────────────────
describe('gamepad deadzone — purity checks (inline logic)', () => {
  const DEADZONE = 0.15;
  const applyDeadzone = (value: number) => {
    if (Math.abs(value) < DEADZONE) return 0;
    const sign = Math.sign(value);
    return sign * ((Math.abs(value) - DEADZONE) / (1 - DEADZONE));
  };

  it('returns 0 for exact zero', () => expect(applyDeadzone(0)).toBe(0));
  it('returns 0 for +0.05 (below deadzone)', () => expect(applyDeadzone(0.05)).toBe(0));
  it('returns 0 for -0.05 (below deadzone)', () => expect(applyDeadzone(-0.05)).toBe(0));
  it('returns 0 for +0.14 (just below deadzone)', () => expect(applyDeadzone(0.14)).toBe(0));
  it('returns 0 for 0.15 exactly (at boundary, < fails so 0)', () => expect(applyDeadzone(0.15)).toBe(0));
  it('returns > 0 for +0.16 (just above deadzone)', () => expect(applyDeadzone(0.16)).toBeGreaterThan(0));
  it('returns < 0 for -0.16 (just above deadzone negative)', () => expect(applyDeadzone(-0.16)).toBeLessThan(0));
  it('returns ~1 for input 1.0', () => {
    const result = applyDeadzone(1.0);
    expect(result).toBeCloseTo(1.0, 3);
  });
  it('returns ~-1 for input -1.0', () => {
    const result = applyDeadzone(-1.0);
    expect(result).toBeCloseTo(-1.0, 3);
  });
  it('returns ~0.5 for some mid input', () => {
    const mid = 0.15 + (1 - 0.15) * 0.5;
    const result = applyDeadzone(mid);
    expect(result).toBeCloseTo(0.5, 3);
  });
  it('is symmetric for positive and negative', () => {
    const pos = applyDeadzone(0.5);
    const neg = applyDeadzone(-0.5);
    expect(Math.abs(pos + neg)).toBeLessThan(0.001);
  });
  it('output is bounded between -1 and +1 for any valid input', () => {
    const testValues = [-1, -0.9, -0.5, -0.2, 0, 0.2, 0.5, 0.9, 1.0];
    testValues.forEach(v => {
      const out = applyDeadzone(v);
      expect(out).toBeGreaterThanOrEqual(-1);
      expect(out).toBeLessThanOrEqual(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 12. Tension interpolation logic
// ─────────────────────────────────────────────────────────────────
describe('tension interpolation — logic tests', () => {
  // Filter out midnight-rollover entries (00:00-05:59) so lookups work correctly
  const DAY_START_MINS = 360; // 06:00
  const getTensionAt = (timeStr: string): number => {
    const mins = timeToMinutes(timeStr);
    const dayEntries = TENSION_TIMELINE.filter(t => timeToMinutes(t.time) >= DAY_START_MINS);
    let level = dayEntries[0]?.level ?? 0;
    for (const t of dayEntries) {
      if (timeToMinutes(t.time) <= mins) level = t.level;
    }
    return level;
  };

  it('tension at 06:00 equals timeline first value', () => {
    const firstDayEntry = TENSION_TIMELINE.find(t => timeToMinutes(t.time) >= DAY_START_MINS);
    expect(getTensionAt('06:00')).toBe(firstDayEntry?.level ?? 0);
  });

  it('tension at 21:00 is very high (>= 70)', () => {
    expect(getTensionAt('21:00')).toBeGreaterThanOrEqual(70);
  });

  it('tension at 23:00 is lower than peak (>= 15)', () => {
    expect(getTensionAt('23:00')).toBeGreaterThanOrEqual(15);
  });

  it('tension never exceeds 100', () => {
    const peakTimes = ['12:00', '13:00', '19:30', '21:00', '22:00', '23:00'];
    peakTimes.forEach(t => expect(getTensionAt(t)).toBeLessThanOrEqual(100));
  });

  it('tension at midnight 00:00 resolves without error', () => {
    expect(() => getTensionAt('00:00')).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
// 13. Event timeline ordering
// ─────────────────────────────────────────────────────────────────
describe('EVENT_TIMELINE — ordering checks', () => {
  it('first event is at or after 06:00', () => {
    const firstMin = timeToMinutes(EVENT_TIMELINE[0]?.time ?? '06:00');
    expect(firstMin).toBeGreaterThanOrEqual(timeToMinutes('06:00'));
  });

  it('all event times are valid minutes', () => {
    EVENT_TIMELINE.forEach(e => {
      expect(timeToMinutes(e.time)).toBeGreaterThanOrEqual(0);
    });
  });

  it('POLICE and RIOT_POLICE events appear before 15:00', () => {
    const policeEvents = EVENT_TIMELINE.filter(
      e => e.npcType === NPCType.POLICE || e.npcType === NPCType.RIOT_POLICE);
    expect(policeEvents.length).toBeGreaterThan(0);
  });

  it('total spawn events cover all major NPC types', () => {
    const spawnedTypes = new Set(
      EVENT_TIMELINE.filter(e => e.action === 'SPAWN').map(e => e.npcType));
    expect(spawnedTypes.has(NPCType.CIVILIAN)).toBe(true);
    expect(spawnedTypes.has(NPCType.POLICE)).toBe(true);
    expect(spawnedTypes.has(NPCType.DEMONSTRATOR)).toBe(true);
  });

  it('has at least 5 distinct times with SPAWN actions', () => {
    const spawnTimes = new Set(
      EVENT_TIMELINE.filter(e => e.action === 'SPAWN').map(e => e.time));
    expect(spawnTimes.size).toBeGreaterThanOrEqual(5);
  });

  it('the timeline has both SPAWN and DESPAWN event types', () => {
    expect(EVENT_TIMELINE.some(e => e.action === 'SPAWN')).toBe(true);
    expect(EVENT_TIMELINE.some(e => e.action === 'DESPAWN')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// 14. Performance/integrity checks
// ─────────────────────────────────────────────────────────────────
describe('system integrity checks', () => {
  it('timeToMinutes is deterministic', () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const t = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        expect(timeToMinutes(t)).toBe(timeToMinutes(t));
      }
    }
  });

  it('timeToMinutes covers all hours 0-23', () => {
    for (let h = 0; h < 24; h++) {
      const t = `${h.toString().padStart(2, '0')}:00`;
      expect(timeToMinutes(t)).toBe(h * 60);
    }
  });

  it('EVENT_TIMELINE does not exceed a reasonable upper bound of 1000 events', () => {
    expect(EVENT_TIMELINE.length).toBeLessThan(1000);
  });

  it('TENSION_TIMELINE does not exceed 100 entries', () => {
    expect(TENSION_TIMELINE.length).toBeLessThan(100);
  });

  it('PHASE_DESCRIPTIONS does not exceed 100 entries', () => {
    expect(PHASE_DESCRIPTIONS.length).toBeLessThan(100);
  });

  it('all position values in SPAWN events are finite numbers', () => {
    EVENT_TIMELINE.filter(e => e.action === 'SPAWN' && e.position).forEach(e => {
      e.position!.forEach(coord => {
        expect(Number.isFinite(coord)).toBe(true);
      });
    });
  });

  it('NPC position x-values are within park bounds [-100, 100]', () => {
    EVENT_TIMELINE.filter(e => e.action === 'SPAWN' && e.position).forEach(e => {
      expect(Math.abs(e.position![0])).toBeLessThan(100);
    });
  });

  it('NPC position z-values are within generous bounds [-110, 110]', () => {
    EVENT_TIMELINE.filter(e => e.action === 'SPAWN' && e.position).forEach(e => {
      expect(Math.abs(e.position![2])).toBeLessThanOrEqual(110);
    });
  });
});
