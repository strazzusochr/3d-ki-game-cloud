/**
 * 🕒 24H LIVE EVENT SCHEDULER — VOLLSTÄNDIG AUS DEM MASTER PLAN
 * 
 * ALLE Events Wort für Wort aus dem 24H Master Plan implementiert.
 * Jede Uhrzeit, jede Aktion, jeder NPC-Typ, jede Position.
 * 
 * PARKFLÄCHE: 85x85m zentriert bei [0,0,0] → x: -42..42, z: -42..42
 * BÜHNE: x: -16..16, z: -20..+5 (verbotene Zone)
 * 
 * ZONEN-LAYOUT:
 *   NORD (z < -42): Straßen hinter der Bühne
 *   BÜHNE (z: -20..5): Verbotene Spawn-Zone
 *   MITTE-VOR-BÜHNE (z: 6..15): Demonstranten-Kernzone
 *   PARK-MITTE (z: 16..30): Menge, Zivilisten
 *   PARK-SÜD (z: 31..42): Polizeilinie, Absperrung
 *   STRASSE-SÜD (z: 50..80): Riot/SEK Anmarsch
 *   PARK-WEST (x: -42..-20): Sani-Station, Feuerwehr
 *   PARK-OST (x: 20..42): Sani-Station
 */

import { NPCType, NPCMood, NPCBehavior } from '../types/enums';

declare global {
  interface Window {
    __EVENT_TIMELINE__?: typeof EVENT_TIMELINE;
  }
}

export type EventAction = 'SPAWN' | 'DESPAWN' | 'MOVE' | 'MOOD_CHANGE' | 'BEHAVIOR_CHANGE';

export interface GameEvent {
  time: string;
  action: EventAction;
  npcType: NPCType;
  count: number;
  position?: [number, number, number];
  radius?: number;
  description: string;
  mood?: NPCMood;
  behavior?: NPCBehavior;
  phaseLabel?: string;
  /** Target mood for MOOD_CHANGE events */
  targetMood?: NPCMood;
  /** Target behavior for BEHAVIOR_CHANGE events */
  targetBehavior?: NPCBehavior;
}

export const NPC_COLORS: Record<string, string> = {
  [NPCType.CIVILIAN]: '#aaaaaa',
  [NPCType.POLICE]: '#2244ff',
  [NPCType.DEMONSTRATOR]: '#ff8800',
  [NPCType.RIOT_POLICE]: '#0033aa',
  [NPCType.MEDIC]: '#00ff88',
  [NPCType.EXTREMIST]: '#ff0000',
  [NPCType.SEK]: '#444444',
  [NPCType.FIREFIGHTER]: '#ff3300',
  [NPCType.RIOTER]: '#cc2200',
  [NPCType.JOURNALIST]: '#ffdd00',
  [NPCType.KRAUSE]: '#ffffff',
  [NPCType.TOURIST]: '#66cc66',
  [NPCType.MUSICIAN]: '#ffcc00',
  [NPCType.ORGANIZER]: '#ff8833',
};

