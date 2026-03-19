/**
 * 🔥 VISUAL EFFECTS — 24H MASTER PLAN
 * 
 * Alle visuellen Effekte die zeitgesteuert erscheinen:
 * - 13:00: Wasserstrahl (blau)
 * - 13:30: Tränengas-Wolken (weiß)
 * - 19:30: Bengalos (rot leuchtend)
 * - 20:00: Brennende Autos (orange Feuer)
 * - 20:30: Scharfschützen-Laser (rot)
 * - 21:00: Muzzle-Flashes (weiß blitzend)
 * - Straßenlaternen (an bei Nacht, aus bei Tag)
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../../../stores/gameStore';

// === BENGALO EFFECT (19:30) ===
const BengaloEffect = ({ position, active }: { position: [number, number, number]; active: boolean }) => {
    const ref = useRef<THREE.PointLight>(null);
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!active || !ref.current || !meshRef.current) return;
        const flicker = 0.7 + Math.sin(clock.elapsedTime * 15) * 0.3;
        ref.current.intensity = 8 * flicker;
        meshRef.current.scale.setScalar(0.3 + Math.sin(clock.elapsedTime * 8) * 0.1);
    });

    if (!active) return null;
    return (
        <group position={position}>
            <pointLight ref={ref} color="#ff2200" intensity={8} distance={25} decay={2} />
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.9} />
            </mesh>
            {/* Smoke column */}
            <mesh position={[0, 2, 0]}>
                <cylinderGeometry args={[0.5, 0.1, 4, 8]} />
                <meshBasicMaterial color="#666666" transparent opacity={0.3} />
            </mesh>
        </group>
    );
};

// === FIRE EFFECT (20:00 brennende Autos) ===
const FireEffect = ({ position, active }: { position: [number, number, number]; active: boolean }) => {
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(({ clock }) => {
        if (!active || !lightRef.current) return;
        const flicker = 0.5 + Math.sin(clock.elapsedTime * 12) * 0.3 + Math.sin(clock.elapsedTime * 7) * 0.2;
        lightRef.current.intensity = 12 * flicker;
    });

    if (!active) return null;
    return (
        <group position={position}>
            <pointLight ref={lightRef} color="#ff6600" intensity={12} distance={30} decay={2} />
            {/* Fire glow */}
            <mesh position={[0, 1.5, 0]}>
                <sphereGeometry args={[1.2, 8, 8]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.4} />
            </mesh>
            {/* Smoke */}
            <mesh position={[0, 4, 0]}>
                <sphereGeometry args={[2, 8, 8]} />
                <meshBasicMaterial color="#333333" transparent opacity={0.25} />
            </mesh>
        </group>
    );
};

// === TEAR GAS CLOUDS (13:30) ===
const TearGasCloud = ({ position, active }: { position: [number, number, number]; active: boolean }) => {
    const ref = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!active || !ref.current) return;
        const t = clock.elapsedTime;
        ref.current.scale.set(
            3 + Math.sin(t * 0.5) * 0.5,
            1.5 + Math.sin(t * 0.7) * 0.3,
            3 + Math.cos(t * 0.3) * 0.5
        );
        (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 0.4) * 0.05;
    });

    if (!active) return null;
    return (
        <mesh ref={ref} position={[position[0], 1.5, position[2]]}>
            <sphereGeometry args={[3, 12, 12]} />
            <meshBasicMaterial color="#ccddcc" transparent opacity={0.25} depthWrite={false} />
        </mesh>
    );
};

// === WATER CANNON BEAM (13:00) ===
const WaterCannon = ({ active }: { active: boolean }) => {
    const ref = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!active || !ref.current) return;
        const t = clock.elapsedTime;
        ref.current.rotation.y = Math.sin(t * 0.3) * 0.5; // Schwenkt
    });

    if (!active) return null;
    return (
        <group position={[0, 2, 50]} rotation={[0, Math.PI, 0]}>
            <mesh ref={ref}>
                <cylinderGeometry args={[0.15, 0.08, 40, 8]} />
                <meshBasicMaterial color="#4488ff" transparent opacity={0.5} />
            </mesh>
        </group>
    );
};

