import { expect } from 'chai';
import { convert } from '../src/index.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { afterEach, describe, it } from 'vitest';

describe('Error Handling', () => {
  const outputPath = resolve(__dirname, 'error-test-output.pdf');
  const validMarkdownPath = resolve(__dirname, 'test.md');
  const nonExistentPath = resolve(__dirname, 'non-existent.md');
  const tempDir = resolve(__dirname);

  afterEach(() => {
    // Clean up any generated files
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
    }
  });

  it('should throw an error when source is not provided', async () => {
    try {
      await convert({
        source: '',
        destination: outputPath,
        assetDir: tempDir,
      });
      // Should not reach here
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('Source path must be provided');
    }
  });
  
  it('should throw an error when destination is not provided', async () => {
    try {
      await convert({
        source: validMarkdownPath,
        destination: '',
        assetDir: tempDir,
      });
      // Should not reach here
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('Destination path must be provided');
    }
  });
  
  it('should throw an error when source file does not exist', async () => {
    try {
      await convert({
        source: nonExistentPath,
        destination: outputPath,
        assetDir: tempDir,
      });
      // Should not reach here
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('ENOENT');
    }
  });
});