import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import {
    getGroundHeightAt,
    getGroundNormalAt,
} from '../3d/environment/cityLayout';

const GAMEPAD_DEADZONE = 0.15;
const PLAYER_HEIGHT_OFFSET = 1.2;
const JUMP_VELOCITY = 8.5;
const GROUND_CONTACT_EPSILON = 0.08;
const GROUND_ACCELERATION = 42;
const AIR_ACCELERATION = 12;
const GROUND_FRICTION = 16;

const applyDeadzone = (value: number) => {
    if (Math.abs(value) < GAMEPAD_DEADZONE) return 0;
    const sign = Math.sign(value);
    return sign * ((Math.abs(value) - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE));
};

/**
 * Trigger haptic feedback if supported.
 */
function vibrate(gamepad: Gamepad, strongMs = 150, strong = 0.4, weak = 0.2) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const act = (gamepad as any).vibrationActuator;
        if (act?.playEffect) {
            act.playEffect('dual-rumble', {
                startDelay: 0,
                duration: strongMs,
                weakMagnitude: weak,
                strongMagnitude: strong,
            });
        }
    } catch {
        // vibration not supported — silent fallback
    }
}

export const Player = () => {
    const meshRef = useRef<THREE.Group>(null);
    const rigidBodyRef = useRef<RapierRigidBody>(null);
    const [, getKeys] = useKeyboardControls();
    const [position] = useState(new THREE.Vector3(0, getGroundHeightAt(0, 10) + PLAYER_HEIGHT_OFFSET, 10));
    const [rotation, setRotation] = useState({ yaw: 0, pitch: -0.5 });
    const [zoom, setZoom] = useState(8);

    // Gamepad connected state
    const [gamepadConnected, setGamepadConnected] = useState(false);
    const [gamepadName, setGamepadName] = useState('');

    // Store actions for gamepad shortcuts
    const toggleTimePause = useGameStore(s => s.toggleTimePause);
    const advanceHour = useGameStore(s => s.advanceHour);
    const rewindHour = useGameStore(s => s.rewindHour);
    const dismissStatistics = useGameStore(s => s.dismissStatistics);
    const showStatistics = useGameStore(s => s.gameState.showStatistics);
    const activeInteractionId = useGameStore(s => s.interactionState.nearbyZoneId);
    const triggerInteraction = useGameStore(s => s.triggerInteraction);

    // STRG + Pfeiltasten: Kamera-Panning
    const ctrlHeld = useRef(false);
    const arrowKeys = useRef({ up: false, down: false, left: false, right: false });
    const panOffset = useRef(new THREE.Vector3(0, 0, 0));

    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3();
    const sideVector = new THREE.Vector3();
    const targetHorizontalVelocity = new THREE.Vector2();
    const currentHorizontalVelocity = new THREE.Vector2();
    const velocityDelta = new THREE.Vector2();
    const speed = 10;
    const gamepadIndexRef = useRef<number | null>(null);

    // Previous button states for one-shot edge detection (avoid repeated fires while held)
    const prevButtonsRef = useRef<boolean[]>([]);
    const buttonCooldown = useRef<Record<number, number>>({});
    const groundedRef = useRef(true);
    const jumpQueued = useRef(false);
    const interactQueued = useRef(false);

    const wasJustPressed = useCallback((gamepad: Gamepad, index: number): boolean => {
        const now = Date.now();
        const prev = prevButtonsRef.current[index] ?? false;
        const curr = gamepad.buttons[index]?.pressed ?? false;
        if (curr && !prev && (now - (buttonCooldown.current[index] ?? 0)) > 300) {
            buttonCooldown.current[index] = now;
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement || e.buttons === 1) {
                setRotation(r => ({
                    yaw: r.yaw - e.movementX * 0.003,
                    pitch: Math.max(-1.4, Math.min(1.4, r.pitch - e.movementY * 0.003))
                }));
            }
        };
        const handleWheel = (e: WheelEvent) => {
            setZoom(z => Math.max(1, Math.min(200, z + e.deltaY * 0.015)));
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') ctrlHeld.current = true;
            if (e.code === 'Space') jumpQueued.current = true;
            if (e.code === 'KeyE') interactQueued.current = true;
            if (e.key === 'ArrowUp') arrowKeys.current.up = true;
            if (e.key === 'ArrowDown') arrowKeys.current.down = true;
            if (e.key === 'ArrowLeft') arrowKeys.current.left = true;
            if (e.key === 'ArrowRight') arrowKeys.current.right = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') ctrlHeld.current = false;
            if (e.key === 'ArrowUp') arrowKeys.current.up = false;
            if (e.key === 'ArrowDown') arrowKeys.current.down = false;
            if (e.key === 'ArrowLeft') arrowKeys.current.left = false;
            if (e.key === 'ArrowRight') arrowKeys.current.right = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        const handleGamepadConnected = (event: GamepadEvent) => {
            gamepadIndexRef.current = event.gamepad.index;
            setGamepadConnected(true);
            setGamepadName(event.gamepad.id);
            console.log(`🎮 Gamepad verbunden: ${event.gamepad.id}`);
        };

        const handleGamepadDisconnected = (event: GamepadEvent) => {
            if (gamepadIndexRef.current === event.gamepad.index) {
                gamepadIndexRef.current = null;
                setGamepadConnected(false);
                setGamepadName('');
                console.log('🎮 Gamepad getrennt');
            }
        };

        const firstGamepad = navigator.getGamepads?.().find(Boolean);
        if (firstGamepad) {
            gamepadIndexRef.current = firstGamepad.index;
            setGamepadConnected(true);
            setGamepadName(firstGamepad.id);
        }

        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('gamepadconnected', handleGamepadConnected);
            window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useFrame((state, delta) => {
        const { forward, backward, left, right } = getKeys();
        const gamepad = gamepadIndexRef.current !== null ? navigator.getGamepads?.()[gamepadIndexRef.current] : null;
        const rigidBody = rigidBodyRef.current;

        if (!rigidBody) {
            return;
        }

        let gpMoveX = 0;
        let gpMoveZ = 0;

        if (gamepad) {
            // ── LEFT STICK: movement ──────────────────────────────
            gpMoveX = applyDeadzone(gamepad.axes[0] ?? 0);
            gpMoveZ = applyDeadzone(gamepad.axes[1] ?? 0);

            // ── RIGHT STICK: camera look ──────────────────────────
            const lookX = applyDeadzone(gamepad.axes[2] ?? 0);
            const lookY = applyDeadzone(gamepad.axes[3] ?? 0);
            if (lookX !== 0 || lookY !== 0) {
                setRotation(r => ({
                    yaw: r.yaw - lookX * 0.08,
                    pitch: Math.max(-1.4, Math.min(1.4, r.pitch - lookY * 0.06))
                }));
            }

            // ── TRIGGERS (analog): zoom ───────────────────────────
            // LT = buttons[6], RT = buttons[7]
            const ltVal = gamepad.buttons[6]?.value ?? 0;
            const rtVal = gamepad.buttons[7]?.value ?? 0;
            if (ltVal > 0.05) setZoom(z => Math.max(1, z - ltVal * 30 * delta));
            if (rtVal > 0.05) setZoom(z => Math.min(200, z + rtVal * 30 * delta));

            // ── D-PAD: camera pan ─────────────────────────────────
            const dpadUp    = gamepad.buttons[12]?.pressed ?? false;
            const dpadDown  = gamepad.buttons[13]?.pressed ?? false;
            const dpadLeft  = gamepad.buttons[14]?.pressed ?? false;
            const dpadRight = gamepad.buttons[15]?.pressed ?? false;

            if (dpadUp || dpadDown || dpadLeft || dpadRight) {
                const panSpeed = 15 * delta;
                const yawRot = new THREE.Euler(0, rotation.yaw, 0);
                if (dpadUp)    panOffset.current.add(new THREE.Vector3(0, 0, -panSpeed).applyEuler(yawRot));
                if (dpadDown)  panOffset.current.add(new THREE.Vector3(0, 0,  panSpeed).applyEuler(yawRot));
                if (dpadLeft)  panOffset.current.add(new THREE.Vector3(-panSpeed, 0, 0).applyEuler(yawRot));
                if (dpadRight) panOffset.current.add(new THREE.Vector3( panSpeed, 0, 0).applyEuler(yawRot));
            }

            // ── LB (button 4): Rewind Hour ────────────────────────
            if (wasJustPressed(gamepad, 4)) {
                rewindHour();
                vibrate(gamepad, 100, 0.2, 0.1);
            }

            // ── RB (button 5): Sprint — handled below as gamepadSprint

            // ── START (button 9): Toggle Time Pause ───────────────
            if (wasJustPressed(gamepad, 9)) {
                toggleTimePause();
                vibrate(gamepad, 80, 0.15, 0.1);
            }

            // ── SELECT (button 8): Dismiss Statistics ────────────
            if (wasJustPressed(gamepad, 8)) {
                if (showStatistics) dismissStatistics();
                vibrate(gamepad, 60, 0.1, 0.05);
            }

            // ── Y (button 3): Reset camera + pan ─────────────────
            if (wasJustPressed(gamepad, 3)) {
                panOffset.current.set(0, 0, 0);
                setZoom(8);
                setRotation({ yaw: 0, pitch: -0.5 });
                vibrate(gamepad, 100, 0.2, 0.2);
            }

            // ── A (button 0): Advance Hour ────────────────────────
            if (wasJustPressed(gamepad, 0)) {
                advanceHour();
                vibrate(gamepad, 100, 0.2, 0.1);
            }

            // ── L3 (button 10): Jump ──────────────────────────────
            if (wasJustPressed(gamepad, 10)) {
                jumpQueued.current = true;
                vibrate(gamepad, 80, 0.16, 0.08);
            }

            // ── B (button 1): Reset pan offset ───────────────────
            if (wasJustPressed(gamepad, 1)) {
                panOffset.current.set(0, 0, 0);
                vibrate(gamepad, 80, 0.15, 0.1);
            }

            // ── X (button 2): Quick zoom reset ───────────────────
            if (wasJustPressed(gamepad, 2)) {
                if (activeInteractionId) {
                    interactQueued.current = true;
                } else {
                    setZoom(z => z > 20 ? 8 : z);
                    vibrate(gamepad, 60, 0.1, 0.05);
                }
            }

            // Update previous button snapshot for edge detection
            prevButtonsRef.current = gamepad.buttons.map(b => b.pressed);
        }

        // STRG + Pfeiltasten → Kamera-Panning (keyboard)
        if (ctrlHeld.current) {
            const panSpeed = 15 * delta;
            const yawRot = new THREE.Euler(0, rotation.yaw, 0);
            if (arrowKeys.current.up)    panOffset.current.add(new THREE.Vector3(0, 0, -panSpeed).applyEuler(yawRot));
            if (arrowKeys.current.down)  panOffset.current.add(new THREE.Vector3(0, 0,  panSpeed).applyEuler(yawRot));
            if (arrowKeys.current.left)  panOffset.current.add(new THREE.Vector3(-panSpeed, 0, 0).applyEuler(yawRot));
            if (arrowKeys.current.right) panOffset.current.add(new THREE.Vector3( panSpeed, 0, 0).applyEuler(yawRot));
        } else {
            // No CTRL: pan offset springs back smoothly
            panOffset.current.lerp(new THREE.Vector3(0, 0, 0), 0.04);
        }

        // WASD + gamepad movement
        const keyFwdInput = (backward ? 1 : 0) - (forward ? 1 : 0);
        const keySideInput = (left ? 1 : 0) - (right ? 1 : 0);
        const fwdInput = THREE.MathUtils.clamp(keyFwdInput + gpMoveZ, -1, 1);
        const sideInput = THREE.MathUtils.clamp(keySideInput + gpMoveX, -1, 1);
        const gamepadSprint = gamepad ? (gamepad.buttons[5]?.pressed ?? false) : false;
        const activeSpeed = gamepadSprint ? speed * 1.7 : speed;
        const translation = rigidBody.translation();
        position.set(translation.x, translation.y, translation.z);

        const currentGroundHeight = getGroundHeightAt(position.x, position.z) + PLAYER_HEIGHT_OFFSET;
        const currentVelocity = rigidBody.linvel();
        const distanceToGround = position.y - currentGroundHeight;

        groundedRef.current = distanceToGround <= GROUND_CONTACT_EPSILON && currentVelocity.y <= 0.5;

        const desiredVelocity = new THREE.Vector3();

        if (!ctrlHeld.current) {
            frontVector.set(0, 0, fwdInput);
            sideVector.set(sideInput, 0, 0);
            const moveRot = new THREE.Euler(0, rotation.yaw, 0);
            direction.subVectors(frontVector, sideVector);

            if (direction.lengthSq() > 0) {
                direction.normalize().applyEuler(moveRot);

                if (groundedRef.current) {
                    direction.projectOnPlane(getGroundNormalAt(position.x, position.z)).normalize();
                }

                direction.multiplyScalar(activeSpeed);
                desiredVelocity.copy(direction);
            }
        }

        targetHorizontalVelocity.set(desiredVelocity.x, desiredVelocity.z);
        currentHorizontalVelocity.set(currentVelocity.x, currentVelocity.z);

        velocityDelta.copy(targetHorizontalVelocity).sub(currentHorizontalVelocity);
        const hasInput = targetHorizontalVelocity.lengthSq() > 0.0001;
        const accel = groundedRef.current
            ? (hasInput ? GROUND_ACCELERATION : GROUND_FRICTION)
            : AIR_ACCELERATION;
        const maxDelta = accel * delta;

        if (velocityDelta.length() > maxDelta) {
            velocityDelta.setLength(maxDelta);
        }

        currentHorizontalVelocity.add(velocityDelta);

        rigidBody.setLinvel(
            {
                x: currentHorizontalVelocity.x,
                y: currentVelocity.y,
                z: currentHorizontalVelocity.y,
            },
            true,
        );

        if (jumpQueued.current && groundedRef.current && !ctrlHeld.current) {
            rigidBody.setLinvel(
                {
                    x: currentHorizontalVelocity.x,
                    y: JUMP_VELOCITY,
                    z: currentHorizontalVelocity.y,
                },
                true,
            );
            groundedRef.current = false;
        }
        jumpQueued.current = false;

        if (interactQueued.current && activeInteractionId) {
            triggerInteraction();
            if (gamepad) {
                vibrate(gamepad, 120, 0.22, 0.12);
            }
        }
        interactQueued.current = false;

        const updatedTranslation = rigidBody.translation();
        position.set(updatedTranslation.x, updatedTranslation.y, updatedTranslation.z);

        if (meshRef.current) {
            meshRef.current.position.copy(position);
            meshRef.current.rotation.y = rotation.yaw;

            const camPos = new THREE.Vector3(0, 0, zoom);
            const pitchEuler = new THREE.Euler(rotation.pitch, rotation.yaw, 0, 'YXZ');
            camPos.applyEuler(pitchEuler);

            const lookTarget = position.clone().add(panOffset.current).add(new THREE.Vector3(0, 1.5, 0));
            const targetCamPos = lookTarget.clone().add(camPos);

            state.camera.position.lerp(targetCamPos, 0.06);
            state.camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);

            // Emit position for multiplayer (Phase 6.1 Socket + 6.2 P2P)
            const moveData = {
                position: [position.x, position.y, position.z],
                rotation: rotation.yaw
            };

            const sock = (window as any).socket;
            if (sock && sock.connected) {
                sock.emit('player-moved', moveData);
            }
            
            useGameStore.getState().broadcastMoveP2P(moveData);
        }
    });

    return (
        <>
            <RigidBody
                ref={rigidBodyRef}
                type="dynamic"
                colliders={false}
                position={[0, getGroundHeightAt(0, 10) + PLAYER_HEIGHT_OFFSET, 10]}
                lockRotations
                canSleep={false}
                linearDamping={6}
                angularDamping={10}
                ccd
            >
                <CapsuleCollider args={[0.5, 0.3]} friction={0.2} />
                <group ref={meshRef} onClick={(e) => (e.target as HTMLElement).requestPointerLock()}>
                    <mesh position={[0, 0.5, 0]} castShadow>
                        <capsuleGeometry args={[0.3, 1, 4, 8]} />
                        <meshStandardMaterial color="#1a237e" metalness={0.5} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0.8, 0.1]} castShadow>
                        <boxGeometry args={[0.5, 0.4, 0.2]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                </group>
            </RigidBody>
            {/* Invisible marker object — gamepad status shown in HUD overlay */}
            {gamepadConnected && (
                <group userData={{ gamepadConnected: true, gamepadName }} />
            )}
        </>
    );
};
