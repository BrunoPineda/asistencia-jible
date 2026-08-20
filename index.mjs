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
const isDeveloper = String(process.env.DEVELOPER ?? 'false').toLowerCase() === 'true';

if (isDeveloper) {
    // Evita que Windows intente utilizar la ruta Linux configurada para Render.
    delete process.env.PUPPETEER_CACHE_DIR;
}

const { Locator, launch } = await import('puppeteer');
const headless = isDeveloper
    ? false
    : String(process.env.BROWSER_HEADLESS ?? 'true').toLowerCase() === 'true';

if (!email || !password) {
    throw new Error('Faltan JIBBLE_EMAIL o JIBBLE_PASSWORD en el archivo .env');
}

const browser = await launch({
  headless,
  slowMo: 10,
  args: isDeveloper
      ? []
      : ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
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
    await Promise.all([
        targetPage.waitForNavigation({ waitUntil: 'networkidle2', timeout }).catch(() => null),
        targetPage.click(loginButtonSelector)
    ]);
    logStep('Inicio de sesión completado');
}

if (executionMode !== 'entrada') {
logStep('Iniciando marcación de salida');
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='button-clock-out'] i"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-clock-out\\"]/span[2]/i)'),
        targetPage.locator(":scope >>> [data-testid='button-clock-out'] i")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 12.2249755859375,
            y: 0,
          },
        });
}
{
    const targetPage = page;
    const actionsSelector = '.q-card__actions';

    logStep('Esperando las acciones para terminar la sesión');

    const clickedButtonHandle = await targetPage.waitForFunction(
        selector => {
            const container = document.querySelector(selector);
            if (!container) return false;

            const buttons = [...container.querySelectorAll('button')].filter(button => {
                const rect = button.getBoundingClientRect();
                return rect.width > 0 &&
                    rect.height > 0 &&
                    !button.disabled &&
                    button.getAttribute('aria-disabled') !== 'true';
            });

            const primaryButton = buttons.at(-1);
            if (!primaryButton) return false;

            const buttonText = primaryButton.innerText?.trim() || 'acción principal';
            primaryButton.click();
            return buttonText;
        },
        { timeout: navigationTimeout, polling: 250 },
        actionsSelector
    );

    const clickedButtonText = await clickedButtonHandle.jsonValue();
    await clickedButtonHandle.dispose();
    logStep(`Acción pulsada: ${clickedButtonText}`);
}
{
    const targetPage = page;
    logStep('Confirmando la marcación de salida');
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
            y: 25.54998779296875,
          },
        });
}
}

if (executionMode !== 'salida') {
logStep('Iniciando marcación de entrada');
// Después de marcar la salida, esperar y pulsar específicamente el botón verde.
{
    const targetPage = page;
    const clockInSelector = "[data-testid='button-clock-in']";

    await targetPage.waitForSelector(clockInSelector, {
        visible: true,
        timeout
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
        { timeout },
        clockInSelector
    );

    await targetPage.locator(clockInSelector)
        .setTimeout(timeout)
        .scroll();
    await targetPage.click(clockInSelector);
    logStep('Botón verde de entrada pulsado');
}
{
    logStep('Seleccionando actividad');
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='select-activity']"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"select-activity\\"])'),
        targetPage.locator(":scope >>> [data-testid='select-activity']")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 248.39999389648438,
            y: 27.399993896484375,
          },
        });
}
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='Cumplimiento\\ de\\ horario']"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"Cumplimiento de horario\\"])'),
        targetPage.locator(":scope >>> [data-testid='Cumplimiento\\ de\\ horario']")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 137.39999389648438,
            y: 13.399993896484375,
          },
        });
}
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='select-project']"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"select-project\\"])'),
        targetPage.locator(":scope >>> [data-testid='select-project']")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 166.39999389648438,
            y: 27.399993896484375,
          },
        });
}
{
    const targetPage = page;
    await Locator.race([
        targetPage.locator("[data-testid='Marcación\\ de\\ horario\\ -\\ UTP']"),
        targetPage.locator('::-p-xpath(//*[@data-testid=\\"Marcación de horario - UTP\\"])'),
        targetPage.locator(":scope >>> [data-testid='Marcación\\ de\\ horario\\ -\\ UTP']")
    ])
        .setTimeout(timeout)
        .click({
          offset: {
            x: 110.39999389648438,
            y: 5.39996337890625,
          },
        });
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

