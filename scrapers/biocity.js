
const URL = 'https://geschmackswerk-leipzig.de/';

export async function scrapeBioCity(browser) {
    let page;
    try {
        page = await browser.newPage();
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for the Elementor food menu items to load
        try {
            await page.waitForSelector('.pt-food-menu-item', { timeout: 10000 });
        } catch (e) {
            console.log('Geschmackswerk menu selector not found, page structure may have changed.');
        }

        const weeklyMenu = await page.evaluate(() => {
            const menu = {};
            const dayMapping = {
                'montag': 'monday',
                'dienstag': 'tuesday',
                'mittwoch': 'wednesday',
                'donnerstag': 'thursday',
                'freitag': 'friday'
            };

            // REOPENING DATE: 2026-03-04 (Wednesday)
            // We should only extract days that are >= this date.
            const REOPENING_DATE = new Date('2026-03-04');

            const columns = document.querySelectorAll('.elementor-widget-wrap');

            columns.forEach(column => {
                const titleEl = column.querySelector('.pt-title');
                const subtitleEl = column.querySelector('.pt-subtitle');
                if (!titleEl) return;

                // Parse the date from the subtitle (e.g., "02.03.2026")
                const dateText = subtitleEl ? subtitleEl.textContent.trim() : '';
                if (dateText) {
                    const parts = dateText.split('.');
                    if (parts.length === 3) {
                        const itemDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        // Skip if the date is before the reopening date
                        if (itemDate < REOPENING_DATE) return;
                    }
                }

                // Match the day name
                const dayText = titleEl.textContent.trim().toLowerCase();
                const dayKey = Object.keys(dayMapping).find(d => dayText.includes(d));
                if (!dayKey) return;

                const dishes = [];
                const items = column.querySelectorAll('.pt-food-menu-item');

                items.forEach(item => {
                    const nameEl = item.querySelector('.pt-food-menu-title .title-wrap');
                    const descEl = item.querySelector('.pt-food-menu-details');
                    const priceEl = item.querySelector('.pt-food-menu-price');

                    const name = nameEl ? nameEl.textContent.trim() : '';
                    const description = descEl ? descEl.textContent.trim() : '';
                    const price = priceEl ? priceEl.textContent.trim() : '';

                    if (name) {
                        let type = 'meat';
                        const labelEl = item.querySelector('.menu-label');
                        const labelText = labelEl ? labelEl.textContent.trim().toLowerCase() : '';

                        if (labelText.includes('vegan')) {
                            type = 'vegan';
                        } else if (labelText.includes('vegi') || labelText.includes('vegetarisch')) {
                            type = 'vegetarian';
                        } else {
                            // Fallback to name/desc check
                            const lowerText = (name + ' ' + description).toLowerCase();
                            if (lowerText.includes('vegan')) {
                                type = 'vegan';
                            } else if (lowerText.includes('vegetarisch') || lowerText.includes('vegi') || lowerText.includes('vegetarian')) {
                                type = 'vegetarian';
                            }
                        }

                        dishes.push({
                            name,
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
            });

            return menu;
        });

        return weeklyMenu;

    } catch (error) {
        console.error('Error scraping Bio-City (Geschmackswerk):', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
