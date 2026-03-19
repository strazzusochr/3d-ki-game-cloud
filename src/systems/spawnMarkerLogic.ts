import { EVENT_TIMELINE, NPC_COLORS, timeToMinutes, type GameEvent } from './eventScheduler';

export interface SpawnPoint {
    position: [number, number, number];
    color: string;
    radius: number;
    id: string;
    time: string;
    title: string;
    details: string[];
    totalCount: number;
    minutesUntilSpawn: number;
    cardOffsetX: number;
    cardOffsetZ: number;
    cardLiftY: number;
    emphasis: number;
}

export type SpawnUrgency = 'watch' | 'ready' | 'imminent';

export type PhaseBand = 'NIGHT' | 'MORNING' | 'MIDDAY' | 'EVENING' | 'LATE';

export const SHORT_NAMES: Record<string, string> = {
    CIVILIAN: 'ZIV',
    POLICE: 'POL',
    DEMONSTRATOR: 'DEMO',
    RIOT_POLICE: 'RIOT',
    MEDIC: 'SANI',
    EXTREMIST: 'EXTR',
    SEK: 'SEK',
    FIREFIGHTER: 'FEU',
    RIOTER: 'RAND',
    JOURNALIST: 'JOUR',
    KRAUSE: 'KRAU',
    TOURIST: 'TOUR',
};

export const getPhaseBandForMinutes = (minutes: number): PhaseBand => {
    if (minutes < 6 * 60) return 'NIGHT';
    if (minutes < 12 * 60) return 'MORNING';
    if (minutes < 17 * 60) return 'MIDDAY';
    if (minutes < 21 * 60) return 'EVENING';
    return 'LATE';
};

export const getSpawnUrgency = (minutesUntilSpawn: number): SpawnUrgency => {
    if (minutesUntilSpawn <= 6) return 'imminent';
    if (minutesUntilSpawn <= 8) return 'ready';
    return 'watch';
};

export const isInSpawnPreviewWindow = (minutesUntilSpawn: number) =>
    minutesUntilSpawn <= 10 && minutesUntilSpawn >= 5;

export const formatCountdown = (minutesUntilSpawn: number) => {
    const mm = Math.max(0, minutesUntilSpawn).toString().padStart(2, '0');
    return `SPAWN IN 00:${mm}`;
};

const buildSpawnMarkers = (
    events: GameEvent[],
    inGameTime: string,
) => {
    const currentMinutes = timeToMinutes(inGameTime);
    const grouped = new Map<string, SpawnPoint>();

    events.forEach((event, i) => {
        if (event.action !== 'SPAWN' || !event.position || event.count <= 0) {
            return;
        }

        const eventMinutes = timeToMinutes(event.time);
        const minutesUntilSpawn = (eventMinutes - currentMinutes + 24 * 60) % (24 * 60);

        if (!isInSpawnPreviewWindow(minutesUntilSpawn)) {
            return;
        }

        const roundedX = Math.round(event.position[0]);
        const roundedZ = Math.round(event.position[2]);
        const key = `${event.time}:${roundedX}:${roundedZ}`;
        const shortName = SHORT_NAMES[event.npcType] || event.npcType;
        const detailLine = `${event.count}x ${shortName}`;
        const hash = Math.abs((roundedX * 31 + roundedZ * 17 + eventMinutes * 13) % 9);
        const lane = hash % 3;
        const row = Math.floor(hash / 3);
        const cardOffsetX = (lane - 1) * 2.1;
        const cardOffsetZ = (row - 1) * 1.4;
        const cardLiftY = row * 0.28;
        const emphasis = (10 - minutesUntilSpawn) / 5;

        if (grouped.has(key)) {
            const existing = grouped.get(key)!;
            existing.details.push(detailLine);
            existing.totalCount += event.count;
            existing.emphasis = Math.max(existing.emphasis, emphasis);
        } else {
            grouped.set(key, {
                position: event.position,
                color: NPC_COLORS[event.npcType] || '#888',
                radius: Math.min(event.radius || 5, 15),
                id: `marker-${i}`,
                time: event.time,
                title: detailLine,
                details: [detailLine],
                totalCount: event.count,
                minutesUntilSpawn,
                cardOffsetX,
                cardOffsetZ,
                cardLiftY,
                emphasis,
            });
        }
    });

    return Array.from(grouped.values()).sort((a, b) => {
        if (a.minutesUntilSpawn !== b.minutesUntilSpawn) {
            return a.minutesUntilSpawn - b.minutesUntilSpawn;
        }
        return b.totalCount - a.totalCount;
    });
};

export const getSpawnMarkerView = (
    inGameTime: string,
    maxVisibleMarkers: number = 8,
    events: GameEvent[] = EVENT_TIMELINE,
) => {
    const markers = buildSpawnMarkers(events, inGameTime);
    const visibleMarkers = markers.slice(0, maxVisibleMarkers);
    const hiddenMarkerCount = Math.max(0, markers.length - visibleMarkers.length);
    return { markers, visibleMarkers, hiddenMarkerCount };
};
