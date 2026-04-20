import { chromium } from 'playwright';

import { createAuralisServer } from '../../server/app.mjs';
import {
    REPO_ROOT,
    dismissBlockingOverlays,
    waitForAppReady,
    waitForInteractiveUi
} from './shared.mjs';

function log(message) {
    console.log(`[qa:live] ${message}`);
}

async function main() {
    const backend = createAuralisServer({
        port: 0,
        quiet: true,
        rootDir: REPO_ROOT
    });

    const { origin } = await backend.start();
    const browser = await chromium.launch({
        headless: false,
        devtools: process.argv.includes('--devtools')
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 }
    });
    const page = await context.newPage();

    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.error(`[browser] ${message.text()}`);
        }
    });

    page.on('pageerror', (error) => {
        console.error(`[pageerror] ${error.message}`);
    });

    page.on('response', (response) => {
        const url = response.url();
        if (response.status() >= 400 && !url.endsWith('/favicon.ico')) {
            console.error(`[network] ${response.status()} ${response.request().method()} ${response.url()}`);
        }
    });

    let cleanedUp = false;
    const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        await backend.stop().catch(() => {});
    };

    process.once('SIGINT', async () => {
        log('Stopping live browser session.');
        await cleanup();
        process.exit(0);
    });

    process.once('SIGTERM', async () => {
        await cleanup();
        process.exit(0);
    });

    try {
        const appUrl = `${origin}/Auralis_mock_zenith.html`;
        await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
        await waitForInteractiveUi(page);
        await dismissBlockingOverlays(page);

        log(`Browser launched at ${appUrl}`);
        log('Leave this process running while you or Playwright drive the app.');
        log('Close the browser window or press Ctrl+C to stop the session.');

        browser.once('disconnected', async () => {
            await cleanup();
        });

        await new Promise((resolve) => {
            browser.once('disconnected', resolve);
        });
    } finally {
        await cleanup();
    }
}

await main();
