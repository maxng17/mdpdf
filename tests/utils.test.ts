import { expect } from 'chai';
import { describe, it } from 'vitest';
import {
  getStyleBlock,
  getStyles,
  hasAcceptableProtocol,
  processSrc,
  qualifyImgSources,
} from '../src/utils.js';

describe('Utils - CSS functions', () => {
  it('getStyleBlock should wrap CSS content in style tags', () => {
    const cssStrings = ['body { color: red; }', 'h1 { color: blue; }'];
    const styleBlock = getStyleBlock(cssStrings);
    
    expect(styleBlock).to.include('<style>body { color: red; }</style>');
    expect(styleBlock).to.include('<style>h1 { color: blue; }</style>');
  });

  it('getStyles should concatenate CSS content without style tags', () => {
    const cssStrings = ['body { color: red; }', 'h1 { color: blue; }'];
    const styles = getStyles(cssStrings);
    
    expect(styles).to.include('body { color: red; }');
    expect(styles).to.include('h1 { color: blue; }');
    expect(styles).to.not.include('<style>');
    expect(styles).to.not.include('</style>');
  });
});

describe('Utils - URL functions', () => {
  it('hasAcceptableProtocol should accept http and https protocols', () => {
    expect(hasAcceptableProtocol('http://example.com')).to.be.true;
    expect(hasAcceptableProtocol('https://example.com')).to.be.true;
    expect(hasAcceptableProtocol('file:///path/to/file')).to.be.false;
    expect(hasAcceptableProtocol('ftp://example.com')).to.be.false;
    expect(hasAcceptableProtocol('relative/path')).to.be.false;
    expect(hasAcceptableProtocol('/absolute/path')).to.be.false;
  });

  it('processSrc should convert relative paths to file URLs', () => {
    const options = { assetDir: '/test/assets' };
    
    // Test with acceptable protocols (should remain unchanged)
    expect(processSrc('http://example.com/image.png', options)).to.equal('http://example.com/image.png');
    expect(processSrc('https://example.com/image.png', options)).to.equal('https://example.com/image.png');
    
    // Test with relative path (should be converted to file URL)
    const result = processSrc('img/test.png', options);
    expect(result.startsWith('file://')).to.be.true;
    expect(result.endsWith('/test/assets/img/test.png')).to.be.true;
  });

  it('qualifyImgSources should update image src attributes in HTML', () => {
    const options = { assetDir: '/test/assets' };
    const html = '<div><img src="image.png"><img src="https://example.com/remote.jpg"></div>';
    
    const result = qualifyImgSources(html, options);
    
    // Remote URL should remain unchanged
    expect(result).to.include('https://example.com/remote.jpg');
    
    // Local path should be converted to file URL
    expect(result).to.include('file://');
    expect(result).to.include('/test/assets/image.png');
  });
});