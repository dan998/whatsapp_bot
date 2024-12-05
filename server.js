const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const tldjs = require('tldjs');
const fs = require('fs');
const { Parser } = require('json2csv');

const app = express();
const port = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Helper function to find all links on a page
async function findLinks(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const links = [];

        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (href && !href.startsWith('#')) {
                links.push(href);
            }
        });

        return links;
    } catch (error) {
        console.error(`Error fetching URL: ${url}`, error.message);
        return [];
    }
}

// Helper function to filter subdomains
function filterSubdomains(links, baseDomain) {
    return links
        .filter((link) => tldjs.getDomain(link) === baseDomain)
        .map((link) => tldjs.parse(link).hostname)
        .filter((hostname, index, array) => array.indexOf(hostname) === index);
}

// Helper function to check for zero-rated links
function findZeroRatedLinks(links, baseDomain) {
    return links.filter((link) => link.startsWith('http://') || link.startsWith('https://')).filter((link) => {
        const domain = tldjs.getDomain(link);
        return domain !== baseDomain;
    });
}

// Route to analyze a website
app.post('/analyze', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const baseDomain = tldjs.getDomain(url);
        const links = await findLinks(url);

        const subdomains = filterSubdomains(links, baseDomain);
        const zeroRatedLinks = findZeroRatedLinks(links, baseDomain);

        const result = {
            url,
            baseDomain,
            subdomains,
            zeroRatedLinks,
        };

        res.json(result);
    } catch (error) {
        console.error('Error analyzing the site:', error.message);
        res.status(500).json({ error: 'Failed to analyze the site.' });
    }
});

// Route to download results
app.post('/download', async (req, res) => {
    const { url, format } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const baseDomain = tldjs.getDomain(url);
        const links = await findLinks(url);

        const subdomains = filterSubdomains(links, baseDomain);
        const zeroRatedLinks = findZeroRatedLinks(links, baseDomain);

        const result = {
            url,
            baseDomain,
            subdomains,
            zeroRatedLinks,
        };

        // Generate the file
        if (format === 'json') {
            const jsonPath = './results.json';
            fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
            res.download(jsonPath);
        } else if (format === 'csv') {
            const csvFields = ['url', 'baseDomain', 'subdomains', 'zeroRatedLinks'];
            const parser = new Parser({ fields: csvFields });
            const csv = parser.parse(result);

            const csvPath = './results.csv';
            fs.writeFileSync(csvPath, csv);
            res.download(csvPath);
        } else {
            res.status(400).json({ error: 'Invalid format. Use "json" or "csv".' });
        }
    } catch (error) {
        console.error('Error generating download file:', error.message);
        res.status(500).json({ error: 'Failed to generate the file.' });
    }
});

// Route to serve results in an HTML page
app.get('/results', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('<h1>URL is required</h1>');
    }

    try {
        const baseDomain = tldjs.getDomain(url);
        const links = await findLinks(url);

        const subdomains = filterSubdomains(links, baseDomain);
        const zeroRatedLinks = findZeroRatedLinks(links, baseDomain);

        const html = `
        <html>
            <head><title>Results</title></head>
            <body>
                <h1>Results for ${url}</h1>
                <h2>Subdomains:</h2>
                <ul>${subdomains.map((sub) => `<li>${sub}</li>`).join('')}</ul>
                <h2>Zero-Rated Links:</h2>
                <ul>${zeroRatedLinks.map((link) => `<li>${link}</li>`).join('')}</ul>
                <a href="/">Go Back</a>
            </body>
        </html>`;
        res.send(html);
    } catch (error) {
        console.error('Error generating HTML:', error.message);
        res.status(500).send('<h1>Failed to generate the results page</h1>');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
