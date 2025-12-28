import { importSongs } from "./db";
import { toast } from "sonner";

export async function importKCCollection(password: string): Promise<boolean> {
    const toastId = toast.loading("Verifying password...");

    try {
        // Call the server-side API route with the password
        const response = await fetch("/api/kc-collection", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ password }),
        });

        if (response.status === 401) {
            toast.error("Incorrect password", { id: toastId });
            return false;
        }

        if (!response.ok) {
            throw new Error("Failed to load collection");
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