// === SNIPER LASER (20:30 SEK) ===
const SniperLaser = ({ from, to, active }: { from: [number, number, number]; to: [number, number, number]; active: boolean }) => {
    if (!active) return null;
    const dir = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
    const len = dir.length();
    const mid = new THREE.Vector3(...from).add(dir.multiplyScalar(0.5));

    return (
        <mesh position={[mid.x, mid.y, mid.z]} rotation={[0, 0, Math.atan2(to[1] - from[1], len)]}>
            <boxGeometry args={[0.02, 0.02, len]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.6} />
        </mesh>
    );
};

// === STREET LIGHTS (on at night, off at day) ===
const StreetLights = ({ isNight }: { isNight: boolean }) => {
    const positions: [number, number, number][] = [
        [-40, 6, -40], [-40, 6, 0], [-40, 6, 40],
        [40, 6, -40], [40, 6, 0], [40, 6, 40],
        [0, 6, -50], [0, 6, 50],
        [-20, 6, -50], [20, 6, -50],
        [-20, 6, 80], [20, 6, 80],
    ];

    return (
        <>
            {positions.map((pos, i) => (
                <group key={`lamp-${i}`} position={pos}>
                    {/* Lamp post */}
                    <mesh position={[0, -3, 0]}>
                        <cylinderGeometry args={[0.08, 0.08, 6, 6]} />
                        <meshStandardMaterial color="#444444" metalness={0.8} />
                    </mesh>
                    {/* Lamp head */}
                    <mesh>
                        <sphereGeometry args={[0.25, 8, 8]} />
                        <meshBasicMaterial color={isNight ? '#ffee88' : '#666666'} />
                    </mesh>
                    {/* Light */}
                    {isNight && (
                        <pointLight color="#ffdd66" intensity={3} distance={20} decay={2} />
                    )}
                </group>
            ))}
        </>
    );
};

// === MUZZLE FLASH (21:00 Schusswechsel) ===
const MuzzleFlashes = ({ active }: { active: boolean }) => {
    const refs = useRef<THREE.PointLight[]>([]);

    useFrame(() => {
        if (!active) return;
        refs.current.forEach((light) => {
            if (light) {
                light.intensity = Math.random() > 0.85 ? 15 : 0;
            }
        });
    });

    if (!active) return null;
    const positions: [number, number, number][] = [
        [-5, 2, 5], [3, 2, -2], [-8, 2, 0], [6, 2, 8], [0, 2, -5],
        [-3, 2, 10], [8, 2, -8], [-10, 2, 3]
    ];

    return (
        <>
            {positions.map((pos, i) => (
                <pointLight
                    key={`flash-${i}`}
                    ref={(el) => { if (el) refs.current[i] = el; }}
                    position={pos}
                    color="#ffffff"
                    intensity={0}
                    distance={15}
                    decay={2}
                />
            ))}
        </>
    );
};

// === AAA MEGA DEMO STAGE / BÜHNE (08:05-15:00) ===
// 32m breit, 12m hoch, Speaker-Towers, Fan-Laser, KILL THE BILL, Floor-Spots
const MegaSpeakerTower = ({ position }: { position: [number, number, number] }) => {
    // 3x4 speaker grid = 12 speakers per tower
    const rows = 4;
    const cols = 3;
    const boxW = 0.9;
    const boxH = 0.85;
    const gap = 0.08;
    const totalW = cols * (boxW + gap);
    const totalH = rows * (boxH + gap);
    return (
        <group position={position}>
            {/* Tower frame */}
            <mesh position={[0, totalH / 2, 0]}>
                <boxGeometry args={[totalW + 0.3, totalH + 0.3, 1.2]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Speaker cones */}
            {Array.from({ length: rows * cols }).map((_, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const x = (col - (cols - 1) / 2) * (boxW + gap);
                const y = (row + 0.5) * (boxH + gap);
                const ledColor = ['#0088ff', '#ff00ff', '#00ff88', '#ffaa00'][i % 4];
                return (
                    <group key={`tw-${i}`} position={[x, y, 0.62]}>
                        <mesh>
                            <cylinderGeometry args={[0.32, 0.22, 0.12, 12]} />
                            <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
                        </mesh>
                        <mesh position={[0, 0, 0.01]}>
                            <sphereGeometry args={[0.1, 8, 8]} />
                            <meshStandardMaterial color="#222" metalness={0.8} />
                        </mesh>
                        <mesh position={[0, 0, 0.03]}>
                            <ringGeometry args={[0.28, 0.35, 12]} />
                            <meshBasicMaterial color={ledColor} transparent opacity={0.5} />
                        </mesh>
                    </group>
                );
            })}
            {/* Top glow */}
            <pointLight position={[0, totalH + 0.5, 1.5]} color="#0088ff" intensity={3} distance={12} decay={2} />
        </group>
    );
};

