import { importSongsBatch } from "./db";
import { toast } from "sonner";
import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const CHUNK_SIZE = 20;

export async function importKCCollection(password: string): Promise<boolean> {
    const toastId = toast.loading("Verifying password...");

    try {
        const isNative = isTauri();
        const fetchFn = isNative ? tauriFetch : fetch;
        const baseUrl = isNative
            ? "https://songbook.karaokecollective.com/api/kc-collection"
            : "/api/kc-collection";

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-KC-Password": password,
        };
        const body = JSON.stringify({ password });

        // First request: get chunk 0 plus total count
        const firstUrl = `${baseUrl}?chunk=0&chunkSize=${CHUNK_SIZE}`;
        console.log(`[KC Import] Fetching first chunk from ${firstUrl} (Native: ${isNative})`);

        const firstResponse = await fetchFn(firstUrl, {
            method: "POST",
            headers,
            body,
        });

        if (firstResponse.status === 401) {
            toast.error("Incorrect password", { id: toastId });
            return false;
        }

        if (!firstResponse.ok) {
            throw new Error(`Failed to load collection: ${firstResponse.status} ${firstResponse.statusText}`);
        }

        const totalSongsHeader = firstResponse.headers.get("X-Total-Songs");
        const totalChunksHeader = firstResponse.headers.get("X-Total-Chunks");

        if (!totalSongsHeader || !totalChunksHeader) {
            // Fallback: server returned all songs at once (old behavior)
            toast.loading("Importing songs...", { id: toastId });
            const jsonText = await firstResponse.text();
            const songs = JSON.parse(jsonText);
            const count = await importSongsBatch(songs);
            toast.success(`Successfully imported ${count} songs from KC Collection!`, { id: toastId });
            return true;
        }

        const totalSongs = parseInt(totalSongsHeader, 10);
        const totalChunks = parseInt(totalChunksHeader, 10);

        // Import first chunk
        const firstChunkSongs = await firstResponse.json();
        let importedCount = await importSongsBatch(firstChunkSongs);
        toast.loading(`Importing songs... (${importedCount}/${totalSongs})`, { id: toastId });

        // Fetch remaining chunks
        for (let chunkIndex = 1; chunkIndex < totalChunks; chunkIndex++) {
            const chunkUrl = `${baseUrl}?chunk=${chunkIndex}&chunkSize=${CHUNK_SIZE}`;
            console.log(`[KC Import] Fetching chunk ${chunkIndex + 1}/${totalChunks}`);

            const chunkResponse = await fetchFn(chunkUrl, {
                method: "POST",
                headers,
                body,
            });

            if (!chunkResponse.ok) {
                throw new Error(`Failed to load chunk ${chunkIndex}: ${chunkResponse.status}`);
            }

            const chunkSongs = await chunkResponse.json();
            importedCount += await importSongsBatch(chunkSongs);
            toast.loading(`Importing songs... (${importedCount}/${totalSongs})`, { id: toastId });
        }

        toast.success(`Successfully imported ${importedCount} songs from KC Collection!`, { id: toastId });
        return true;
    } catch (error) {
        console.error("Import failed:", error);
        toast.error("Failed to import KC Collection. Make sure you have internet access.", { id: toastId });
        return false;
    }
}
