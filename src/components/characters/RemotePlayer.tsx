import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RemotePlayerProps {
    position: [number, number, number];
    rotation: number;
    id: string;
}

export const RemotePlayer = ({ position, rotation, id }: RemotePlayerProps) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.position.lerp(new THREE.Vector3(...position), 0.1);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation, 0.1);
        }
    });

    return (
        <group ref={groupRef} userData={{ remoteId: id }}>
            <mesh position={[0, 0.5, 0]} castShadow>
                <capsuleGeometry args={[0.3, 1, 4, 8]} />
                <meshStandardMaterial color="#c62828" metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.8, 0.1]} castShadow>
                <boxGeometry args={[0.5, 0.4, 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
};
