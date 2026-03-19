/**
 * 🚀 INFINITE ENGINE - V3.0 — 24H MASTER PLAN VOLLSTÄNDIG
 * Off-thread simulation mit ALLEN Behavior-Presets aus dem Master Plan.
 *
 * BEHAVIORS:
 *   IDLE          — stehen, leichtes Schwanken
 *   WANDER        — Zivilisten langsam zufällig
 *   JOG           — Jogger schnell entlang Route
 *   PATROL        — Polizei-Patrouille
 *   GATHER        — Demonstranten sammeln sich
 *   CHANT         — Sprechchöre, Rhythmus-Schwanken
 *   HOLD_SIGN     — Schild hochhalten
 *   FLEE          — Panik-Flucht vom Zentrum weg
 *   ATTACK        — Aggressiv auf Feind zubewegen
 *   FOLLOW        — Anführer folgen (Extremisten-Marsch)
 *   SHIELD_WALL   — Polizei Linie halten
 *   SURROUND      — SEK Kreis-Formation
 *   THROW         — Objekte werfen (Flaschen, Steine)
 *   COMBAT        — Nahkampf (Schlagstock vs Eisenstange)
 *   CLEANUP       — Aufräumen (Feuerwehr, Sanitäter)
 *   GUARD         — Checkpoint bewachen (Nacht)
 *   RETREAT       — Geordneter Rückzug
 */

import { computeAdaptiveBehavior, isAgitatorType, isPoliceType } from '../systems/ai/behaviorEscalation';

interface WorkerNPC {
    id: number;
    type: string;
    behavior: string;
    x: number;
    z: number;
    rotY: number;
    speed: number;
    targetX?: number;
    targetZ?: number;
    behaviorTimer: number;
    homeX: number;
    homeZ: number;
    swayPhase: number;
    /** Animation flag: 0=idle, 1=walking, 2=combat, 3=fallen */
    animState: number;
}

let npcs: WorkerNPC[] = [];
let isRunning = false;
let lastTick = performance.now();
const FLOATS_PER_NPC = 12;
let outputBuffer: Float32Array;
let maxInstances = 500;
let currentTension = 10;

const getSpeed = (type: string, behavior: string): number => {
    switch (behavior) {
        case 'JOG': return 3.0;
        case 'FLEE': return 5.0;   // Panik = schnell!
        case 'RETREAT': return 3.5;
        case 'ATTACK': return 3.5;
        case 'COMBAT': return 2.0;   // Nahkampf = langsamer
        case 'FOLLOW': return 2.5;   // Marsch
        case 'PATROL': return 1.2;
        case 'WANDER': return 0.8;
        case 'GATHER': return 1.0;
        case 'HOLD_SIGN': return 0.3;
        case 'IDLE': return 0.2;
        case 'CHANT': return 0.4;
        case 'SHIELD_WALL': return 0.6;   // Formation: langsam
        case 'SURROUND': return 1.5;   // Umzingelung: mittel
        case 'THROW': return 0.8;   // Werfen: stehen bleiben
        case 'CLEANUP': return 0.6;   // Aufräumen
        case 'GUARD': return 0.3;   // Wache = fast still
        default: break;
    }
    let base = 1.4;
    switch (type) {
        case 'RIOT_POLICE': case 'SEK': base = 2.4; break;
        case 'EXTREMIST': base = 2.0; break;
        case 'POLICE': base = 1.7; break;
        case 'MEDIC': case 'FIREFIGHTER': base = 1.2; break;
        default: base = 1.5; break;
    }
    return base * (1 + (currentTension / 100) * 0.25);
};

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;
    if (type === 'INIT') {
        maxInstances = payload.maxInstances || 500;
        outputBuffer = new Float32Array(maxInstances * FLOATS_PER_NPC);
        npcs = (payload.npcs || []).map((n: any) => ({
            id: n.id,
            type: n.type,
            behavior: n.behavior || 'IDLE',
            x: n.position[0],
            z: n.position[2],
            rotY: n.rotation || 0,
            speed: getSpeed(n.type, n.behavior || 'IDLE'),
            behaviorTimer: Math.random() * 3,
            homeX: n.position[0],
            homeZ: n.position[2],
            swayPhase: Math.random() * Math.PI * 2,
            animState: 0
        }));
        if (!isRunning) { isRunning = true; tick(); }
    }
    if (type === 'SET_TENSION') {
        currentTension = payload;
    }
    if (type === 'SYNC_NPCS') {
        const synced = payload as any[];
        const syncedMap = new Map(synced.map((r: any) => [r.id, r]));

        // Update behaviors of existing NPCs (for MOOD_CHANGE events)
        npcs = npcs.filter(n => syncedMap.has(n.id)).map(n => {
            const raw = syncedMap.get(n.id)!;
            if (raw.behavior !== n.behavior) {
                n.behavior = raw.behavior;
                n.speed = getSpeed(n.type, n.behavior);
                n.targetX = undefined; // Reset target for new behavior
                n.targetZ = undefined;
                n.behaviorTimer = 0; // Immediate new behavior
            }
            return n;
        });

        // Add new NPCs
        synced.forEach(raw => {
            if (!npcs.some(n => n.id === raw.id)) {
                npcs.push({
                    id: raw.id,
                    type: raw.type,
                    behavior: raw.behavior || 'IDLE',
                    x: raw.position[0],
                    z: raw.position[2],
                    rotY: raw.rotation || 0,
                    speed: getSpeed(raw.type, raw.behavior || 'IDLE'),
                    behaviorTimer: Math.random() * 3,
                    homeX: raw.position[0],
                    homeZ: raw.position[2],
                    swayPhase: Math.random() * Math.PI * 2,
                    animState: 0
                });
            }
        });
    }
    if (type === 'MOVE_TO_TARGET') {
        const { ids, target } = payload;
        const targetIds = new Set(ids as number[]);
        npcs.forEach(npc => {
            if (targetIds.has(npc.id)) {
                npc.targetX = target[0] + (Math.random() - 0.5) * 10;
                npc.targetZ = target[2] + (Math.random() - 0.5) * 10;
                npc.behavior = 'FOLLOW';
                npc.speed = getSpeed(npc.type, 'FOLLOW');
            }
        });
    }
};

