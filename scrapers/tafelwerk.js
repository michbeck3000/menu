
const URL = 'https://www.tafelwerk-leipzig.de/weeklycard';

export async function scrapeTafelwerk(browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Tafelwerk is an Angular SPA. We navigate and wait for the base DOM, then wait for our selector.
        // We avoid networkidle0/2 because some trackers keep the connection open and cause timeouts.
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for the menu cards to render
        try {
            await page.waitForSelector('.row.day', { timeout: 15000 });
            // Angular might need an extra moment to render the rest of the days (e.g. Friday)
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log('Tafelwerk menu selector .row.day not found or timed out.');
            // Maybe take a screenshot or dump html if debugging was easier
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

            const dayBlocks = document.querySelectorAll('.row.day');
            dayBlocks.forEach(dayBlock => {
                const dateHeaderEl = dayBlock.querySelector('.day-date h3');
                const dateHeader = dateHeaderEl ? dateHeaderEl.textContent.toLowerCase() : '';
                let dayKey = null;

                for (const [german, english] of Object.entries(dayMapping)) {
                    if (dateHeader.includes(german)) {
                        dayKey = english;
                        break;
                    }
                }

                if (dayKey) {
                    const dishes = [];
                    const cards = dayBlock.querySelectorAll('.card');

                    cards.forEach(card => {
                        const catEl = card.querySelector('.card-header h4');
                        const titleEl = card.querySelector('.card-title h5');
                        const descEl = card.querySelector('.card-text');
                        const priceEls = card.querySelectorAll('.card-footer span');

                        let category = catEl ? catEl.textContent.split('|')[0].trim() : '';
                        let title = titleEl ? titleEl.textContent.split('|')[0].trim() : '';

                        // Clean standalone allergens/additives like 'A1', 'G', '1,3'
                        const token = "(?:[a-rA-R][0-9]?|[0-9]{1,2})";
                        const regex = new RegExp(`(^|[\\s\\(\\)\\[\\]])(${token}(?:\\s*[,;]\\s*${token})*)(?=[\\s\\(\\)\\[\\],.]|$)`, 'g');
                        let prevTitle;
                        do {
                            prevTitle = title;
                            title = title.replace(regex, (match, prefix, block) => {
                                if (block.toLowerCase() === 'a') return match;
                                return prefix;
                            });
                        } while (title !== prevTitle);
                        title = title.replace(/\(\s*\)/g, '');
                        title = title.replace(/\s+/g, ' ').trim();
                        const description = '';

                        // Extract prices - format: "4,50 €" and "7,70 €" in separate elements, or single price
                        let price = '';
                        const priceTexts = Array.from(priceEls).map(el => el.textContent.trim()).filter(t => t && t !== 'N/A');
                        
                        if (priceTexts.length >= 2) {
                            // Parse prices to find larger/smaller
                            const parsePrice = (p) => {
                                const match = p.replace(',', '.').match(/[\d.]+/);
                                return match ? parseFloat(match[0]) : 0;
                            };
                            const prices = priceTexts.map(p => ({ raw: p.replace('|', '').trim(), value: parsePrice(p) }));
                            prices.sort((a, b) => b.value - a.value); // Descending
                            
                            const larger = prices[0].raw;
                            const smaller = prices[1] ? prices[1].raw : null;
                            
                            if (smaller) {
                                price = `${larger} (klein: ${smaller})`;
                            } else {
                                price = larger;
                            }
                        } else if (priceTexts.length === 1) {
                            price = priceTexts[0].replace('|', '').trim();
                        }

                        // Determine type (keep original title as-is)
                        let type = 'meat';
                        const lowerText = (title + ' ' + description + ' ' + category).toLowerCase();
                        if (lowerText.includes('vegan')) type = 'vegan';
                        else if (lowerText.includes('vegetarisch') || lowerText.includes('vegetarian')) type = 'vegetarian';
                        else if (lowerText.includes('fisch') || lowerText.includes('fish')) type = 'fish';

                        // Remove vegan/vegetarian from title since we now show badges
                        title = title.replace(/\b(vegan|vegetarisch|vegetarian)\b/gi, '').replace(/\s+/g, ' ').trim();
                        // Clean up leading dashes or pipes
                        title = title.replace(/^[\s-|]+/, '').trim();

                        if (title) {
                            dishes.push({
                                name: title,
                                description,
                                price,
                                bistro: 'Tafelwerk',
                                type
                            });
                        }
                    });

                    if (dishes.length > 0) {
                        menu[dayKey] = dishes;
                    }
                }
            });
            return menu;
        });

        return weeklyMenu;

    } catch (error) {
        console.warn('Tafelwerk scraper error:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
