export class WorkerManager {
    private worker: Worker | null = null;
    public latestNPCBuffer: Float32Array | null = null;
    public readonly FLOATS_PER_NPC = 12;

    public init() {
        if (this.worker) return;
        this.worker = new Worker(new URL('../workers/simWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
            if (e.data.type === 'FRAME') this.latestNPCBuffer = new Float32Array(e.data.payload);
        };
    }
    public startSimulation(maxInstances: number, initialNpcs: any[] = []) {
        this.worker?.postMessage({ type: 'INIT', payload: { maxInstances, npcs: initialNpcs } });
    }

    public syncNpcs(npcs: any[]) {
        this.worker?.postMessage({ type: 'SYNC_NPCS', payload: npcs });
    }

    public moveNpcsToTarget(ids: number[], target: [number, number, number]) {
        this.worker?.postMessage({ type: 'MOVE_TO_TARGET', payload: { ids, target } });
    }

    public sendTension(level: number) {
        this.worker?.postMessage({ type: 'SET_TENSION', payload: level });
    }

    public stopSimulation() { this.worker?.postMessage({ type: 'STOP' }); }
}
export const workerManager = new WorkerManager();
