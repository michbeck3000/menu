const WEBSITE_URL = 'https://porta.de/einrichtungshaeuser/leipzig';

export async function scrapePorta(browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(WEBSITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const pdfUrl = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const pdfLink = links.find(a => 
                a.href && 
                a.href.toLowerCase().includes('.pdf') &&
                a.textContent && 
                a.textContent.toLowerCase().includes('mittagsangebote')
            );
            return pdfLink ? pdfLink.href : null;
        });

        if (!pdfUrl) {
            console.warn('Porta: No PDF link found with "Mittagsangebote". Proceeding anyway...');
        } else {
            console.log('Porta: Found PDF URL:', pdfUrl);
        }

        const urlArg = pdfUrl || "";

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
            console.warn('Porta: Could not find Python with pdfplumber');
            return {};
        }

        const { fileURLToPath } = await import('url');
        const { dirname, join } = await import('path');
        const { execSync: exec } = await import('child_process');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const scriptPath = join(__dirname, 'porta.py');

        const resultBuffer = exec(`${pythonCmd} "${scriptPath}" "${urlArg}"`);
        const resultRaw = resultBuffer.toString().trim();

        try {
            const menuData = JSON.parse(resultRaw);
            if (menuData.error) {
                console.warn('Porta python error:', menuData.error);
                return {};
            }
            return menuData;
        } catch (parseError) {
            console.warn('Porta: Failed to parse output:', resultRaw.substring(0, 100));
            return {};
        }

    } catch (error) {
        console.warn('Porta scraper error:', error.message);
        return {};
    } finally {
        if (page) await page.close();
    }
}
