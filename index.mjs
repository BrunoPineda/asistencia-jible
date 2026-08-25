import { readFileSync } from 'node:fs';

// Carga variables desde .env sin dependencias externas.
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

const email = process.env.JIBBLE_EMAIL;
const password = process.env.JIBBLE_PASSWORD;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const isDeveloper = String(process.env.DEVELOPER ?? 'false').toLowerCase() === 'true';

const sendTelegramNotification = async (text) => {
    if (!telegramToken || !telegramChatId) return;

    try {
        const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error al enviar notificación por Telegram: ${err.message}`);
    }
};

process.on('uncaughtException', async (error) => {
    console.error(`[${new Date().toISOString()}] Excepción no capturada:`, error);
    await sendTelegramNotification(`❌ <b>Error en Marcación:</b> ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    console.error(`[${new Date().toISOString()}] Promesa rechazada:`, reason);
    await sendTelegramNotification(`❌ <b>Error en Marcación:</b> ${errorMsg}`);
    process.exit(1);
});

if (isDeveloper) {
    // Evita que Windows intente utilizar la ruta Linux configurada para Render.
    delete process.env.PUPPETEER_CACHE_DIR;
}

const { Locator, launch } = await import('puppeteer');
const headless = String(
    process.env.BROWSER_HEADLESS ?? (isDeveloper ? 'false' : 'true')
).toLowerCase() === 'true';

if (!email || !password) {
    throw new Error('Faltan JIBBLE_EMAIL o JIBBLE_PASSWORD en el archivo .env');
}

const launchOptions = isDeveloper
    ? {
        headless,
        channel: 'chrome',
        slowMo: 10,
        protocolTimeout: 120000,
        args: [
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling'
        ]
    }
    : {
        headless,
        slowMo: 0,
        protocolTimeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--no-default-browser-check',
            '--renderer-process-limit=1',
            '--js-flags=--max-old-space-size=128',
            '--disable-features=Translate,MediaRouter,OptimizationHints,PaintHolding'
        ]
    };

const browser = await launch(launchOptions);

browser.on('disconnected', () => {
    console.error(`[${new Date().toISOString()}] El navegador Chrome se desconectó inesperadamente`);
});

const page = await browser.newPage();

if (!isDeveloper) {
    // Evita descargar y renderizar recursos pesados que no necesita la automatización.
    const cdpSession = await page.createCDPSession();
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.setBlockedURLs', {
        urls: [
            '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.svg',
            '*.woff', '*.woff2', '*.ttf', '*.otf',
            '*.mp3', '*.mp4', '*.webm', '*.avi'
        ]
    });
}

const timeout = 30000;
const navigationTimeout = 60000;
const executionMode = process.argv[2] ?? 'completo';
const validModes = new Set(['completo', 'entrada', 'salida']);

const logStep = message => {
    console.log(`[${new Date().toISOString()}] ${message}`);
};

if (!validModes.has(executionMode)) {
    throw new Error(`Modo no válido: ${executionMode}`);
}
page.setDefaultTimeout(timeout);
page.setDefaultNavigationTimeout(navigationTimeout);
logStep(`Iniciando automatización en modo: ${executionMode}`);
logStep(`Entorno: ${isDeveloper ? 'DESARROLLO (Windows)' : 'PRODUCCIÓN (Render)'}`);
logStep(`Navegador visible: ${headless ? 'NO (headless)' : 'SÍ'}`);
if (!isDeveloper) {
    logStep('Modo de bajo consumo activado para Render');
}