const DemoStage = ({ active, totalMinutes }: { active: boolean; totalMinutes: number }) => {

    if (!active) return null;

    // Zeit-Bereich Check für Banner
    const isHoffmann = totalMinutes >= 660 && totalMinutes < 690; // 11:00-11:30
    const isWeber = totalMinutes >= 690 && totalMinutes < 720;    // 11:30-12:00
    const isUltimatum = totalMinutes >= 720 && totalMinutes < 750; // 12:00-12:30
    const isConcert = totalMinutes >= 1080;                       // 18:00+

    let bannerTitle = 'KILL THE BILL';
    let bannerSub = 'THE ULTIMATE RESISTANCE';
    let bannerColor = '#ff4400';

    if (isHoffmann) {
        bannerTitle = 'DR. MICHAEL HOFFMANN';
        bannerSub = 'REDE: FREIHEIT FÜR WIEN';
        bannerColor = '#00ffcc';
    } else if (isWeber) {
        bannerTitle = 'KARL WEBER';
        bannerSub = 'AKTIVISMUS & WIDERSTAND';
        bannerColor = '#ffaa00';
    } else if (isUltimatum) {
        bannerTitle = 'POLIZEI-ULTIMATUM';
        bannerSub = 'OBERST MARTIN GRUBER';
        bannerColor = '#ff0000';
    } else if (isConcert) {
        bannerTitle = 'CHRISTIAN STRAZZUSO';
        bannerSub = 'LIVE IN CONCERT';
        bannerColor = '#00ccff';
    }

    return (
        <group position={[0, 0, -8]}>
            {/* ═══ MASSIVE PLATFORM (32 x 15m) ═══ */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[32, 1, 15]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Front edge LED strip */}
            <mesh position={[0, 0.1, 7.55]}>
                <boxGeometry args={[32, 0.8, 0.1]} />
                <meshBasicMaterial color="#00ccff" transparent opacity={0.35} />
            </mesh>

            {/* ═══ BACK WALL / BÜHNENKÖRPER (30 x 8m) ═══ */}
            <mesh position={[0, 4, -5]} castShadow>
                <boxGeometry args={[30, 8, 10]} />
                <meshStandardMaterial color="#050505" roughness={0.5} metalness={0.8} />
            </mesh>

            {/* ═══ SCREEN + BANNER ═══ */}
            <mesh position={[0, 6, -0.1]}>
                <planeGeometry args={[28, 6]} />
                <meshStandardMaterial color="#000000" emissive="#111111" />
            </mesh>
            {/* "KILL THE BILL" floating text */}
            <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
                <Text
                    position={[0, 6.5, 0]}
                    fontSize={isConcert ? 2.2 : 3}
                    color={bannerColor}
                    anchorX="center"
                    anchorY="middle"
                >
                    {bannerTitle}
                </Text>
                <Text
                    position={[0, 4.5, 0]}
                    fontSize={0.8}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    {bannerSub}
                </Text>
            </Float>

            {/* ═══ 4 MASSIVE SPEAKER TOWERS ═══ */}
            {/* Left outer */}
            <MegaSpeakerTower position={[-16, 1, 2]} />
            {/* Left inner */}
            <MegaSpeakerTower position={[-13, 1, 3]} />
            {/* Right inner */}
            <MegaSpeakerTower position={[13, 1, 3]} />
            {/* Right outer */}
            <MegaSpeakerTower position={[16, 1, 2]} />

            {/* ═══ TRUSS / LIGHTING RIG ═══ */}
            {/* Horizontal truss bar */}
            <mesh position={[0, 12, 2]}>
                <boxGeometry args={[34, 0.3, 0.3]} />
                <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Left truss pillar */}
            <mesh position={[-16, 6.5, 2]}>
                <cylinderGeometry args={[0.12, 0.12, 11, 6]} />
                <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Right truss pillar */}
            <mesh position={[16, 6.5, 2]}>
                <cylinderGeometry args={[0.12, 0.12, 11, 6]} />
                <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
            </mesh>

            {/* ═══ BRIGHT STAGE LIGHTING (keine Laser) ═══ */}
            {/* 4 massive white spotlights from truss - illuminate the stage */}
            <pointLight position={[-10, 11, 4]} color="#fffaf0" intensity={120} distance={30} decay={2} />
            <pointLight position={[-3, 11, 4]} color="#fffaf0" intensity={120} distance={30} decay={2} />
            <pointLight position={[3, 11, 4]} color="#fffaf0" intensity={120} distance={30} decay={2} />
            <pointLight position={[10, 11, 4]} color="#fffaf0" intensity={120} distance={30} decay={2} />

            {/* 6 warm downlights across the stage */}
            {[-10, -6, -2, 2, 6, 10].map((x, i) => (
                <pointLight key={`dl-${i}`} position={[x, 8, 0]} color="#fff5e0" intensity={40} distance={20} decay={2} />
            ))}

            {/* Front edge wash lights */}
            <pointLight position={[-8, 2, 6]} color="#ffffff" intensity={15} distance={15} decay={2} />
            <pointLight position={[0, 2, 6]} color="#ffffff" intensity={15} distance={15} decay={2} />
            <pointLight position={[8, 2, 6]} color="#ffffff" intensity={15} distance={15} decay={2} />

            {/* ═══ STAGE AMBIENT ═══ */}
            <pointLight position={[0, 8, 0]} color="#ffffff" intensity={5} distance={30} decay={2} />
        </group>
    );
};


