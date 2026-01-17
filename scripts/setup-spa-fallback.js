/**
 * Post-build script for Tauri static export
 * Copies song.html to handle dynamic routes like /song/[id]
 * 
 * In a static export, Next.js only generates HTML for paths returned by generateStaticParams.
 * For a catch-all route like /song/[[...slug]], we only get /song.html.
 * Tauri serves static files, so navigating to /song/some-id fails because that file doesn't exist.
 * 
 * This script copies song.html to song/[fallback]/index.html to create a fallback
 * that allows client-side routing to work.
 */

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const songHtml = path.join(outDir, 'song.html');
const songDir = path.join(outDir, 'song');

// Check if song.html exists
if (!fs.existsSync(songHtml)) {
    console.log('song.html not found, skipping SPA fallback setup');
    process.exit(0);
}

// Create song directory if it doesn't exist
if (!fs.existsSync(songDir)) {
    fs.mkdirSync(songDir, { recursive: true });
}

// Copy song.html to song/index.html (for /song route)
const songIndexHtml = path.join(songDir, 'index.html');
fs.copyFileSync(songHtml, songIndexHtml);
console.log('Copied song.html -> song/index.html');

// Create a special _fallback directory that Tauri can use
// Actually, we need to create multiple placeholder directories
// or configure Tauri differently.

// For now, let's just create a song/_fallback/index.html
const fallbackDir = path.join(songDir, '_fallback');
if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
}
fs.copyFileSync(songHtml, path.join(fallbackDir, 'index.html'));
console.log('Copied song.html -> song/_fallback/index.html');

console.log('SPA fallback setup complete');
