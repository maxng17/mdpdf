import {
  access as fsAccess,
  constants as fsConstants,
  unlinkSync,
  existsSync,
  readFileSync,
} from 'fs';
import should from 'should';
should; // Import should to extend Object.prototype
import { execa } from 'execa';
import { convert } from '../src/index.js';
import { createOptions } from './utils.js';

function clean() {
  const filesToRemove = [
    './README.pdf',
    './README.html',
    './output.pdf',
    './test-img-output.pdf',
    './tests/test.html'
  ];

  filesToRemove.forEach((file) => {
    // Use a synchronous approach to avoid callback issues
    try {
      if (existsSync(file)) {
        unlinkSync(file);
        console.log(`Cleaned up: ${file}`);
      }
    } catch (err) {
      console.error(`Error cleaning file ${file}:`, err);
    }
  });
}

describe('Convert CLI', function () {
  this.timeout(180000);

  after(clean);
  beforeEach(clean);

  context('when given a markdown file', () => {
    it('creates a pdf', (done) => {
      console.log('Starting test: creates a pdf');
      execa('node', ['./dist/bin/index.js', './README.md'], { timeout: 60000 })
        .then((result) => {
          console.log('Command completed successfully');
          const stdout = result.stdout;
          const pdfExists = existsSync('./README.pdf');
          
          console.log('PDF exists:', pdfExists);
          console.log('Stdout:', stdout);

          should(pdfExists).be.true();
          should(stdout).endWith('README.pdf');

          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });
  });

  context('when passed debug flag', () => {
    it('creates a pdf and html file', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting test: creates a pdf and html file');
      execa('node', ['./dist/bin/index.js', './README.md', '--debug'], { timeout: 20000 })
        .then((result) => {
          console.log('Command completed successfully');
          const stdout = result.stdout;
          const pdfExists = existsSync('./README.pdf');
          const htmlExists = existsSync('./README.html');
          
          console.log('PDF exists:', pdfExists, 'HTML exists:', htmlExists);
          console.log('Stdout:', stdout);

          should(pdfExists).be.true();
          should(htmlExists).be.true();
          should(stdout).endWith('README.pdf');

          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });
  });

  context('when passed a destination', () => {
    it('creates a pdf at the specified destination', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting test: creates a pdf at the specified destination');
      execa('node', ['./dist/bin/index.js', './README.md', 'output.pdf'], { timeout: 20000 })
        .then((result) => {
          console.log('Command completed successfully');
          const stdout = result.stdout;
          const pdfExists = existsSync('./output.pdf');
          
          console.log('PDF exists:', pdfExists);
          console.log('Stdout:', stdout);

          should(pdfExists).be.true();
          should(stdout).endWith('output.pdf');

          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });
  });

  context('when given markdown with an image', () => {
    it('creates a pdf', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting test: creates a pdf with image');
      execa('node', ['./dist/bin/index.js', './tests/test.md', './test-img-output.pdf'], { timeout: 20000 })
        .then((result) => {
          console.log('Command completed successfully');
          const stdout = result.stdout;
          const pdfExists = existsSync('./test-img-output.pdf');
          
          console.log('PDF exists:', pdfExists);
          console.log('Stdout:', stdout);

          should(pdfExists).be.true();
          should(stdout).endWith('test-img-output.pdf');

          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });
  });

  context('When custom style is passed', () => {
    it('HTML file contains the custom style', function(done) {
      this.timeout(30000); // Increase timeout for this test
      execa('node', ['./dist/bin/index.js', './tests/test.md', '--style=./tests/test.css', '--debug'])
        .then(() => {
          const htmlContent = readFileSync('./tests/test.html', 'utf8');
          const cssContent = readFileSync('./tests/test.css', 'utf8');
          const ghStyleContent = readFileSync('./src/assets/github-markdown-css.css', 'utf8');

          should(htmlContent.includes(cssContent)).be.true();
          should(htmlContent.includes(ghStyleContent)).be.false();
          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });

    it('HTML file contains the default styles when --gh-style is passed', function(done) {
      this.timeout(30000); // Increase timeout for this test
      execa('node', ['./dist/bin/index.js', './tests/test.md', '--style=./tests/test.css', '--debug', '--gh-style'])
        .then(() => {
          const htmlContent = readFileSync('./tests/test.html', 'utf8');
          const cssContent = readFileSync('./tests/test.css', 'utf8');
          const ghStyleContent = readFileSync('./src/assets/github-markdown-css.css', 'utf8');

          should(htmlContent.includes(cssContent)).be.true();
          should(htmlContent.includes(ghStyleContent)).be.true();
          done();
        })
        .catch((err) => {
          console.error('Test error:', err.message);
          done(err);
        });
    });
  });
});

describe('Convert API', function () {
  this.timeout(180000);

  after(clean);
  beforeEach(clean);

  context('when given a markdown source', () => {
    it('creates a pdf', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting API test: creates a pdf');
      const options = createOptions({
        source: 'README.md',
      });
      convert(options)
        .then((pdfPath) => {
          console.log('Convert completed successfully');
          const pdfExists = existsSync('./README.pdf');
          console.log('PDF exists:', pdfExists);

          should(pdfExists).be.true();

          done();
        })
        .catch((err) => {
          console.error('API test error:', err.message);
          done(err);
        });
    });
  });

  context('when debug is true', () => {
    it('creates a html file', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting API test: creates a html file');
      const options = createOptions({
        source: 'README.md',
        debug: true,
      });
      convert(options)
        .then((pdfPath) => {
          console.log('Convert completed successfully');
          const pdfExists = existsSync('./README.pdf');
          const htmlExists = existsSync('./README.html');
          console.log('PDF exists:', pdfExists, 'HTML exists:', htmlExists);

          should(pdfExists).be.true();
          should(htmlExists).be.true();

          done();
        })
        .catch((err) => {
          console.error('API test error:', err.message);
          done(err);
        });
    });
  });

  context('when destination is set', () => {
    it('creates a pdf at the destination', function(done) {
      this.timeout(30000); // Increase timeout
      console.log('Starting API test: creates a pdf at the destination');
      const options = createOptions({
        source: 'README.md',
        destination: 'output.pdf',
      });
      convert(options)
        .then((pdfPath) => {
          console.log('Convert completed successfully');
          const pdfExists = existsSync('./output.pdf');
          console.log('PDF exists:', pdfExists);

          should(pdfExists).be.true();

          done();
        })
        .catch((err) => {
          console.error('API test error:', err.message);
          done(err);
        });
    });
  });
});