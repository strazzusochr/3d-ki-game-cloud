import { BallCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import { useMemo } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { INTERACTION_ZONES, getInteractionAvailability, getInteractionZoneById, isZoneCompleted } from '../../../systems/interactionZones';
import { getGroundHeightAt } from './cityLayout';

export const InteractionZones = () => {
    const activeZoneId = useGameStore((state) => state.interactionState.nearbyZoneId);
    const missionProgress = useGameStore((state) => state.interactionState.missionProgress);
    const setNearbyInteraction = useGameStore((state) => state.setNearbyInteraction);

    const zones = useMemo(() => {
        return INTERACTION_ZONES.map((zone) => ({
            ...zone,
            position: [zone.position[0], getGroundHeightAt(zone.position[0], zone.position[2]), zone.position[2]] as [number, number, number],
        }));
    }, []);

    return (
        <group>
            {zones.map((zone) => {
                const completed = isZoneCompleted(missionProgress, zone.id);
                const active = activeZoneId === zone.id;
                const availability = getInteractionAvailability(missionProgress, zone.id);
                const locked = !availability.available;
                const ringColor = completed ? '#00ff88' : locked ? '#777777' : active ? '#ffffff' : zone.color;
                const fillOpacity = completed ? 0.3 : locked ? 0.08 : active ? 0.38 : 0.18;

                return (
                    <group key={zone.id} position={zone.position}>
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
                            <ringGeometry args={[zone.radius - 0.35, zone.radius, 48]} />
                            <meshBasicMaterial color={ringColor} transparent opacity={0.85} depthWrite={false} />
                        </mesh>
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
                            <circleGeometry args={[zone.radius - 0.4, 32]} />
                            <meshBasicMaterial color={zone.color} transparent opacity={fillOpacity} depthWrite={false} />
                        </mesh>
                        <Text
                            position={[0, 2.25, 0]}
                            fontSize={0.75}
                            color={ringColor}
                            anchorX="center"
                            anchorY="middle"
                            outlineWidth={0.05}
                            outlineColor="#000000"
                        >
                            {zone.shortLabel}
                        </Text>
                        <Text
                            position={[0, 1.3, 0]}
                            fontSize={0.36}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                            maxWidth={8}
                            textAlign="center"
                            outlineWidth={0.03}
                            outlineColor="#000000"
                        >
                            {completed
                                ? 'ERLEDIGT'
                                : locked
                                    ? `GESPERRT: ${availability.reason}`
                                    : getInteractionZoneById(zone.id)?.prompt}
                        </Text>

                        <RigidBody type="fixed" colliders={false}>
                            <BallCollider
                                args={[zone.radius]}
                                position={[0, 1.1, 0]}
                                sensor
                                onIntersectionEnter={() => setNearbyInteraction(zone.id)}
                                onIntersectionExit={() => {
                                    if (useGameStore.getState().interactionState.nearbyZoneId === zone.id) {
                                        setNearbyInteraction(null);
                                    }
                                }}
                            />
                        </RigidBody>
                    </group>
                );
            })}
        </group>
    );
};