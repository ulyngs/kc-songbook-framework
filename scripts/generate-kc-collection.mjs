
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

const CONTENT_DIR = path.resolve('../content');
const OUTPUT_DIR = path.resolve('./public/seed-songs');
const CSV_FILE = 'KC Songbook - songlist.csv';
const PDF_FILE = 'KC Songbook MASTER 3.32.pdf';

async function generateCollection() {
    console.log('Starting generation...');

    // 1. Read CSV
    console.log('Reading CSV...');
    const csvContent = await fs.readFile(path.join(CONTENT_DIR, CSV_FILE), 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        from_line: 2
    });
    console.log(`Found ${records.length} songs in CSV.`);
    if (records.length > 0) {
        console.log('First record sample:', records[0]);
    }

    // 2. Load PDF for extraction (pdf-lib) and text analysis (pdfjs)
    console.log('Loading PDF...');
    const pdfBuffer = await fs.readFile(path.join(CONTENT_DIR, PDF_FILE));
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pdfData = new Uint8Array(pdfBuffer);
    const loadingTask = getDocument({ data: pdfData });
    const doc = await loadingTask.promise;

    // 3. Parse Index (Pages 3-7 based on previous inspection, but let's be dynamic or generous)
    // We'll map Song Title -> Page Number.
    // The index usually lists "Title ... Page"
    console.log('Parsing PDF Index...');
    const titleToPageMap = new Map();
    // Using a heuristic: Index usually starts around page 3. Let's scan pages 3 to 10.
    // We look for lines ending in numbers which might be page numbers.

    for (let i = 3; i <= 10; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        // Simple extraction: join all items, then split by lines or look for patterns
        // The previous inspection showed lines like: "7  Valerie   by Mark Ronson...  242"
        // Heuristic: Last token is the page number (in the songbook proper, which might be offset from PDF page index).
        // Wait, the PDF page index might strictly match the songbook page number if the PDF *is* the songbook.
        // Use the printed page number to find the PDF page index? 
        // Usually PDF_Page_Index = Printed_Page_No + Offset.
        // Let's assume the index maps Title -> Printed Page.
        // We need to find the mapping: Printed Page -> PDF Page.
        // For now, let's extract the "Title" and "Page Number" from the index text.

        // We'll use a regex on the full page text or line-by-line if possible.
        // Inspect text showed: "Title ... Page"
        // But pdfjs `getTextContent` returns separate items.

        // Let's try to reconstruct lines based on 'transform' y-coordinate (rough approximation).
        const items = content.items;
        const lines = {};
        for (const item of items) {
            const y = Math.round(item.transform[5]); // Y coordinate
            if (!lines[y]) lines[y] = [];
            lines[y].push(item.str);
        }

        // Sort lines by Y (descending)
        const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);

        for (const y of sortedYs) {
            const lineText = lines[y].join('').trim();
            // Regex to find "Title ... Page"
            // Example: "7 Valerie by Mark Ronson ... 242"
            // or "242 Waterloo by ABBA ... 231" 
            // Actually look at the inspection output again in previous turn:
            // "242 Waterloo by ABBA ... 245" -> No wait, 
            // "253 What's Up ... 240". 
            // The snippet in Step 47 shows:
            // "242  Wild World   by Cat Stevens ... 259" ? No.
            // "258  Wild World   by Cat Stevens ...  244"
            // Wait, let's look at CSV vs PDF inspection.
            // CSV: "242,Wild World,Cat Stevens..."
            // PDF Inspection Page 7: "259  The Winner Takes it All ... 260" ? No.
            // Let's re-read the inspection output carefully.
            // "258  Wild World   by Cat Stevens   ...   244" (maybe 244 is the page?)
            // The CSV says "242 Wild World". 
            // The PDF Index seems to have: [IndexNumber] [Title] [Artist] ... [Page?]
            // Inspection output: "258  Wild World   by Cat Stevens   ...   259"
            // Wait, 
            // Page 7 output:
            // "258  Wild World   by Cat Stevens ... 259" (This might be Index Num ... Page Num?)
            // Let's rely on string matching to CSV titles first.

            // Better strategy:
            // 1. We know the songs from CSV.
            // 2. We search for the Song Title in the PDF Index pages to find the "Page Number".
            // 3. Or better: We assume the songs in the PDF are ordered (mostly).
            // 4. Actually, the PDF contains the songs. 
            // Let's just find the page where the title appears as a HEADING.
            // This is more robust than parsing the TOC.
            // Most songbooks have the title at the top of the page.
            // We can scan ALL pages (277 pages is fast) for the title in a large font or at the top.
        }
    }

    // Strategy Switch: Scan ALL pages for titles.
    // This avoids parsing the TOC which is messy.
    console.log('Scanning all pages for song titles (Heuristic: Title at top of page)...');

    const songPages = new Map(); // Title -> PageIndex (0-based)

    // Helper to normalize strings: lowercase, remove non-alphanumeric
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        // Heuristic: The song title is usually the largest or first text, or matches a known title.
        // Let's get all text and checking if it *contains* a known title from CSV.

        const fullTextNormalized = normalize(content.items.map(item => item.str).join(' '));

        for (const record of records) {
            if (!record.song_title) continue;
            if (songPages.has(record.song_title)) continue; // Already found

            const titleNorm = normalize(record.song_title);

            // Heuristic: exact match in full text
            if (fullTextNormalized.includes(titleNorm)) {
                // Verify Artist if present
                if (record.artist) {
                    const artistNorm = normalize(record.artist.split(' ')[0]); // Check first word of artist
                    if (fullTextNormalized.includes(artistNorm)) {
                        songPages.set(record.song_title, i - 1); // 0-based for pdf-lib
                    }
                } else {
                    // If no artist, just match title
                    songPages.set(record.song_title, i - 1);
                }
            }
        }
    }

    console.log(`Matched ${songPages.size} / ${records.length} songs to pages.`);

    // 4. Generate JSON
    const outputSongs = [];

    for (const record of records) {
        const pageIndex = songPages.get(record.song_title);
        if (pageIndex === undefined) {
            console.warn(`Could not find page for "${record.song_title}". Skipping.`);
            continue;
        }

        // Extract single page PDF
        // Create a new PDF doc for this song
        const songPdf = await PDFDocument.create();
        const [copiedPage] = await songPdf.copyPages(pdfDoc, [pageIndex]);
        songPdf.addPage(copiedPage);
        const pdfBase64 = await songPdf.saveAsBase64({ dataUri: true });

        const isMovie = record.is_movie?.toLowerCase() === 'yes' || record.is_movie === 'TRUE';
        const artistName = isMovie ? `${record.artist} 🎥` : record.artist;

        outputSongs.push({
            title: record.song_title,
            artist: artistName,
            key: record.song_key,
            isXmas: record.is_xmas === 'TRUE',
            isMovie: isMovie,
            // For KC Collection, we assume all are valid parts of the collection, 
            // effectively treating them like we did public domain for the seed script but essentially just importing them.
            // The Interface in the app expects 'isPublicDomain' for the seed script logic, 
            // but if we are importing via JSON drag-drop or similar, we might not strictly need it,
            // BUT for the songs.json / seed-data.ts logic, it filters on isPublicDomain.
            // The user wants 'kc-collection.json' to have ALL content.
            // We'll set isPublicDomain: true just to bypass any filters if this file is used in that flow,
            // or false if we want strict separation. 
            // Given the user said "make songs.json only contain public domain... and kc-collection.json be the one that contains all",
            // I'll leave isPublicDomain as is from CSV (likely false/empty for most) OR simply omit it and rely on the app to handle it.
            // However, to ensure it "works" if loaded:
            // Let's assume the new file structure is compatible.
            musicType: 'pdf',
            musicData: pdfBase64,
            musicFileName: `${record.song_title.replace(/[^a-z0-9]/gi, '_')}.pdf`
        });
    }

    // 5. Write to File
    console.log(`Writing ${outputSongs.length} songs to ${path.join(OUTPUT_DIR, 'kc-collection.json')}`);
    await fs.writeFile(
        path.join(OUTPUT_DIR, 'kc-collection.json'),
        JSON.stringify(outputSongs, null, 2)
    );

    console.log('Done!');
    // Also, we must fix songs.json to ONLY contain public domain songs from this generated set (or from the corrupted one? No, from the source!)
    // User said: "make songs.json only contain the public domain seed songs"
    // I should define "public domain seed songs".
    // Based on the CSV, there are columns like `is_xmas` but maybe not public domain.
    // `seed-data.ts` filtered on `song.isPublicDomain`.
    // Inspecting the CSV `KC Songbook - songlist.csv`:
    // It has `is_xmas`, `is_movie`. 
    // It DOES NOT have `is_public_domain`.
    // However, the `songs.json` had "Twelve Days of Christmas" with "isPublicDomain": true.
    // It seems `songs.json` previously had manually currated public domain songs.
    // I should probably KEEP the existing `songs.json` (if valid) but strip out non-public domain,
    // OR regenerate it if I can identify public domain songs.
    // Given I don't know which are PD from CSV, I will just LEAVE songs.json alone for now (or restore a backup?)
    // User said "make songs.json only contain the public domain seed songs".
    // The current songs.json IS corrupted/mixed.
    // I'll try to Filter the outputSongs for `isXmas`? No, "Twelve Days" is PD.
    // Maybe just the Xmas ones marked TRUE are PD?
    // Let's just create kc-collection.json first as requested.
    // And maybe empty songs.json or keep the one safe song I saw ("Twelve Days").

    // Actually, I can overwrite songs.json with JUST the identified public domain songs from the generated list IF I had a flag.
    // Since I lack the flag in CSV, I will generate `kc-collection.json` and then maybe grab the specific known PD songs for `songs.json`.
    // "Twelve Days of Christmas" is at the end of the CSV.
    // "Silent Night", "Away in a Manger" etc are likely PD.
    // I'll filter for `is_xmas === 'TRUE'` as a proxy for "likely seed songs" if that's what was intended?
    // No, `songs.json` had a specific list. 
    // I'll write `kc-collection.json` and verified success, then ask user about songs.json cleanup or just leave it minimal.

}

generateCollection().catch(console.error);
