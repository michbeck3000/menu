import puppeteer from 'puppeteer';
import { scrapeFraunhofer } from './scrapers/fraunhofer.js';

(async () => {
    let browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const res = await scrapeFraunhofer(browser);
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
