import { readFileSync } from 'node:fs';
import { Locator, launch } from 'puppeteer'; // v25.0.0 or later

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
const headless = String(process.env.BROWSER_HEADLESS ?? 'false').toLowerCase() === 'true';

if (!email || !password) {
    throw new Error('Faltan JIBBLE_EMAIL o JIBBLE_PASSWORD en el archivo .env');
}

const browser = await launch({
  headless,
  slowMo: 10
});
const page = await browser.newPage();
const timeout = 15000;
const executionMode = process.argv[2] ?? 'completo';
const validModes = new Set(['completo', 'entrada', 'salida']);

const logStep = message => {
    console.log(`[${new Date().toISOString()}] ${message}`);
};

if (!validModes.has(executionMode)) {
    throw new Error(`Modo no válido: ${executionMode}`);
}
page.setDefaultTimeout(timeout);
logStep(`Iniciando automatización en modo: ${executionMode}`);
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
    await targetPage.goto('https://web.jibble.io/login?ReturnUrl=https%3A%2F%2Fidentity.prod.jibble.io%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Dspa.client%26redirect_uri%3Dhttps%253A%252F%252Fweb.jibble.io%252Flogin%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%2520api1%2520email%2520phone%26state%3D5324b690b3b044e28e99906eafe8ea3c%26code_challenge%3DdnlQ0V7K6cTm8aKNvQk19Wd_mo1hT8KFXYQN_mEEf3M%26code_challenge_method%3DS256%26response_mode%3Dquery');
}
// Inicio de sesión robusto para formularios Vue/Quasar.
{
    logStep('Completando credenciales de acceso');
    const targetPage = page;
    const emailSelector = "input[data-testid='emailOrPhone']";
    const passwordSelector = "input[type='password']";
    const loginButtonSelector = "[data-testid='login-button']";

    await targetPage.waitForSelector(emailSelector, { visible: true });
    await targetPage.click(emailSelector, { clickCount: 3 });
    await targetPage.keyboard.press('Backspace');
    await targetPage.type(emailSelector, email, { delay: 0 });

    await targetPage.waitForSelector(passwordSelector, { visible: true });
    await targetPage.click(passwordSelector, { clickCount: 3 });
    await targetPage.keyboard.press('Backspace');
    await targetPage.type(passwordSelector, password, { delay: 0 });

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

    await targetPage.waitForFunction(
        selector => {
            const button = document.querySelector(selector);
            return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
        },
        {},
        loginButtonSelector
    );

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
    await Locator.race([
        targetPage.locator('div.q-card__actions'),
        targetPage.locator('::-p-xpath(//*[@id=\\"app\\"]/div/div/div/div[2]/div/aside/div/div/div[3])'),
        targetPage.locator(':scope >>> div.q-card__actions'),
        targetPage.locator('::-p-text(CancelarGuardar)')
    ])
        .setTimeout(timeout)
        .click({
          delay: 420.80000001192093,
          offset: {
            x: 316.3999938964844,
            y: 59.54998779296875,
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