/**
 * BEHAVIOR-DRIVEN CROWD LOGIC — VOLLSTÄNDIG AUS MASTER PLAN
 */
function updateBehaviors(dt: number) {
    const demoCenter = { x: 0, z: 12 }; // Bühne Frontbereich
    const platzCenter = { x: 0, z: 0 }; // Stephansplatz Mitte

    for (const npc of npcs) {
        npc.behaviorTimer -= dt;
        npc.swayPhase += dt * 1.5;
        npc.animState = 0; // Default: idle

        // === BEHAVIOR-SPECIFIC MOVEMENT ===
        if (npc.behaviorTimer <= 0 && !npc.targetX) {
            switch (npc.behavior) {
                case 'WANDER':
                    // Zivilisten: wandern in 30m Radius um Spawn
                    npc.targetX = npc.homeX + (Math.random() - 0.5) * 30;
                    npc.targetZ = npc.homeZ + (Math.random() - 0.5) * 30;
                    npc.behaviorTimer = 3 + Math.random() * 5;
                    break;

                case 'JOG':
                    // Jogger: schnell, großer Radius
                    npc.targetX = npc.homeX + (Math.random() - 0.5) * 60;
                    npc.targetZ = npc.homeZ + (Math.random() - 0.5) * 60;
                    npc.behaviorTimer = 2 + Math.random() * 3;
                    break;

                case 'PATROL':
                    // Polizei: Patrouille entlang Platzrand
                    npc.targetX = npc.homeX + (Math.random() - 0.5) * 20;
                    npc.targetZ = npc.homeZ + (Math.random() - 0.5) * 8;
                    npc.behaviorTimer = 4 + Math.random() * 4;
                    break;

                case 'GATHER':
                    // Demonstranten sammeln sich vor Bühne
                    npc.targetX = demoCenter.x + (Math.random() - 0.5) * 15;
                    npc.targetZ = demoCenter.z + (Math.random() - 0.5) * 10;
                    npc.behaviorTimer = 5 + Math.random() * 5;
                    break;

                case 'HOLD_SIGN':
                    // Schild halten: fast still, leichtes Schwanken
                    npc.targetX = npc.x + Math.sin(npc.swayPhase) * 0.5;
                    npc.targetZ = npc.z + Math.cos(npc.swayPhase * 0.7) * 0.3;
                    npc.behaviorTimer = 2 + Math.random() * 3;
                    break;

                case 'CHANT':
                    // Sprechchöre: rhythmisches Schwanken
                    npc.targetX = npc.x + Math.sin(npc.swayPhase * 2) * 0.8;
                    npc.targetZ = npc.z + Math.cos(npc.swayPhase * 1.5) * 0.5;
                    npc.behaviorTimer = 1.5 + Math.random() * 2;
                    break;

                case 'SHIELD_WALL':
                    // Polizei-LINIE: gleichmäßig auf Z-Achse, minimale Bewegung
                    // Halten Position, leichtes Vorwärts-Drängen bei hoher Tension
                    if (currentTension > 60) {
                        npc.targetX = npc.x + (Math.random() - 0.5) * 2;
                        npc.targetZ = npc.z - 0.5; // Langsam nach vorne drängen
                    } else {
                        npc.targetX = npc.x + (Math.random() - 0.5) * 1;
                        npc.targetZ = npc.z + (Math.random() - 0.5) * 0.5;
                    }
                    npc.behaviorTimer = 3 + Math.random() * 3;
                    break;

                case 'SURROUND':
                    // SEK: Kreis um Zentrum bilden, langsam enger werdend
                    {
                        const angle = Math.atan2(npc.z - platzCenter.z, npc.x - platzCenter.x);
                        const currentDist = Math.sqrt(
                            (npc.x - platzCenter.x) ** 2 + (npc.z - platzCenter.z) ** 2
                        );
                        // Langsam einkreisen (Radius wird kleiner)
                        const targetDist = Math.max(15, currentDist - 3);
                        const jitter = (Math.random() - 0.5) * 0.3;
                        npc.targetX = platzCenter.x + Math.cos(angle + jitter) * targetDist;
                        npc.targetZ = platzCenter.z + Math.sin(angle + jitter) * targetDist;
                        npc.behaviorTimer = 3 + Math.random() * 4;
                    }
                    break;

                case 'THROW':
                    // Objekte werfen: stehen bleiben, leichtes Vor/Zurück
                    npc.targetX = npc.x + (Math.random() - 0.5) * 3;
                    npc.targetZ = npc.z + (Math.random() - 1) * 2;
                    npc.behaviorTimer = 1 + Math.random() * 2;
                    npc.animState = 2; // combat/throw anim
                    break;

                case 'COMBAT':
                    // Nahkampf: zum nächsten Feind bewegen
                    {
                        const enemies = npcs.filter(other => {
                            if (other.id === npc.id) return false;
                            const isExtremist = npc.type === 'EXTREMIST' || npc.type === 'RIOTER';
                            const isCop = npc.type === 'POLICE' || npc.type === 'RIOT_POLICE' || npc.type === 'SEK';
                            const otherIsExtremist = other.type === 'EXTREMIST' || other.type === 'RIOTER';
                            const otherIsCop = other.type === 'POLICE' || other.type === 'RIOT_POLICE' || other.type === 'SEK';
                            // Demonstranten auch mit COMBAT greifen Cops an
                            const isDemo = npc.type === 'DEMONSTRATOR';
                            if (isExtremist || isDemo) return otherIsCop;
                            if (isCop) return otherIsExtremist || (other.type === 'DEMONSTRATOR' && other.behavior === 'COMBAT');
                            return false;
                        });

                        if (enemies.length > 0) {
                            // Find closest enemy
                            let closest = enemies[0];
                            let minDist = Infinity;
                            for (const e of enemies) {
                                const d = (e.x - npc.x) ** 2 + (e.z - npc.z) ** 2;
                                if (d < minDist) { minDist = d; closest = e; }
                            }
                            npc.targetX = closest.x + (Math.random() - 0.5) * 2;
                            npc.targetZ = closest.z + (Math.random() - 0.5) * 2;
                            npc.animState = 2; // combat
                        } else {
                            // No enemies: wander aggressively
                            npc.targetX = platzCenter.x + (Math.random() - 0.5) * 20;
                            npc.targetZ = platzCenter.z + (Math.random() - 0.5) * 20;
                        }
                        npc.behaviorTimer = 0.5 + Math.random() * 1.5;
                    }
                    break;

                case 'FLEE':
                    // Panik-Flucht: schnell vom Zentrum WEG
                    {
                        const dx = npc.x - platzCenter.x;
                        const dz = npc.z - platzCenter.z;
                        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                        // Fluchtrichtung = weg vom Zentrum + Zufall
                        npc.targetX = npc.x + (dx / dist) * 30 + (Math.random() - 0.5) * 15;
                        npc.targetZ = npc.z + (dz / dist) * 30 + (Math.random() - 0.5) * 15;
                        npc.behaviorTimer = 2 + Math.random() * 3;
                    }
                    break;

                case 'FOLLOW':
                    // Anführer folgen: zum Platz-Zentrum marschieren (Extremisten-Marsch)
                    if (!npc.targetX) {
                        npc.targetX = platzCenter.x + (Math.random() - 0.5) * 12;
                        npc.targetZ = platzCenter.z + (Math.random() - 0.5) * 12;
                    }
                    npc.behaviorTimer = 3 + Math.random() * 3;
                    break;

                case 'ATTACK':
                    // Aggressiv auf Zentrum zubewegen
                    npc.targetX = platzCenter.x + (Math.random() - 0.5) * 10;
                    npc.targetZ = platzCenter.z + (Math.random() - 0.5) * 10;
                    npc.behaviorTimer = 1 + Math.random() * 2;
                    break;

                case 'CLEANUP':
                    // Aufräumen: langsam im Bereich umherlaufen
                    npc.targetX = npc.homeX + (Math.random() - 0.5) * 15;
                    npc.targetZ = npc.homeZ + (Math.random() - 0.5) * 15;
                    npc.behaviorTimer = 3 + Math.random() * 5;
                    break;

                case 'GUARD':
                    // Checkpoint bewachen: minimal, stehen fast still
                    npc.targetX = npc.homeX + (Math.random() - 0.5) * 3;
                    npc.targetZ = npc.homeZ + (Math.random() - 0.5) * 3;
                    npc.behaviorTimer = 5 + Math.random() * 5;
                    break;

                case 'RETREAT':
                    // Geordneter Rückzug: weg vom Zentrum, langsamer als FLEE
                    {
                        const rdx = npc.x - platzCenter.x;
                        const rdz = npc.z - platzCenter.z;
                        const rdist = Math.sqrt(rdx * rdx + rdz * rdz) || 1;
                        npc.targetX = npc.x + (rdx / rdist) * 15 + (Math.random() - 0.5) * 8;
                        npc.targetZ = npc.z + (rdz / rdist) * 15 + (Math.random() - 0.5) * 8;
                        npc.behaviorTimer = 3 + Math.random() * 3;
                    }
                    break;

                case 'IDLE':
                default:
                    if (Math.random() < 0.02) {
                        npc.targetX = npc.x + (Math.random() - 0.5) * 4;
                        npc.targetZ = npc.z + (Math.random() - 0.5) * 4;
                    }
                    npc.behaviorTimer = 2 + Math.random() * 3;
                    break;
            }
        }

        // === TENSION OVERRIDES ===
        if (currentTension > 60 && npc.type === 'DEMONSTRATOR' && npc.behavior !== 'COMBAT' && npc.behavior !== 'THROW' && !npc.targetX) {
            npc.targetX = demoCenter.x + (Math.random() - 0.5) * 25;
            npc.targetZ = demoCenter.z + (Math.random() - 0.5) * 15;
        } else if (currentTension > 80 && npc.type === 'EXTREMIST' && npc.behavior !== 'COMBAT' && !npc.targetX) {
            npc.targetX = (Math.random() - 0.5) * 12;
            npc.targetZ = -4 + Math.random() * 8;
        } else if (currentTension > 40 && npc.type === 'POLICE' && npc.behavior === 'PATROL' && !npc.targetX) {
            npc.targetX = (Math.random() - 0.5) * 60;
            npc.targetZ = 35 + (Math.random() - 0.5) * 3;
        }

        // === CLUSTERING, THREAT-SCAN & AVOIDANCE ===
        let neighborCount = 0;
        let avgX = 0;
        let avgZ = 0;
        let hostileNearby = 0;
        let policeNearby = 0;
        let agitatorNearby = 0;
        let panicNearby = 0;

        const selfIsPolice = isPoliceType(npc.type);
        const selfIsAgitator = isAgitatorType(npc.type);

        const step = Math.max(1, Math.floor(npcs.length / 5));
        for (let j = 0; j < npcs.length; j += step) {
            const other = npcs[j];
            if (other.id === npc.id) continue;
            const dx = other.x - npc.x;
            const dz = other.z - npc.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < 16) {
                neighborCount++;
                avgX += other.x;
                avgZ += other.z;

                if (isPoliceType(other.type)) {
                    policeNearby++;
                    if (selfIsAgitator) {
                        hostileNearby++;
                    }
                }

                if (isAgitatorType(other.type)) {
                    agitatorNearby++;
                    if (selfIsPolice || npc.type === 'DEMONSTRATOR' || npc.type === 'ORGANIZER' || npc.type === 'KRAUSE') {
                        hostileNearby++;
                    }
                }

                if (other.behavior === 'FLEE' || other.behavior === 'RETREAT') {
                    panicNearby++;
                }
            }
        }

        const adaptiveBehavior = computeAdaptiveBehavior({
            type: npc.type,
            behavior: npc.behavior,
            tension: currentTension,
            hostileNearby,
            policeNearby,
            agitatorNearby,
            panicNearby,
        });

        if (adaptiveBehavior !== npc.behavior) {
            npc.behavior = adaptiveBehavior;
            npc.speed = getSpeed(npc.type, npc.behavior);
            npc.targetX = undefined;
            npc.targetZ = undefined;
            npc.behaviorTimer = Math.max(0.4, npc.behaviorTimer);
        }

        let currentSpeed = npc.speed;
        if (neighborCount > 0) {
            currentSpeed *= 0.5;
            if (!npc.targetX) {
                npc.x += (avgX / neighborCount - npc.x) * 0.005;
                npc.z += (avgZ / neighborCount - npc.z) * 0.005;
            }
        }

        // === COMBAT PROXIMITY CHECK ===
        if (npc.behavior === 'COMBAT' || npc.behavior === 'ATTACK') {
            for (let j = 0; j < npcs.length; j += step) {
                const other = npcs[j];
                if (other.id === npc.id) continue;
                const dx = other.x - npc.x;
                const dz = other.z - npc.z;
                if (dx * dx + dz * dz < 4) { // 2m range
                    npc.animState = 2; // combat!
                    break;
                }
            }
        }

        // === APPLY PHYSICS ===
        if (npc.targetX !== undefined && npc.targetZ !== undefined) {
            const dx = npc.targetX - npc.x;
            const dz = npc.targetZ - npc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 1.0) {
                const moveDist = currentSpeed * dt;
                const nextX = npc.x + (dx / dist) * moveDist;
                const nextZ = npc.z + (dz / dist) * moveDist;

                // STAGE COLLISION
                const inStage = nextX > -17 && nextX < 17 && nextZ > -21 && nextZ < 6;
                const inBoundaries = nextX > -120 && nextX < 120 && nextZ > -120 && nextZ < 150;

                if (!inStage && inBoundaries) {
                    npc.x = nextX;
                    npc.z = nextZ;
                    npc.rotY = Math.atan2(dx, dz);
                    npc.animState = npc.animState === 2 ? 2 : 1; // walking unless combat
                } else {
                    npc.targetX = undefined;
                }
            } else {
                npc.targetX = undefined;
            }
        }
    }
}

