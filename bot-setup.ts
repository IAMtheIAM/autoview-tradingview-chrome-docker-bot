// This file automates logging into Autoview, useful if you have a lot of exchanges.

import { Chromeless } from 'chromeless';

declare var TradingView;

module.exports = {
    autoviewSetup: async function () {
        const chromeless = new Chromeless({
            launchChrome: true,
            waitTimeout: 20000
        });

        const kraken = await chromeless
            .setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3430.0 Safari/537.36')
            // .setViewport({width: 2485, height: 1400, scale: 1})
            .goto('chrome-extension://okdhadoplaoehmeldlpakhpekjcpljmb/options.html')
            .wait(2000)
            .click('[data-page="settings"]')
            .wait(200)
            .click('button[name="grant"][data-exchange="KRAKEN"]')
            .wait(2000)
            .click('[data-page="exchange-kraken"]')
            .wait(200)
            .type('', '#exchange-kraken-private-0') // private key
            .type('', '#exchange-kraken-public-0') // public key
            .click('button[name="test"][data-exchange="KRAKEN"]')
            .wait(200)
            .click('button[data-action="action_access_save"][data-exchange="KRAKEN"]')
            .wait(5000)
            .catch((err) => {
                console.error(err);
            });
        console.log('Finished Enabling 1 Exchange! (Kraken)'); // prints local file path or S3 url

        const bitfinex = await chromeless
            .setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3430.0 Safari/537.36')
            // .setViewport({width: 2485, height: 1400, scale: 1})
            .goto('chrome-extension://okdhadoplaoehmeldlpakhpekjcpljmb/options.html')
            .wait(2000)
            .click('[data-page="settings"]')
            .wait(200)
            .click('button[name="grant"][data-exchange="BITFINEX"]')
            .wait(2000)
            .click('[data-page="exchange-bitfinex"]')
            .wait(200)
            .type('', '#exchange-bitfinex-private-0') // private key
            .type('', '#exchange-bitfinex-public-0') // public key
            .click('button[name="test"][data-exchange="BITFINEX"]')
            .wait(200)
            .click('button[data-action="action_access_save"][data-exchange="BITFINEX"]')
            .wait(5000)
            .catch((err) => {
                console.error(err);
            });
        console.log('Finished Enabling 1 Exchange! (Bitfinex)'); // prints local file path or S3 url



        await chromeless.end();

    }
}

// Make this runnable from package.json through NPM scripts using `make-runnable`
require('make-runnable'); // must be at the END of the file