// === BARRICADE MESHES (20:00) ===
const Barricades = ({ active }: { active: boolean }) => {
    if (!active) return null;
    const positions: { pos: [number, number, number]; rot: number }[] = [
        { pos: [-15, 0.5, 30], rot: 0.3 },
        { pos: [15, 0.5, 25], rot: -0.2 },
        { pos: [0, 0.5, 35], rot: 0.1 },
        { pos: [-8, 0.5, 28], rot: 0.6 },
        { pos: [10, 0.5, 32], rot: -0.4 },
    ];

    return (
        <>
            {positions.map((b, i) => (
                <group key={`barr-${i}`} position={b.pos} rotation={[0, b.rot, 0]}>
                    {/* Overturned car / container */}
                    <mesh>
                        <boxGeometry args={[3, 1, 1.5]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} />
                    </mesh>
                    {/* Debris on top */}
                    <mesh position={[0, 0.7, 0]}>
                        <boxGeometry args={[1.5, 0.4, 0.8]} />
                        <meshStandardMaterial color="#8b4513" roughness={1} />
                    </mesh>
                </group>
            ))}
        </>
    );
};

// === 30 SCHWEDENFEUER (18:00-08:00) ===
// Park: 85×85m, 5×6 Raster, 12m Lichtradius → 187% Abdeckung
const Schwedenfeuer = ({ position }: { position: [number, number, number] }) => {
    // Refs für die Flammen der 3 Logs
    const flame1Ref = useRef<THREE.Mesh>(null);
    const flame2Ref = useRef<THREE.Mesh>(null);
    const flame3Ref = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    // Random seed für unterschiedliches Flackern
    const seed = useMemo(() => Math.random() * 100, []);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime * 2 + seed;

        // Asymmetrisches Flackern pro Flamme
        if (flame1Ref.current) {
            flame1Ref.current.scale.y = 1 + Math.sin(t * 8) * 0.2 + Math.sin(t * 13) * 0.1;
            flame1Ref.current.scale.x = 1 + Math.sin(t * 6) * 0.1;
        }
        if (flame2Ref.current) {
            flame2Ref.current.scale.y = 1 + Math.cos(t * 9) * 0.25;
            flame2Ref.current.scale.x = 1 + Math.sin(t * 7) * 0.15;
            flame2Ref.current.position.x = 0.15 + Math.sin(t * 5) * 0.05; // züngelt seitlich
        }
        if (flame3Ref.current) {
            flame3Ref.current.scale.y = 1 + Math.sin(t * 11) * 0.3;
            flame3Ref.current.scale.z = 1 + Math.cos(t * 4) * 0.1;
        }

        // Licht-Intensität flackert organisch
        if (lightRef.current) {
            lightRef.current.intensity = 60 + Math.sin(t * 5) * 15 + Math.sin(t * 8.5) * 10;
        }
    });

    // Sub-Komponente für einen einzelnen Stamm
    const FireLog = ({ pos, rot, h, r, flameRef, flameOffX = 0 }: any) => (
        <group position={pos} rotation={rot}>
            {/* Stamm-Basis */}
            <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[r * 0.9, r, h, 7]} />
                <meshStandardMaterial color="#4a2a10" roughness={1} />
            </mesh>

            {/* Glühender oberer Teil (Emissive) */}
            <mesh position={[0, h - 0.1, 0]}>
                <cylinderGeometry args={[r * 0.85, r * 0.9, 0.25, 7]} />
                <meshStandardMaterial color="#882200" emissive="#ff3300" emissiveIntensity={2} roughness={0.8} />
            </mesh>

            {/* Kreuzschnitt Spalten */}
            <mesh position={[0, h, 0]}>
                <boxGeometry args={[r * 1.8, 0.4, 0.04]} />
                <meshStandardMaterial color="#220a00" roughness={1} />
            </mesh>
            <mesh position={[0, h, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[r * 1.8, 0.4, 0.04]} />
                <meshStandardMaterial color="#220a00" roughness={1} />
            </mesh>

            {/* Animierte Flamme züngelt aus dem Schnitt/zur Seite */}
            <mesh ref={flameRef} position={[flameOffX, h + 0.2, 0]}>
                <coneGeometry args={[r * 0.8, r * 3, 6]} />
                <meshBasicMaterial color="#ff8800" transparent opacity={0.8} />
            </mesh>
            <mesh position={[flameOffX * 0.5, h + 0.1, 0]}>
                <sphereGeometry args={[r * 0.6, 6, 6]} />
                <meshBasicMaterial color="#ffcc33" transparent opacity={0.9} />
            </mesh>
        </group>
    );

    return (
        <group position={position}>
            {/* Cluster aus 3 unterschiedlich hohen/dicken Logs */}
            {/* Log 1: Groß, gerade */}
            <FireLog pos={[-0.1, 0, -0.1]} rot={[0, 0.4, 0]} h={1.3} r={0.16} flameRef={flame1Ref} />

            {/* Log 2: Mittel, leicht schief */}
            <FireLog pos={[0.18, 0, 0.05]} rot={[0, -0.2, 0.05]} h={0.9} r={0.13} flameRef={flame2Ref} flameOffX={0.15} />

            {/* Log 3: Klein, davor */}
            <FireLog pos={[-0.05, 0, 0.2]} rot={[-0.08, 0, -0.05]} h={0.6} r={0.11} flameRef={flame3Ref} />

            {/* Warmes Licht entfernt — Verhindert 90°C Überhitzung (Lichtwurf deaktiviert) */}
        </group>
    );
};

