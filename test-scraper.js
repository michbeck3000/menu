import puppeteer from 'puppeteer';

const URL = 'https://www.tafelwerk-leipzig.de/weeklycard';

(async () => {
    let browser;
    try {
        console.log("Launching browser...");
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("Navigating...");
        await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

        console.log("Waiting 5s...");
        await new Promise(r => setTimeout(r, 5000));

        const days = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('.day-date h3').forEach(el => results.push(el.innerText));
            return results;
        });

        console.log("Found days in DOM:");
        console.log(days);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (browser) await browser.close();
    }
})();