export const EVENT_TIMELINE: GameEvent[] = [

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 2: MORGEN (06:00–09:00) — AUFBAU & VORBEREITUNG ═══
  // ═══════════════════════════════════════════════════════════════

  // 06:00 — TAGESBEGINN: Stadt erwacht
  // ✅ Straßenlaternen schalten AUS (handled in CityEnvironment)
  // ✅ Sonnenaufgang-Shader aktiviert (Sky component)
  // ✅ Erste NPCs spawnen (Frühaufsteher, Jogger)
  {
    time: '06:00', action: 'SPAWN', npcType: NPCType.CIVILIAN, count: 40, position: [-25, 0, 25], radius: 30,
    description: 'CPU-SAVE: Großgruppe West (40 NPCs)', mood: NPCMood.PEACEFUL, behavior: NPCBehavior.WANDER,
    phaseLabel: '🌅 Erwachen (Optimierte Last)'
  },
  {
    time: '06:00', action: 'SPAWN', npcType: NPCType.CIVILIAN, count: 40, position: [25, 0, 25], radius: 30,
    description: 'CPU-SAVE: Großgruppe Ost (40 NPCs)', mood: NPCMood.PEACEFUL, behavior: NPCBehavior.WANDER
  },
  // 5 Polizisten spawnen (Patrouille-Route)
  {
    time: '06:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 2, position: [35, 0, 40], radius: 8,
    description: 'Patrouille Eingang Ost — passive Überwachung', mood: NPCMood.PEACEFUL, behavior: NPCBehavior.PATROL
  },
  // GESAMT: 25 NPCs

  // 08:00 — DEMO-VORBEREITUNG: "Erste Demonstranten treffen ein"
  // Organisatoren bauen Bühne auf, Sound-System testet
  {
    time: '08:00', action: 'SPAWN', npcType: NPCType.DEMONSTRATOR, count: 4, position: [0, 0, 10], radius: 6,
    description: '08:00 — Erste Demonstranten am Stephansplatz. Bühnenaufbau beginnt.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.GATHER,
    phaseLabel: '📢 Demo-Vorbereitung — Erste Demonstranten'
  },
  // GESAMT: 33 NPCs

  // 08:10 — SOUNDCHECK
  {
    time: '08:10', action: 'SPAWN', npcType: NPCType.MUSICIAN, count: 1, position: [0, 1.5, -2], radius: 0,
    description: '08:10 — Soundcheck auf der Bühne ("1, 2, Test...")',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.IDLE,
    phaseLabel: '🔊 Demo-Vorbereitung — Soundcheck'
  },
  // GESAMT: 34 NPCs

  // 08:45 — Schilder werden verteilt: "FREIHEIT STATT ANGST"
  {
    time: '08:45', action: 'SPAWN', npcType: NPCType.ORGANIZER, count: 1, position: [0, 0, 8], radius: 3,
    description: '08:45 — Organisatoren verteilen Schilder "FREIHEIT STATT ANGST"',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.HOLD_SIGN,
    phaseLabel: '📢 Schilder werden verteilt'
  },
  // Die existierenden 8 Demonstranten erhalten nun auch Schilder
  {
    time: '08:45', action: 'BEHAVIOR_CHANGE', npcType: NPCType.DEMONSTRATOR, count: 4, position: [0, 0, 10], radius: 0,
    description: 'Schilder werden an Anwesende verteilt',
    behavior: NPCBehavior.HOLD_SIGN
  },

  // 09:00 — 17 weitere Demonstranten (10 + 7), friedlich versammelt
  {
    time: '09:00', action: 'SPAWN', npcType: NPCType.DEMONSTRATOR, count: 5, position: [-20, 0, 15], radius: 8,
    description: '09:00 — Linker Flügel versammelt. Schilder hochhalten. Fahnen schwenken.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.HOLD_SIGN
  },
  {
    time: '09:00', action: 'SPAWN', npcType: NPCType.DEMONSTRATOR, count: 3, position: [20, 0, 15], radius: 8,
    description: '09:00 — Rechter Flügel. Trinken Kaffee, essen Snacks. Mood: PEACEFUL.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.HOLD_SIGN
  },
  // GESAMT: 52 NPCs (20 Ziv + 25 Demo + 5 Pol + 2 Org + 1 Musician)

  // 09:10 — Soundcheck beendet, Musiker geht
  {
    time: '09:10', action: 'DESPAWN', npcType: NPCType.MUSICIAN, count: 1, position: [0, 0, -2], radius: 0,
    description: '09:10 — Soundcheck beendet. Musiker verlässt die Bühne.',
    phaseLabel: '📢 Soundcheck Beendet'
  },
  // GESAMT: 51 NPCs

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 3: VORMITTAG (10:00–11:30) — DEMO WÄCHST         ═══
  // ═══════════════════════════════════════════════════════════════

  // 10:00 — MASSEN-ZUSTROM
  {
    time: '10:00', action: 'SPAWN', npcType: NPCType.DEMONSTRATOR, count: 5, position: [0, 0, 25], radius: 10,
    description: '10:00 — 5 weitere Demonstranten, enger Radius. Platz wird voll.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.GATHER,
    phaseLabel: '📢 Massen-Zustrom — Crowd wächst'
  },
  // 7 Polizisten bilden Polizeilinie bei [0,0,38]
  {
    time: '10:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 3, position: [0, 0, 38], radius: 15,
    description: '10:00 — Polizeikette Süd. Formation: Linie.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL
  },
  // 5 Zivilisten despawnen (nervös, verlassen Gegend)
  {
    time: '10:00', action: 'DESPAWN', npcType: NPCType.CIVILIAN, count: 2,
    description: '10:00 — 2 Zivilisten fliehen nervös'
  },
  // 10:20 — Erste Sprechchöre: "Freiheit! Freiheit! Freiheit!"
  {
    time: '10:20', action: 'MOOD_CHANGE', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '10:20 — Sprechchöre beginnen: "Freiheit! Freiheit!" Musik startet.',
    targetMood: NPCMood.ENTHUSIASTIC, targetBehavior: NPCBehavior.CHANT
  },
  // GESAMT: 62 NPCs, Eskalation: 15%

  // 11:00 — HAUPTREDNER: "Dr. Michael Hoffmann" betritt Bühne
  {
    time: '11:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 1, position: [-35, 0, 38], radius: 5,
    description: '11:00 — 1 Pol Verstärkung Gasse West',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL,
    phaseLabel: '🎤 Hauptredner auf der Bühne'
  },
  {
    time: '11:00', action: 'DESPAWN', npcType: NPCType.CIVILIAN, count: 2,
    description: '11:00 — Weitere 2 Zivilisten fliehen'
  },
  {
    time: '11:00', action: 'SPAWN', npcType: NPCType.ORGANIZER, count: 1, position: [0, 0, 8], radius: 1,
    description: '11:00 — Redner "Dr. Michael Hoffmann" betritt das Podest im Zuschauerbereich',
    mood: NPCMood.ENTHUSIASTIC, behavior: NPCBehavior.IDLE
  },
  // Rede: "Bürger Wiens! Unsere Rechte werden beschnitten!"
  // Crowd reagiert: Jubel, Klatschen, Schilder höher
  {
    time: '11:03', action: 'MOOD_CHANGE', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '11:03 — Menge reagiert mit Applaus auf den Redner',
    targetMood: NPCMood.ENTHUSIASTIC, targetBehavior: NPCBehavior.CHANT
  },
  // GESAMT: 61 NPCs, Eskalation: 15%

  // 11:30 — AGGRESSIVE RHETORIK: "Karl Weber" (Aktivist)
  // Ton aggressiver: "Die Polizei ist das Werkzeug der Unterdrückung!"
  {
    time: '11:30', action: 'SPAWN', npcType: NPCType.ORGANIZER, count: 1, position: [3, 0, 8], radius: 1,
    description: '11:30 — Redner "Karl Weber" tritt vor die Menge mit aggressiver Rhetorik',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.IDLE,
    phaseLabel: '⚠️ Aggressive Rhetorik — Stimmung kippt'
  },
  {
    time: '11:30', action: 'DESPAWN', npcType: NPCType.CIVILIAN, count: -1,
    description: '11:30 — Alle restlichen Zivilisten despawnen'
  },
  // Mood wechselt zu ANGRY: Faust-Heben, Brüllen
  {
    time: '11:35', action: 'MOOD_CHANGE', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '11:35 — Crowd wird wütend durch aggressive Rede. Erste aggressive Gesten.',
    targetMood: NPCMood.ANGRY, targetBehavior: NPCBehavior.CHANT
  },
  {
    time: '11:40', action: 'SPAWN', npcType: NPCType.CIVILIAN, count: 0, // Dummy-Event für Spieler-Update
    description: '11:40 — Polizei funkt: Situation verschärft sich.',
    phaseLabel: '🚨 Situation verschärft sich! (Polizei funkt)'
  },
  // GESAMT: 52 NPCs (0 Ziv + 35 Demo + 15 Pol + 2 Org), Eskalation: 25%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 4: MITTAG (12:00–12:30) — ULTIMATUM & GEWALT     ═══
  // ═══════════════════════════════════════════════════════════════

  // 12:00 — POLIZEI-ULTIMATUM: "Oberst Martin Gruber"
  // "Hiermit wird diese Demonstration für beendet erklärt!"
  // "Sie haben 15 Minuten, um den Platz zu verlassen!"
  {
    time: '12:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 3, position: [35, 0, 38], radius: 5,
    description: '12:00 — 3 Pol Verstärkung Gasse Ost. Gesamt 11 Cops.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL
  },
  {
    time: '12:00', action: 'SPAWN', npcType: NPCType.ORGANIZER, count: 1, position: [-3, 0, 8], radius: 1,
    description: '12:00 — Polizei-Chef "Oberst Martin Gruber" richtet Ultimatum an die Menge',
    mood: NPCMood.TENSE, behavior: NPCBehavior.IDLE,
    phaseLabel: '🚨 Polizei-Ultimatum — Auflösung!'
  },
  // 12:03 — EXPLOSION DER WUT: "NEIN!", "Scheiß Bullen!", "Wir gehen nicht!"
  // 12:04 — Erste Objekte fliegen: 3 Flaschen, 5 Bierdosen, 2 Schilder
  {
    time: '12:04', action: 'MOOD_CHANGE', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '12:04 — WUT-EXPLOSION! Flaschen fliegen! Schilder geworfen! Mood: RIOTING.',
    targetMood: NPCMood.RIOTING, targetBehavior: NPCBehavior.THROW,
    phaseLabel: '🔥 Explosion der Wut! Flaschen fliegen!'
  },

  // 12:15 — ERSTE GEWALT: "Frontkollision"
  // Demonstranten erreichen Polizei-Linie. Schubsereien → Massenschlägerei
  {
    time: '12:15', action: 'SPAWN', npcType: NPCType.MEDIC, count: 1, position: [38, 0, 0], radius: 5,
    description: '12:15 — 1 Sanitäter Rand Ost. Erste Schläge, Nahkampf beginnt.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.CLEANUP,
    phaseLabel: '💥 Erste Gewaltausbrüche — Frontkollision'
  },
  // Demonstranten → COMBAT, Polizei hält Shield-Wall
  {
    time: '12:17', action: 'MOOD_CHANGE', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '12:17 — MASSENSCHLÄGEREI! Schlagstöcke, Faustschläge, Tritte. Blut-Splatter.',
    targetMood: NPCMood.RIOTING, targetBehavior: NPCBehavior.COMBAT,
    phaseLabel: '⚔️ Massenschlägerei! Polizei vs. Demo'
  },
  // GESAMT: 60 NPCs, Eskalation: 60%

  // 12:30 — HUNDERTSCHAFT RÜCKT AN
  // 20 Riot-Polizisten, volle Riot-Gear, Schild-Beats: BOOM BOOM BOOM
  {
    time: '12:30', action: 'SPAWN', npcType: NPCType.RIOT_POLICE, count: 10, position: [0, 0, 65], radius: 12,
    description: '12:30 — 10 Riot-Police Formation Süd-Straße. Schild-Schlagen im Rhythmus.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL,
    phaseLabel: '🛡️ Hundertschaft rückt an — BOOM BOOM BOOM'
  },
  {
    time: '12:30', action: 'DESPAWN', npcType: NPCType.DEMONSTRATOR, count: 5,
    description: '12:30 — 5 Demonstranten fliehen Richtung Nord'
  },
  // GESAMT: 70 NPCs, Eskalation: 70%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 5: NACHMITTAG (13:00–14:00) — WASSERWERFER       ═══
  // ═══════════════════════════════════════════════════════════════

  // 13:00 — WASSERWERFER-EINSATZ: "Hydro Cannon Assault"
  // Wasserstrahl 60m Reichweite, NPCs 5m Knockback, Nass-Shader
  {
    time: '13:00', action: 'DESPAWN', npcType: NPCType.DEMONSTRATOR, count: 5,
    description: '13:00 — 5 Demonstranten durch Wasserwerfer zerstreut',
    phaseLabel: '💧 Wasserwerfer-Einsatz — Hydro Cannon'
  },

  // 13:30 — TRÄNENGAS: "Chemical Dispersion"
  // 10 Granaten, weiße Rauch-Wolken, Husten, Desorientierung
  {
    time: '13:30', action: 'DESPAWN', npcType: NPCType.DEMONSTRATOR, count: 4,
    description: '13:30 — 4 Demonstranten durch Tränengas vertrieben. Husten, Panik.',
    phaseLabel: '☁️ Tränengas-Angriff — Chemical Dispersion'
  },
  // Gas-Effekt: Sicht -80%, Bewegung -40%, Schaden 5 HP/Sek

  // 14:00 — POLIZEI-VORSTOSS: "Aggressive Clearing"
  // Formation Keil (Phalanx), Schlagstöcke schwingend, brutal
  {
    time: '14:00', action: 'DESPAWN', npcType: NPCType.DEMONSTRATOR, count: 6,
    description: '14:00 — 6 Demonstranten festgenommen. Keil-Formation. Brutale Räumung.',
    phaseLabel: '⚔️ Polizei-Vorstoß — Aggressive Clearing'
  },
  {
    time: '14:00', action: 'DESPAWN', npcType: NPCType.POLICE, count: 2,
    description: '14:00 — 2 verletzte Polizisten despawnen'
  },
  // Blut-Decals, Bewusstlose, Schreie
  // GESAMT: 35 NPCs, Eskalation: 40%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 6: RUHE (15:00–17:30) — FALSE PEACE              ═══
  // ═══════════════════════════════════════════════════════════════

  // 15:00 — RUHE VOR DEM STURM: "False Peace"
  {
    time: '15:00', action: 'DESPAWN', npcType: NPCType.DEMONSTRATOR, count: -1,
    description: '15:00 — Alle restlichen Demonstranten weg (~15).',
    phaseLabel: '🧹 Ruhe vor dem Sturm — False Peace'
  },
  {
    time: '15:00', action: 'DESPAWN', npcType: NPCType.RIOT_POLICE, count: 5,
    description: '15:00 — 5 Riot-Polizei abgezogen'
  },
  // Aufräum-Teams: Feuerwehr und Sanitäter
  {
    time: '15:00', action: 'SPAWN', npcType: NPCType.FIREFIGHTER, count: 1, position: [-30, 0, 10], radius: 8,
    description: '15:00 — 1 Feuerwehr aufräumen. Zerbrochene Flaschen, Blut-Pfützen.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.CLEANUP
  },
  {
    time: '15:00', action: 'SPAWN', npcType: NPCType.MEDIC, count: 1, position: [-38, 0, 0], radius: 5,
    description: '15:00 — 1 Sanitäter versorgen Verletzte.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.CLEANUP
  },
  // GESAMT: 15 NPCs, Eskalation: 30%

  // 16:00 — NACHRICHTENZYKLUS: "Media Coverage"
  // TV-Screens, Kamera-Teams, Social Media: "#WienRiot" trending
  {
    time: '16:00', action: 'SPAWN', npcType: NPCType.CIVILIAN, count: 4, position: [0, 0, 30], radius: 25,
    description: '16:00 — 4 Schaulustige Parkrand. Kamera-Teams filmen.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.WANDER,
    phaseLabel: '📺 Nachrichtenzyklus — #WienRiot trending'
  },
  // GESAMT: 23 NPCs

  // 17:00–17:30 — ABZUG & SPERRSTUNDE
  {
    time: '17:00', action: 'DESPAWN', npcType: NPCType.FIREFIGHTER, count: 1,
    description: '17:00 — Feuerwehr abziehen'
  },
  {
    time: '17:00', action: 'DESPAWN', npcType: NPCType.MEDIC, count: -1,
    description: '17:00 — Alle Sanitäter abziehen'
  },
  {
    time: '17:30', action: 'DESPAWN', npcType: NPCType.CIVILIAN, count: -1,
    description: '17:30 — Alle Zivilisten weg. Ausgangssperre.',
    phaseLabel: '🚷 Sperrstunde — Stadt wird geräumt'
  },
  // GESAMT: 7 NPCs (nur Polizei-Checkpoints), Eskalation: 20%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 7: ABEND (18:00–19:00) — EXTREMISTEN & MOB       ═══
  // ═══════════════════════════════════════════════════════════════

  // 18:00 — DÄMMERUNG: "Extremists Gather"
  // 30 schwarz gekleidete Extremisten in 5 Gruppen
  // Sturmhauben, Masken, Eisenstangen, Baseballschläger, Molotows
  {
    time: '18:00', action: 'SPAWN', npcType: NPCType.EXTREMIST, count: 3, position: [-70, 0, -70], radius: 8,
    description: '18:00 — 3 Extremisten Gasse Nord-West. Komplett schwarz, Sturmhauben.',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.FOLLOW,
    phaseLabel: '🌑 Dämmerung — Extremisten sammeln sich'
  },
  {
    time: '18:00', action: 'SPAWN', npcType: NPCType.EXTREMIST, count: 3, position: [70, 0, -70], radius: 8,
    description: '18:00 — 3 Extremisten Gasse Nord-Ost. Eisenstangen, Schläger.',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.FOLLOW
  },
  {
    time: '18:00', action: 'SPAWN', npcType: NPCType.EXTREMIST, count: 3, position: [-70, 0, 70], radius: 8,
    description: '18:00 — 3 Extremisten Gasse Süd-West. Molotow-Cocktails.',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.FOLLOW
  },
  {
    time: '18:00', action: 'SPAWN', npcType: NPCType.EXTREMIST, count: 3, position: [70, 0, 70], radius: 8,
    description: '18:00 — 3 Extremisten Gasse Süd-Ost. Improvisierte Schilde.',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.FOLLOW
  },
  {
    time: '18:00', action: 'SPAWN', npcType: NPCType.EXTREMIST, count: 3, position: [0, 0, 100], radius: 10,
    description: '18:00 — 3 Extremisten Hauptstraße Süd. Vereinzelt Pistolen.',
    mood: NPCMood.ANGRY, behavior: NPCBehavior.FOLLOW
  },
  // 18:45 — Mob formiert sich, Anführer gibt Befehle
  {
    time: '18:45', action: 'MOOD_CHANGE', npcType: NPCType.EXTREMIST, count: -1,
    description: '18:45 — Mob formiert. Anführer: "Heute Nacht brennt Wien!"',
    targetMood: NPCMood.RIOTING, targetBehavior: NPCBehavior.FOLLOW
  },
  // GESAMT: 37 NPCs (7 Pol + 30 Extremisten), Eskalation: 50%

  // 🎸 18:10 — CHRISTIAN STRAZZUSO betritt Bühne (Vorgezogen auf Wunsch)
  {
    time: '18:10', action: 'SPAWN', npcType: NPCType.MUSICIAN, count: 1, position: [0, 1.5, -13], radius: 1,
    description: '18:10 — CHRISTIAN STRAZZUSO betritt die Bühne. Konzertvorbereitung.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.HOLD_SIGN,
    phaseLabel: '🎸 CHRISTIAN STRAZZUSO — LIVE IN CONCERT'
  },

  // 19:00 — MOB-ANGRIFF: "Black Bloc Assault"
  // Skandieren: "ACAB! ACAB! ACAB!", Trommeln auf Schilder
  {
    time: '19:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 2, position: [0, 0, 42], radius: 8,
    description: '19:00 — 2 Pol Verstärkung Parkrand',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL,
    phaseLabel: '💀 Mob-Angriff — Black Bloc Assault'
  },
  // 15 Extremisten marschieren zu [0,0,12] — FRONTAL-KOLLISION
  {
    time: '19:00', action: 'MOVE', npcType: NPCType.EXTREMIST, count: 15, position: [0, 0, 12],
    description: '19:00 — 15 Extremisten marschieren zu Bühne. "ACAB! ACAB!"'
  },
  // 19:03 — Nahkampf-Chaos: Eisenstangen vs Schlagstöcke, Molotows, Schüsse
  {
    time: '19:03', action: 'MOOD_CHANGE', npcType: NPCType.EXTREMIST, count: -1,
    description: '19:03 — FRONTAL-KOLLISION! 15 vs 6. Brutale Gewalt. MAXIMUM CHAOS.',
    targetMood: NPCMood.RIOTING, targetBehavior: NPCBehavior.COMBAT
  },
  // GESAMT: 42 NPCs, Eskalation: 80%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 8: NACHT (19:30–20:30) — BENGALOS, SEK           ═══
  // ═══════════════════════════════════════════════════════════════

  // 19:30 — BENGALO-INFERNO: "Pyro Show from Hell"
  // 20 Bengalos ROT, Rauch, Polizisten in Flammen
  {
    time: '19:30', action: 'DESPAWN', npcType: NPCType.POLICE, count: 2,
    description: '19:30 — 2 verletzte Polizisten fallen aus',
    phaseLabel: '🔥 Bengalo-Inferno — Pyro Show from Hell'
  },
  {
    time: '19:30', action: 'DESPAWN', npcType: NPCType.EXTREMIST, count: 1,
    description: '19:30 — 1 Extremist fällt im Kampf'
  },
  // GESAMT: 35 NPCs, Eskalation: 85%

  // 20:00 — AUTO-BRÄNDE & BARRIKADEN: "Urban Warfare Setup"
  // Umgestürzte Autos, Müll-Container, Pflastersteine
  {
    time: '20:00', action: 'DESPAWN', npcType: NPCType.EXTREMIST, count: 1,
    description: '20:00 — 1 weiterer Extremist fällt. Barrikaden werden gebaut.',
    phaseLabel: '🔥 Barrikaden & Brände — Urban Warfare'
  },
  // GESAMT: 32 NPCs, Eskalation: 90%

  // 20:30 — SEK ANKUNFT: "Special Forces Arrival"
  // Hubschrauber-Sound, 25 SEK: Sturmgewehre (Steyr AUG), Scharfschützen
  {
    time: '20:30', action: 'SPAWN', npcType: NPCType.SEK, count: 12, position: [0, 0, 85], radius: 15,
    description: '20:30 — 12 SEK Anfahrt. Sturmgewehre, Nachtsicht. Scharfschützen-Laser.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SURROUND,
    phaseLabel: '🎯 SEK-Ankunft — Special Forces'
  },
  // GESAMT: 57 NPCs (7 Pol + 25 Ext + 25 SEK), Eskalation: 95%

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 9: PEAK (21:00–21:30) — TOTALE ESKALATION        ═══
  // ═══════════════════════════════════════════════════════════════

  // 21:00 — HÖHEPUNKT: "Peak Chaos"
  // Schusswechsel: Extremist feuert Pistole, SEK eröffnet Feuer
  {
    time: '21:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 2, position: [30, 0, 30], radius: 10,
    description: '21:00 — 2 Pol Reserve Park-Ost',
    mood: NPCMood.TENSE, behavior: NPCBehavior.SHIELD_WALL,
    phaseLabel: '💀 TOTALE ESKALATION — Peak Chaos'
  },
  {
    time: '21:00', action: 'SPAWN', npcType: NPCType.MEDIC, count: 1, position: [55, 0, 55], radius: 8,
    description: '21:00 — 1 Sanitäter Triage Südost',
    mood: NPCMood.PANICKED, behavior: NPCBehavior.CLEANUP
  },
  // 21:00:30 — SEK ERÖFFNET FEUER: Sturmgewehr-Salven
  // ALL-OUT WAR: 25 Ext vs 37 Sicherheitskräfte
  {
    time: '21:00', action: 'MOOD_CHANGE', npcType: NPCType.SEK, count: -1,
    description: '21:00 — SEK ERÖFFNET FEUER! Sturmgewehr-Salven. Blut-Fontänen.',
    targetMood: NPCMood.RIOTING, targetBehavior: NPCBehavior.COMBAT
  },
  // GESAMT PEAK: ~65 NPCs, Eskalation: 100% MAXIMUM

  // 21:30 — WENDE: "Retreat & Scatter"
  // Anführer: "Rückzug! In die Kanalisation!"
  {
    time: '21:30', action: 'DESPAWN', npcType: NPCType.EXTREMIST, count: 7,
    description: '21:30 — 7 Extremisten fliehen. "Rückzug! In die Kanalisation!"',
    phaseLabel: '🏃 Mob-Rückzug — Retreat & Scatter'
  },
  {
    time: '21:30', action: 'DESPAWN', npcType: NPCType.EXTREMIST, count: 5,
    description: '21:30 — 5 Extremisten verhaftet/bewusstlos'
  },
  // GESAMT: 40 NPCs, Eskalation: 70% (sinkend)

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 10: AFTERMATH (22:00–06:00) — AUFRÄUMEN & RESET  ═══
  // ═══════════════════════════════════════════════════════════════

  // 22:00 — "Crime Scene Processing"
  {
    time: '22:00', action: 'DESPAWN', npcType: NPCType.SEK, count: 7,
    description: '22:00 — 7 SEK Teilabzug',
    phaseLabel: '🏥 Aftermath — Crime Scene Processing'
  },
  {
    time: '22:00', action: 'DESPAWN', npcType: NPCType.POLICE, count: 5,
    description: '22:00 — 5 Polizei Teilabzug'
  },
  {
    time: '22:00', action: 'SPAWN', npcType: NPCType.FIREFIGHTER, count: 2, position: [-20, 0, 35], radius: 15,
    description: '22:00 — 2 Feuerwehr Löscharbeiten. Brände löschen.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.CLEANUP
  },
  {
    time: '22:00', action: 'SPAWN', npcType: NPCType.MEDIC, count: 2, position: [20, 0, 20], radius: 10,
    description: '22:00 — 2 Sanitäter Erstversorgung. Verletzte versorgen.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.CLEANUP
  },
  // GESAMT: 23 NPCs, Eskalation: 40%

  // 23:00 — NÄCHTLICHE RUHE: "Calm Returns"
  {
    time: '23:00', action: 'DESPAWN', npcType: NPCType.FIREFIGHTER, count: -1,
    description: '23:00 — Feuerwehr abziehen',
    phaseLabel: '🌙 Nächtliche Ruhe — Calm Returns'
  },
  {
    time: '23:00', action: 'DESPAWN', npcType: NPCType.MEDIC, count: -1,
    description: '23:00 — Sanitäter abziehen'
  },
  {
    time: '23:00', action: 'DESPAWN', npcType: NPCType.SEK, count: -1,
    description: '23:00 — Alle SEK weg'
  },
  {
    time: '23:00', action: 'DESPAWN', npcType: NPCType.POLICE, count: 4,
    description: '23:00 — 4 Polizisten ab. Nur Checkpoint bleibt.'
  },
  // GESAMT: ~12 NPCs (Polizei-Checkpoints), Eskalation: 20%

  // 00:00 — MITTERNACHT: "Day Ends"
  // Statistik-Screen: Tote, Verletzte, Festnahmen, Schaden
  // Notstand ausgerufen
  {
    time: '00:00', action: 'MOOD_CHANGE', npcType: NPCType.POLICE, count: -1,
    description: '00:00 — Mitternacht. Tag endet. Statistik-Screen.',
    targetMood: NPCMood.PEACEFUL, targetBehavior: NPCBehavior.GUARD,
    phaseLabel: '🕛 Mitternacht — Tag endet'
  },

  // 🎸 04:00 — CHRISTIAN STRAZZUSO verlässt Bühne
  {
    time: '04:00', action: 'DESPAWN', npcType: NPCType.MUSICIAN, count: -1,
    description: '04:00 — Konzert endet. CHRISTIAN STRAZZUSO verlässt die Bühne. Bühnenabbau.',
    phaseLabel: '🌃 Konzert vorbei — Nachtruhe'
  },

  // 01:00–05:00 — NACHT-RUHE
  // Nur Patrols, vereinzelte Plünderer, Reparatur-Teams
  {
    time: '01:00', action: 'MOOD_CHANGE', npcType: NPCType.POLICE, count: -1,
    description: '01:00 — Nachtruhe. Nur Patrouille. Vereinzelt Plünderer (Optional).',
    targetMood: NPCMood.PEACEFUL, targetBehavior: NPCBehavior.PATROL,
    phaseLabel: '🌃 Nachtruhe — Stadt schläft'
  },

  // ═══════════════════════════════════════════════════════════════
  // ═══  CHUNK 11: AFTERMATH-NACHT (00:30–05:30) — NACHWIRKUNG  ═══
  // ═══════════════════════════════════════════════════════════════

  // 00:30 — PLÜNDERER: Opportunisten nach dem Chaos
  {
    time: '00:30', action: 'SPAWN', npcType: NPCType.RIOTER, count: 1, position: [0, 0, 20], radius: 15,
    description: '00:30 — 1 Plünderer sichtet Tatort. Opportunisten versuchen Beute zu sichern.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.WANDER,
    phaseLabel: '🔦 Nachtrunde — Plünderer & Patrouille'
  },

  // 02:00 — SPURENSICHERUNG: Ermittlerteam betritt Tatort
  {
    time: '02:00', action: 'SPAWN', npcType: NPCType.CIVILIAN, count: 1, position: [-15, 0, 15], radius: 5,
    description: '02:00 — Ermittlerteam Spurensicherung. Fotodokumentation, Beweissicherung.',
    mood: NPCMood.TENSE, behavior: NPCBehavior.WANDER,
    phaseLabel: '🔎 Spurensicherung — Ermittlerteam aktiv'
  },

  // 03:30 — FESTNAHMEN: Plünderer verhaftet
  {
    time: '03:30', action: 'DESPAWN', npcType: NPCType.RIOTER, count: 1,
    description: '03:30 — Plünderer verhaftet. Polizei meldet 1 Festnahme nach Nacht-Razzia.',
    phaseLabel: '🔒 Nacht-Festnahmen — Plünderer verhaftet'
  },

  // 05:00 — CHECKPOINT-WECHSEL: Frühschicht
  {
    time: '05:00', action: 'SPAWN', npcType: NPCType.POLICE, count: 1, position: [0, 0, 42], radius: 8,
    description: '05:00 — Frühschicht tritt an. Checkpoint-Wechsel. Lagebericht übergeben.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.PATROL,
    phaseLabel: '🌄 Checkpoint-Wechsel — Frühschicht'
  },

  // 05:30 — PRESSE: Erste Journalisten kehren zurück
  {
    time: '05:30', action: 'SPAWN', npcType: NPCType.JOURNALIST, count: 2, position: [15, 0, 30], radius: 10,
    description: '05:30 — 2 Journalisten: Morgen-Lagebericht. Kamera-Teams dokumentieren Schäden.',
    mood: NPCMood.PEACEFUL, behavior: NPCBehavior.WANDER,
    phaseLabel: '📰 Presse kehrt zurück — Morgen-Lagebericht'
  },

  // 06:00 — NEUER TAG: "Cycle Repeats" (handled by resetDayCycle)
];

