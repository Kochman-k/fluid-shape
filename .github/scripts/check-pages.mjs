import { createHash } from 'node:crypto';

const site = process.env.SITE_URL;
const expectedHash = process.env.EXPECTED_INDEX_SHA;
if (!site || !expectedHash) throw new Error('SITE_URL and EXPECTED_INDEX_SHA are required');

async function request(url) {
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}

let lastError;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    const url = new URL(site);
    url.searchParams.set('deployment', process.env.GITHUB_RUN_ID || expectedHash.slice(0, 12));
    const html = await (await request(url)).text();
    const actualHash = createHash('sha256').update(html).digest('hex');
    if (actualHash !== expectedHash) throw new Error('The public site is still serving a different HTML build');
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
    const styles = [...html.matchAll(/<link\b[^>]*>/g)]
      .filter(match => /\brel="stylesheet"/.test(match[0]))
      .map(match => match[0].match(/\bhref="([^"]+)"/)?.[1])
      .filter(Boolean);
    if (!scripts.length || !styles.length) throw new Error('Compiled scripts or styles are missing');
    for (const [kind, paths] of [['script', scripts], ['style', styles]]) {
      for (const path of paths) {
        const response = await request(new URL(path, site));
        const mime = response.headers.get('content-type') || '';
        if (kind === 'script' ? !/javascript/.test(mime) : !/text\/css/.test(mime)) {
          throw new Error(`Incorrect ${kind} content type: ${path} (${mime})`);
        }
      }
    }
    console.log('Verified: the public site serves the current compiled HTML, JavaScript and CSS.');
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.log(`Publication check ${attempt}/12: ${error.message}`);
    if (attempt < 12) await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
throw lastError;
