#!/usr/bin/env node
/**
 * Upload a songbook backup file to Netlify Blobs as the KC Collection
 * 
 * Splits the collection into chunks for efficient mobile import.
 * Each chunk is stored as a separate blob to avoid reading the full
 * 59 MB collection on every API request.
 * 
 * Usage: npm run upload-kc-collection ./path/to/backup.json
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';

const CHUNK_SIZE = 20;
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

    // Create temp directory for chunk files
    const tmpDir = mkdtempSync(join(tmpdir(), 'kc-collection-'));

    try {
        const totalChunks = Math.ceil(songs.length / CHUNK_SIZE);

        // Upload manifest
        const manifest = {
            totalSongs: songs.length,
            totalChunks,
            chunkSize: CHUNK_SIZE,
        };
        const manifestPath = join(tmpDir, 'manifest.json');
        writeFileSync(manifestPath, JSON.stringify(manifest));

        console.log(`📤 Uploading manifest and ${totalChunks} chunks to Netlify Blobs...`);

        execSync(`netlify blob:set kc-collection manifest.json --input "${manifestPath}"`, {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        console.log(`  ✓ Uploaded manifest (${songs.length} songs, ${totalChunks} chunks)`);

        // Upload each chunk
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, songs.length);
            const chunk = songs.slice(start, end);

            const chunkPath = join(tmpDir, `chunk-${i}.json`);
            writeFileSync(chunkPath, JSON.stringify(chunk));

            execSync(`netlify blob:set kc-collection "chunk-${i}.json" --input "${chunkPath}"`, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log(`  ✓ Uploaded chunk ${i + 1}/${totalChunks} (songs ${start + 1}-${end})`);
        }

        // Also upload the full collection for backward compatibility
        console.log(`📤 Uploading full collection (backward compat)...`);
        execSync(`netlify blob:set kc-collection kc-collection.json --input "${filePath}"`, {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        console.log(`\n✅ Successfully uploaded ${songs.length} songs to KC Collection!`);
        console.log(`   ${totalChunks} chunks + manifest + full collection`);
    } finally {
        // Clean up temp directory
        rmSync(tmpDir, { recursive: true, force: true });
    }
} catch (error) {
    if (error.code === 'ENOENT' || error.message?.includes('netlify')) {
        console.error('❌ Netlify CLI not found. Install it with: npm install -g netlify-cli');
        console.error('   Then login with: netlify login');
    } else {
        console.error('❌ Error:', error.message);
    }
    process.exit(1);
}
