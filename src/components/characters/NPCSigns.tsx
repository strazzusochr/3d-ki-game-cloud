import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useGameStore } from '../../stores/gameStore';
import { workerManager } from '../../managers/WorkerManager';
import { NPCBehavior, NPCType } from '../../types/enums';

export const NPCSigns = () => {
    const stickRef = useRef<THREE.InstancedMesh>(null);
    const boardRef = useRef<THREE.InstancedMesh>(null);
    
    // Wir nutzen ein temporäres Objekt für die Matrix-Updates
    const temp = useMemo(() => new THREE.Object3D(), []);
    
    // Eine versteckte Matrix für Schilder, die wir gerade nicht brauchen
    const hidden = useMemo(() => {
        const o = new THREE.Object3D();
        o.position.set(0, -1000, 0);
        o.scale.set(0, 0, 0);
        o.updateMatrix();
        return o.matrix.clone();
    }, []);

    // Geometrie für den Holzstab (doppelt so lang: 3.2m, etwas dicker)
    const stickGeo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), []);
    const stickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 }), []);

    // Geometrie für das Pappschild (doppelt so groß)
    const boardGeo = useMemo(() => new THREE.BoxGeometry(2.4, 1.4, 0.05), []);
    const boardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 1 }), []);

    const MAX_SIGNS = 200;

    useFrame(() => {
        if (!stickRef.current || !boardRef.current) return;
        const npcs = useGameStore.getState().npcs;
        const buffer = workerManager.latestNPCBuffer;
        
        let signIndex = 0;

        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            
            const isKrause = npc.type === NPCType.KRAUSE;
            // 25% der KRAUSE-NPCs sortieren wir komplett aus (bekommen nie ein Schild)
            if (isKrause && npc.id % 4 === 0) continue;

            // Schild-Bedingung: Organizer haben es immer. Alle anderen (Demos, Krause) NUR, wenn sie HOLD_SIGN als Behavior haben!
            if (npc.type === NPCType.ORGANIZER || npc.behavior === NPCBehavior.HOLD_SIGN) {
                if (signIndex >= MAX_SIGNS) break;

                let x = npc.position[0];
                let z = npc.position[2];
                let rotY = 0;
                
                // Positionen und Rotation aus dem Worker-Buffer lesen
                if (buffer && buffer.length > i * 12 + 6) {
                    x = buffer[i * 12 + 2];
                    z = buffer[i * 12 + 4];
                    rotY = buffer[i * 12 + 6]; 
                }

                // 1. STAB (in der Hand des NPCs, leicht versetzt)
                temp.position.set(x + 0.4, 1.9, z); // x+0.4, y=1.9 (höher, da Stab 3.2m lang)
                temp.rotation.set(0, rotY, 0);
                temp.scale.set(1, 1, 1);
                temp.updateMatrix();
                stickRef.current.setMatrixAt(signIndex, temp.matrix);

                // 2. SCHILD (oben am Stab)
                temp.position.set(x + 0.4, 3.5, z); // y=3.5 (über dem Kopf, am oberen Drittel des Stabs)
                // Schild soll den Text zeigen, also richten wir es passend zur Laufrichtung aus
                temp.rotation.set(0, rotY, 0);
                temp.updateMatrix();
                boardRef.current.setMatrixAt(signIndex, temp.matrix);

                signIndex++;
            }
        }

        // Verstecke die restlichen Instanzen, die gerade nicht gebraucht werden
        for (let i = signIndex; i < MAX_SIGNS; i++) {
            stickRef.current.setMatrixAt(i, hidden);
            boardRef.current.setMatrixAt(i, hidden);
        }

        stickRef.current.instanceMatrix.needsUpdate = true;
        boardRef.current.instanceMatrix.needsUpdate = true;
        stickRef.current.count = signIndex;
        boardRef.current.count = signIndex;
    });

    // Wir brauchen Text auf den Schildern. Da Text (Drei) nicht so einfach instanziiert 
    // werden kann wie Meshes, rendern wir den Text für die sichtbaren Schilder als normale Komponenten,
    // hängen sie aber an die berechneten Positionen (die wir aus dem store/buffer holen).
    const npcs = useGameStore(state => state.npcs);
    const signNpcs = npcs.filter(n => {
        const isKrause = n.type === NPCType.KRAUSE;
        if (isKrause && n.id % 4 === 0) return false; // 25% der Krause rausfiltern
        
        return n.type === NPCType.ORGANIZER || n.behavior === NPCBehavior.HOLD_SIGN;
    });
    const buffer = workerManager.latestNPCBuffer;

    return (
        <>
            <instancedMesh ref={stickRef} args={[stickGeo, stickMat, MAX_SIGNS]} castShadow />
            <instancedMesh ref={boardRef} args={[boardGeo, boardMat, MAX_SIGNS]} castShadow />
            
            {/* Rendere den Text "FREIHEIT STATT ANGST" klassisch (da Instancing von Text sehr hart ist) */}
            {signNpcs.slice(0, MAX_SIGNS).map((npc) => {
                // Wir müssen den Index des NPCs im Original-Array finden, um an den Buffer ranzukommen
                const originalIndex = npcs.findIndex(n => n.id === npc.id);
                if (originalIndex === -1) return null;

                let x = npc.position[0];
                let z = npc.position[2];
                let rotY = 0;
                
                if (buffer && buffer.length > originalIndex * 12 + 6) {
                    x = buffer[originalIndex * 12 + 2];
                    z = buffer[originalIndex * 12 + 4];
                    rotY = buffer[originalIndex * 12 + 6]; 
                }

                // Alle Schriften sollen schwarz sein
                const isKrause = npc.type === NPCType.KRAUSE;
                const signText = isKrause ? "mRNA CORONA 💉\nBIOWEAPON" : "FREIHEIT\nSTATT ANGST";
                const signColor = "#111"; // Tiefschwarz für beide

                return (
                    <group key={`sign-text-${npc.id}`} position={[x + 0.4, 3.5, z]} rotation={[0, rotY, 0]}>
                        {/* Vorne */}
                        <Text
                            position={[0, 0, 0.026]}
                            fontSize={0.3}
                            color={signColor}
                            outlineWidth={0.01}
                            outlineColor="#fff"
                            anchorX="center"
                            anchorY="middle"
                            depthOffset={2} // Verhindert Verschwinden der Schrift beim reinzoomen!
                        >
                            {signText}
                        </Text>
                        {/* Hinten, gespiegelt gedreht */}
                        <Text
                            position={[0, 0, -0.026]}
                            rotation={[0, Math.PI, 0]}
                            fontSize={0.3}
                            color={signColor}
                            outlineWidth={0.01}
                            outlineColor="#fff"
                            anchorX="center"
                            anchorY="middle"
                            depthOffset={2}
                        >
                            {signText}
                        </Text>
                    </group>
                );
            })}
        </>
    );
};
