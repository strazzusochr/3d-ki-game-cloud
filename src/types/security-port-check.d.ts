declare module '../../scripts/security/port-check.mjs' {
    export type PortCheckMode = 'all' | 'stream' | 'autonomy';

    export type ResolvedPorts = Partial<{
        DEV_PORT: number;
        STREAM_PORT: number;
        WS_PORT: number;
        AUTONOMY_PORT: number;
    }>;

    export function resolvePorts(mode?: PortCheckMode, env?: NodeJS.ProcessEnv): Promise<ResolvedPorts>;
    export function applyResolvedPorts(targetEnv: NodeJS.ProcessEnv, resolved: ResolvedPorts): void;
}