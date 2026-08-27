import { readFileSync } from 'node:fs';

// Cargar variables de entorno desde .env sin dependencias externas
try {
    const envFile = readFileSync(new URL('.env', import.meta.url), 'utf8');

    for (const line of envFile.split(/\r?\n/)) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim();
        process.env[key] ??= value;
    }
} catch (error) {
    if (error?.code !== 'ENOENT') throw error;
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramNotification(text) {
    if (!telegramToken || !telegramChatId) {
        console.warn('⚠️  [AVISO] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en el .env');
        console.warn('    Agrega TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID a tu .env para recibirlos en Telegram.');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.description || 'Error de API de Telegram');
        }
        console.log(`[${new Date().toLocaleTimeString('es-PE')}] ✅ Mensaje enviado exitosamente a Telegram.`);
    } catch (err) {
        console.error(`[${new Date().toLocaleTimeString('es-PE')}] ❌ Error al enviar mensaje: ${err.message}`);
    }
}

async function executeJob() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-PE', { hour12: true });
    const dateStr = now.toLocaleDateString('es-PE');

    console.log(`[${now.toLocaleTimeString('es-PE')}] 🚀 Ejecutando job pruebajibble...`);
    console.log(`   Mensaje: "hola" | Hora de ejecución: ${timeStr}`);

    const message = `hola\n⏰ <b>Hora de ejecución del job:</b> ${timeStr} (${dateStr})`;

    await sendTelegramNotification(message);
}

function startScheduler() {
    const args = process.argv.slice(2);
    const runNow = args.includes('--now');

    const now = new Date();
    
    // Configurar la hora objetivo: 09:25:00 AM del día actual
    const target = new Date();
    target.setHours(9, 25, 0, 0);

    const diffMs = target.getTime() - now.getTime();

    if (runNow) {
        console.log(`[${now.toLocaleTimeString('es-PE')}] Opción --now detectada. Ejecutando inmediatamente...`);
        executeJob();
        return;
    }

    if (diffMs > 0) {
        const totalSeconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        console.log(`[${now.toLocaleTimeString('es-PE')}] ⏳ Job programado para las 09:25:00 AM.`);
        console.log(`   Faltan ${minutes} min y ${seconds} seg. Esperando...`);

        setTimeout(async () => {
            await executeJob();
        }, diffMs);
    } else {
        console.log(`[${now.toLocaleTimeString('es-PE')}] ⚠️ La hora objetivo (09:25:00 AM) ya transcurrió hoy.`);
        console.log(`   Ejecutando job inmediatamente...`);
        executeJob();
    }
}

startScheduler();
