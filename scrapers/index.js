import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { scrapeBioCity } from './biocity.js';
import { scrapeFraunhofer } from './fraunhofer.js';
import { scrapeTafelwerk } from './tafelwerk.js';
import { scrapeNationalbibliothek } from './nationalbibliothek.js';
import { scrapePorta } from './porta.js';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runScrapers() {
    console.log('Starting menu scraping with Puppeteer...');

    const results = {
        updatedAt: new Date().toISOString(),
        days: {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: []
        }
    };

    let oldMenusData = null;
    const outputPath = path.join(__dirname, '..', 'public', 'data', 'menus.json');
    try {
        oldMenusData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch (e) {
        // Erster Lauf – kein Fallback verfügbar
    }

    function getBistroData(result, bistroName) {
        if (result?.status === 'fulfilled' && result.value) {
            const hasDishes = Object.values(result.value).some(d => d?.length > 0);
            if (hasDishes) return result.value;
        }

        if (oldMenusData?.updatedAt) {
            const ageHours = (Date.now() - new Date(oldMenusData.updatedAt).getTime()) / 3_600_000;
            if (ageHours <= 72) {
                const fb = {};
                for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
                    const d = (oldMenusData.days[day] || []).filter(x => x.bistro === bistroName);
                    if (d.length) fb[day] = d;
                }
                if (Object.keys(fb).length) {
                    console.log(`${bistroName}: Fallback auf Daten vom ${new Date(oldMenusData.updatedAt).toLocaleDateString('de-DE')}`);
                    return fb;
                }
            }
        }

        console.log(`${bistroName}: Keine aktuellen Daten verfügbar`);
        const ph = {};
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
            ph[day] = [{ name: 'Keine Daten vorhanden', price: '', description: '', type: 'meat' }];
        }
        return ph;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Helper for some environments
        });

        // Run scrapers in parallel, passing the browser instance but making it fail-safe
        const scrapeResults = await Promise.allSettled([
            scrapeBioCity(browser),
            scrapeFraunhofer(browser),
            scrapeTafelwerk(browser),
            scrapeNationalbibliothek(browser),
            scrapePorta(browser)
        ]);

        const biocity = getBistroData(scrapeResults[0], 'Bio-City');
        if (scrapeResults[0].status === 'rejected') console.error('Bio-City scraper failed:', scrapeResults[0].reason);

        const fraunhofer = getBistroData(scrapeResults[1], 'Fraunhofer');
        if (scrapeResults[1].status === 'rejected') console.error('Fraunhofer scraper failed:', scrapeResults[1].reason);

        const tafelwerk = getBistroData(scrapeResults[2], 'Tafelwerk');
        if (scrapeResults[2].status === 'rejected') console.error('Tafelwerk scraper failed:', scrapeResults[2].reason);

        const nationalbibliothek = getBistroData(scrapeResults[3], 'Nationalbibliothek');
        if (scrapeResults[3].status === 'rejected') console.error('Nationalbibliothek scraper failed:', scrapeResults[3].reason);

        const porta = getBistroData(scrapeResults[4], 'Porta');
        if (scrapeResults[4].status === 'rejected') console.error('Porta scraper failed:', scrapeResults[4].reason);

        const DishSchema = z.object({
            name: z.string().min(1),
            price: z.string(),
            description: z.string().optional().default(''),
            bistro: z.enum(['Bio-City', 'Fraunhofer', 'Tafelwerk', 'Nationalbibliothek', 'Porta']),
            type: z.string().optional(),
            isWeeklySpecial: z.boolean().optional()
        });

        // Helper to merge data
        const mergeData = (sourceData, bistroName) => {
            if (!sourceData) return;
            Object.keys(sourceData).forEach(day => {
                if (results.days[day]) {
                    const dishes = sourceData[day].map(dish => ({
                        ...dish,
                        bistro: bistroName
                    }));

                    const validDishes = [];
                    for (const dish of dishes) {
                        try {
                            const validDish = DishSchema.parse(dish);
                            validDishes.push(validDish);
                        } catch (e) {
                            console.warn(`Invalid dish found at ${bistroName} on ${day}:`, dish, `Errors:`, e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '));
                        }
                    }

                    results.days[day].push(...validDishes);
                }
            });
        };

        if (biocity) mergeData(biocity, 'Bio-City');
        if (fraunhofer) mergeData(fraunhofer, 'Fraunhofer');
        if (tafelwerk) mergeData(tafelwerk, 'Tafelwerk');
        if (nationalbibliothek) mergeData(nationalbibliothek, 'Nationalbibliothek');
        if (porta) mergeData(porta, 'Porta');

        // ... existing sorting and saving logic ...
        // Sort dishes by bistro name within each day
        Object.keys(results.days).forEach(day => {
            results.days[day].sort((a, b) => a.bistro.localeCompare(b.bistro));
        });

        // Save to public/data/menus.json
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'menus.json');
        // ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`Menu data saved to ${outputPath}`);

    } catch (error) {
        console.error('Error running scrapers:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

// Allow running directly
if (process.argv[1] === __filename) {
    runScrapers();
}

export { runScrapers };
