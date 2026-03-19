import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { workerManager } from '../../managers/WorkerManager';
import { lodManager as lodManagerInstance } from '../../managers/LODManager';
import { NPC_COLORS } from '../../systems/eventScheduler';
import { createMergedHumanoidGeometry } from '../../meshes/ProceduralHumanMesh';

/**
 * InstancedHumanoid V4.1 — PERFORMANCE-OVERDRIVE (60 FPS CLOUD FIX)
 */

const COLOR_CACHE: Record<string, THREE.Color> = {};
Object.entries(NPC_COLORS).forEach(([type, hex]) => {
    COLOR_CACHE[type] = new THREE.Color(hex);
});
const DEFAULT_COLOR = new THREE.Color('#888888');

function createLODGeometry(lod: number): THREE.BufferGeometry {
    // Zurück zum Original-LOD-System: Echte Menschen statt Kapseln!
    return createMergedHumanoidGeometry(lod);
}

const MAX = 150; // Drosselung für CPU-Heat-Fix (vorher 250)
const isRendererGlobal = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderer') === 'true';

export const InstancedHumanoid: React.FC = () => {
    const { camera } = useThree();
    
    const lod0Ref = useRef<THREE.InstancedMesh>(null);
    const lod1Ref = useRef<THREE.InstancedMesh>(null);
    const lod2Ref = useRef<THREE.InstancedMesh>(null);
    const lod3Ref = useRef<THREE.InstancedMesh>(null);
    const lod4Ref = useRef<THREE.InstancedMesh>(null);

    const refs = useMemo(() => [lod0Ref, lod1Ref, lod2Ref, lod3Ref, lod4Ref], []);
    
    const geometries = useMemo(() => [
        createLODGeometry(0),
        createLODGeometry(1),
        createLODGeometry(2),
        createLODGeometry(3),
        createLODGeometry(4),
    ], []);

    const temp = useMemo(() => new THREE.Object3D(), []);
    const hidden = useMemo(() => {
        const o = new THREE.Object3D();
        o.position.set(0, -1000, 0);
        o.scale.set(0, 0, 0);
        o.updateMatrix();
        return o.matrix.clone();
    }, []);

    // Load texture only if not in renderer mode
    const texture = useMemo(() => {
        if (isRendererGlobal) return null;
        const loader = new THREE.TextureLoader();
        return loader.load('/textures/humanoid_texture.png');
    }, []);

    const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: isRendererGlobal ? "#7a7a7a" : "white",
        roughness: isRendererGlobal ? 1 : 0.7,
        metalness: 0,
        map: isRendererGlobal ? null : texture,
    }), [texture]);


    const frameCounter = useRef(0);

    // Initialize instanceColor buffers on mount
    useEffect(() => {
        const white = new THREE.Color(0xffffff);
        refs.forEach((ref) => {
            if (ref.current) {
                for (let i = 0; i < MAX; i++) {
                    ref.current.setColorAt(i, white);
                }
                if (ref.current.instanceColor) {
                    ref.current.instanceColor.needsUpdate = true;
                }
            }
        });
    }, [refs]);

    useFrame(() => {
        if (refs.some(r => !r.current)) return;
        
        frameCounter.current++;
        // 🚀 Cloud-Renderer Update-Rate (alle 60 Frames = absolute CPU Ersparnis)
        const lodUpdateFrequency = isRendererGlobal ? 60 : 3;
        const doUpdate = frameCounter.current % lodUpdateFrequency === 0;
        
        const npcs = useGameStore.getState().npcs;
        const buffer = workerManager.latestNPCBuffer;
        const count = Math.min(npcs.length, MAX);

        const lodCounts = [0, 0, 0, 0, 0];
        let lod0Count = 0;
        let lod1Count = 0;

        for (let i = 0; i < count; i++) {
            const npc = npcs[i];
            let x = npc.position[0], y = 1.35, z = npc.position[2];
            
            if (buffer && buffer.length > i * 12 + 4) {
                x = buffer[i * 12 + 2];
                y = buffer[i * 12 + 3];
                z = buffer[i * 12 + 4];
            }

            let lod: number;
            const distSq = (x - camera.position.x) ** 2 + (y - camera.position.y) ** 2 + (z - camera.position.z) ** 2;
            
            // Auch in der Cloud volle AAA-Qualität für NPCs, wenn nah dran!
            if (doUpdate) {
                lod = lodManagerInstance.getLODLevel(Math.sqrt(distSq));
            } else {
                lod = 2; // Default Standard
            }

            if (!isRendererGlobal) {
                if (lod === 0) lod0Count++;
                if (lod === 1) lod1Count++;
                // Aggressivere Drosselung für CPU-Heat-Fix
                if (lod === 0 && lod0Count > 30) lod = 1;
                if (lod === 1 && lod1Count > 60) lod = 2;
            }
            
            temp.position.set(x, y, z);
            temp.scale.set(1, 1, 1);
            temp.updateMatrix();

            const targetRef = refs[lod].current!;
            const idx = lodCounts[lod];
            targetRef.setMatrixAt(idx, temp.matrix);
            
            const color = COLOR_CACHE[npc.type] || DEFAULT_COLOR;
            targetRef.setColorAt(idx, color);
            
            lodCounts[lod]++;

        }

        // Hide unused instances
        refs.forEach((ref, l) => {
            const mesh = ref.current!;
            for (let i = lodCounts[l]; i < MAX; i++) {
                mesh.setMatrixAt(i, hidden);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.count = lodCounts[l];
        });

    });

    const isRenderer = isRendererGlobal;

    return (
        <>
            <instancedMesh ref={lod0Ref} args={[geometries[0], baseMat, MAX]} castShadow={!isRenderer} receiveShadow={!isRenderer} />
            <instancedMesh ref={lod1Ref} args={[geometries[1], baseMat, MAX]} castShadow={!isRenderer} receiveShadow={!isRenderer} />
            <instancedMesh ref={lod2Ref} args={[geometries[2], baseMat, MAX]} receiveShadow={!isRenderer} />
            <instancedMesh ref={lod3Ref} args={[geometries[3], baseMat, MAX]} receiveShadow={!isRenderer} />
            <instancedMesh ref={lod4Ref} args={[geometries[4], baseMat, MAX]} receiveShadow={!isRenderer} />
        </>
    );
};
