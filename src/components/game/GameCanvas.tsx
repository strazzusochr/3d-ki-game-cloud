import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Sky, KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { workerManager } from '../../managers/WorkerManager';
import { useGameStore } from '../../stores/gameStore';
import { InstancedHumanoid } from '../characters/InstancedHumanoid';
import { NPCSigns } from '../characters/NPCSigns';
import { CityEnvironment } from '../3d/environment/CityEnvironment';
import { InteractionZones } from '../3d/environment/InteractionZones';
import { WorldColliders } from '../3d/environment/WorldColliders';
import { SpawnMarkers } from '../3d/environment/SpawnMarkers';
import { VisualEffects } from '../3d/effects/VisualEffects';
import { Player } from '../characters/Player';
import { RemotePlayer } from '../characters/RemotePlayer';
import { ErrorBoundary } from 'react-error-boundary';
import { MAX_ACTIVE_NPCS } from '../../systems/eventScheduler';
import { CloudStreamViewer } from '../cloud/CloudStreamViewer';

/**
 * GameCanvas — HYBRID RENDERER
 * 
 * Wenn isZeroFootprint === true, wird kein lokales WebGL initialisiert.
 * Stattdessen wird der CloudStreamViewer eingebunden.
 */

const SceneContent = () => {
    const isPlaying = useGameStore(state => state.gameState.isPlaying);
    const inGameTime = useGameStore(state => state.gameState.inGameTime);
    const npcs = useGameStore(state => state.npcs);
    const remotePlayers = useGameStore(state => state.remotePlayers);

    // Calculate Sun Position from time
    const [h, m] = inGameTime.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    const angle = (totalMinutes / 1440) * Math.PI * 2 - Math.PI / 2;
    const sunPos = [Math.cos(angle) * 100, Math.sin(angle) * 100, 20] as [number, number, number];
    const isDay = h > 6 && h < 20;

    // 🌅 Time-of-day atmosphere
    const isSunrise = h >= 6 && h < 8;
    const isDusk = h >= 17 && h < 20;
    const isNight = h >= 20 || h < 6;

    const bgColor = isSunrise ? '#c4784a' : isDusk ? '#7a4a3a' : isNight ? '#1a2a4a' : '#4a90c2';
    const sunColor = isSunrise ? '#ff9944' : isDusk ? '#ff7744' : isNight ? '#8899cc' : '#fffaf0';
    const ambientIntensity = isSunrise ? 0.5 : isDusk ? 0.5 : isNight ? 0.7 : 0.8;
    const sunIntensity = isSunrise ? 1.2 : isDusk ? 1.0 : isNight ? 0.6 : 2.0;

    useEffect(() => {
        if (isPlaying) {
            workerManager.init();
            workerManager.startSimulation(MAX_ACTIVE_NPCS, npcs);
        }
        return () => workerManager.stopSimulation();
    }, [isPlaying]);

    const isRenderer = new URLSearchParams(window?.location?.search).get('renderer') === 'true';
    // 💀 Brutal-Performance: Keine Schatten im Cloud-Renderer für 60 FPS
    const castShadows = !isRenderer;
    const shadowRes = 256;

    return (
        <>
            <color attach="background" args={['#000000']} />
            {!isRenderer && <Sky sunPosition={sunPos} />}
            <ambientLight intensity={ambientIntensity} />
            <directionalLight
                position={sunPos}
                intensity={sunIntensity}
                castShadow={castShadows}
                shadow-mapSize={[shadowRes, shadowRes]}
                shadow-camera-left={-100}
                shadow-camera-right={100}
                shadow-camera-top={100}
                shadow-camera-bottom={-100}
                shadow-camera-near={1}
                shadow-camera-far={500}
                shadow-bias={-0.001}
                color={sunColor}
            />
            <hemisphereLight
                args={[
                    isSunrise ? '#ff8844' : isNight ? '#4466aa' : '#6688cc',
                    isSunrise ? '#442211' : '#1a1a2a',
                    isSunrise ? 0.4 : isDay ? 0.3 : 0.8
                ]}
            />

            <Physics gravity={[0, -24, 0]} timeStep="vary" colliders={false}>
                <WorldColliders />
                <CityEnvironment />
                <SpawnMarkers />
                <InteractionZones />

                <InstancedHumanoid />
                <NPCSigns />
                <Player />
                {Object.entries(remotePlayers).map(([id, data]) => (
                    <RemotePlayer key={id} id={id} position={data.position} rotation={data.rotation} />
                ))}
                <VisualEffects />
            </Physics>
        </>
    );
};

export const GameCanvas = () => {
    const isZeroFootprint = useGameStore(state => state.isZeroFootprint);
    const [renderKey, setRenderKey] = useState(0);
    const startGame = useGameStore(state => state.startGame);
    const initSocket = useGameStore(state => state.initSocket);

    useEffect(() => {
        initSocket();
        startGame();
    }, []);

    // ☁️ ZERO FOOTPRINT MODE: Starte keine lokale Engine
    if (isZeroFootprint) {
        return <CloudStreamViewer />;
    }

    const isRenderer = new URLSearchParams(window?.location?.search).get('renderer') === 'true';
    const streamProfile = useGameStore.getState().streamProfile || 'medium';
    const useShadows = !isRenderer && (streamProfile === 'aaa' || streamProfile === 'high');
    const useAntialias = streamProfile !== 'low' && !isRenderer;
    
    // 🚀 Performance-Brutal-Turbo: 360p intern für 60 FPS Cloud-Streaming
    const dpr = isRenderer ? 0.4 : (streamProfile === 'aaa' ? 1.25 : window.devicePixelRatio);

    return (
        <ErrorBoundary FallbackComponent={({error}: any) => <div style={{color:'red',fontWeight:'bold'}}>Renderer Error: {error?.message || 'Unknown Error'}</div>}>
        <KeyboardControls map={[
            { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
            { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
            { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
            { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        ]}>
            <Canvas
                key={renderKey}
                shadows={useShadows}
                dpr={dpr}
                gl={{
                    antialias: useAntialias,
                    powerPreference: "high-performance",
                    precision: isRenderer ? "lowp" : "highp",
                    stencil: false,
                    depth: true,
                    logarithmicDepthBuffer: !isRenderer,
                    preserveDrawingBuffer: true
                }}
                onCreated={({ gl }) => {
                    gl.domElement.addEventListener('webglcontextrestored', () => setRenderKey(prev => prev + 1));
                }}
            >
                <Suspense fallback={<Html center>Loading Engine...</Html>}><SceneContent /></Suspense>
            </Canvas>
        </KeyboardControls >
        </ErrorBoundary>
    );
};
