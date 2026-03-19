import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

/**
 * CloudStreamViewer V3 — Socket.IO JPEG Frame Transport
 * 
 * KERNFIX: WebRTC funktioniert NICHT in HuggingFace Docker.
 * Stattdessen empfangen wir JPEG-Frames direkt per Socket.IO
 * vom captureLoop() in stream-server.mjs.
 * 
 * Architektur:
 *   Server: page.screenshot() → io.emit('frame', jpegBuffer)
 *   Client: socket.on('frame') → Blob URL → <img> Tag
 *   
 * Ergebnis: Zuverlässiger Zero-Footprint Stream in JEDER Cloud-Umgebung.
 */
export const CloudStreamViewer: React.FC = () => {
    const imgRef = useRef<HTMLImageElement>(null);
    const { cloudStreamUrl } = useGameStore(state => state.gameState);
    const [status, setStatus] = useState('Verbindung zur Cloud...');
    const [streamFps, setStreamFps] = useState(0);
    const [rendererFps, setRendererFps] = useState(0);
    const socketRef = useRef<Socket | null>(null);
    const frameCountRef = useRef(0);
    const lastFpsTimeRef = useRef(Date.now());
    const prevBlobUrlRef = useRef<string | null>(null);

    // FPS-Zähler für empfangene Frames
    const countFrame = useCallback(() => {
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
            setStreamFps(frameCountRef.current);
            lastFpsTimeRef.current = now;
            frameCountRef.current = 0;
        }
    }, []);

    useEffect(() => {
        const socketUrl = cloudStreamUrl || window.location.origin;
        console.log('🔌 CloudStreamViewer V3: Verbinde zu', socketUrl);

        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            upgrade: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity,
            timeout: 20000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Socket.IO verbunden:', socket.id);
            setStatus('Verbunden — Warte auf Video-Stream...');
            socket.emit('register-role', { role: 'viewer' });
        });

        // 🎥 JPEG Frame Empfang (Kernfunktion)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.on('frame', (jpegData: any) => {
            if (!imgRef.current) return;
            
            // Alten Blob URL freigeben (Speicherleck verhindern)
            if (prevBlobUrlRef.current) {
                URL.revokeObjectURL(prevBlobUrlRef.current);
            }
            
            const raw = jpegData instanceof ArrayBuffer ? jpegData : (jpegData.buffer || jpegData);
            const blob = new Blob([new Uint8Array(raw)], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            imgRef.current.src = url;
            prevBlobUrlRef.current = url;
            
            countFrame();
            
            if (status !== 'LIVE STREAM AKTIV (Zero-Footprint)') {
                setStatus('LIVE STREAM AKTIV (Zero-Footprint)');
            }
        });

        // HUD-State vom Renderer empfangen (wird vom getClientHTML bereits verarbeitet)
        socket.on('hud-state', () => {
            // HUD-Daten werden direkt vom eingebetteten Viewer verarbeitet
        });

        // Transport-Metriken (Renderer FPS)
        socket.on('transport-metrics', (data: any) => {
            if (data.rendererFps) setRendererFps(data.rendererFps);
        });

        socket.on('disconnect', () => {
            setStatus('Cloud-Verbindung unterbrochen. Reconnecting...');
            setStreamFps(0);
        });

        socket.on('connect_error', (err: any) => {
            console.warn('⚠️ Socket.IO Fehler:', err.message);
            setStatus(`Verbindungsfehler: ${err.message}`);
        });

        return () => {
            socket.disconnect();
            if (prevBlobUrlRef.current) {
                URL.revokeObjectURL(prevBlobUrlRef.current);
            }
        };
    }, [cloudStreamUrl, countFrame]);

    // Input Forwarding (Tastatur + Maus an Server)
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (socket.connected) socket.emit('keydown', { key: e.code });
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (socket.connected) socket.emit('keyup', { key: e.code });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const isLive = streamFps > 0;

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: '#0a0a0a', overflow: 'hidden'
        }}>
            {/* Video-Stream als JPEG-Sequenz */}
            <img
                ref={imgRef}
                alt="Cloud Stream"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: isLive ? 'block' : 'none',
                    // 🚀 Cloud-Turbo-Smoothing: Macht 180p auf Fullscreen erträglich
                    imageRendering: 'pixelated',
                    filter: 'contrast(1.1) brightness(1.05)',
                }}
                onMouseMove={(e) => {
                    socketRef.current?.emit('mousemove', { x: e.clientX, y: e.clientY });
                }}
                onMouseDown={(e) => {
                    socketRef.current?.emit('mousedown', { button: e.button === 0 ? 'left' : 'right' });
                }}
                onMouseUp={(e) => {
                    socketRef.current?.emit('mouseup', { button: e.button === 0 ? 'left' : 'right' });
                }}
                onClick={(e) => {
                    socketRef.current?.emit('click', { x: e.clientX, y: e.clientY });
                }}
            />

            {/* Ladeanzeige wenn kein Stream */}
            {!isLive && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)', textAlign: 'center',
                    color: '#0ff', fontFamily: 'monospace'
                }}>
                    <div style={{ fontSize: '24px', marginBottom: '1rem' }}>
                        ⏳ {status}
                    </div>
                    {rendererFps > 0 && (
                        <div style={{ fontSize: '14px', color: '#0f0', marginBottom: '1rem' }}>
                            Renderer: {rendererFps} FPS — Frames werden übertragen...
                        </div>
                    )}
                    <div style={{
                        width: '40px', height: '40px', border: '3px solid #0ff',
                        borderTop: '3px solid transparent', borderRadius: '50%',
                        animation: 'spin 1s linear infinite', margin: '0 auto'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
        </div>
    );
};