// 30 Positionen: 5 Spalten × 6 Reihen, organischer Versatz
const SCHWEDENFEUER_POSITIONS: [number, number, number][] = [
    // Reihe 1 (z=-35) — Süd
    [-32, 0, -35], [-16, 0, -35], [0, 0, -35], [16, 0, -35], [32, 0, -35],
    // Reihe 2 (z=-21)
    [-30, 0, -21], [-14, 0, -21], [2, 0, -21], [18, 0, -21], [34, 0, -21],
    // Reihe 3 (z=-7) — Bühne-Zone: Mitte ausgespart, seitlich verschoben
    [-34, 0, -7], [-18, 0, -7], [18, 0, -7], [34, 0, -7], [-8, 0, -3],
    // Reihe 4 (z=+7)
    [-32, 0, 7], [-15, 0, 7], [0, 0, 9], [15, 0, 7], [32, 0, 7],
    // Reihe 5 (z=+21)
    [-30, 0, 21], [-14, 0, 21], [2, 0, 21], [18, 0, 21], [34, 0, 21],
    // Reihe 6 (z=+35) — Nord
    [-32, 0, 35], [-16, 0, 35], [0, 0, 35], [16, 0, 35], [32, 0, 35],
];

const SchwedenfeuerGrid = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
        <>
            {SCHWEDENFEUER_POSITIONS.map((pos, i) => (
                <Schwedenfeuer key={`sf-${i}`} position={pos} />
            ))}
        </>
    );
};

