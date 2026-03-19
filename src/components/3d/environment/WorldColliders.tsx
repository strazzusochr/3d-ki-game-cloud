import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
    BASE_GROUND_HEIGHT,
    BUILDING_LOTS,
    PARK_HEIGHT,
    SIDEWALK_HEIGHT,
    STREET_HEIGHT,
    STREET_SEGMENTS,
    getBuildingHeight,
} from './cityLayout';

const COLLIDER_THICKNESS = 0.1;

export const WorldColliders = () => {
    return (
        <>
            <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[500, COLLIDER_THICKNESS / 2, 500]} position={[0, BASE_GROUND_HEIGHT - COLLIDER_THICKNESS / 2, 0]} />
                <CuboidCollider args={[42.5, COLLIDER_THICKNESS / 2, 42.5]} position={[0, PARK_HEIGHT - COLLIDER_THICKNESS / 2, 0]} />

                {STREET_SEGMENTS.map((segment) => (
                    <CuboidCollider
                        key={segment.id}
                        args={[segment.width / 2, COLLIDER_THICKNESS / 2, segment.depth / 2]}
                        position={[segment.x, STREET_HEIGHT - COLLIDER_THICKNESS / 2, segment.z]}
                    />
                ))}

                {BUILDING_LOTS.map((lot) => (
                    <CuboidCollider
                        key={`sidewalk-${lot.id}`}
                        args={[(lot.width + 8) / 2, COLLIDER_THICKNESS / 2, (lot.depth + 8) / 2]}
                        position={[lot.x, SIDEWALK_HEIGHT - COLLIDER_THICKNESS / 2, lot.z]}
                    />
                ))}

                {BUILDING_LOTS.map((lot) => {
                    const height = getBuildingHeight(lot);
                    return (
                        <CuboidCollider
                            key={`building-${lot.id}`}
                            args={[lot.width / 2, height / 2, lot.depth / 2]}
                            position={[lot.x, height / 2 + 0.3, lot.z]}
                        />
                    );
                })}
            </RigidBody>
        </>
    );
};