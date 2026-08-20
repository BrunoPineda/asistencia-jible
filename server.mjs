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
    console.log(`[API] Iniciando proceso de automatización: ${mode}`);

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['index.mjs', mode], {
            cwd: currentDirectory,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false
        });

        const maxCapturedLogChars = 64 * 1024;
        let stdout = '';
        let stderr = '';

        const appendLimited = (current, output) => {
            const combined = current + output;
            return combined.length > maxCapturedLogChars
                ? combined.slice(-maxCapturedLogChars)
                : combined;
        };

        child.stdout.on('data', chunk => {
            const output = chunk.toString();
            stdout = appendLimited(stdout, output);
            process.stdout.write(`[automatización:${mode}] ${output}`);
        });

        child.stderr.on('data', chunk => {
            const output = chunk.toString();
            stderr = appendLimited(stderr, output);
            process.stderr.write(`[automatización:${mode}:error] ${output}`);
        });

        child.once('error', reject);
        child.once('close', code => {
            console.log(`[API] Proceso ${mode} finalizado con código ${code}`);

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
