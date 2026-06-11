import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function main() {
  const svg192 = readFileSync(join(publicDir, 'icon-192.svg'));
  const svg512 = readFileSync(join(publicDir, 'icon-512.svg'));

  await sharp(svg192).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'));
  await sharp(svg512).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'));
  await sharp(svg192).resize(48, 48).png().toFile(join(publicDir, 'favicon-48.png'));
  await sharp(svg192).resize(96, 96).png().toFile(join(publicDir, 'favicon-96.png'));

  console.log('PNG icons generated successfully!');
}

main().catch(console.error);