function tick() {
    if (!isRunning) {
        // CPU-SLEEP: Wenn nicht aktiv, stoppt die Rekursion komplett.
        // Wird über INIT wieder gestartet.
        return;
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;

    // Nur simulieren, wenn NPCs vorhanden sind
    if (npcs.length > 0) {
        updateBehaviors(dt);

        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            const offset = i * FLOATS_PER_NPC;
            outputBuffer[offset] = npc.id;
            outputBuffer[offset + 2] = npc.x;
            outputBuffer[offset + 3] = 1.25;
            outputBuffer[offset + 4] = npc.z;
            outputBuffer[offset + 5] = npc.rotY;
            outputBuffer[offset + 6] = npc.animState; // 0=idle, 1=walking, 2=combat, 3=fallen
        }

        const buffer = outputBuffer.buffer;
        (postMessage as any)({ type: 'FRAME', payload: buffer }, [buffer]);
        outputBuffer = new Float32Array(maxInstances * FLOATS_PER_NPC);
    }

    // ADAPTIVE TICK-RATE: 
    // Bei hoher Tension (Action): 33ms (30 FPS Simulation)
    // Im Leerlauf: 100ms (10 FPS Simulation) -> Spart massiv CPU
    const nextTick = currentTension > 30 ? 33 : 100;
    setTimeout(tick, nextTick);
}
