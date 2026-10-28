// Prints the user manuals to PDF with Chromium (shapes Sinhala and Tamil correctly).
// Run from the admin repo root: node docs/manuals/src/build.mjs [name ...]
// Writes docs/manuals/<name>.pdf for each src/<name>.html (app-manual.en, console-manual.en, ...).

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const src = dirname(fileURLToPath(import.meta.url));
const out = dirname(src);

const FOOTER = {
  en: { 'console-manual': 'Admin Console User Manual', 'app-manual': 'Supplier App User Manual', page: 'Page' },
  si: { 'console-manual': 'පරිපාලන කොන්සෝලය: පරිශීලක අත්පොත', 'app-manual': 'සැපයුම්කරු යෙදුම: පරිශීලක අත්පොත', page: 'පිටුව' },
  ta: { 'console-manual': 'நிர்வாகக் கன்சோல்: பயனர் கையேடு', 'app-manual': 'வழங்குநர் செயலி: பயனர் கையேடு', page: 'பக்கம்' },
};

const wanted = process.argv.slice(2);
const names = readdirSync(src)
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.slice(0, -5))
  .filter((name) => wanted.length === 0 || wanted.includes(name));

const browser = await chromium.launch();
try {
  for (const name of names) {
    const [doc, lang] = name.split('.');
    const words = FOOTER[lang] ?? FOOTER.en;
    const page = await browser.newPage();
    await page.goto(pathToFileURL(join(src, `${name}.html`)).href, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
    });
    const file = join(out, `${name}.pdf`);
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#5b6b63;padding:0 16mm;display:flex;justify-content:space-between;font-family:'Sinhala Sangam MN','Tamil Sangam MN',-apple-system,Arial,sans-serif;"><span>Tea Factory Digital · ${words[doc] ?? ''}</span><span>${words.page} <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await page.close();
    console.log(`wrote ${file}`);
  }
} finally {
  await browser.close();
}
