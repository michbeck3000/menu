import puppeteer from 'puppeteer';
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://geschmackswerk-leipzig.de/', { waitUntil: 'networkidle0' });
    const html = await page.$eval('.pt-food-menu-item', el => el.innerHTML);
    console.log(html);
    await browser.close();
})();
