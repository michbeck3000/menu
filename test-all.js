import puppeteer from 'puppeteer';
import { scrapeTafelwerk } from './scrapers/tafelwerk.js';
import { scrapeFraunhofer } from './scrapers/fraunhofer.js';

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        console.log("Scraping Tafelwerk...");
        const tw = await scrapeTafelwerk(browser);
        console.log("Tafelwerk Monday:", tw.monday?.[0]?.name);
        console.log("Tafelwerk Tuesday:", tw.tuesday?.[0]?.name);
        console.log("Tafelwerk Wednesday:", tw.wednesday?.[0]?.name);
        console.log("Tafelwerk Thursday:", tw.thursday?.[0]?.name);
        console.log("Tafelwerk Friday:", tw.friday?.[0]?.name);

        console.log("Scraping Fraunhofer...");
        const fh = await scrapeFraunhofer(browser);
        console.log("Fraunhofer Monday:", fh.monday?.[0]?.name);
        console.log("Fraunhofer Friday:", fh.friday?.[0]?.name);

        await browser.close();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
