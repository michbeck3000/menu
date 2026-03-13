const URL = 'https://saxonia-catering.de/saxonia-catering-betriebsrestaurants.html';

export async function scrapeNationalbibliothek(browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const pdfUrl = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const pdfLink = links.find(a => 
                a.href && a.href.includes('DNB_') && a.href.toLowerCase().includes('.pdf')
            );
            return pdfLink ? pdfLink.href : null;
        });

        if (!pdfUrl) {
            console.warn('Nationalbibliothek: No PDF link found');
            return {};
        }

        console.log('Nationalbibliothek: Found PDF URL:', pdfUrl);

        const { execSync } = await import('child_process');
        
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
                execSync(`${cmd} -c "import pdfplumber"`, { stdio: 'ignore' });
                pythonCmd = cmd;
                break;
            } catch (e) {
                // Ignore
            }
        }

        if (!pythonCmd) {
            console.warn('Nationalbibliothek: Could not find Python with pdfplumber');
            return {};
        }

        const { fileURLToPath } = await import('url');
        const { dirname, join } = await import('path');
        const { execSync: exec } = await import('child_process');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const scriptPath = join(__dirname, 'nationalbibliothek.py');

        const resultBuffer = exec(`${pythonCmd} "${scriptPath}" "${pdfUrl}"`);
        const resultRaw = resultBuffer.toString().trim();

        try {
            const menuData = JSON.parse(resultRaw);
            if (menuData.error) {
                console.warn('Nationalbibliothek python error:', menuData.error);
                return {};
            }
            return menuData;
        } catch (parseError) {
            console.warn('Nationalbibliothek: Failed to parse output:', resultRaw.substring(0, 100));
            return {};
        }

    } catch (error) {
        console.warn('Nationalbibliothek scraper error:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
