export type InteractionZoneId =
    | 'epoch-terminal'
    | 'hazard-console'
    | 'evacuation-board-north'
    | 'evacuation-board-west'
    | 'evacuation-board-south';

export interface MissionProgress {
    epochBriefingVerified: boolean;
    hazardMapPrepared: boolean;
    prioritizedZoneIds: InteractionZoneId[];
}

export interface InteractionZone {
    id: InteractionZoneId;
    title: string;
    shortLabel: string;
    description: string;
    prompt: string;
    position: [number, number, number];
    radius: number;
    color: string;
}

export interface InteractionOutcome {
    missionProgress: MissionProgress;
    reputationDelta: number;
    moralDelta: number;
    tensionDelta: number;
    phaseLabel?: string;
    message: string;
    wasApplied: boolean;
}

export interface InteractionAvailability {
    available: boolean;
    reason?: string;
}

export const INITIAL_MISSION_PROGRESS: MissionProgress = {
    epochBriefingVerified: false,
    hazardMapPrepared: false,
    prioritizedZoneIds: [],
};

export const INTERACTION_ZONES: InteractionZone[] = [
    {
        id: 'epoch-terminal',
        title: 'Epoch-2 Lage-Terminal',
        shortLabel: 'NASA',
        description: 'Verifiziert die PDC25-Epoch-2-Datenlage fuer den Einsatzstab.',
        prompt: 'Epoch-2 Datenlage verifizieren',
        position: [0, 0, 28],
        radius: 3.4,
        color: '#00ccff',
    },
    {
        id: 'hazard-console',
        title: 'Hazard-Konsole',
        shortLabel: 'HAZ',
        description: 'Aktualisiert Schaedenbild, Gefahrenachsen und Prioritaetsrouten.',
        prompt: 'Schaedensbild vorbereiten',
        position: [28, 0, 28],
        radius: 3.4,
        color: '#ffaa00',
    },
    {
        id: 'evacuation-board-north',
        title: 'Evakuierungsboard Nord',
        shortLabel: 'NORD',
        description: 'Priorisiert die nördliche Risikozone fuer Kommunikation und Transport.',
        prompt: 'Risikozone Nord priorisieren',
        position: [-28, 0, 28],
        radius: 3.1,
        color: '#66ff88',
    },
    {
        id: 'evacuation-board-west',
        title: 'Evakuierungsboard West',
        shortLabel: 'WEST',
        description: 'Priorisiert die westliche Risikozone fuer Kommunikation und Transport.',
        prompt: 'Risikozone West priorisieren',
        position: [-28, 0, -28],
        radius: 3.1,
        color: '#66ff88',
    },
    {
        id: 'evacuation-board-south',
        title: 'Evakuierungsboard Sued',
        shortLabel: 'SUED',
        description: 'Priorisiert die südliche Risikozone fuer Kommunikation und Transport.',
        prompt: 'Risikozone Sued priorisieren',
        position: [28, 0, -28],
        radius: 3.1,
        color: '#66ff88',
    },
];

const POPULATION_ZONE_IDS: InteractionZoneId[] = [
    'evacuation-board-north',
    'evacuation-board-west',
    'evacuation-board-south',
];

export const getInteractionZoneById = (zoneId: InteractionZoneId | null | undefined) => {
    if (!zoneId) {
        return null;
    }

    return INTERACTION_ZONES.find((zone) => zone.id === zoneId) ?? null;
};

export const isPopulationZone = (zoneId: InteractionZoneId) => POPULATION_ZONE_IDS.includes(zoneId);

export const isZoneCompleted = (progress: MissionProgress, zoneId: InteractionZoneId) => {
    if (zoneId === 'epoch-terminal') {
        return progress.epochBriefingVerified;
    }

    if (zoneId === 'hazard-console') {
        return progress.hazardMapPrepared;
    }

    return progress.prioritizedZoneIds.includes(zoneId);
};

