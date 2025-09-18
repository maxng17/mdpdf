import { resolve } from 'path';
import { parse } from 'url';
import fileUrl from 'file-url';
import cheerio from 'cheerio';
const { load } = cheerio;
export function getStyleBlock(stylesheets) {
    // Format CSS strings into HTML to be placed in the header.
    // We do this because the normal <link...> doesn't work for the headers and footers.
    let styleHtml = '';
    for (const i in stylesheets) {
        if (Object.prototype.hasOwnProperty.call(stylesheets, i)) {
            const style = stylesheets[i];
            styleHtml += '<style>' + style + '</style>';
        }
    }
    return styleHtml;
}
export function getStyles(stylesheets) {
    let styleHtml = '';
    for (const i in stylesheets) {
        if (Object.prototype.hasOwnProperty.call(stylesheets, i)) {
            const style = stylesheets[i];
            styleHtml += style;
        }
    }
    return styleHtml;
}
export function hasAcceptableProtocol(src) {
    const acceptableProtocols = ['http:', 'https:'].join('|');
    const theUrl = parse(src);
    if (!theUrl.protocol) {
        return false;
    }
    return new RegExp(acceptableProtocols).test(src);
}
export function processSrc(src, options) {
    if (hasAcceptableProtocol(src)) {
        // The protocol is great and okay!
        return src;
    }
    // We need to convert it
    const resolvedSrc = resolve(options.assetDir, src);
    return fileUrl(resolvedSrc);
}
export function qualifyImgSources(html, options) {
    const $ = load(html);
    $('img').each((i, img) => {
        const imgElement = $(img);
        const src = imgElement.attr('src');
        if (src) {
            imgElement.attr('src', processSrc(src, options));
        }
    });
    return $.html();
}
//# sourceMappingURL=utils.js.map