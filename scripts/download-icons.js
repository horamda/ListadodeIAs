const fs = require('fs/promises');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const iconsDir = path.join(rootDir, 'assets', 'icons');

function getToolDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function getIconFileName(tool) {
  const safeName = tool.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeName || 'ia'}-icono.png`;
}

async function readTools() {
  const html = await fs.readFile(indexPath, 'utf8');
  const match = html.match(/const aiTools = (\[[\s\S]*?\]);/);

  if (!match) {
    throw new Error('No se encontro el arreglo aiTools en index.html.');
  }

  return Function(`"use strict"; return (${match[1]});`)();
}

async function downloadIcon(tool) {
  const domain = getToolDomain(tool.url);
  const iconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  const targetPath = path.join(iconsDir, getIconFileName(tool));
  const response = await fetch(iconUrl);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);

  return { name: tool.name, fileName: path.basename(targetPath), bytes: buffer.length };
}

async function main() {
  const tools = await readTools();
  await fs.mkdir(iconsDir, { recursive: true });

  const results = [];
  const failures = [];

  for (const tool of tools) {
    try {
      results.push(await downloadIcon(tool));
    } catch (error) {
      failures.push({ name: tool.name, message: error.message });
    }
  }

  console.log(`Iconos descargados: ${results.length}`);
  for (const result of results) {
    console.log(`- ${result.fileName} (${result.bytes} bytes)`);
  }

  if (failures.length > 0) {
    console.error(`Errores: ${failures.length}`);
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
