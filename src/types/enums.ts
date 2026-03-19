export enum NPCType { 
    CIVILIAN = 'CIVILIAN', 
    POLICE = 'POLICE', 
    RIOTER = 'RIOTER', 
    JOURNALIST = 'JOURNALIST', 
    TOURIST = 'TOURIST', 
    KRAUSE = 'KRAUSE',
    DEMONSTRATOR = 'DEMONSTRATOR',
    RIOT_POLICE = 'RIOT_POLICE',
    MEDIC = 'MEDIC',
    EXTREMIST = 'EXTREMIST',
    SEK = 'SEK',
    FIREFIGHTER = 'FIREFIGHTER',
    MUSICIAN = 'MUSICIAN',
    ORGANIZER = 'ORGANIZER'
}
export enum NPCState { IDLE = 'IDLE', WALK = 'WALK', RUN = 'RUN' }
export enum Faction { CIVILIAN = 'CIVILIAN', POLICE = 'POLICE', RIOTER = 'RIOTER' }
export enum EmotionalState { NEUTRAL = 'NEUTRAL', ANGRY = 'ANGRY', SCARED = 'SCARED', HAPPY = 'HAPPY', PEACEFUL = 'PEACEFUL' }

/** Mood of the NPC crowd — drives animation/sound selection */
export enum NPCMood {
    PEACEFUL = 'PEACEFUL',
    TENSE = 'TENSE',
    ANGRY = 'ANGRY',
    RIOTING = 'RIOTING',
    ENTHUSIASTIC = 'ENTHUSIASTIC',
    PANICKED = 'PANICKED'
}

/** Behavior preset — tells the worker what movement pattern to use */
export enum NPCBehavior {
    IDLE = 'IDLE',               // stehen bleiben, leichtes Schwanken
    WANDER = 'WANDER',           // langsam zufällig herumlaufen (Zivilisten)
    JOG = 'JOG',                 // joggen entlang Route (Frühaufsteher)
    PATROL = 'PATROL',           // Polizei-Patrouille (langsam, Route)
    GATHER = 'GATHER',           // zu Punkt sammeln (Demonstranten)
    CHANT = 'CHANT',             // Sprechchöre, stehen, Schilder schwenken
    HOLD_SIGN = 'HOLD_SIGN',     // Schild hochhalten, leichtes Schwanken
    FLEE = 'FLEE',               // davonrennen (Panik)
    ATTACK = 'ATTACK',           // aggressiv auf Ziel zubewegen
    FOLLOW = 'FOLLOW',           // einem Anführer folgen (Marsch)
    SHIELD_WALL = 'SHIELD_WALL', // Polizei Formation: Linie halten
    SURROUND = 'SURROUND',      // SEK: Kreis um Zentrum bilden
    THROW = 'THROW',             // Objekte werfen (Flaschen, Steine)
    COMBAT = 'COMBAT',           // Nahkampf (Schlagstock vs Eisenstange)
    CLEANUP = 'CLEANUP',         // Aufräumen (Feuerwehr, Sanis)
    GUARD = 'GUARD',             // Checkpoint bewachen (Nacht)
    RETREAT = 'RETREAT'          // Geordneter Rückzug
}
