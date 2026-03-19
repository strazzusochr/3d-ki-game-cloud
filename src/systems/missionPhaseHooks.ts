import { EmotionalState, NPCBehavior, NPCMood, NPCType } from '../types/enums';
import type { MissionProgress } from './interactionZones';

export interface MissionHookNpc {
    id: number;
    type: NPCType;
    position: [number, number, number];
    mood: NPCMood;
    behavior: NPCBehavior;
    emotionalState: EmotionalState;
}

const NORTH_START_MIN = 12 * 60;
const EVAC_START_MIN = 18 * 60;
const LATE_PHASE_MIN = 21 * 60;

const withState = <T extends MissionHookNpc>(npc: T, behavior: NPCBehavior, mood: NPCMood): T => {
    const emotionalState = mood === NPCMood.PANICKED
        ? EmotionalState.SCARED
        : mood === NPCMood.ANGRY || mood === NPCMood.RIOTING
            ? EmotionalState.ANGRY
            : mood === NPCMood.PEACEFUL
                ? EmotionalState.PEACEFUL
                : mood === NPCMood.ENTHUSIASTIC
                    ? EmotionalState.HAPPY
                    : EmotionalState.NEUTRAL;

    return {
        ...npc,
        behavior,
        mood,
        emotionalState,
    };
};

const inNorthSector = (npc: MissionHookNpc) => npc.position[2] >= 0;
const inWestSector = (npc: MissionHookNpc) => npc.position[0] < 0 && npc.position[2] < 0;
const inSouthSector = (npc: MissionHookNpc) => npc.position[0] >= 0 && npc.position[2] < 0;

const isPopulation = (type: NPCType) =>
    type === NPCType.CIVILIAN || type === NPCType.TOURIST || type === NPCType.JOURNALIST;

const isSecurity = (type: NPCType) =>
    type === NPCType.POLICE || type === NPCType.RIOT_POLICE || type === NPCType.SEK;

const isAgitator = (type: NPCType) =>
    type === NPCType.EXTREMIST || type === NPCType.RIOTER;

export const applyMissionPhaseHooks = <T extends MissionHookNpc>(
    npcs: T[],
    currentMinutes: number,
    progress: MissionProgress,
): T[] => {
    if (!progress.epochBriefingVerified && !progress.hazardMapPrepared && progress.prioritizedZoneIds.length === 0) {
        return npcs;
    }

    return npcs.map((npc) => {
        let next = npc;

        if (progress.epochBriefingVerified && currentMinutes >= NORTH_START_MIN && currentMinutes < EVAC_START_MIN) {
            if (npc.type === NPCType.JOURNALIST || npc.type === NPCType.ORGANIZER) {
                next = withState(next, NPCBehavior.GATHER, NPCMood.TENSE);
            }
        }

        if (progress.hazardMapPrepared && currentMinutes >= EVAC_START_MIN) {
            if (npc.type === NPCType.MEDIC || npc.type === NPCType.FIREFIGHTER) {
                next = withState(next, NPCBehavior.CLEANUP, NPCMood.TENSE);
            }

            if (isSecurity(npc.type) && next.behavior === NPCBehavior.PATROL) {
                next = withState(next, NPCBehavior.SHIELD_WALL, NPCMood.TENSE);
            }
        }

        if (progress.prioritizedZoneIds.length > 0 && currentMinutes >= EVAC_START_MIN) {
            const inTargetSector =
                (progress.prioritizedZoneIds.includes('evacuation-board-north') && inNorthSector(npc)) ||
                (progress.prioritizedZoneIds.includes('evacuation-board-west') && inWestSector(npc)) ||
                (progress.prioritizedZoneIds.includes('evacuation-board-south') && inSouthSector(npc));

            if (inTargetSector && isPopulation(npc.type)) {
                next = withState(next, NPCBehavior.FLEE, NPCMood.PANICKED);
            }

            if (inTargetSector && isSecurity(npc.type) && next.behavior !== NPCBehavior.SURROUND) {
                next = withState(next, NPCBehavior.SHIELD_WALL, NPCMood.TENSE);
            }
        }

        if (progress.prioritizedZoneIds.length >= 3 && currentMinutes >= LATE_PHASE_MIN) {
            if (isAgitator(npc.type) && next.behavior !== NPCBehavior.COMBAT) {
                next = withState(next, NPCBehavior.RETREAT, NPCMood.TENSE);
            }

            if (npc.type === NPCType.DEMONSTRATOR && next.behavior === NPCBehavior.COMBAT) {
                next = withState(next, NPCBehavior.RETREAT, NPCMood.PANICKED);
            }
        }

        return next;
    });
};