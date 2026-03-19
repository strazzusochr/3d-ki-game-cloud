import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import * as BufferGeometryUtils from 'three-stdlib';

/**
 * Erstellt eine gemergte BufferGeometry eines Humanoiden für InstancedMesh.
 * Kopf, Torso, Gliedmaßen werden zu einem Mesh kombiniert.
 */
export function createMergedHumanoidGeometry(lodLevel: number = 0): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Kopf
  const headGeo = new THREE.SphereGeometry(0.12, lodLevel === 0 ? 32 : 12, lodLevel === 0 ? 32 : 12);
  headGeo.translate(0, 0.75, 0);
  geometries.push(headGeo);

  // Torso (V-Shape für AAA-Look)
  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.7, lodLevel === 0 ? 16 : 8);
  torsoGeo.translate(0, 0.35, 0);
  geometries.push(torsoGeo);

  // Arme
  const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.65, lodLevel === 0 ? 12 : 6);
  
  const lArm = armGeo.clone();
  lArm.translate(-0.25, 0.4, 0);
  lArm.rotateZ(0.1);
  geometries.push(lArm);

  const rArm = armGeo.clone();
  rArm.translate(0.25, 0.4, 0);
  rArm.rotateZ(-0.1);
  geometries.push(rArm);

  // Beine
  const legGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.8, lodLevel === 0 ? 12 : 6);

  const lLeg = legGeo.clone();
  lLeg.translate(-0.1, -0.35, 0);
  geometries.push(lLeg);

  const rLeg = legGeo.clone();
  rLeg.translate(0.1, -0.35, 0);
  geometries.push(rLeg);

  // Mergen der Einzelteile zu einer Geometrie für Instancing
  // @ts-ignore - BufferGeometryUtils aus three-stdlib Export-Handling
  const merged = BufferGeometryUtils.mergeGeometries(geometries);
  
  // Ressourcen der Einzel-Geos freigeben
  geometries.forEach(g => g.dispose());

  return merged;
}

/**
 * Erstellt ein prozedurales High-Poly Mesh für NPCs.
 * Ziel: 200.000+ Polygone für LOD-0.
 */
export function createHighPolyHumanMesh(lodLevel: number = 0): THREE.BufferGeometry {
  // Grundgeometrie (Box-Model für effiziente Subdiv)
  const boxGeo = new THREE.BoxGeometry(0.4, 1.8, 0.2, 4, 18, 2);
  
  // LOD-Level Bestimmung der Subdivisions
  let iterations = 0;
  switch(lodLevel) {
    case 0: iterations = 4; break; // Realistisch: 4 für High-AAA
    case 1: iterations = 3; break; 
    case 2: iterations = 2; break; 
    case 3: iterations = 1; break; 
    default: iterations = 0;      
  }

  let finalGeo: THREE.BufferGeometry;
  
  if (iterations > 0) {
    finalGeo = LoopSubdivision.modify(boxGeo, iterations, {
      split: false,
      uvSmooth: true,
      preserveEdges: false,
      flatOnly: false,
      maxTriangles: 500000
    });
  } else {
    finalGeo = boxGeo;
  }

  return finalGeo;
}
