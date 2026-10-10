import path from 'node:path';
import { createServer } from 'vite';

// Vite resolves the same TS modules and @ alias as the game, with no browser/asset import.
const server = await createServer({
    configFile: false,
    resolve: { alias: { '@': path.join(process.cwd(), 'src') } },
    server: { middlewareMode: true }, appType: 'custom',
});
try {
    await server.ssrLoadModule('/src/test/rendering/Instancing.test.ts');
    await server.ssrLoadModule('/src/test/rendering/DirectionalShadowFitter.test.ts');
} finally { await server.close(); }
