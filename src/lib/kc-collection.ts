import { importSongs } from "./db";
import { toast } from "sonner";
import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export async function importKCCollection(password: string): Promise<boolean> {
    const toastId = toast.loading("Verifying password...");

    try {
        const isNative = isTauri();
        const fetchFn = isNative ? tauriFetch : fetch;
        const url = isNative
            ? "https://songbook.karaokecollective.com/api/kc-collection"
            : "/api/kc-collection";

        console.log(`[KC Import] Importing from ${url} (Native: ${isNative})`);

        // Call the server-side API route with the password
        // Send password in header for iOS WebView compatibility (body sometimes empty)
        const response = await fetchFn(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-KC-Password": password,
            },
            body: JSON.stringify({ password }),
        });

        if (response.status === 401) {
            toast.error("Incorrect password", { id: toastId });
            return false;
        }

        if (!response.ok) {
            throw new Error(`Failed to load collection: ${response.status} ${response.statusText}`);
        }

        toast.loading("Importing songs...", { id: toastId });

        const jsonText = await response.text();
        const count = await importSongs(jsonText);

        toast.success(`Successfully imported ${count} songs from KC Collection!`, { id: toastId });
        return true;
    } catch (error) {
        console.error("Import failed:", error);
        toast.error("Failed to import KC Collection. Make sure you have internet access.", { id: toastId });
        return false;
    }
}
