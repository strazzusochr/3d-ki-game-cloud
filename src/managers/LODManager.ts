import * as THREE from 'three';

export class LODManager {
    private static instance: LODManager;
    // Aggressivere Verteilung für 60 FPS Cloud-Streaming
    // LOD 0: < 4m (Ultra-Close)
    // LOD 1: 4-12m  
    // LOD 2: 12-30m
    // LOD 3: 30-70m
    // LOD 4: > 70m (Box/Impostor)
    private lodThresholds = [4, 12, 30, 70];

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
