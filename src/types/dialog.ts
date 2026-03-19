import { GameEvent } from '../systems/eventScheduler';
import { EmotionalState } from './enums';

export interface DialogChoice {
    text: string;
    nextNodeId: string;
    consequence?: Partial<GameEvent>;
    reputationDelta?: number;
    moralDelta?: number;
}

export interface DialogNode {
    id: string;
    speaker: string;
    text: string;
    audioFile?: string;
    lipSyncData?: number[];
    emotionChange?: EmotionalState;
    choices?: DialogChoice[];
    triggerCondition?: string;
    duration?: number;
}

export interface DialogState {
    activeNodeId: string | null;
    history: string[];
    isChoicePending: boolean;
}