{
    const targetPage = page;
    await targetPage.setViewport({
        width: 608,
        height: 729
    })
}
{
    const targetPage = page;
    logStep('Abriendo la página de inicio de sesión de Jibble');
    const loginUrl = 'https://web.jibble.io/login';

    try {
        await targetPage.goto(loginUrl, {
            waitUntil: 'domcontentloaded',
            timeout: navigationTimeout
        });
    } catch (error) {
        logStep(`Primer intento de navegación falló: ${error.message}`);
        logStep('Reintentando abrir Jibble');

        await targetPage.goto(loginUrl, {
            waitUntil: 'domcontentloaded',
            timeout: navigationTimeout
        });
    }

    logStep('Página de Jibble cargada');
}
// Inicio de sesión robusto para formularios Vue/Quasar.
{
    logStep('Completando credenciales de acceso');
    const targetPage = page;
    const emailSelector = "input[data-testid='emailOrPhone']";
    const passwordSelector = "input[type='password']";
    const loginButtonSelector = "[data-testid='login-button']";

    logStep(`URL actual del login: ${targetPage.url()}`);
    logStep(`Título de la página: ${await targetPage.title()}`);

    logStep('Esperando el campo de correo');
    await targetPage.waitForSelector(emailSelector, {
        visible: true,
        timeout: navigationTimeout
    });
    logStep('Campo de correo encontrado');

    await targetPage.click(emailSelector, { clickCount: 3 });
    await targetPage.keyboard.press('Backspace');
    await targetPage.type(emailSelector, email, { delay: 0 });
    logStep('Correo ingresado correctamente');

    logStep('Esperando el campo de contraseña');
    await targetPage.waitForSelector(passwordSelector, {
        visible: true,
        timeout: navigationTimeout
    });
    logStep('Campo de contraseña encontrado');

    await targetPage.click(passwordSelector, { clickCount: 3 });
    await targetPage.keyboard.press('Backspace');
    await targetPage.type(passwordSelector, password, { delay: 0 });
    logStep('Contraseña ingresada correctamente');

    const valuesArePresent = await targetPage.evaluate(
        (email, password) => {
            const emailInput = document.querySelector(email);
            const passwordInput = document.querySelector(password);
            emailInput?.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput?.dispatchEvent(new Event('change', { bubbles: true }));
            passwordInput?.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput?.dispatchEvent(new Event('change', { bubbles: true }));
            return Boolean(emailInput?.value && passwordInput?.value);
        },
        emailSelector,
        passwordSelector
    );

    if (!valuesArePresent) {
        throw new Error('Jibble no conservó el correo o la contraseña en los campos.');
    }

    logStep('Esperando que el botón de inicio de sesión se habilite');
    await targetPage.waitForFunction(
        selector => {
            const button = document.querySelector(selector);
            return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
        },
        { timeout: navigationTimeout },
        loginButtonSelector
    );

    logStep('Botón de inicio de sesión habilitado');
    logStep('Enviando formulario de inicio de sesión');

    const loginUrlBeforeSubmit = targetPage.url();
    await targetPage.click(loginButtonSelector);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const dashboardIsVisible = await targetPage.evaluate(() => {
        const isVisible = selector => {
            const element = document.querySelector(selector);
            if (!element) return false;

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0;
        };

        return isVisible("[data-testid='button-clock-out']") ||
            isVisible("[data-testid='button-clock-in']");
    });

    if (!dashboardIsVisible && targetPage.url() === loginUrlBeforeSubmit) {
        logStep('El primer clic no cambió la página; reintentando el login con Enter');
        await targetPage.focus(passwordSelector);
        await targetPage.keyboard.press('Enter');
    }

    logStep('Esperando que cargue el panel principal de Jibble');

    try {
        await targetPage.waitForFunction(
            () => {
                const isReady = selector => {
                    const element = document.querySelector(selector);
                    if (!element) return false;

                    const rect = element.getBoundingClientRect();
                    const style = window.getComputedStyle(element);
                    return style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        rect.width > 0 &&
                        rect.height > 0 &&
                        !element.disabled &&
                        element.getAttribute('aria-disabled') !== 'true';
                };

                return isReady("[data-testid='button-clock-out']") ||
                    isReady("[data-testid='button-clock-in']");
            },
            { timeout: navigationTimeout, polling: 500 }
        );
    } catch (error) {
        const diagnostic = await targetPage.evaluate(() => ({
            url: location.href,
            title: document.title,
            visibleText: document.body?.innerText
                ?.replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1200) || 'Sin texto visible'
        })).catch(() => ({
            url: targetPage.url(),
            title: 'No disponible',
            visibleText: 'No se pudo inspeccionar la página'
        }));

        console.error('[LOGIN] Diagnóstico:', JSON.stringify(diagnostic));
        throw new Error(
            `Jibble no cargó el panel después del login. URL: ${diagnostic.url}. ` +
            `Mensaje visible: ${diagnostic.visibleText}`,
            { cause: error }
        );
    }

    logStep(`Inicio de sesión completado. URL actual: ${targetPage.url()}`);
}

