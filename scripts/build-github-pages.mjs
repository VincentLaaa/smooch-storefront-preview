import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Render the theme into the existing Pages checkout, retaining its cart demo shim.
const root = fileURLToPath(new URL('..', import.meta.url));
const target = resolve(root, process.argv[2] || 'dist/github-pages');
const prefix = '/smooch-storefront-preview';
const origin = 'http://127.0.0.1:9393';
const routes = ['/', '/products/smooch-daily-gummies-qa', '/products/smooch-daily-gummies-qa-single', '/pages/faq', '/pages/contact'];
await readFile(join(target, '.git')); // Require the isolated publication checkout.
const server = spawn(process.execPath, ['dev/server.mjs'], {
  cwd: root, env: { ...process.env, PORT: '9393' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let startupError = '';
server.stderr.on('data', data => { startupError += data.toString(); });
server.stdout.resume();
const rebase = html => html
  .replace(/\b(src|href|action|poster)="\/(?!\/)/g, `$1="${prefix}/`)
  .replace(/(['"])\/(assets|dev-assets)\//g, `$1${prefix}/$2/`)
  .replace(/\bsrcset="([^"]*)"/g, (_, values) => `srcset="${values.replace(/(^|,\s*)\/(?!\/)/g, `$1${prefix}/`)}"`)
  .replaceAll(origin, 'https://vincentlaaa.github.io' + prefix);
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(startupError || 'Render server exited');
    try { ready = (await fetch(origin)).ok; } catch { /* Server is starting. */ }
    if (ready) break;
    await new Promise(done => setTimeout(done, 250));
  }
  if (!ready) throw new Error('Render server did not start');
  await cp(join(root, 'assets'), join(target, 'assets'), { recursive: true });
  await cp(join(root, 'dev/public'), join(target, 'dev-assets'), { recursive: true });
  for (const route of routes) {
    const destination = join(target, route.slice(1), 'index.html');
    const previous = await readFile(destination, 'utf8');
    const cart = previous.match(/<script type="application\/json" id="smooch-preview-cart-fixture">[\s\S]*?<\/script><script src="[^"]*preview-cart-shim\.js"><\/script>/)?.[0] || '';
    const response = await fetch(origin + route);
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
    let html = rebase(await response.text());
    if (cart) html = html.replace('</body>', `${cart}</body>`);
    await mkdir(join(target, route.slice(1)), { recursive: true });
    await writeFile(destination, html.replace(/[\t ]+$/gm, ''));
    console.log(`Rendered ${route}${cart ? ' with cart preview' : ''}`);
  }
  await writeFile(join(target, '.nojekyll'), '');
} finally {
  server.kill();
}
