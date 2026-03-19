/**
 * 🔊 AUDIO MANAGER — 24H MASTER PLAN
 *
 * Web Audio API Sound-System für alle Sounds aus dem Master Plan:
 * - 06:00: Vogelgezwitscher, vereinzelte Autos
 * - 10:20: Sprechchöre "Freiheit! Freiheit!"
 * - 12:00: Polizei-Megafon-Ansage
 * - 12:30: Schild-Beats BOOM BOOM BOOM
 * - 13:00: Wasserwerfer-Rauschen
 * - 19:00: "ACAB!" Skandieren
 * - 19:30: Bengalo-Knistern
 * - 21:00: Schüsse, Explosionen
 * - Durchgehend: Sirenen, Crowd-Murmeln, Tension-Musik
 *
 * Implementiert als Sine/Noise Web Audio Generatoren (kein externes Audio nötig).
 * Kategorien: sfx | ambient | music | voice — je mit separatem GainNode
 */

export type AudioCategory = 'sfx' | 'ambient' | 'music' | 'voice';

class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private categoryGains: Map<AudioCategory, GainNode> = new Map();
    private activeNodes: Map<string, { osc?: OscillatorNode; gain: GainNode; category: AudioCategory }> = new Map();
    private isInitialized = false;
    private _masterVolume = 0.5;
    private _muted = false;

    /** Initialize AudioContext on first user interaction */
    init() {
        if (this.isInitialized) return;
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this._masterVolume;
            this.masterGain.connect(this.ctx.destination);

            // Category gain nodes
            const categories: AudioCategory[] = ['sfx', 'ambient', 'music', 'voice'];
            for (const cat of categories) {
                const g = this.ctx.createGain();
                g.gain.value = 1.0;
                g.connect(this.masterGain);
                this.categoryGains.set(cat, g);
            }

            this.isInitialized = true;
            console.log('🔊 AudioManager initialisiert (Web Audio API)');
        } catch (e) {
            console.warn('Audio nicht verfügbar:', e);
        }
    }

    /** Ensure context is running (resume after browser suspend) */
    private resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    /** Get routing target for a category */
    private dest(cat: AudioCategory): GainNode {
        return this.categoryGains.get(cat) ?? (this.masterGain as GainNode);
    }

    // ─────────────────────────────────────────
    // VOLUME CONTROLS
    // ─────────────────────────────────────────

    /** Set master volume 0..1 */
    setVolume(vol: number) {
        this._masterVolume = Math.max(0, Math.min(1, vol));
        if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._masterVolume;
    }

    /** Mute or unmute all audio */
    setMuted(muted: boolean) {
        this._muted = muted;
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this._masterVolume;
    }

    /** Set volume for a specific category (0..1) */
    setCategoryVolume(cat: AudioCategory, vol: number) {
        const g = this.categoryGains.get(cat);
        if (g) g.gain.value = Math.max(0, Math.min(1, vol));
    }

    /**
     * Duck ambient category to duckLevel over fadeDuration seconds,
     * then restore to 1.0 after holdDuration seconds.
     */
    duckAmbient(duckLevel = 0.25, fadeDuration = 0.3, holdDuration = 5) {
        if (!this.ctx) return;
        const g = this.categoryGains.get('ambient');
        if (!g) return;
        const now = this.ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(duckLevel, now + fadeDuration);
        g.gain.setValueAtTime(duckLevel, now + fadeDuration + holdDuration);
        g.gain.linearRampToValueAtTime(1.0, now + fadeDuration + holdDuration + fadeDuration);
    }

    // ─────────────────────────────────────────
    // SOUND GENERATORS
    // ─────────────────────────────────────────

    /** Sirene: auf/ab schwingende Sinuswelle */
    playSiren(duration = 5) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(this.dest('sfx'));
        
        // Siren sweep: 600Hz ↔ 900Hz
        const now = this.ctx.currentTime;
        for (let i = 0; i < duration * 2; i++) {
            osc.frequency.setValueAtTime(600, now + i * 0.5);
            osc.frequency.linearRampToValueAtTime(900, now + i * 0.5 + 0.25);
            osc.frequency.linearRampToValueAtTime(600, now + i * 0.5 + 0.5);
        }
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    }

    /** Schüsse: kurze White-Noise Bursts */
    playGunshot() {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.2;
        source.connect(gain);
        gain.connect(this.dest('sfx'));
        source.start();
    }

    /** Explosion: tiefe Noise-Welle mit langem Decay */
    playExplosion() {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * 0.8; // 800ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.3;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.dest('sfx'));
        source.start();
    }

    /** Crowd-Murmeln: tiefes rosa Rauschen (ambient category, loopable) */
    startCrowdMurmur() {
        if (!this.ctx || !this.masterGain || this.activeNodes.has('crowd')) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
            b6 = white * 0.115926;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.04;
        source.connect(gain);
        gain.connect(this.dest('ambient'));
        source.start();
        this.activeNodes.set('crowd', { gain, category: 'ambient' });
    }

    /** Schild-Beats: rhythmisches tiefes Klopfen (BOOM BOOM BOOM) — sfx */
    playShieldBeats(count = 6) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 80;
            gain.gain.setValueAtTime(0.3, now + i * 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.2);
            osc.connect(gain);
            gain.connect(this.dest('sfx'));
            osc.start(now + i * 0.4);
            osc.stop(now + i * 0.4 + 0.3);
        }
    }

    /** Bengalo-Knistern: hochfrequentes Rauschen — sfx */
    playBengaloSizzle(duration = 3) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.1 * (1 + Math.sin(i / 200) * 0.5);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.06;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.dest('sfx'));
        source.start();
    }

    /** Chanting: rhythmischer Ton (Sprechchöre) — ambient */
    playChanting(duration = 5) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        const count = 4;
        for (let j = 0; j < count; j++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 160 + j * 40;
            for (let i = 0; i < duration * 2; i++) {
                gain.gain.setValueAtTime(0.04, now + i * 0.5 + j * 0.1);
                gain.gain.linearRampToValueAtTime(0.01, now + i * 0.5 + 0.2 + j * 0.1);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.4 + j * 0.1);
            }
            osc.connect(gain);
            gain.connect(this.dest('ambient'));
            osc.start(now);
            osc.stop(now + duration);
        }
    }

    /** Vögel: hochfrequente Chirps — ambient */
    playBirds(duration = 10) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        for (let i = 0; i < duration * 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + Math.random() * duration;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000 + Math.random() * 1000, startTime);
            osc.frequency.exponentialRampToValueAtTime(4000 + Math.random() * 1000, startTime + 0.1);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.02, startTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, startTime + 0.15);
            
            osc.connect(gain);
            gain.connect(this.dest('ambient'));
            osc.start(startTime);
            osc.stop(startTime + 0.2);
        }
    }

    /** Wasserwerfer: Rauschen mit moduliertem Fluss — sfx */
    playWaterCannon(duration = 4) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Band-pass modulated noise simulates water flow
            data[i] = (Math.random() * 2 - 1) * 0.15 * (0.5 + 0.5 * Math.sin(i / (this.ctx.sampleRate / 8)));
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.18;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.dest('sfx'));
        source.start();
    }

    /** Polizei Megafon: verzerrte Stimme (Bandpass-Rauschen) — voice */
    playPoliceMegaphone(duration = 4) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        // Simulate megaphone with modulated oscillator through narrow bandpass
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 180;
        // Speech-rhythm modulation
        const modOsc = this.ctx.createOscillator();
        modOsc.frequency.value = 3.5;
        const modGain = this.ctx.createGain();
        modGain.gain.value = 30;
        modOsc.connect(modGain);
        modGain.connect(osc.frequency);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200;
        bp.Q.value = 5;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.12;
        gain.gain.linearRampToValueAtTime(0, now + duration);
        osc.connect(bp);
        bp.connect(gain);
        gain.connect(this.dest('voice'));
        this.duckAmbient(0.3, 0.2, duration);
        osc.start(now);
        modOsc.start(now);
        osc.stop(now + duration);
        modOsc.stop(now + duration);
    }

    /** Schritte: kurze perkussive Clicks — sfx */
    playFootsteps(count = 4, tempo = 0.5) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 100 + Math.random() * 40;
            gain.gain.setValueAtTime(0.08, now + i * tempo);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * tempo + 0.05);
            osc.connect(gain);
            gain.connect(this.dest('sfx'));
            osc.start(now + i * tempo);
            osc.stop(now + i * tempo + 0.08);
        }
    }

    /** Melodic Arpeggio: Simuliert Konzert-Musik — music */
    playConcert(duration = 20) {
        if (!this.ctx || !this.masterGain) return;
        this.resume();
        const now = this.ctx.currentTime;
        const scale = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392]; // A-Moll
        for (let i = 0; i < duration * 4; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + i * 0.25;
            osc.type = i % 8 < 4 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(scale[Math.floor(Math.random() * scale.length)], startTime);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.05, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
            
            osc.connect(gain);
            gain.connect(this.dest('music'));
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }

    /** STOP all sounds */
    stopAll() {
        this.activeNodes.forEach((node) => {
            node.gain.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime || 0) + 0.5);
        });
        this.activeNodes.clear();
    }

    /** Stop only sounds of a specific category */
    stopCategory(cat: AudioCategory) {
        this.activeNodes.forEach((node, key) => {
            if (node.category === cat) {
                node.gain.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime || 0) + 0.3);
                this.activeNodes.delete(key);
            }
        });
    }

    /** Whether the manager has been initialized */
    get initialized() { return this.isInitialized; }
}

/** Singleton Audio Manager */
export const audioManager = new AudioManager();
