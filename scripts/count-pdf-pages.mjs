
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs/promises';
import path from 'path';

async function countPages() {
    const pdfPath = path.resolve('../content/KC Songbook MASTER 3.32.pdf');
    const buffer = await fs.readFile(pdfPath);
    const data = new Uint8Array(buffer);

    const loadingTask = getDocument({ data });
    const doc = await loadingTask.promise;

    console.log(`Total Pages: ${doc.numPages}`);
}

countPages().catch(console.error);
