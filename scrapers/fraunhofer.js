
const URL = 'https://www.cafeteria-leipzig.de/cafeteria-fraunhofer-izi/';

export async function scrapeFraunhofer(browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a bit for potential JS redirects or rendering
        // Fraunhofer site seemed static from chunk analysis but might have bot checks
        await new Promise(r => setTimeout(r, 2000));

        const weeklyMenu = await page.evaluate(() => {
            const menu = {};
            const dayMapping = {
                'montag': 'monday',
                'dienstag': 'tuesday',
                'mittwoch': 'wednesday',
                'donnerstag': 'thursday',
                'freitag': 'friday'
            };

            let currentDay = null;
            const paragraphs = document.querySelectorAll('p'); // Get all paragraphs

            paragraphs.forEach(p => {
                const text = p.innerText.trim();
                if (!text) return;

                const lowerText = text.toLowerCase();
                let foundDay = null;

                // Check if line is a day
                for (const [german, english] of Object.entries(dayMapping)) {
                    if (lowerText.startsWith(german.toLowerCase())) {
                        foundDay = english;
                        break;
                    }
                }

                if (foundDay) {
                    currentDay = foundDay;
                    if (!menu[currentDay]) menu[currentDay] = [];
                } else if (currentDay) {
                    // Logic to exclude non-dishes
                    if (text.match(/^\d{2}\.\d{2}/)) return; // Date like 09.01.
                    if (lowerText.includes('änderungen vorbehalten')) return;
                    if (lowerText.includes('speiseplan')) return;

                    // Exclude garbage
                    if (lowerText.includes('cookie')) return;
                    if (lowerText.includes('datenschutzerklärung')) return;
                    if (lowerText.includes('impressum')) return;
                    if (lowerText.includes('anbieter:')) return;
                    if (lowerText.includes('perlickstraße')) return;
                    if (lowerText.includes('leipzig')) return;
                    if (lowerText.includes('tel:')) return;
                    if (lowerText.includes('haema')) return;
                    if (lowerText.includes('jimdo')) return;
                    if (lowerText.includes('google')) return;
                    if (text.length > 200) return; // Likely legal text

                    if (lowerText.includes('betriebsferien')) {
                        // Special handling for closed days?
                        // For now just add as dish or note
                        menu[currentDay].push({
                            name: text,
                            price: "",
                            bistro: 'Fraunhofer',
                            type: 'meat' // Default
                        });
                        return;
                    }

                    let type = 'meat';
                    if (lowerText.includes('vegan')) type = 'vegan';
                    else if (lowerText.includes('vegetarisch') || lowerText.includes('vegetarian')) type = 'vegetarian';
                    else if (lowerText.includes('fisch') || lowerText.includes('fish')) type = 'fish';

                    // Ensure it's not a price-only line if they exist separate (unlikely here)
                    if (text.length > 3) {
                        menu[currentDay].push({
                            name: text,
                            price: "",
                            bistro: 'Fraunhofer',
                            type: type
                        });
                    }
                }
            });
            return menu;
        });

        return weeklyMenu;

    } catch (error) {
        console.warn('Fraunhofer scraper error:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
