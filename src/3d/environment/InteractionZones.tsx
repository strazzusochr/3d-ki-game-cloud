import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const InteractionZones = () => {
    // Dummy-Zonen: Einfache Kugeln
    return (
        <group>
            <mesh position={[10, 1, 10]}>
                <sphereGeometry args={[2, 16, 16]} />
                <meshStandardMaterial color="#ffcc00" opacity={0.5} transparent />
            </mesh>
            <mesh position={[-10, 1, -10]}>
                <sphereGeometry args={[2, 16, 16]} />
                <meshStandardMaterial color="#00ccff" opacity={0.5} transparent />
            </mesh>
        </group>
    );
};
