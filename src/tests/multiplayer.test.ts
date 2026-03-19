import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';

describe('Multiplayer Sync (Phase 6.1)', () => {
    beforeEach(() => {
        useGameStore.setState({ remotePlayers: {} });
    });

    it('should initialize with empty remotePlayers', () => {
        const state = useGameStore.getState();
        expect(state.remotePlayers).toEqual({});
    });

    it('should update a remote player position', () => {
        const { updateRemotePlayer } = useGameStore.getState();
        const testData = { position: [10, 0, 10] as [number, number, number], rotation: 1.5 };
        
        updateRemotePlayer('player-1', testData);
        
        const state = useGameStore.getState();
        expect(state.remotePlayers['player-1']).toEqual(testData);
    });

    it('should remove a remote player', () => {
        const { updateRemotePlayer, removeRemotePlayer } = useGameStore.getState();
        updateRemotePlayer('player-1', { position: [0,0,0], rotation: 0 });
        
        removeRemotePlayer('player-1');
        
        const state = useGameStore.getState();
        expect(state.remotePlayers['player-1']).toBeUndefined();
    });

    it('should have initSocket action defined', () => {
        const state = useGameStore.getState();
        expect(typeof state.initSocket).toBe('function');
    });
});
