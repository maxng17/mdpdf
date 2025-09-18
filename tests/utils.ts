import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MdPdfOptions } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptionsInput {
  source: string;
  destination?: string;
  debug?: boolean;
}

export function createOptions(options: OptionsInput): MdPdfOptions {
  const source = options.source;
  const destination =
    options.destination || source.slice(0, source.indexOf('.md')) + '.pdf';
  const debug = options.debug || false;

  return {
    source: resolve(source),
    destination: resolve(destination),
    assetDir: dirname(resolve(source)),
    header: null,
    debug: debug ? source.slice(0, source.indexOf('.md')) + '.html' : null,
    pdf: {
      format: 'A4',
      orientation: 'portrait',
      base: join('file://', __dirname, '/assets/'),
      header: {
        height: null,
      },
      border: {
        top: '10mm',
        left: '10mm',
        bottom: '10mm',
        right: '10mm',
      },
    },
  };
}
