import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { audioManager } from '../../managers/AudioManager';

/**
 * 🔊 GAME AUDIO — Asset-freie Prozedurale Klangerzeugung
 * 
 * Verwendet den AudioManager (Web Audio API) für alle Sounds.
 * Keine externen MP3-Dateien nötig (Zero-Local-Footprint).
 */
export const GameAudio = () => {
    const inGameTime = useGameStore((state: any) => state.gameState.inGameTime);
    const isPlaying = useGameStore((state: any) => state.gameState.isPlaying);
    const masterVolume = useGameStore((state: any) => state.gameState.masterVolume);
    const muted = useGameStore((state: any) => state.gameState.muted);
    
    const firedAmbientKeys = useRef<Set<string>>(new Set());
    const [h, m] = inGameTime.split(':').map(Number);
    const inGameMinutes = h * 60 + m;

    // Unlock audio on first interaction
    const unlockAudio = useCallback(() => {
        if (audioManager.initialized) return;
        audioManager.init();
        console.log('🔊 Audio unlocked and AudioManager initialized');
    }, []);

    useEffect(() => {
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
    }, [unlockAudio]);

    // Sync volume settings
    useEffect(() => {
        audioManager.setVolume(masterVolume);
        audioManager.setMuted(muted);
    }, [masterVolume, muted]);

    // Zeitgesteuerte Sound-Events (Ambient & SFX)
    useEffect(() => {
        if (!isPlaying || !audioManager.initialized) return;

        // Vormittag: Vögel (06:00 - 09:00)
        if (inGameMinutes >= 6 * 60 && inGameMinutes < 9 * 60) {
            if (m % 10 === 0 && !firedAmbientKeys.current.has(`birds_${h}_${m}`)) {
                firedAmbientKeys.current.add(`birds_${h}_${m}`);
                audioManager.playBirds(15);
            }
        }

        // Mittag: Crowd & Sprechchöre (10:00 - 15:00)
        if (inGameMinutes >= 10 * 60 && inGameMinutes < 15 * 60) {
            if (m % 5 === 0 && !firedAmbientKeys.current.has(`chanting_${h}_${m}`)) {
                firedAmbientKeys.current.add(`chanting_${h}_${m}`);
                audioManager.playChanting(10);
            }
        }

        // Abend: Konzert (18:00 - 24:00)
        if (inGameMinutes >= 18 * 60 && inGameMinutes < 24 * 60) {
            if (m % 1 === 0 && !firedAmbientKeys.current.has(`concert_${h}_${m}`)) {
                firedAmbientKeys.current.add(`concert_${h}_${m}`);
                audioManager.playConcert(1);
            }
        }

        // Nacht: Gelegentliche Sirenen (00:00 - 05:00)
        if (inGameMinutes < 5 * 60 || inGameMinutes >= 22 * 60) {
            if (m % 15 === 0 && !firedAmbientKeys.current.has(`night_siren_${h}_${m}`)) {
                firedAmbientKeys.current.add(`night_siren_${h}_${m}`);
                audioManager.playSiren(5);
            }
        }

        // Reset am Tagesanfang
        if (inGameMinutes === 0) {
            firedAmbientKeys.current.clear();
        }

    }, [inGameMinutes, isPlaying]);

    return null;
};

