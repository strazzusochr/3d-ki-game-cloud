import { DialogNode } from '../types/dialog';
import { EmotionalState } from '../types/enums';

export const DIALOG_TREE: Record<string, DialogNode> = {
    'root_organizer': {
        id: 'root_organizer',
        speaker: 'Veranstalter (Thomas)',
        text: 'Herr Oberst, wir haben eine friedliche Versammlung angemeldet. Warum ziehen Sie hier so viel Polizei zusammen? Das provoziert die Leute nur!',
        choices: [
            {
                text: 'Wir sind nur zur Sicherheit hier. Wenn es friedlich bleibt, greifen wir nicht ein.',
                nextNodeId: 'organizer_peaceful',
                reputationDelta: 5,
                moralDelta: 5
            },
            {
                text: 'Das ist eine gefährliche Lage. Jede Provokation Ihrerseits wird sofort unterbunden!',
                nextNodeId: 'organizer_aggressive',
                reputationDelta: -5,
                moralDelta: -5
            },
            {
                text: '(Deeskalierend) Lassen Sie uns gemeinsam dafür sorgen, dass niemand zu Schaden kommt.',
                nextNodeId: 'organizer_deescalate',
                reputationDelta: 10,
                moralDelta: 10
            }
        ]
    },
    'organizer_peaceful': {
        id: 'organizer_peaceful',
        speaker: 'Veranstalter (Thomas)',
        text: 'Ich hoffe, Sie halten Ihr Wort. Meine Ordner versuchen die Menge ruhig zu halten, aber die Stimmung ist gereizt.',
        duration: 3000
    },
    'organizer_aggressive': {
        id: 'organizer_aggressive',
        speaker: 'Veranstalter (Thomas)',
        text: 'Das klingt wie eine Drohung. Wenn das hier eskaliert, dann wegen Ihrer Sturheit!',
        emotionChange: EmotionalState.ANGRY,
        duration: 3000
    },
    'organizer_deescalate': {
        id: 'organizer_deescalate',
        speaker: 'Veranstalter (Thomas)',
        text: 'Einverstanden. Ich werde noch einmal durchgeben, dass keine Flaschen geworfen werden dürfen. Aber halten Sie Ihre Männer zurück.',
        emotionChange: EmotionalState.PEACEFUL,
        duration: 4000
    },
    // Ultimatum Sequenz (12:00)
    'ultimatum_start': {
        id: 'ultimatum_start',
        speaker: 'Oberst Martin Gruber (Funk)',
        text: 'Achtung an alle Einheiten! Wir leiten jetzt das Ultimatum ein. Stefan, du musst das vor Ort koordinieren.',
        choices: [
            {
                text: 'Verstanden. Ich versuche noch einmal mit den Sprechern zu reden.',
                nextNodeId: 'ultimatum_talk',
                moralDelta: 5
            },
            {
                text: 'Bereit zum Vorrücken. Wenn sie nicht gehen, räumen wir.',
                nextNodeId: 'ultimatum_action',
                reputationDelta: -10
            }
        ]
    }
};
