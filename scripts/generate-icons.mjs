import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(dir, { recursive: true });

const src = join(dir, 'coconut-logo.jpg');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

// icon.png — 1024×1024, cream background, logo centered
run(`magick convert "${src}" -resize 1024x1024 -gravity center -background '#FFFDF8' -extent 1024x1024 "${join(dir, 'icon.png')}"`);

// splash-icon.png — 1024×1024, transparent background, logo centered (60%)
run(`magick convert "${src}" -resize 600x600 -gravity center -background none -extent 1024x1024 "${join(dir, 'splash-icon.png')}"`);

// favicon.png — 48×48, cream background, logo centered
run(`magick convert "${src}" -resize 48x48 -gravity center -background '#FFFDF8' -extent 48x48 "${join(dir, 'favicon.png')}"`);

// android-icon-foreground.png — 512×512, transparent background, logo centered
run(`magick convert "${src}" -resize 360x360 -gravity center -background none -extent 512x512 "${join(dir, 'android-icon-foreground.png')}"`);

// android-icon-monochrome.png — 512×512, high-contrast silhouette (black on transparent)
run(`magick convert "${src}" -resize 360x360 -gravity center -background none -extent 512x512 -colorspace Gray -threshold 50% "${join(dir, 'android-icon-monochrome.png')}"`);

process.stdout.write('All icons generated from coconut-logo.jpg\n');
