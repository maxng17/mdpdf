import {
  readFile as _readFile,
  writeFile as _writeFile,
  copyFileSync,
  unlinkSync
} from 'fs';
import { join, dirname, resolve } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import showdown from 'showdown';
const { setFlavor, Converter } = showdown;
import showdownEmoji from 'showdown-emoji';
import showdownHighlight from 'showdown-highlight';
import { launch } from 'puppeteer';
import handlebars from 'handlebars';
const { SafeString, compile } = handlebars;
import { allowUnsafeNewFunction } from 'loophole';
import { getStyles, getStyleBlock, qualifyImgSources } from './utils.js';
import { getOptions } from './puppeteer-helper.js';

const readFile = promisify(_readFile);
const writeFile = promisify(_writeFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Main layout template
const layoutPath = join(__dirname, '/layouts/doc-body.hbs');
const headerLayoutPath = join(__dirname, '/layouts/header.hbs');
const footerLayoutPath = join(__dirname, '/layouts/footer.hbs');

function getAllStyles(options) {
  const cssStyleSheets = [];

  // GitHub Markdown Style
  if (options.ghStyle) {
    cssStyleSheets.push(join(__dirname, '/assets/github-markdown-css.css'));
  }
  // Highlight CSS
  cssStyleSheets.push(join(__dirname, '/assets/highlight/styles/github.css'));

  // Some additional defaults such as margins
  if (options.defaultStyle) {
    cssStyleSheets.push(join(__dirname, '/assets/default.css'));
  }

  // Optional user given CSS
  if (options.styles) {
    cssStyleSheets.push(options.styles);
  }

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
    extensions: []
  };
  
  // Sometimes emojis can mess with time representations
  // such as "00:00:00"
  if (convertEmojis) {
    options.extensions.push(showdownEmoji);
  }

  if (enableHighlight) {
    options.extensions.push(showdownHighlight)
  }

  const converter = new Converter(options);

  return converter.makeHtml(markdown);
}

export async function convert(options) {
  options = options || {};
  if (!options.source) {
    throw new Error('Source path must be provided');
  }

  if (!options.destination) {
    throw new Error('Destination path must be provided');
  }

  options.assetDir = dirname(resolve(options.source));

  const styles = getAllStyles(options);
  let css = new SafeString(styles.styleBlock);
  const local = {
    css: css,
  };

  // Asynchronously read files and prepare components
  const layoutPromise = readFile(layoutPath, 'utf8').then(compile);
  const sourcePromise = readFile(options.source, 'utf8');
  const headerPromise = prepareHeader(options, styles.styles);
  const footerPromise = prepareFooter(options);

  const [layoutTemplate, sourceMarkdown, headerHtml, footerHtml] = await Promise.all([
    layoutPromise,
    sourcePromise,
    headerPromise,
    footerPromise,
  ]);

  options.header = headerHtml;
  options.footer = footerHtml;

  const emojis = !options.noEmoji;
  const syntaxHighlighting = !options.noHighlight;
  const simpleLineBreaks = !options.ghStyle;
  let content = parseMarkdownToHtml(sourceMarkdown, emojis, syntaxHighlighting, simpleLineBreaks);

  content = qualifyImgSources(content, options);

  local.body = new SafeString(content);
    
  // Use loophole for this body template to avoid issues with editor extensions
  const html = allowUnsafeNewFunction(() => layoutTemplate(local)); // Use layoutTemplate from Promise.all
    
  return await createPdf(html, options); // Add await
}
    
async function prepareHeader(options, css) {
  if (!options.header) {
    return undefined; // Return early if no header
  }
    
  // Get the hbs layout
  const headerLayoutContent = await readFile(headerLayoutPath, 'utf8');
  const headerTemplate = compile(headerLayoutContent);
    
  // Get the header html
  const headerContent = await readFile(options.header, 'utf8');
  const preparedHeader = qualifyImgSources(headerContent, options);
    
  // Compile the header template
  const headerHtml = headerTemplate({
    content: new SafeString(preparedHeader),
    css: new SafeString(css.replace(/"/gm, "'")),
  });
    
  return headerHtml;
}

function prepareFooter(options) {
  if (options.footer) {
    return readFile(options.footer, 'utf8').then((footerContent) => {
      const preparedFooter = qualifyImgSources(footerContent, options);

      return preparedFooter;
    });
  } else {
    return Promise.resolve();
  }
}
    
async function createPdf(html, options) {
  const tempHtmlPath = resolve(dirname(options.destination), '_temp.html');
  let browser = null; // Initialize browser to null
    
  try {
    await writeFile(tempHtmlPath, html);
    
    browser = await launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = (await browser.pages())[0];
    await page.goto('file:' + tempHtmlPath, { waitUntil: options.waitUntil ?? 'networkidle0' });
    
    const puppetOptions = getOptions(options);
    await page.pdf(puppetOptions);
    
    await browser.close();
    browser = null; // Indicate browser is closed
    
    if (options.debug) {
      copyFileSync(tempHtmlPath, options.debug);
    }
    // unlinkSync moved to finally block
    
    return options.destination;
  } catch (error) {
    // Ensure browser is closed even if an error occurs
    if (browser) {
      await browser.close();
    }
    // Re-throw the error to be handled by the caller
    throw error;
  } finally {
    // Clean up temp file in case of error or success
    try {
      unlinkSync(tempHtmlPath);
    } catch (e) {
      // Ignore errors if the file doesn't exist or couldn't be deleted
    }
  }
}
