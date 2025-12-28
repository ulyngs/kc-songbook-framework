
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs/promises';
import path from 'path';

async function inspectText() {
    const pdfPath = path.resolve('../content/KC Songbook MASTER 3.32.pdf');
    const buffer = await fs.readFile(pdfPath);
    const data = new Uint8Array(buffer);

    const loadingTask = getDocument({ data });
    const doc = await loadingTask.promise;

    console.log(`Total Pages: ${doc.numPages}`);

    for (let i = 1; i <= 10; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        console.log(`--- Page ${i} ---`);
        console.log(text);
    }
}

inspectText().catch(console.error);
