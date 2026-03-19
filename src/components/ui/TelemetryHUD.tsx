import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';


export const TelemetryHUD = () => {
    const [fps, setFps] = useState(0);
    const [polyCount, setPolyCount] = useState(0);
    const [activeNPCs, setActiveNPCs] = useState(0);
    const [lodDistribution, setLodDistribution] = useState([0, 0, 0, 0, 0]);

    const npcs = useGameStore(state => state.npcs);
    const inGameTime = useGameStore(state => state.gameState.inGameTime);
    const tensionLevel = useGameStore(state => state.gameState.tensionLevel);
    const currentPhase = useGameStore(state => state.gameState.currentPhaseLabel);

    // FPS calculation using requestAnimationFrame
    const framesRef = useRef(0);
    const lastTimeRef = useRef(performance.now());

    useEffect(() => {
        let animationId: number;

        const updateFPS = () => {
            framesRef.current++;
            const time = performance.now();

            if (time >= lastTimeRef.current + 1000) {
                const calculatedFps = Math.round((framesRef.current * 1000) / (time - lastTimeRef.current));
                setFps(calculatedFps);
                framesRef.current = 0;
                lastTimeRef.current = time;
            }

            animationId = requestAnimationFrame(updateFPS);
        };

        animationId = requestAnimationFrame(updateFPS);

        return () => cancelAnimationFrame(animationId);
    }, []);

    // Update NPC and polygon count
    useEffect(() => {
        const polyWeights = [200000, 50000, 10000, 2000, 500];
        let totalPolys = 0;
        const currentLodDist = [0, 0, 0, 0, 0];

        npcs.forEach(npc => {
            // Real LOD distribution from the NPC data (if available) or by distance simulation
            // In the current architecture, InstancedHumanoid manages the LODs in a local cache.
            // For the HUD to be perfectly accurate without a complex bridge, we'll use a 
            // conservative distance-based distribution that reflects the UNLIMITED LOD policy.
            const dist = Math.sqrt(Math.pow(npc.position[0], 2) + Math.pow(npc.position[2], 2));
            const lod = dist < 4 ? 0 : dist < 12 ? 1 : dist < 30 ? 2 : dist < 60 ? 3 : 4;
            
            currentLodDist[lod]++;
            totalPolys += polyWeights[lod];
        });

        setPolyCount(totalPolys);
        setActiveNPCs(npcs.length);
        setLodDistribution(currentLodDist);
    }, [npcs]);

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff00',
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '12px',
            borderRadius: '5px',
            pointerEvents: 'none',
            zIndex: 1000,
            border: '1px solid #00ff00'
        }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#fff' }}>
                🚀 JETBRAIN TELEMETRY (HYPER-AAA)
            </div>
            <div style={{ color: '#00ffff', marginBottom: '5px', borderBottom: '1px solid #333', paddingBottom: '3px' }}>
                TIME: {inGameTime} | TENSION: {tensionLevel}%
                <br />
                PHASE: {currentPhase}
            </div>
            <div>FPS: <span style={{ color: fps < 30 ? '#ff0000' : '#00ff00' }}>{fps}</span></div>
            <div>NPCs: {activeNPCs} / 250</div>
            <div>POLYGONS: {(polyCount / 1000000).toFixed(2)}M</div>
            <div style={{ marginTop: '5px', borderTop: '1px solid #333', paddingTop: '5px' }}>
                LOD DISTRIBUTION:
                {lodDistribution.map((count, i) => (
                    <div key={i} style={{ paddingLeft: '10px' }}>
                        LOD-{i} ({i === 0 ? '200k' : i === 1 ? '50k' : 'LOW'}): {count}
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '5px', color: '#aaa', fontSize: '10px' }}>
                BROWSER: BRAVE NIGHTLY (WebGPU)
                <br />
                FOOTPRINT: ZERO-LOCAL-CLOUD
            </div>
        </div>
    );
};
