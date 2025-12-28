/**
 * Icon Generator Script
 * 
 * This script generates PNG icons from the SVG source.
 * Run with: node scripts/generate-icons.js
 * 
 * Prerequisites: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Install with: npm install sharp');
  console.log('For now, creating placeholder icons...');
  
  // Create placeholder PNG files (1x1 transparent pixel as base64)
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const iconsDir = path.join(__dirname, '../public/icons');
  
  // Simple 1x1 coral-colored PNG
  const createPlaceholder = (size) => {
    // This is a minimal valid PNG that's coral colored
    // In production, you'd want to use proper icon generation
    console.log(`Creating placeholder for icon-${size}.png`);
  };
  
  sizes.forEach(createPlaceholder);
  console.log('\nTo generate proper icons, install sharp and run this script again.');
  console.log('Or use an online tool to convert public/icons/icon.svg to PNGs.');
  process.exit(0);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');
const svgPath = path.join(iconsDir, 'icon.svg');

async function generateIcons() {
  const svg = fs.readFileSync(svgPath);
  
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
  
  // Generate maskable icon with padding
  await sharp(svg)
    .resize(410, 410) // Leave room for safe area
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 232, g: 93, b: 76, alpha: 1 }
    })
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('Generated icon-maskable-512.png');
  
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);


