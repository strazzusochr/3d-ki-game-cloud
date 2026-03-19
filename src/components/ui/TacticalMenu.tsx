import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { NPCType, NPCBehavior, NPCMood } from '../../types/enums';

interface TacticalOption {
    label: string;
    type: NPCType;
    behavior: NPCBehavior;
    mood?: NPCMood;
}

const TACTICAL_OPTIONS: TacticalOption[] = [
    { label: 'Polizei: Streife gehen', type: NPCType.POLICE, behavior: NPCBehavior.PATROL, mood: NPCMood.PEACEFUL },
    { label: 'Polizei: Linie bilden', type: NPCType.POLICE, behavior: NPCBehavior.SHIELD_WALL, mood: NPCMood.TENSE },
    { label: 'Bereitschaft: Stellung halten', type: NPCType.RIOT_POLICE, behavior: NPCBehavior.GUARD, mood: NPCMood.TENSE },
    { label: 'Bereitschaft: Vorrücken', type: NPCType.RIOT_POLICE, behavior: NPCBehavior.ATTACK, mood: NPCMood.ANGRY },
    { label: 'SEK: Ziel einkesseln', type: NPCType.SEK, behavior: NPCBehavior.SURROUND, mood: NPCMood.TENSE },
    { label: 'Alle Einheiten: Rückzug', type: NPCType.POLICE, behavior: NPCBehavior.RETREAT, mood: NPCMood.PANICKED },
];

export const TacticalMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const issueOrder = useGameStore(state => state.issueTacticalOrder);
    const lastOrder = useGameStore(state => state.gameState.lastTacticalOrder);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'c') {
                setIsOpen(prev => !prev);
            }
            if (isOpen) {
                const num = parseInt(e.key);
                if (!isNaN(num) && num > 0 && num <= TACTICAL_OPTIONS.length) {
                    const opt = TACTICAL_OPTIONS[num - 1];
                    issueOrder(opt.type, opt.behavior, opt.mood);
                    // Wir lassen das Menü für schnelle Befehlsfolgen offen, 
                    // oder schließen es nach Wunsch:
                    // setIsOpen(false); 
                }
                if (e.key === 'Escape') {
                    setIsOpen(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, issueOrder]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            width: '300px',
            backgroundColor: 'rgba(0, 20, 40, 0.9)',
            border: '2px solid #00aaff',
            borderRadius: '8px',
            padding: '15px',
            color: 'white',
            fontFamily: 'monospace',
            zIndex: 3000,
            boxShadow: '0 0 15px rgba(0, 170, 255, 0.5)'
        }}>
            <div style={{
                fontSize: '16px',
                color: '#00aaff',
                borderBottom: '1px solid #00aaff',
                marginBottom: '10px',
                paddingBottom: '5px',
                fontWeight: 'bold',
                textAlign: 'center'
            }}>
                🛰️ TAKTISCHES KOMMANDO
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TACTICAL_OPTIONS.map((opt, index) => (
                    <button
                        key={index}
                        onClick={() => issueOrder(opt.type, opt.behavior, opt.mood)}
                        style={{
                            backgroundColor: 'rgba(0, 170, 255, 0.1)',
                            border: '1px solid #005588',
                            color: 'white',
                            padding: '8px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 170, 255, 0.3)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 170, 255, 0.1)')}
                    >
                        <span style={{ color: '#00aaff', marginRight: '8px' }}>[{index + 1}]</span>
                        {opt.label}
                    </button>
                ))}
            </div>

            {lastOrder && (
                <div style={{
                    marginTop: '15px',
                    fontSize: '11px',
                    color: '#aaa',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    borderTop: '1px solid #333',
                    paddingTop: '8px'
                }}>
                    Letzter Befehl: {lastOrder}
                </div>
            )}

            <div style={{
                marginTop: '10px',
                fontSize: '10px',
                color: '#666',
                textAlign: 'center'
            }}>
                [C] Schließen | [ESC] Abbruch
            </div>
        </div>
    );
};