if (executionMode !== 'entrada') {
const targetPage = page;
const clockOutSelector = "[data-testid='button-clock-out']";
const clockInSelector = "[data-testid='button-clock-in']";

const visibleClockButton = await targetPage.waitForFunction(
    (outSelector, inSelector) => {
        const isVisible = selector => {
            const element = document.querySelector(selector);
            if (!element) return false;

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0;
        };

        if (isVisible(outSelector)) return 'salida';
        if (isVisible(inSelector)) return 'entrada';
        return false;
    },
    { timeout: navigationTimeout, polling: 250 },
    clockOutSelector,
    clockInSelector
).then(handle => handle.jsonValue());

if (visibleClockButton === 'entrada') {
    if (executionMode === 'salida') {
        logStep('No hay una sesión activa: Jibble ya muestra el botón de entrada');
        logStep('No es necesario marcar salida');
        await sendTelegramNotification('ℹ️ <b>Jibble:</b> No hay una sesión activa. No es necesario marcar salida.');
        await browser.close();
        process.exit(0);
    }

    logStep('Jibble ya se encuentra fuera de sesión; se omite la salida');
} else {
    logStep('Iniciando marcación de salida');
    await targetPage.waitForFunction(
        selector => {
            const button = document.querySelector(selector);
            return button &&
                !button.disabled &&
                button.getAttribute('aria-disabled') !== 'true';
        },
        { timeout: navigationTimeout },
        clockOutSelector
    );

    await targetPage.click(clockOutSelector);
    logStep('Botón de salida pulsado');

    const confirmButtonSelector = "[data-testid='right-sidebar-confirm-btn'], .q-card__actions button";
    try {
        await targetPage.waitForSelector(confirmButtonSelector, {
            visible: true,
            timeout: 5000
        });
        logStep('Panel/Diálogo de salida abierto correctamente');
    } catch {
        logStep('El diálogo no apareció en 5s; reintentando clic en botón de salida');
        await targetPage.evaluate(selector => {
            const button = document.querySelector(selector);
            button?.scrollIntoView({ block: 'center', inline: 'center' });
            button?.click();
        }, clockOutSelector);

        await targetPage.waitForSelector(confirmButtonSelector, {
            visible: true,
            timeout: 10000
        });
        logStep('Panel/Diálogo de salida abierto en el segundo intento');
    }

    logStep('Confirmando la marcación de salida');
    const clickedConfirm = await targetPage.evaluate(() => {
        const primaryConfirmBtn = document.querySelector("[data-testid='right-sidebar-confirm-btn']");
        if (primaryConfirmBtn) {
            primaryConfirmBtn.click();
            return 'right-sidebar-confirm-btn';
        }

        const cardActions = document.querySelector('.q-card__actions');
        if (cardActions) {
            const buttons = [...cardActions.querySelectorAll('button')].filter(b => !b.disabled);
            const lastBtn = buttons.at(-1);
            if (lastBtn) {
                lastBtn.click();
                return lastBtn.innerText?.trim() || 'card-action-btn';
            }
        }

        return false;
    });

    if (!clickedConfirm) {
        logStep('Haciendo clic mediante Locator fallback en botón de salida');
        await Locator.race([
            targetPage.locator("[data-testid='right-sidebar-confirm-btn']"),
            targetPage.locator('::-p-text(Guardar)')
        ])
            .setTimeout(timeout)
            .click();
    } else {
        logStep(`Confirmación pulsada mediante selector: ${clickedConfirm}`);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    await sendTelegramNotification('🔴 <b>Jibble:</b> Marcación de salida realizada correctamente.');
}
}

if (executionMode !== 'salida') {
logStep('Iniciando marcación de entrada');
// La entrada es idempotente: si Jibble ya muestra salida, la sesión está activa.
{
    const targetPage = page;
    const clockInSelector = "[data-testid='button-clock-in']";
    const clockOutSelector = "[data-testid='button-clock-out']";

    const currentClockStateHandle = await targetPage.waitForFunction(
        (inSelector, outSelector) => {
            const isVisible = selector => {
                const element = document.querySelector(selector);
                if (!element) return false;

                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                return style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0;
            };

            if (isVisible(outSelector)) return 'dentro';
            if (isVisible(inSelector)) return 'fuera';
            return false;
        },
        { timeout: navigationTimeout, polling: 250 },
        clockInSelector,
        clockOutSelector
    );

    const currentClockState = await currentClockStateHandle.jsonValue();
    await currentClockStateHandle.dispose();

    if (executionMode === 'entrada' && currentClockState === 'dentro') {
        logStep('La entrada ya estaba marcada; no se realizará una marcación duplicada');
        await sendTelegramNotification('ℹ️ <b>Jibble:</b> La entrada ya estaba marcada. No se realizará marcación duplicada.');
        await browser.close();
        logStep('Automatización finalizada correctamente');
        process.exit(0);
    }

    await targetPage.waitForSelector(clockInSelector, {
        visible: true,
        timeout: navigationTimeout
    });

    await targetPage.waitForFunction(
        selector => {
            const button = document.querySelector(selector);
            if (!button) return false;

            const rect = button.getBoundingClientRect();
            const style = window.getComputedStyle(button);
            const isVisible =
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0;

            return isVisible &&
                !button.disabled &&
                button.getAttribute('aria-disabled') !== 'true';
        },
        { timeout: navigationTimeout },
        clockInSelector
    );

    await targetPage.locator(clockInSelector)
        .setTimeout(navigationTimeout)
        .scroll();
    await targetPage.click(clockInSelector);
    logStep('Botón verde de entrada pulsado');

    const activitySelector = "[data-testid='select-activity']";
    try {
        await targetPage.waitForSelector(activitySelector, {
            visible: true,
            timeout: 5000
        });
        logStep('Panel de marcación abierto correctamente');
    } catch {
        logStep('El panel no se abrió con el primer clic; reintentando');

        await targetPage.evaluate(selector => {
            const button = document.querySelector(selector);
            if (!button) {
                throw new Error('No se encontró nuevamente el botón verde de entrada');
            }
            button.scrollIntoView({ block: 'center', inline: 'center' });
            button.click();
        }, clockInSelector);

        await targetPage.waitForSelector(activitySelector, {
            visible: true,
            timeout: navigationTimeout
        });
        logStep('Panel de marcación abierto en el segundo intento');
    }
}
{
    logStep('Seleccionando actividad');
    const targetPage = page;
    const activitySelector = "[data-testid='select-activity']";

    const activitySelectors = [
        activitySelector,
        'input[placeholder="Selecciona una actividad"]',
        'input[type="search"][role="combobox"][data-testid*="activity"]',
        'input.q-field__input[role="combobox"][placeholder*="actividad"]'
    ];

    const activityInputHandle = await targetPage.waitForFunction(
        selectors => {
            for (const selector of selectors) {
                const input = document.querySelector(selector);
                if (!input) continue;

                const rect = input.getBoundingClientRect();
                const style = window.getComputedStyle(input);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0;

                if (isVisible &&
                    !input.disabled &&
                    input.getAttribute('aria-disabled') !== 'true') {
                    input.scrollIntoView({ block: 'center', inline: 'center' });
                    input.focus();
                    input.click();
                    return selector;
                }
            }
            return false;
        },
        { timeout: navigationTimeout, polling: 250 },
        activitySelectors
    );

    const matchedActivitySelector = await activityInputHandle.jsonValue();
    await activityInputHandle.dispose();
    logStep(`Campo de actividad encontrado mediante: ${matchedActivitySelector}`);
}
{
    const targetPage = page;
    const activityOptionSelector = '[data-testid="Cumplimiento de horario"]';

    logStep('Esperando la opción Cumplimiento de horario');
    await targetPage.waitForSelector(activityOptionSelector, {
        visible: true,
        timeout: navigationTimeout
    });
    await targetPage.click(activityOptionSelector);
    logStep('Actividad seleccionada correctamente');
}
{
    const targetPage = page;
    const projectSelector = "[data-testid='select-project']";

    logStep('Seleccionando proyecto');
    const projectSelectors = [
        projectSelector,
        'input[placeholder="Selecciona un proyecto"]',
        'input[type="search"][role="combobox"][data-testid*="project"]',
        'input.q-field__input[role="combobox"][placeholder*="proyecto"]'
    ];

    const projectInputHandle = await targetPage.waitForFunction(
        selectors => {
            for (const selector of selectors) {
                const input = document.querySelector(selector);
                if (!input) continue;

                const rect = input.getBoundingClientRect();
                const style = window.getComputedStyle(input);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0;

                if (isVisible &&
                    !input.disabled &&
                    input.getAttribute('aria-disabled') !== 'true') {
                    input.scrollIntoView({ block: 'center', inline: 'center' });
                    input.focus();
                    input.click();
                    return selector;
                }
            }
            return false;
        },
        { timeout: navigationTimeout, polling: 250 },
        projectSelectors
    );

    const matchedProjectSelector = await projectInputHandle.jsonValue();
    await projectInputHandle.dispose();
    logStep(`Campo de proyecto encontrado mediante: ${matchedProjectSelector}`);
}
{
    const targetPage = page;
    const projectOptionSelector = '[data-testid="Marcación de horario - UTP"]';

    logStep('Esperando la opción Marcación de horario - UTP');
    await targetPage.waitForSelector(projectOptionSelector, {
        visible: true,
        timeout: navigationTimeout
    });
    await targetPage.click(projectOptionSelector);
    logStep('Proyecto seleccionado correctamente');
}
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='right-sidebar-confirm-btn'] > span.q-btn__content"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"right-sidebar-confirm-btn\\"]/span[2])'),
        targetPage.locator(":scope >>> [data-testid='right-sidebar-confirm-btn'] > span.q-btn__content"),
        targetPage.locator('::-p-text(Guardar)')
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 38.399993896484375,
            y: 13.54998779296875,
          },
        });
    logStep('Marcación de entrada guardada correctamente');
    await sendTelegramNotification('🟢 <b>Jibble:</b> Marcación de entrada realizada correctamente.');
}
}

