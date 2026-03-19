import net from 'node:net';

import { describe, expect, it } from 'vitest';

// @ts-expect-error - Runtime-MJS wird hier bewusst direkt getestet.
import { applyResolvedPorts, resolvePorts } from '../../scripts/security/port-check.mjs';

describe('security/port-check', () => {
    it('vergibt bei blockiertem Wunschport eindeutige Fallback-Ports ohne Duplikate', async () => {
        const blocker = net.createServer();
        await new Promise<void>((resolve, reject) => {
            blocker.once('error', reject);
            blocker.listen(0, '127.0.0.1', () => resolve());
        });

        const address = blocker.address();
        const blockedPort = typeof address === 'object' && address ? address.port : 39999;

        try {
            const resolved = await resolvePorts('stream', {
                STREAM_PORT: String(blockedPort),
                WS_PORT: String(blockedPort),
                AUTONOMY_PORT: String(blockedPort),
            } as NodeJS.ProcessEnv);

            const values = [resolved.STREAM_PORT, resolved.WS_PORT, resolved.AUTONOMY_PORT];
            const unique = new Set(values);

            expect(unique.size).toBe(3);
            expect(values).not.toContain(blockedPort);
            values.forEach((value) => {
                expect(value).toBeGreaterThanOrEqual(3000);
                expect(value).toBeLessThanOrEqual(3010);
            });
        } finally {
            await new Promise<void>((resolve) => blocker.close(() => resolve()));
        }
    });

    it('mapped kompatible Zielvariablen konsistent in die Umgebung', () => {
        const targetEnv = {} as NodeJS.ProcessEnv;

        applyResolvedPorts(targetEnv, {
            DEV_PORT: 3001,
            STREAM_PORT: 7860,
            WS_PORT: 3000,
            AUTONOMY_PORT: 3099,
        });

        expect(targetEnv.DEV_PORT).toBe('3001');
        expect(targetEnv.VITE_PORT).toBe('3001');
        expect(targetEnv.STREAM_PORT).toBe('7860');
        expect(targetEnv.PORT).toBe('7860');
        expect(targetEnv.WS_PORT).toBe('3000');
        expect(targetEnv.SOCKET_PORT).toBe('3000');
        expect(targetEnv.AUTONOMY_PORT).toBe('3099');
        expect(targetEnv.INTERNAL_PORT).toBe('3099');
    });

    it('bricht bei ungueltigen Portwerten frueh mit klarer Fehlermeldung ab', async () => {
        await expect(resolvePorts('all', { DEV_PORT: '99999' } as NodeJS.ProcessEnv)).rejects.toThrow(
            'DEV_PORT ist ungueltig',
        );
    });
});
