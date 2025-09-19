import { copyFileSync, unlinkSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, resolve, parse as parsePath } from 'path';
import showdown from 'showdown';
const { setFlavor, Converter } = showdown;
import showdownEmoji from 'showdown-emoji';
import showdownHighlight from 'showdown-highlight';
import { launch, type Browser } from 'puppeteer';
import handlebars from 'handlebars';
const { SafeString, compile } = handlebars;
import { allowUnsafeNewFunction } from 'loophole';
import { getStyles, getStyleBlock, qualifyImgSources } from './utils.js';
import { getOptions } from './puppeteer-helper.js';
import type { MdPdfOptions } from './types.js';
import { DEFAULT_CSS, GITHUB_MARKDOWN_CSS, HIHGLIGHT_STYLES, DOC_BODY_TEMPLATE, HEADER_TEMPLATE, FOOTER_TEMPLATE } from './constants.js';


// Templates are now inline constants

interface MdPdfStyles {
  styles: string;
  styleBlock: string;
}

function getAllStyles(): MdPdfStyles {
  const cssStyleSheets = [DEFAULT_CSS, HIHGLIGHT_STYLES, GITHUB_MARKDOWN_CSS];

  return {
    styles: getStyles(cssStyleSheets),
    styleBlock: getStyleBlock(cssStyleSheets),
  };
}

function parseMarkdownToHtml(
  markdown: string,
  convertEmojis: boolean,
  enableHighlight: boolean,
  simpleLineBreaks: boolean
): string {
  setFlavor('github');
  const options: showdown.ConverterOptions = {
    prefixHeaderId: false,
    ghCompatibleHeaderId: true,
    simpleLineBreaks,
    extensions: [],
  };

  // Sometimes emojis can mess with time representations
  // such as "00:00:00"
  if (convertEmojis) {
    options.extensions!.push(showdownEmoji);
  }

  if (enableHighlight) {
    options.extensions!.push(showdownHighlight);
  }

  const converter = new Converter(options);

  return converter.makeHtml(markdown);
}

export async function convert(
  options?: Partial<MdPdfOptions>
): Promise<string> {
  if (!options?.source) {
    throw new Error('Source path must be provided');
  }

  if (!options.destination) {
    throw new Error('Destination path must be provided');
  }

  // Create a complete options object with required properties
  const fullOptions: MdPdfOptions = {
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
  const css = new SafeString(styles.styleBlock);
  const local: {
    css: typeof SafeString.prototype;
    body?: typeof SafeString.prototype;
  } = {
    css: css,
  };

  // Asynchronously read files and prepare components
  const layoutTemplate = compile(DOC_BODY_TEMPLATE);
  const sourcePromise = readFile(fullOptions.source, 'utf8');
  const headerPromise = prepareHeader(fullOptions, styles.styles);
  const footerPromise = prepareFooter(fullOptions);

  const [sourceMarkdown, headerHtml, footerHtml] =
    await Promise.all([
      sourcePromise,
      headerPromise,
      footerPromise,
    ]);

  fullOptions.header = headerHtml;
  fullOptions.footer = footerHtml;

  const emojis = !fullOptions.noEmoji;
  const syntaxHighlighting = true; // Always enable syntax highlighting
  const simpleLineBreaks = false; // Always use GitHub-style line breaks
  let content = parseMarkdownToHtml(
    sourceMarkdown,
    emojis,
    syntaxHighlighting,
    simpleLineBreaks
  );

  content = qualifyImgSources(content, fullOptions);

  local.body = new SafeString(content);

  // Use loophole for this body template to avoid issues with editor extensions
  const html = allowUnsafeNewFunction(() => layoutTemplate(local));

  return await createPdf(html, fullOptions);
}

async function prepareHeader(
  options: MdPdfOptions,
  css: string
): Promise<string | undefined> {
  if (!options.header) {
    return undefined; // Return early if no header
  }

  // Use inline template
  const headerTemplate = compile(HEADER_TEMPLATE);

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

function prepareFooter(options: MdPdfOptions): Promise<string | undefined> {
  if (options.footer) {
    return readFile(options.footer, 'utf8').then((footerContent) => {
      const preparedFooter = qualifyImgSources(footerContent, options);
      
      // Use inline template
      const footerTemplate = compile(FOOTER_TEMPLATE);
      const footerHtml = footerTemplate({
        content: new SafeString(preparedFooter),
        css: new SafeString(''), // Footer doesn't need CSS styling
      });

      return footerHtml;
    });
  } else {
    return Promise.resolve(undefined);
  }
}

async function createPdf(html: string, options: MdPdfOptions): Promise<string> {
  const tempHtmlPath = resolve(dirname(options.destination), '_temp.html');

  let browser: Browser | null = null; // Initialize browser to null

  try {
    await writeFile(tempHtmlPath, html);

    browser = await launch({
      headless: true, // Use boolean instead of 'new' string
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
    } catch (_e) {
      // Ignore errors if the file doesn't exist or couldn't be deleted
    }
  }
}
