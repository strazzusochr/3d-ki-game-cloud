import { useMemo } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { BUILDING_LOTS, STREET_SEGMENTS, getBuildingHeight } from './cityLayout';

const Tree = ({ position }: { position: [number, number, number] }) => (
    <group position={position}>
        <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.3, 2]} />
            <meshStandardMaterial color="#3e2723" />
        </mesh>
        <mesh position={[0, 3, 0]} castShadow>
            <sphereGeometry args={[1.5, 8, 8]} />
            <meshStandardMaterial color="#2e7d32" />
        </mesh>
    </group>
);

const StreetLamp = ({ position }: { position: [number, number, number] }) => {
    const inGameTime = useGameStore(state => state.gameState.inGameTime);
    const [h] = inGameTime.split(':').map(Number);
    const isDark = h < 7 || h > 19;

    return (
        <group position={position}>
            {/* Pole */}
            <mesh position={[0, 3, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.1, 6]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            {/* Top */}
            <mesh position={[0, 6, 0]} castShadow>
                <boxGeometry args={[0.4, 0.2, 0.8]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            {/* Light Source */}
            {isDark && (
                <>
                    <pointLight 
                        position={[0, 5.8, 0]} 
                        intensity={200} 
                        distance={20} 
                        color="#ffcc66" 
                        decay={2}
                    />
                    <mesh position={[0, 5.85, 0]}>
                        <boxGeometry args={[0.3, 0.1, 0.5]} />
                        <meshStandardMaterial color="#fff" emissive="#ffcc66" emissiveIntensity={5} />
                    </mesh>
                </>
            )}
        </group>
    );
};

export const CityEnvironment = () => {
    const buildings = useMemo(() => {
        return BUILDING_LOTS.map((lot) => ({
            ...lot,
            height: getBuildingHeight(lot),
        }));
    }, []);

    // Create a series of planes for the streets to avoid Z-fighting and ensure visibility
    const streets = useMemo(() => {
        return STREET_SEGMENTS.map((segment) => ({
            id: segment.id,
            x: segment.x,
            z: segment.z,
            w: segment.width,
            d: segment.depth,
        }));
    }, []);

    return (
        <group>
            {/* 1. Base Ground (Dirt/Dark) - LOWEST LAYER */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
                <planeGeometry args={[1000, 1000]} />
                <meshStandardMaterial color="#0a0a0a" roughness={1} />
            </mesh>

            {/* 2. Asphalt World (Streets Layer) - MIDDLE LAYER (-0.05) */}
            {streets.map(s => (
                <mesh key={s.id} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, -0.05, s.z]} receiveShadow>
                    <planeGeometry args={[s.w, s.d]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
                </mesh>
            ))}

            {/* 3. Central Park Area (Green Square) - TOP LAYER (0.05) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
                <planeGeometry args={[85, 85]} />
                <meshStandardMaterial color="#2a4d2c" roughness={1} />
            </mesh>

            {/* 4. Sidewalks & Buildings - ELEVATED LAYER (0.1+) */}
            {buildings.map((b) => (
                <group key={b!.id} position={[b!.x, 0, b!.z]}>
                    {/* Sidewalk */}
                    <mesh position={[0, 0.1, 0]} receiveShadow>
                        <boxGeometry args={[b!.width + 8, 0.2, b!.depth + 8]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>

                    {/* Building */}
                    <mesh position={[0, b!.height / 2 + 0.3, 0]} castShadow receiveShadow>
                        <boxGeometry args={[b!.width, b!.height, b!.depth]} />
                        <meshStandardMaterial color="#222" roughness={0.4} />
                    </mesh>

                    {/* Roof */}
                    <mesh position={[0, b!.height + 0.3, 0]}>
                        <boxGeometry args={[b!.width - 2, 0.2, b!.depth - 2]} />
                        <meshStandardMaterial color="#050505" />
                    </mesh>

                    {/* Front Facade Glow */}
                    <mesh position={[0, b!.height / 2 + 0.3, b!.depth / 2 + 0.1]}>
                        <planeGeometry args={[b!.width * 0.7, b!.height * 0.8]} />
                        <meshStandardMaterial color="#000" emissive="#050505" />
                    </mesh>
                </group>
            ))}

            {/* Infrastructure Details */}
            <StreetLamp position={[-42, 0, -42]} />
            <StreetLamp position={[42, 0, -42]} />
            <StreetLamp position={[-42, 0, 42]} />
            <StreetLamp position={[42, 0, 42]} />
            
            <Tree position={[-20, 0, 20]} />
            <Tree position={[20, 0, 20]} />
            <Tree position={[-25, 0, -15]} />
            <Tree position={[25, 0, -15]} />
            <Tree position={[0, 0, 30]} />
        </group>
    );
};
