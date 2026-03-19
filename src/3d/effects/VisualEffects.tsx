import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const VisualEffects = () => {
    // Dummy-Effekt: Rotierende Box
    const effectRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (effectRef.current) {
            effectRef.current.rotation.y += 0.02;
        }
    });
    return (
        <mesh ref={effectRef} position={[0, 3, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#ff00ff" opacity={0.4} transparent />
        </mesh>
    );
};