// ═══════════════════════════════════════════════
// ═══ MAIN VISUAL EFFECTS COMPONENT            ═══
// ═══════════════════════════════════════════════
export const VisualEffects = () => {
    const inGameTime = useGameStore((state: any) => state.gameState.inGameTime);

    const [h] = inGameTime.split(':').map(Number);
    const totalMinutes = h * 60 + (parseInt(inGameTime.split(':')[1]) || 0);
    const isNight = h >= 20 || h < 6;

    // Time checks
    const waterCannonActive = totalMinutes >= 780 && totalMinutes < 810;    // 13:00-13:30
    const tearGasActive = totalMinutes >= 810 && totalMinutes < 870;        // 13:30-14:30
    const bengalosActive = totalMinutes >= 1170 && totalMinutes < 1290;     // 19:30-21:30
    const firesActive = totalMinutes >= 1200 && totalMinutes < 1380;        // 20:00-23:00
    const barricadesActive = totalMinutes >= 1200;                          // 20:00+
    const sniperLaserActive = totalMinutes >= 1230 && totalMinutes < 1320;  // 20:30-22:00
    const muzzleFlashActive = totalMinutes >= 1260 && totalMinutes < 1320;  // 21:00-22:00
    const stageActive = totalMinutes >= 485 || totalMinutes < 180;          // 08:05-03:00 (nächster Tag)
    const schwedenfeuerActive = h >= 18 || h < 8;                           // 18:00-08:00

    // Bengalo positions
    const bengaloPositions: [number, number, number][] = useMemo(() => [
        [-8, 0.5, 5], [8, 0.5, 5], [-4, 0.5, 10], [4, 0.5, 10],
        [-12, 0.5, 8], [12, 0.5, 8], [0, 0.5, 3], [-6, 0.5, 15],
        [6, 0.5, 15], [-10, 0.5, 12], [10, 0.5, 12], [0, 0.5, 18],
    ], []);

    // Tear gas positions
    const tearGasPositions: [number, number, number][] = useMemo(() => [
        [-5, 0, 15], [5, 0, 15], [0, 0, 20], [-10, 0, 18],
        [10, 0, 18], [-3, 0, 25], [3, 0, 25], [0, 0, 12],
        [-8, 0, 22], [8, 0, 22],
    ], []);

    // Fire positions (brennende Autos & Mülleimer)
    const firePositions: [number, number, number][] = useMemo(() => [
        [-15, 0, 35], [18, 0, 30], [-20, 0, 20], [25, 0, 15],
        [0, 0, 40],
    ], []);

    return (
        <>
            {/* Demo-Bühne 08:05-15:00 */}
            <DemoStage active={stageActive} totalMinutes={totalMinutes} />

            {/* 30 Schwedenfeuer 18:00-08:00 */}
            <SchwedenfeuerGrid active={schwedenfeuerActive} />

            {/* Straßenlaternen */}
            <StreetLights isNight={isNight} />

            {/* Wasserwerfer-Strahl 13:00 */}
            <WaterCannon active={waterCannonActive} />

            {/* Tränengas-Wolken 13:30 */}
            {tearGasPositions.map((pos, i) => (
                <TearGasCloud key={`gas-${i}`} position={pos} active={tearGasActive} />
            ))}

            {/* Bengalos 19:30 — ROT */}
            {bengaloPositions.map((pos, i) => (
                <BengaloEffect key={`beng-${i}`} position={pos} active={bengalosActive} />
            ))}

            {/* Brennende Autos/Objekte 20:00 */}
            {firePositions.map((pos, i) => (
                <FireEffect key={`fire-${i}`} position={pos} active={firesActive} />
            ))}

            {/* Barrikaden 20:00 */}
            <Barricades active={barricadesActive} />

            {/* Scharfschützen-Laser 20:30 */}
            <SniperLaser
                from={[50, 15, 60]}
                to={[0, 1.5, 0]}
                active={sniperLaserActive}
            />
            <SniperLaser
                from={[-50, 15, 60]}
                to={[5, 1.5, 5]}
                active={sniperLaserActive}
            />

            {/* Muzzle Flashes 21:00 */}
            <MuzzleFlashes active={muzzleFlashActive} />

            {/* 🎥 POST-PROCESSING (AAA-STABILITÄT) */}
            <EffectComposer>
                <Bloom 
                    intensity={1.0} 
                    luminanceThreshold={0.9} 
                    luminanceSmoothing={0.025} 
                    mipmapBlur 
                />
                <Vignette offset={0.1} darkness={1.1} />
            </EffectComposer>
        </>
    );
};