{
    const targetPage = page;
    logStep('Abriendo menú de usuario para cerrar sesión');
    await Locator.race([
        targetPage.locator('#app > div > div > div > div:nth-of-type(1) > button i'),
        targetPage.locator('::-p-xpath(//*[@id=\\"app\\"]/div/div/div/div[1]/button/span[2]/i)'),
        targetPage.locator(':scope >>> #app > div > div > div > div:nth-of-type(1) > button i')
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 10,
            y: 18,
          },
        });
}
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='authorized-person']"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"authorized-person\\"])'),
        targetPage.locator(":scope >>> [data-testid='authorized-person']")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 88,
            y: 40.39996337890625,
          },
        });
}
{
    const targetPage = page;
    const promises = [];
    const startWaitingForEvents = () => {
        promises.push(targetPage.waitForNavigation());
    }
    await Locator.race([
        targetPage.locator('div > div.q-item__section--side'),
        targetPage.locator('::-p-xpath(//*[@id=\\"q-portal--menu--5\\"]/div/div/div/div[2])'),
        targetPage.locator(':scope >>> div > div.q-item__section--side')
    ])
        .setTimeout(timeout)
        .on('action', () => startWaitingForEvents())
        .click({
          offset: {
            x: 27.800003051757812,
            y: 15,
          },
        });
    await Promise.all(promises);
}

logStep('Cerrando navegador');
await browser.close();
logStep('Automatización finalizada correctamente');