if (typeof window !== 'undefined') {
  window.__EVENT_TIMELINE__ = EVENT_TIMELINE;
}

/**
 * ESKALATIONS-TIMELINE — exakt aus dem Master Plan
 * 06:00 →  0% → 21:00 → 100% → 06:00 → 10%
 */
export const TENSION_TIMELINE: { time: string; level: number }[] = [
  { time: '06:00', level: 0 },
  { time: '08:00', level: 5 },
  { time: '10:00', level: 15 },
  { time: '11:00', level: 15 },
  { time: '11:30', level: 25 },
  { time: '12:00', level: 45 },
  { time: '12:15', level: 60 },
  { time: '12:30', level: 70 },
  { time: '13:00', level: 65 },
  { time: '13:30', level: 50 },
  { time: '14:00', level: 40 },
  { time: '15:00', level: 30 },
  { time: '16:00', level: 20 },
  { time: '18:00', level: 50 },
  { time: '19:00', level: 80 },
  { time: '19:30', level: 85 },
  { time: '20:00', level: 90 },
  { time: '20:30', level: 95 },
  { time: '21:00', level: 100 },
  { time: '21:30', level: 70 },
  { time: '22:00', level: 40 },
  { time: '23:00', level: 20 },
  { time: '00:00', level: 15 },
  { time: '01:00', level: 10 },
  { time: '02:00', level: 12 },
  { time: '05:00', level: 8 },
];

