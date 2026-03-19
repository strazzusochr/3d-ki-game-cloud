import * as THREE from 'three';

export const BASE_GROUND_HEIGHT = -0.2;
export const STREET_HEIGHT = -0.05;
export const PARK_HEIGHT = 0.05;
export const SIDEWALK_HEIGHT = 0.1;

export const PARK_HALF_EXTENT = 42.5;
export const CENTER_CARVE_HALF_EXTENT = 45;
export const BUILDING_GRID_COLS = 12;
export const BUILDING_SPACING = 50;
export const BUILDING_WIDTH = 25;
export const BUILDING_DEPTH = 25;
export const SIDEWALK_MARGIN = 4;

export interface BuildingLot {
    id: number;
    x: number;
    z: number;
    width: number;
    depth: number;
}

const pseudoRandomFromId = (id: number) => {
    const seed = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
    return seed - Math.floor(seed);
};

export interface StreetSegment {
    id: string;
    x: number;
    z: number;
    width: number;
    depth: number;
}

export const BUILDING_LOTS: BuildingLot[] = [...Array(144)]
    .map((_, index) => {
        const x = ((index % BUILDING_GRID_COLS) - (BUILDING_GRID_COLS / 2 - 0.5)) * BUILDING_SPACING;
        const z = (Math.floor(index / BUILDING_GRID_COLS) - (BUILDING_GRID_COLS / 2 - 0.5)) * BUILDING_SPACING;

        if (Math.abs(x) < CENTER_CARVE_HALF_EXTENT && Math.abs(z) < CENTER_CARVE_HALF_EXTENT) {
            return null;
        }

        return {
            id: index,
            x,
            z,
            width: BUILDING_WIDTH,
            depth: BUILDING_DEPTH,
        } satisfies BuildingLot;
    })
    .filter((lot): lot is BuildingLot => lot !== null);

export const getBuildingHeight = (lot: BuildingLot) => {
    return 15 + (Math.abs(lot.x) + Math.abs(lot.z)) * 0.05 + pseudoRandomFromId(lot.id) * 15;
};

export const STREET_SEGMENTS: StreetSegment[] = (() => {
    const segments: StreetSegment[] = [];
    const totalSize = 600;

    for (let x = -300; x <= 300; x += BUILDING_SPACING) {
        if (Math.abs(x) < 40) continue;
        segments.push({ id: `v-${x}`, x, z: 0, width: 15, depth: totalSize });
    }

    for (let z = -300; z <= 300; z += BUILDING_SPACING) {
        if (Math.abs(z) < 40) continue;
        segments.push({ id: `h-${z}`, x: 0, z, width: totalSize, depth: 15 });
    }

    return segments;
})();

const isInsideRect = (x: number, z: number, centerX: number, centerZ: number, width: number, depth: number) => {
    return Math.abs(x - centerX) <= width / 2 && Math.abs(z - centerZ) <= depth / 2;
};

export const isPointInsidePark = (x: number, z: number) => {
    return Math.abs(x) <= PARK_HALF_EXTENT && Math.abs(z) <= PARK_HALF_EXTENT;
};

export const isPointOnStreet = (x: number, z: number) => {
    return STREET_SEGMENTS.some((segment) => isInsideRect(x, z, segment.x, segment.z, segment.width, segment.depth));
};

export const isPointInsideBuilding = (x: number, z: number, padding = 0) => {
    return BUILDING_LOTS.some((lot) =>
        isInsideRect(x, z, lot.x, lot.z, lot.width + padding * 2, lot.depth + padding * 2)
    );
};

export const isPointOnSidewalk = (x: number, z: number) => {
    return BUILDING_LOTS.some((lot) => {
        const insideExpanded = isInsideRect(
            x,
            z,
            lot.x,
            lot.z,
            lot.width + SIDEWALK_MARGIN * 2,
            lot.depth + SIDEWALK_MARGIN * 2,
        );
        const insideBuilding = isInsideRect(x, z, lot.x, lot.z, lot.width, lot.depth);
        return insideExpanded && !insideBuilding;
    });
};

export const getGroundHeightAt = (x: number, z: number) => {
    if (isPointInsidePark(x, z)) {
        return PARK_HEIGHT;
    }

    if (isPointOnSidewalk(x, z)) {
        return SIDEWALK_HEIGHT;
    }

    if (isPointOnStreet(x, z)) {
        return STREET_HEIGHT;
    }

    return BASE_GROUND_HEIGHT;
};

export const getGroundNormalAt = (x: number, z: number, sampleDistance = 0.35) => {
    const left = getGroundHeightAt(x - sampleDistance, z);
    const right = getGroundHeightAt(x + sampleDistance, z);
    const down = getGroundHeightAt(x, z - sampleDistance);
    const up = getGroundHeightAt(x, z + sampleDistance);

    return new THREE.Vector3(left - right, sampleDistance * 2, down - up).normalize();
};

export const resolveWalkablePosition = (
    previous: THREE.Vector3,
    target: THREE.Vector3,
    radius = 0.45,
) => {
    if (!isPointInsideBuilding(target.x, target.z, radius)) {
        return target;
    }

    const slideX = target.clone();
    slideX.z = previous.z;
    if (!isPointInsideBuilding(slideX.x, slideX.z, radius)) {
        return slideX;
    }

    const slideZ = target.clone();
    slideZ.x = previous.x;
    if (!isPointInsideBuilding(slideZ.x, slideZ.z, radius)) {
        return slideZ;
    }

    return previous.clone();
};