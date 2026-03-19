import * as THREE from 'three';

export class LODManager {
    private static instance: LODManager;
    // Radikal verschärft für CPU-Heat-Fix (Distanzen halbiert)
    // LOD 0: < 2m (Ultra-Close)
    // LOD 1: 2-6m  
    // LOD 2: 6-15m
    // LOD 3: 15-40m
    // LOD 4: > 40m (Box/Impostor)
    private lodThresholds = [2, 6, 15, 40];

    public static getInstance(): LODManager {
        if (!LODManager.instance) {
            LODManager.instance = new LODManager();
        }
        return LODManager.instance;
    }

    public getLODLevel(distance: number): number {
        if (distance < this.lodThresholds[0]) return 0;
        if (distance < this.lodThresholds[1]) return 1;
        if (distance < this.lodThresholds[2]) return 2;
        if (distance < this.lodThresholds[3]) return 3;
        return 4;
    }

    public calculateDistance(pos1: [number, number, number], cameraPos: THREE.Vector3): number {
        const dx = pos1[0] - cameraPos.x;
        const dy = pos1[1] - cameraPos.y;
        const dz = pos1[2] - cameraPos.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

export const lodManager = LODManager.getInstance();
