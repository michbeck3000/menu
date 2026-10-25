
const URL = 'https://geschmackswerk-leipzig.de/';

export async function scrapeBioCity(browser) {
    let page;
    try {
        page = await browser.newPage();
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for the weekly menu section to load
        try {
            await page.waitForSelector('#wochenkarte .woche .tag', { timeout: 10000 });
        } catch {
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

            const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

            // Remove allergen strings like "(Sj, Sm)" or "(Gl,Ei,L)" from the end
            const allergenRegex = /\s*\([a-zA-Z,\s]+\)$/;
            // Diet markers are part of the description, e.g. "vegan, mit ..." or "vegetarisch, an ..."
            const dietRegex = /^(vegan|vegetarisch|vegi)\b\s*[,:-]?\s*/i;

            document.querySelectorAll('#wochenkarte .woche .tag').forEach(tag => {
                const dayText = cleanText(tag.querySelector('.tag-kopf strong')?.textContent).toLowerCase();
                const dayKey = Object.keys(dayMapping).find(d => dayText.includes(d));
                if (!dayKey) return;

                const dishes = [];
                tag.querySelectorAll('.gericht').forEach(item => {
                    const spans = item.querySelectorAll('.zeile span');
                    const nameEl = spans[0];
                    const priceEl = spans[spans.length - 1];
                    const descEl = item.querySelector('small');

                    let name = cleanText(nameEl?.textContent);
                    let description = cleanText(descEl?.textContent);
                    const price = cleanText(priceEl?.textContent);

                    let type = 'meat';
                    const dietMatch = description.match(dietRegex);
                    if (dietMatch) {
                        type = dietMatch[1].toLowerCase() === 'vegan' ? 'vegan' : 'vegetarian';
                    }

                    name = name.replace(allergenRegex, '').trim();
                    description = description
                        .replace(dietRegex, '')
                        .replace(allergenRegex, '')
                        .trim();

                    if (name) {
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
