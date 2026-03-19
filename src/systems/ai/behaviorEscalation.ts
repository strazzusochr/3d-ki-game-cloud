export interface EscalationInput {
    type: string;
    behavior: string;
    tension: number;
    hostileNearby: number;
    policeNearby: number;
    agitatorNearby: number;
    panicNearby: number;
}

export interface FactionReactionInput {
    faction: string;
    tension: number;
    hostileNearby: number;
    policeNearby: number;
    supportNearby: number;
    panicNearby: number;
    trendSignal: 'stabilizing' | 'deteriorating' | 'volatile' | 'flat';
}

const POLICE_TYPES = new Set(['POLICE', 'RIOT_POLICE', 'SEK']);
const AGITATOR_TYPES = new Set(['EXTREMIST', 'RIOTER']);
const CIVILIAN_TYPES = new Set(['CIVILIAN', 'TOURIST', 'JOURNALIST', 'MUSICIAN']);

const NON_INTERRUPTIBLE_BEHAVIORS = new Set(['GUARD', 'CLEANUP', 'SURROUND']);
const ADAPTIVE_BEHAVIORS = new Set(['FLEE', 'RETREAT', 'ATTACK', 'COMBAT', 'SHIELD_WALL']);

export const isPoliceType = (type: string) => POLICE_TYPES.has(type);
export const isAgitatorType = (type: string) => AGITATOR_TYPES.has(type);
export const isCivilianType = (type: string) => CIVILIAN_TYPES.has(type);

export const getBaselineBehaviorForType = (type: string, currentBehavior: string) => {
    if (type === 'POLICE') return 'PATROL';
    if (type === 'RIOT_POLICE' || type === 'SEK') return 'SHIELD_WALL';
    if (type === 'EXTREMIST' || type === 'RIOTER') return 'FOLLOW';
    if (type === 'DEMONSTRATOR' || type === 'ORGANIZER' || type === 'KRAUSE') return 'GATHER';
    if (type === 'MEDIC' || type === 'FIREFIGHTER') return 'CLEANUP';
    if (isCivilianType(type)) return 'WANDER';
    return currentBehavior;
};

export const computeAdaptiveBehavior = (input: EscalationInput) => {
    if (NON_INTERRUPTIBLE_BEHAVIORS.has(input.behavior)) {
        return input.behavior;
    }

    if (isCivilianType(input.type)) {
        if (input.tension >= 55 && input.hostileNearby >= 2) {
            return 'FLEE';
        }
    }

    if (input.type === 'DEMONSTRATOR' || input.type === 'ORGANIZER' || input.type === 'KRAUSE') {
        if (input.tension >= 75 && input.hostileNearby >= 2) {
            return 'RETREAT';
        }
        if (input.tension >= 68 && input.agitatorNearby >= 2 && input.policeNearby >= 1) {
            return 'COMBAT';
        }
    }

    if (isPoliceType(input.type)) {
        if (input.tension >= 70 && (input.agitatorNearby >= 2 || input.panicNearby >= 3)) {
            return 'SHIELD_WALL';
        }
    }

    if (isAgitatorType(input.type)) {
        if (input.tension >= 72 && input.policeNearby >= 1) {
            return 'COMBAT';
        }
        if (input.tension >= 55 && input.policeNearby === 0) {
            return 'ATTACK';
        }
    }

    const canDeescalate = ADAPTIVE_BEHAVIORS.has(input.behavior);
    if (canDeescalate && input.tension < 45 && input.hostileNearby === 0 && input.panicNearby === 0) {
        return getBaselineBehaviorForType(input.type, input.behavior);
    }

    return input.behavior;
};

export const computeFactionReaction = (input: FactionReactionInput) => {
    // Fraktionsreaktion: Polizei, Demo, Aggressor, Support
    if (input.faction === 'POLICE') {
        if (input.tension >= 70 && input.hostileNearby >= 2) {
            return 'SHIELD_WALL';
        }
        if (input.trendSignal === 'deteriorating' && input.panicNearby >= 2) {
            return 'RETREAT';
        }
        if (input.supportNearby >= 3 && input.tension < 40) {
            return 'ADVANCE';
        }
    }
    if (input.faction === 'DEMONSTRATOR') {
        if (input.tension >= 75 && input.hostileNearby >= 2) {
            return 'FLEE';
        }
        if (input.trendSignal === 'volatile' && input.panicNearby >= 1) {
            return 'PANIC';
        }
        if (input.supportNearby >= 2 && input.tension < 50) {
            return 'GATHER';
        }
    }
    if (input.faction === 'AGGRESSOR') {
        if (input.tension >= 72 && input.policeNearby >= 1) {
            return 'ATTACK';
        }
        if (input.trendSignal === 'deteriorating' && input.panicNearby >= 2) {
            return 'ESCALATE';
        }
    }
    if (input.faction === 'SUPPORT') {
        if (input.supportNearby >= 4 && input.tension < 40) {
            return 'SUPPORT';
        }
        if (input.trendSignal === 'stabilizing' && input.tension < 30) {
            return 'CALM';
        }
    }
    return 'IDLE';
};