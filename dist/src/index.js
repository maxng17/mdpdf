import { copyFileSync, unlinkSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, resolve, parse as parsePath } from 'path';
import showdown from 'showdown';
const { setFlavor, Converter } = showdown;
import showdownEmoji from 'showdown-emoji';
import showdownHighlight from 'showdown-highlight';
import { existsSync } from 'fs';
import { launch } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import handlebars from 'handlebars';
const { SafeString, compile } = handlebars;
import { getStyles, getStyleBlock, qualifyImgSources } from './utils.js';
import { getOptions } from './puppeteer-helper.js';
import { DEFAULT_CSS, GITHUB_MARKDOWN_CSS, HIHGLIGHT_STYLES, DOC_BODY_TEMPLATE, HEADER_TEMPLATE, FOOTER_TEMPLATE } from './constants.js';
// Templates are now inline constants
async function getChromiumExecutable() {
    // Check for custom executable path from environment variable
    const customPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (customPath && existsSync(customPath)) {
        return customPath;
    }
    // Always use @sparticuz/chromium for serverless environments
    return await chromium.executablePath();
}
function getAllStyles() {
    const cssStyleSheets = [DEFAULT_CSS, HIHGLIGHT_STYLES, GITHUB_MARKDOWN_CSS];
    return {
        styles: getStyles(cssStyleSheets),
        styleBlock: getStyleBlock(cssStyleSheets),
    };
}
function parseMarkdownToHtml(markdown, convertEmojis, enableHighlight, simpleLineBreaks) {
    setFlavor('github');
    const options = {
        prefixHeaderId: false,
        ghCompatibleHeaderId: true,
        simpleLineBreaks,
        extensions: [],
    };
    // Sometimes emojis can mess with time representations
    // such as "00:00:00"
    if (convertEmojis) {
        options.extensions?.push(showdownEmoji());
    }
    if (enableHighlight) {
        options.extensions?.push(showdownHighlight());
    }
    const converter = new Converter(options);
    return converter.makeHtml(markdown);
}
async function prepareHeader(options) {
    const headerTemplate = compile(HEADER_TEMPLATE);
    const styles = getAllStyles();
    return headerTemplate({
        css: styles.styleBlock,
    });
}
async function prepareFooter(options) {
    const footerTemplate = compile(FOOTER_TEMPLATE);
    return footerTemplate({
        css: '', // Footer doesn't need CSS
    });
}
export async function convert(options) {
    const fullOptions = {
        source: options.source,
        destination: options.destination,
        assetDir: options.assetDir || dirname(resolve(options.source)),
        header: options.header,
        footer: options.footer,
        noEmoji: options.noEmoji,
        debug: options.debug,
        waitUntil: options.waitUntil,
        pdf: options.pdf,
    };
    const styles = getAllStyles();
    const simpleLineBreaks = false; // Always use GitHub-style line breaks
    const sourcePromise = readFile(fullOptions.source, 'utf8');
    const headerPromise = prepareHeader(fullOptions);
    const footerPromise = prepareFooter(fullOptions);
    const [source, header, footer] = await Promise.all([
        sourcePromise,
        headerPromise,
        footerPromise,
    ]);
    const html = parseMarkdownToHtml(source, !fullOptions.noEmoji, true, simpleLineBreaks);
    const layoutTemplate = compile(DOC_BODY_TEMPLATE);
    const qualifiedHtml = qualifyImgSources(html, { assetDir: fullOptions.assetDir });
    const finalHtml = layoutTemplate({
        css: styles.styleBlock,
        body: new SafeString(qualifiedHtml),
    });
    return createPdf(finalHtml, fullOptions);
}
async function createPdf(html, options) {
    const tempHtmlPath = resolve(dirname(options.destination), '_temp.html');
    let browser = null; // Initialize browser to null
    try {
        await writeFile(tempHtmlPath, html);
        const executablePath = await getChromiumExecutable();
        browser = await launch({
            headless: true, // Use boolean instead of 'new' string
            executablePath,
            args: chromium.args, // Always use serverless-optimized args
        });
        const page = (await browser.pages())[0];
        await page.goto('file:' + tempHtmlPath, {
            waitUntil: options.waitUntil ?? 'networkidle0',
        });
        // have to bypass by arguments
        // custom title support
        const targetTitle = options.pdf?.title
            ? options.pdf.title
            : parsePath(options.source).name;
        await page.evaluate((targetTitle) => {
            // overwrite title to fix https://github.com/elliotblackburn/mdpdf/issues/211
            document.title = targetTitle;
        }, targetTitle);
        const puppetOptions = getOptions(options);
        await page.pdf(puppetOptions);
        await browser.close();
        browser = null; // Indicate browser is closed
        if (options.debug) {
            copyFileSync(tempHtmlPath, options.debug);
        }
        return options.destination;
    }
    catch (error) {
        // Ensure browser is closed even if an error occurs
        if (browser) {
            try {
                await browser.close();
            }
            catch (closeError) {
                // Ignore close errors
            }
        }
        throw error;
    }
    finally {
        // Clean up temporary HTML file
        try {
            unlinkSync(tempHtmlPath);
        }
        catch (unlinkError) {
            // Ignore unlink errors
        }
    }
}
//# sourceMappingURL=index.js.map