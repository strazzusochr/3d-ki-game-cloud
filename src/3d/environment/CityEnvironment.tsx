import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const CityEnvironment = () => {
    const groundRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        // Dummy Animation: Boden leicht pulsieren
        if (groundRef.current) {
            groundRef.current.scale.x = 1 + Math.sin(Date.now() * 0.001) * 0.01;
            groundRef.current.scale.y = 1;
            groundRef.current.scale.z = 1 + Math.cos(Date.now() * 0.001) * 0.01;
        }
    });
    return (
        <group>
            {/* Boden */}
            <mesh ref={groundRef} position={[0, 0, 0]} receiveShadow>
                <boxGeometry args={[120, 1, 120]} />
                <meshStandardMaterial color="#4a90c2" />
            </mesh>
            {/* Dummy Gebäude */}
            <mesh position={[0, 2, 0]}>
                <boxGeometry args={[10, 4, 10]} />
                <meshStandardMaterial color="#c4784a" />
            </mesh>
        </group>
    );
};