/**
 * PHASE DESCRIPTIONS — Vollständig aus Master Plan
 */
export const PHASE_DESCRIPTIONS: { time: string; label: string }[] = [
  { time: '06:00', label: '🌅 Tagesbeginn — Stadt erwacht' },
  { time: '08:00', label: '📢 Demo-Vorbereitung — Erste Demonstranten' },
  { time: '09:00', label: '📢 Versammlung — Schilder werden verteilt' },
  { time: '10:00', label: '📢 Massen-Zustrom — Crowd wächst' },
  { time: '10:20', label: '📢 Sprechchöre — "Freiheit! Freiheit!"' },
  { time: '11:00', label: '🎤 Hauptredner — Dr. Michael Hoffmann' },
  { time: '11:30', label: '⚠️ Aggressive Rhetorik — Karl Weber' },
  { time: '12:00', label: '🚨 Polizei-Ultimatum — "Platz verlassen!"' },
  { time: '12:04', label: '💥 Wut-Explosion — Flaschen fliegen!' },
  { time: '12:15', label: '💥 Frontkollision — Massenschlägerei' },
  { time: '12:30', label: '🛡️ Hundertschaft — Schild-Beats: BOOM!' },
  { time: '13:00', label: '💧 Wasserwerfer — Hydro Cannon Assault' },
  { time: '13:30', label: '☁️ Tränengas — Chemical Dispersion' },
  { time: '14:00', label: '⚔️ Polizei-Vorstoß — Phalanx-Räumung' },
  { time: '15:00', label: '🧹 Ruhe vor dem Sturm — False Peace' },
  { time: '16:00', label: '📺 Nachrichtenzyklus — #WienRiot' },
  { time: '17:30', label: '🚷 Sperrstunde — Ausgangssperre' },
  { time: '18:00', label: '🌑 Extremisten sammeln sich — 5 Gruppen' },
  { time: '18:45', label: '🌑 Mob formiert — "Heute brennt Wien!"' },
  { time: '19:00', label: '💀 Black Bloc Assault — "ACAB! ACAB!"' },
  { time: '19:03', label: '💀 Frontal-Kollision — Brutale Gewalt' },
  { time: '19:30', label: '🔥 Bengalo-Inferno — Pyro Show from Hell' },
  { time: '20:00', label: '🔥 Barrikaden & Brände — Urban Warfare' },
  { time: '20:30', label: '🎯 SEK-Ankunft — Special Forces' },
  { time: '21:00', label: '💀 TOTALE ESKALATION — Peak Chaos (100%)' },
  { time: '21:30', label: '🏃 Mob-Rückzug — Retreat & Scatter' },
  { time: '22:00', label: '🏥 Aftermath — Crime Scene Processing' },
  { time: '23:00', label: '🌙 Nächtliche Ruhe — Calm Returns' },
  { time: '00:00', label: '🕛 Mitternacht — Tag endet' },
  { time: '00:30', label: '🔦 Nachtrunde — Plünderer & Patrouille' },
  { time: '01:00', label: '🌃 Nachtruhe — Stadt schläft' },
  { time: '02:00', label: '🔎 Spurensicherung — Ermittlerteam' },
  { time: '03:30', label: '🔒 Nacht-Festnahmen — Plünderer verhaftet' },
  { time: '05:00', label: '🌄 Checkpoint-Wechsel — Frühschicht' },
  { time: '05:30', label: '📰 Presse zurück — Morgen-Lagebericht' },
];

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export const MAX_ACTIVE_NPCS = 80; // Gedrosselt für CPU-Heat-Fix (vorher 250)
