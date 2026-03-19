import React, { useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { DIALOG_TREE } from '../../data/dialogs';

export const DialogPanel: React.FC = () => {
    const activeNodeId = useGameStore(state => state.dialogState.activeNodeId);
    const chooseOption = useGameStore(state => state.chooseDialogOption);
    const closeDialog = useGameStore(state => state.closeDialog);

    const currentNode = activeNodeId ? DIALOG_TREE[activeNodeId] : null;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!currentNode || !currentNode.choices) return;
            
            const num = parseInt(e.key);
            if (!isNaN(num) && num > 0 && num <= currentNode.choices.length) {
                chooseOption(num - 1);
            }
            if (e.key === 'Escape') {
                closeDialog();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentNode, chooseOption, closeDialog]);

    if (!currentNode) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '2px solid #00ffff',
            borderRadius: '10px',
            padding: '20px',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            zIndex: 2000,
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
        }}>
            <div style={{
                fontSize: '14px',
                color: '#00ffff',
                textTransform: 'uppercase',
                marginBottom: '10px',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                {currentNode.speaker}
            </div>
            
            <div style={{
                fontSize: '18px',
                lineHeight: '1.5',
                marginBottom: '20px',
                minHeight: '60px'
            }}>
                {currentNode.text}
            </div>

            {currentNode.choices && currentNode.choices.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentNode.choices.map((choice, index) => (
                        <button
                            key={index}
                            onClick={() => chooseOption(index)}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid #444',
                                color: 'white',
                                padding: '10px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                        >
                            <span style={{ color: '#00ffff', marginRight: '10px' }}>{index + 1}.</span>
                            {choice.text}
                        </button>
                    ))}
                </div>
            )}

            {!currentNode.choices || currentNode.choices.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '10px' }}>
                    [Der Dialog wird fortgesetzt...]
                </div>
            ) : null}
        </div>
    );
};
