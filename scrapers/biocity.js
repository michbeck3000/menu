
const URL = 'https://bistro-biocity.de/wochenkarte';

export async function scrapeBioCity(browser) {
    let page;
    try {
        page = await browser.newPage();
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for the menu container
        try {
            await page.waitForSelector('.nova-food-menu', { timeout: 5000 });
        } catch (e) {
            console.log('BioCity menu selector not found immediately, might differ or error page.');
        }

        const weeklyMenu = await page.evaluate(() => {
            const menu = {};
            const dayMapping = {
                'Montag': 'monday',
                'Dienstag': 'tuesday',
                'Mittwoch': 'wednesday',
                'Donnerstag': 'thursday',
                'Freitag': 'friday'
            };

            const sections = document.querySelectorAll('.nova-food-menu__section');
            sections.forEach(section => {
                const titleEl = section.querySelector('.section-title');
                const dayText = titleEl ? titleEl.innerText.trim().split('\n')[0] : '';
                const dayKey = Object.keys(dayMapping).find(d => dayText.includes(d));

                if (dayKey) {
                    const dishes = [];
                    const items = section.querySelectorAll('.nova-food-menu-item');

                    items.forEach(item => {
                        const titleEl = item.querySelector('.item-title');
                        const descEl = item.querySelector('.item-description');
                        const priceEl = item.querySelector('.item-price');

                        const title = titleEl ? titleEl.innerText.trim() : '';
                        const description = descEl ? descEl.innerText.trim() : '';
                        const price = priceEl ? priceEl.innerText.trim() : '';

                        if (title) {
                            let type = 'meat';
                            const lowerText = (title + ' ' + description).toLowerCase();
                            if (lowerText.includes('vegan')) type = 'vegan';
                            else if (lowerText.includes('vegetarisch') || lowerText.includes('vegetarian')) type = 'vegetarian';
                            else if (lowerText.includes('fisch') || lowerText.includes('fish')) type = 'fish';

                            dishes.push({
                                name: title,
                                description,
                                price,
                                bistro: 'Bio-City',
                                type
                            });
                        }
                    });

                    if (dishes.length > 0) {
                        menu[dayMapping[dayKey]] = dishes;
                    }
                }
            });
            return menu;
        });

        return weeklyMenu;

    } catch (error) {
        console.error('Error scraping Bio-City:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
