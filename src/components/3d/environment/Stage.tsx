import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';

const SpeakerStack = ({ position }: { position: [number, number, number] }) => (
    <group position={position}>
        {/* Massive Bass Bin */}
        {[0, 1.2, 2.4, 3.6].map((y) => (
            <mesh key={y} position={[0, y, 0]} castShadow>
                <boxGeometry args={[2.5, 1.1, 2]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
                {/* Speaker Driver Detail */}
                <mesh position={[0, 0, 1.05]}>
                    <circleGeometry args={[0.4, 32]} />
                    <meshStandardMaterial color="#111" emissive="#222" />
                </mesh>
            </mesh>
        ))}
        {/* Line Array Top */}
        <group position={[0, 5, 0.5]} rotation={[0.2, 0, 0]}>
            {[0, 0.8, 1.6, 2.4].map((y) => (
                <mesh key={y} position={[0, y, 0]} castShadow>
                    <boxGeometry args={[2, 0.7, 1.2]} />
                    <meshStandardMaterial color="#111" />
                </mesh>
            ))}
        </group>
    </group>
);

const ScreenContent = () => {
    const textRef = useRef<THREE.Group>(null);
    const screenRef = useRef<THREE.Mesh>(null);
    const marqueeRef1 = useRef<THREE.Group>(null);
    const marqueeRef2 = useRef<THREE.Group>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (textRef.current) {
            textRef.current.position.y = 6.5 + Math.sin(t * 2) * 0.2;
            textRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
        }
        if (screenRef.current) {
            (screenRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(t * 3) * 1.5;
            // Bunte Farbwechsel
            const hue = (t * 0.1) % 1;
            (screenRef.current.material as THREE.MeshStandardMaterial).emissive.setHSL(hue, 0.8, 0.2);
        }
        // Marquee Text Bewegung
        if (marqueeRef1.current) marqueeRef1.current.position.y = ((t * 2) % 12) - 6;
        if (marqueeRef2.current) marqueeRef2.current.position.y = (((t * 2) + 6) % 12) - 6;
    });

    return (
        <group position={[0, 0, 0]}>
            {/* GIANT FLAT LED SCREEN (Directly at the back edge) */}
            <mesh ref={screenRef} position={[0, 6.5, -16.8]} castShadow>
                <boxGeometry args={[28, 12, 0.2]} />
                <meshStandardMaterial
                    color="#000"
                    emissive="#0044ff"
                    emissiveIntensity={2}
                    roughness={0.1}
                    metalness={0.9}
                />
            </mesh>

            {/* Main Stage Text */}
            <group ref={textRef} position={[0, 6.5, -16.5]}>
                <Text
                    position={[0, 1.5, 0]}
                    fontSize={3.5}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.1}
                    outlineColor="#000"
                >
                    LIVE IN CONCERT
                </Text>
                <Text
                    position={[0, -1.5, 0]}
                    fontSize={2.5}
                    color="#ffcc00"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.1}
                    outlineColor="#000"
                >
                    STRAZZUSO
                </Text>
            </group>

            {/* Side Vertical Marquee Screens (Scrolling Text) */}
            {[-15, 15].map((x, idx) => (
                <group key={idx} position={[x, 6.5, -16.5]}>
                    <mesh>
                        <boxGeometry args={[1.5, 12, 0.3]} />
                        <meshStandardMaterial color="#050505" emissive="#ff0000" emissiveIntensity={0.5} />
                    </mesh>
                    <group ref={idx === 0 ? marqueeRef1 : marqueeRef2}>
                        <Text
                            rotation={[0, 0, Math.PI / 2]}
                            fontSize={0.8}
                            color="#fff"
                            anchorX="center"
                            anchorY="middle"
                        >
                            +++ RESISTANCE +++ FREIHEIT +++ NOW +++
                        </Text>
                    </group>
                </group>
            ))}
        </group>
    );
};

export const Stage = () => {
    return (
        <group position={[0, 0, 0]}>
            {/* 1. STAGE FLOOR (Clean flat look) */}
            <mesh position={[0, 0.5, -8]} receiveShadow>
                <boxGeometry args={[40, 1, 18]} />
                <meshStandardMaterial color="#111" roughness={0.6} />
            </mesh>

            {/* 2. OPEN TRUSS STRUCTURE */}
            {/* Corner Pillars */}
            {[[-19.5, -16.5], [19.5, -16.5]].map((pos, i) => (
                <mesh key={i} position={[pos[0], 6.5, pos[1]]} castShadow>
                    <boxGeometry args={[0.6, 13, 0.6]} />
                    <meshStandardMaterial color="#444" metalness={1} roughness={0.1} />
                </mesh>
            ))}
            {/* Top Cross Beam */}
            <mesh position={[0, 12.8, -16.5]} castShadow>
                <boxGeometry args={[40, 0.6, 0.6]} />
                <meshStandardMaterial color="#444" metalness={1} roughness={0.1} />
            </mesh>

            {/* 3. SCREEN SYSTEM (Flat) */}
            <ScreenContent />

            {/* 4. AUDIO SYSTEM (Huge Stacks) */}
            <SpeakerStack position={[-17, 0.5, -3]} />
            <SpeakerStack position={[17, 0.5, -3]} />

            {/* 5. DYNAMIC LIGHTING (Optimized: 6 Lights, No Stage Shadows) */}
            {[...Array(6)].map((_, i) => (
                <group key={i} position={[(i - 2.5) * 7.5, 12.5, -16]}>
                    <mesh rotation={[0.4, 0, 0]}>
                        <cylinderGeometry args={[0.2, 0.3, 0.6]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <spotLight
                        position={[0, 0, 0]}
                        angle={0.25}
                        penumbra={0.5}
                        intensity={120}
                        distance={60}
                        castShadow={false} // Schatten deaktiviert für massive Performance-Gewinne
                        color={['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#00ff00'][i % 5]}
                        target-position={[(i - 2.5) * 10, -10, 20]}
                    />
                </group>
            ))}
        </group>
    );
};
