import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';

export const useTimeCycle = () => {
    const updateTime = useGameStore(state => state.updateTime);
    const resetDayCycle = useGameStore(state => state.resetDayCycle);
    const isPlaying = useGameStore(state => state.gameState.isPlaying);
    const isTimePaused = useGameStore(state => state.gameState.isTimePaused);
    const inGameTime = useGameStore(state => state.gameState.inGameTime);
    const timeSpeed = useGameStore(state => state.gameState.timeSpeed);
    const rewindHour = useGameStore(state => state.rewindHour);
    const timeRef = useRef({ hours: 6, minutes: 0 });

    useEffect(() => {
        const [h, m] = inGameTime.split(':').map(Number);
        timeRef.current = { hours: h, minutes: m };
    }, [inGameTime]);

    useEffect(() => {
        if (!isPlaying || isTimePaused) return;

        const absSpeed = Math.abs(timeSpeed);
        const direction = timeSpeed >= 0 ? 1 : -1;
        // MASTERPLAN: 24 Min real = 24h ingame → 1 Spielminute = 1 Sek real (1000ms Basis)
        // 1 reale Sekunde = 1 Spielminute (60x Beschleunigung)
        const intervalMs = Math.max(100, Math.floor(1000 / absSpeed));

        const interval = setInterval(() => {
            timeRef.current.minutes += direction;

            // Forward overflow
            if (timeRef.current.minutes >= 60) {
                timeRef.current.minutes = 0;
                timeRef.current.hours += 1;
            }
            // Backward underflow
            if (timeRef.current.minutes < 0) {
                timeRef.current.minutes = 59;
                timeRef.current.hours -= 1;
            }

            // Forward: 24h cycle reset
            if (timeRef.current.hours >= 24) {
                timeRef.current.hours = 0;
                resetDayCycle();
            }
            // Backward: wrap to 23:xx and rebuild state
            if (timeRef.current.hours < 0) {
                timeRef.current.hours = 23;
                rewindHour();
                return;
            }

            const h = timeRef.current.hours.toString().padStart(2, '0');
            const m = timeRef.current.minutes.toString().padStart(2, '0');
            updateTime(`${h}:${m}`);
        }, intervalMs);

        return () => clearInterval(interval);
    }, [isPlaying, isTimePaused, timeSpeed, updateTime, resetDayCycle, rewindHour]);
};
