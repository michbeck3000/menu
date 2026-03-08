import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PAGE_URL = 'https://www.cafeteria-leipzig.de/cafeteria-fraunhofer-izi/';

export async function scrapeFraunhofer(browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Step 1: Find the PDF download link on the page
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        const pdfUrl = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const pdfLink = links.find(a =>
                a.href.toLowerCase().includes('.pdf') ||
                a.href.toLowerCase().includes('speiseplan')
            );
            return pdfLink ? pdfLink.href : null;
        });

        if (!pdfUrl) {
            console.warn('Fraunhofer: No PDF link found on page');
            return {};
        }

        console.log('Fraunhofer: Found PDF URL:', pdfUrl);

        // Step 2: Use Python script to parse the PDF
        // Try to find a python executable that has pdfplumber installed
        const pythonCandidates = [
            'python3',
            'python',
            '/Library/Developer/CommandLineTools/usr/bin/python3',
            '/usr/bin/python3',
            '/opt/homebrew/bin/python3'
        ];

        let pythonCmd = null;
        for (const cmd of pythonCandidates) {
            try {
                // Check if this python has pdfplumber
                execSync(`${cmd} -c "import pdfplumber"`, { stdio: 'ignore' });
                pythonCmd = cmd;
                break;
            } catch (e) {
                // Ignore and try next
            }
        }

        if (!pythonCmd) {
            console.warn('Fraunhofer: Could not find a Python executable with pdfplumber installed.');
            console.warn('Please run: pip3 install pdfplumber requests');
            return {};
        }

        console.log(`Fraunhofer: Executing Python script via ${pythonCmd}...`);

        // Execute the script and capture stdout
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const scriptPath = join(__dirname, 'fraunhofer.py');

        const resultBuffer = execSync(`${pythonCmd} "${scriptPath}" "${pdfUrl}"`);
        const resultRaw = resultBuffer.toString().trim();

        // Step 3: Parse JSON result
        try {
            const menuData = JSON.parse(resultRaw);
            if (menuData.error) {
                console.warn('Fraunhofer python script error:', menuData.error);
                return {};
            }
            return menuData;
        } catch (parseError) {
            console.warn('Fraunhofer: Failed to parse Python script output:', resultRaw.substring(0, 100));
            return {};
        }
    } catch (error) {
        console.warn('Fraunhofer scraper error:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
