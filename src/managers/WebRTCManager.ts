import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { useGameStore } from '../stores/gameStore';

class WebRTCManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map();
    private calls: Map<string, MediaConnection> = new Map();
    private localStream: MediaStream | null = null;

    init(id: string) {
        if (this.peer) return;

        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('[WebRTC] Peer opened with ID:', id);
        });

        this.peer.on('connection', (conn) => {
            this.setupDataConnection(conn);
        });

        this.peer.on('call', (call) => {
            if (this.localStream) {
                call.answer(this.localStream);
                this.setupVoiceCall(call);
            }
        });

        this.peer.on('error', (err) => {
            console.error('[WebRTC] Peer Error:', err);
        });
    }

    async startVoice() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            console.log('[WebRTC] Local audio stream acquired');
            return true;
        } catch (err) {
            console.error('[WebRTC] Failed to get local stream:', err);
            return false;
        }
    }

    connectToPeer(remoteId: string) {
        if (!this.peer || this.connections.has(remoteId)) return;

        const conn = this.peer.connect(remoteId);
        this.setupDataConnection(conn);

        if (this.localStream) {
            const call = this.peer.call(remoteId, this.localStream);
            this.setupVoiceCall(call);
        }
    }

    private setupDataConnection(conn: DataConnection) {
        conn.on('open', () => {
            console.log('[WebRTC] Connected to peer:', conn.peer);
            this.connections.set(conn.peer, conn);
        });

        conn.on('data', (data: any) => {
            if (data.type === 'move') {
                useGameStore.getState().updateRemotePlayer(conn.peer, data.payload);
            }
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            useGameStore.getState().removeRemotePlayer(conn.peer);
        });
    }

    private setupVoiceCall(call: MediaConnection) {
        call.on('stream', (remoteStream) => {
            console.log('[WebRTC] Received remote audio stream from:', call.peer);
            this.playRemoteStream(call.peer, remoteStream);
        });

        call.on('close', () => {
            this.calls.delete(call.peer);
        });

        this.calls.set(call.peer, call);
    }

    private playRemoteStream(peerId: string, stream: MediaStream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        
        // Basic distance-based volume management would go here
        // For now, just play it
        (window as any)[`audio_${peerId}`] = audio;
    }

    broadcastMove(payload: any) {
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send({ type: 'move', payload });
            }
        });
    }

    disconnect() {
        this.peer?.destroy();
        this.peer = null;
        this.connections.clear();
        this.calls.clear();
        this.localStream?.getTracks().forEach(t => t.stop());
    }
}

export const webrtcManager = new WebRTCManager();