export const getInteractionAvailability = (
    progress: MissionProgress,
    zoneId: InteractionZoneId,
): InteractionAvailability => {
    if (zoneId === 'hazard-console' && !progress.epochBriefingVerified) {
        return {
            available: false,
            reason: 'Zuerst Epoch-2 Lage-Terminal abschliessen.',
        };
    }

    if (isPopulationZone(zoneId) && !progress.hazardMapPrepared) {
        return {
            available: false,
            reason: 'Zuerst Hazard-Konsole abschliessen.',
        };
    }

    return { available: true };
};

export const getMissionChecklist = (progress: MissionProgress) => [
    {
        id: 'epoch2',
        label: `Epoch-2 Datenlage verifizieren (${progress.epochBriefingVerified ? '1/1' : '0/1'})`,
        completed: progress.epochBriefingVerified,
    },
    {
        id: 'hazards',
        label: `Schaedensbild fuer Locations und Hazards vorbereiten (${progress.hazardMapPrepared ? '1/1' : '0/1'})`,
        completed: progress.hazardMapPrepared,
    },
    {
        id: 'population',
        label: `Betroffene Bevoelkerung nach Risikozonen priorisieren (${progress.prioritizedZoneIds.length}/3)`,
        completed: progress.prioritizedZoneIds.length >= 3,
    },
];

export const applyInteractionOutcome = (
    progress: MissionProgress,
    zoneId: InteractionZoneId,
): InteractionOutcome => {
    const availability = getInteractionAvailability(progress, zoneId);
    if (!availability.available) {
        return {
            missionProgress: progress,
            reputationDelta: 0,
            moralDelta: 0,
            tensionDelta: 0,
            message: availability.reason ?? 'Diese Interaktion ist noch gesperrt.',
            wasApplied: false,
        };
    }

    if (zoneId === 'epoch-terminal') {
        if (progress.epochBriefingVerified) {
            return {
                missionProgress: progress,
                reputationDelta: 0,
                moralDelta: 0,
                tensionDelta: 0,
                message: 'Epoch-2 Lagebild bereits verifiziert.',
                wasApplied: false,
            };
        }

        return {
            missionProgress: {
                ...progress,
                epochBriefingVerified: true,
            },
            reputationDelta: 8,
            moralDelta: 10,
            tensionDelta: -6,
            phaseLabel: 'NASA Epoch-2 Datenlage verifiziert',
            message: 'Epoch-2 Datenlage freigegeben. Einsatzstab aktualisiert.',
            wasApplied: true,
        };
    }

    if (zoneId === 'hazard-console') {
        if (progress.hazardMapPrepared) {
            return {
                missionProgress: progress,
                reputationDelta: 0,
                moralDelta: 0,
                tensionDelta: 0,
                message: 'Hazard-Schaedensbild bereits vorbereitet.',
                wasApplied: false,
            };
        }

        return {
            missionProgress: {
                ...progress,
                hazardMapPrepared: true,
            },
            reputationDelta: 6,
            moralDelta: 8,
            tensionDelta: -4,
            phaseLabel: 'Gefahrenachsen synchronisiert',
            message: 'Hazard-Schaedensbild aktualisiert und an Einsatzkraefte gemeldet.',
            wasApplied: true,
        };
    }

    if (progress.prioritizedZoneIds.includes(zoneId)) {
        return {
            missionProgress: progress,
            reputationDelta: 0,
            moralDelta: 0,
            tensionDelta: 0,
            message: 'Diese Risikozone ist bereits priorisiert.',
            wasApplied: false,
        };
    }

    return {
        missionProgress: {
            ...progress,
            prioritizedZoneIds: [...progress.prioritizedZoneIds, zoneId],
        },
        reputationDelta: 4,
        moralDelta: 5,
        tensionDelta: -3,
        phaseLabel: `Risikozone priorisiert (${progress.prioritizedZoneIds.length + 1}/3)`,
        message: `Risikozone priorisiert: ${getInteractionZoneById(zoneId)?.title ?? zoneId}.`,
        wasApplied: true,
    };
};