import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const WorldColliders = () => {
    // Dummy-Collider: Einfache Box
    return (
        <group>
            <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[10, 1, 10]} />
                <meshStandardMaterial color="#222" opacity={0.3} transparent />
            </mesh>
        </group>
    );
};
