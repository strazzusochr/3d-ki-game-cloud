import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const SpawnMarkers = () => {
    // Dummy-Spawn-Marker: Einfache rote Kugeln
    return (
        <group>
            <mesh position={[20, 1, 0]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color="#ff0000" opacity={0.7} transparent />
            </mesh>
            <mesh position={[-20, 1, 0]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color="#00ff00" opacity={0.7} transparent />
            </mesh>
        </group>
    );
};
