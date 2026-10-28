// Prints the logic handbooks to PDF with Chromium, which shapes Sinhala and Tamil correctly.
// Run from the admin repo root: node docs/handbooks/src/build.mjs [name ...]
// Writes docs/handbooks/<name>.pdf for each src/<name>.html (console.en, app.si, ...).

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const src = dirname(fileURLToPath(import.meta.url));
const out = dirname(src);

const FOOTER = {
  en: { console: 'Admin Console: How It Works', app: 'Supplier App: How It Works', page: 'Page' },
  si: { console: 'පරිපාලන කොන්සෝලය: ක්‍රියා කරන ආකාරය', app: 'සැපයුම්කරු යෙදුම: ක්‍රියා කරන ආකාරය', page: 'පිටුව' },
  ta: { console: 'நிர்வாகக் கன்சோல்: இது எவ்வாறு செயல்படுகிறது', app: 'வழங்குநர் செயலி: இது எவ்வாறு செயல்படுகிறது', page: 'பக்கம்' },
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
    await page.evaluate(() => document.fonts.ready);
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
