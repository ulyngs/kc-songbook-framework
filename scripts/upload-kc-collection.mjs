#!/usr/bin/env node
/**
 * Upload a songbook backup file to Netlify Blobs as the KC Collection
 * 
 * Usage: npm run upload-kc-collection ./path/to/backup.json
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const inputFile = process.argv[2];

if (!inputFile) {
    console.error('❌ Usage: npm run upload-kc-collection <path-to-backup.json>');
    console.error('   Example: npm run upload-kc-collection ./songbook-backup-2026-01-25.json');
    process.exit(1);
}

const filePath = resolve(inputFile);

if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
}

// Validate it's valid JSON with songs
try {
    const content = readFileSync(filePath, 'utf-8');
    const songs = JSON.parse(content);

    if (!Array.isArray(songs)) {
        console.error('❌ Invalid format: Expected an array of songs');
        process.exit(1);
    }

    console.log(`📦 Found ${songs.length} songs in backup file`);
    console.log(`📤 Uploading to Netlify Blobs (kc-collection store)...`);

    // Upload using Netlify CLI
    execSync(`netlify blob:set kc-collection kc-collection.json --input "${filePath}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    console.log(`\n✅ Successfully uploaded ${songs.length} songs to KC Collection!`);
} catch (error) {
    if (error.code === 'ENOENT' || error.message?.includes('netlify')) {
        console.error('❌ Netlify CLI not found. Install it with: npm install -g netlify-cli');
        console.error('   Then login with: netlify login');
    } else {
        console.error('❌ Error:', error.message);
    }
    process.exit(1);
}
