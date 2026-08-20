import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);

const routes = new Map([
    ['/api/asistencia/completo', 'completo'],
    ['/api/asistencia/entrada', 'entrada'],
    ['/api/asistencia/salida', 'salida']
]);

let isRunning = false;

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(body));
}

function runAutomation(mode) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['index.mjs', mode], {
            cwd: currentDirectory,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });

        child.once('error', reject);
        child.once('close', code => {
            if (code === 0) {
                resolve({ mode, message: 'Marcación completada correctamente', stdout });
                return;
            }

            reject(new Error(stderr || `La automatización terminó con código ${code}`));
        });
    });
}

const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
        sendJson(response, 200, {
            ok: true,
            service: 'jibble-automation',
            running: isRunning
        });
        return;
    }

    const mode = routes.get(request.url);

    if (request.method !== 'POST' || !mode) {
        sendJson(response, 404, {
            ok: false,
            message: 'Ruta no encontrada',
            endpoints: [...routes.keys()]
        });
        return;
    }

    if (isRunning) {
        sendJson(response, 409, {
            ok: false,
            message: 'Ya existe una marcación en ejecución'
        });
        return;
    }

    isRunning = true;

    try {
        const result = await runAutomation(mode);
        sendJson(response, 200, { ok: true, ...result });
    } catch (error) {
        sendJson(response, 500, {
            ok: false,
            mode,
            message: error instanceof Error ? error.message : String(error)
        });
    } finally {
        isRunning = false;
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`API de Jibble ejecutándose en http://localhost:${port}`);
    console.log('POST /api/asistencia/completo');
    console.log('POST /api/asistencia/entrada');
    console.log('POST /api/asistencia/salida');
});
