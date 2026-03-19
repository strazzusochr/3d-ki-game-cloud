import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
    BASE_GROUND_HEIGHT,
    PARK_HEIGHT,
    SIDEWALK_HEIGHT,
    STREET_HEIGHT,
    getGroundHeightAt,
    getGroundNormalAt,
    isPointInsideBuilding,
    isPointInsidePark,
    isPointOnSidewalk,
    isPointOnStreet,
    resolveWalkablePosition,
} from '../components/3d/environment/cityLayout';

describe('player physics layout helpers', () => {
    it('detects the park center as walkable park ground', () => {
        expect(isPointInsidePark(0, 0)).toBe(true);
        expect(getGroundHeightAt(0, 0)).toBe(PARK_HEIGHT);
    });

    it('detects street strips outside the park center', () => {
        expect(isPointOnStreet(-50, 0)).toBe(true);
        expect(getGroundHeightAt(-50, 0)).toBe(STREET_HEIGHT);
    });

    it('falls back to base terrain away from streets and park', () => {
        expect(isPointInsidePark(340, 340)).toBe(false);
        expect(isPointOnStreet(340, 340)).toBe(false);
        expect(getGroundHeightAt(340, 340)).toBe(BASE_GROUND_HEIGHT);
    });

    it('detects sidewalks around buildings', () => {
        expect(isPointOnSidewalk(-260, -275)).toBe(true);
        expect(getGroundHeightAt(-260, -275)).toBe(SIDEWALK_HEIGHT);
    });

    it('detects building footprints as blocked', () => {
        expect(isPointInsideBuilding(-225, -275)).toBe(true);
        expect(isPointInsideBuilding(0, 0)).toBe(false);
    });

    it('resolves collisions by sliding or stopping outside buildings', () => {
        const previous = new THREE.Vector3(-245, 0, -275);
        const target = new THREE.Vector3(-225, 0, -275);
        const resolved = resolveWalkablePosition(previous, target, 0.45);

        expect(isPointInsideBuilding(resolved.x, resolved.z, 0.45)).toBe(false);
        expect(resolved.x).toBe(previous.x);
    });

    it('returns an upward-facing normal on flat park ground', () => {
        const normal = getGroundNormalAt(0, 0);

        expect(normal.y).toBeGreaterThan(0.99);
        expect(normal.length()).toBeCloseTo(1, 5);
    });

    it('returns a normalized normal near terrain edges', () => {
        const normal = getGroundNormalAt(42.5, 0);

        expect(normal.y).toBeGreaterThan(0.7);
        expect(normal.length()).toBeCloseTo(1, 5);
    });
});