import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function resolveWithExtension(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' || /\.(mjs|cjs|js|ts|tsx|json)$/.test(specifier)) throw err;
    let last = err;
    for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
      try { return await nextResolve(specifier + ext, context); }
      catch (e) { last = e; }
    }
    throw last;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(join(root, specifier.slice(2))).href;
  return resolveWithExtension(specifier, context, nextResolve);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const source = `export default ${readFileSync(fileURLToPath(url), 'utf8')};\n`;
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
