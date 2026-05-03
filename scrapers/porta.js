export async function scrapePorta(browser) {
    try {
        const { execSync } = await import('child_process');
        const { fileURLToPath } = await import('url');
        const { dirname, join } = await import('path');
        const { execSync: exec } = await import('child_process');

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
                execSync(`${cmd} -c "print(1)"`, { stdio: 'ignore' });
                pythonCmd = cmd;
                break;
            } catch (e) {
                // Ignore
            }
        }

        if (!pythonCmd) {
            console.warn('Porta: Could not find Python');
            return {};
        }

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const scriptPath = join(__dirname, 'porta.py');

        const resultBuffer = exec(`${pythonCmd} "${scriptPath}"`);
        const resultRaw = resultBuffer.toString().trim();

        const menuData = JSON.parse(resultRaw);
        if (menuData.error) {
            console.warn('Porta python error:', menuData.error);
            return {};
        }
        return menuData;

    } catch (error) {
        console.warn('Porta scraper error:', error.message);
        return {};
    }
}