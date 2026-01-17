import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import fs from "fs/promises";
import path from "path";

// Server-side only password - NOT exposed to client
const KC_PASSWORD = process.env.KC_COLLECTION_PASSWORD;

// Check if we're running in Netlify environment
const isNetlifyEnvironment = !!process.env.NETLIFY || !!process.env.NETLIFY_BLOBS_CONTEXT;

export async function POST(request: NextRequest) {
    try {
        // Parse request body with defensive handling for iOS WebView
        // iOS WebView sometimes doesn't send the body properly
        let password: string | undefined;

        // First try to get password from Authorization header (works reliably on iOS)
        const authHeader = request.headers.get('X-KC-Password');
        if (authHeader) {
            password = authHeader;
            console.log("[KC API] Password received via header");
        }

        // Fallback to body parsing
        if (!password) {
            try {
                const body = await request.text();
                console.log("[KC API] Request body:", body ? body.substring(0, 100) : "(empty)");
                if (body) {
                    const parsed = JSON.parse(body);
                    password = parsed.password;
                }
            } catch (parseError) {
                console.error("[KC API] Body parse error:", parseError);
            }
        }

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (password !== KC_PASSWORD) {
            return NextResponse.json(
                { error: "Incorrect password" },
                { status: 401 }
            );
        }

        let data: string | null = null;

        if (isNetlifyEnvironment) {
            // Production: Fetch from Netlify Blobs
            const store = getStore("kc-collection");
            data = await store.get("kc-collection.json", { type: "text" });
        } else {
            // Local development: Read from filesystem
            const filePath = path.join(process.cwd(), "src", "data", "kc-collection.json");
            try {
                data = await fs.readFile(filePath, "utf-8");
            } catch {
                // File doesn't exist locally
                data = null;
            }
        }

        if (!data) {
            return NextResponse.json(
                { error: "Collection not found. Make sure to upload it to Netlify Blobs for production, or have the file locally for development." },
                { status: 404 }
            );
        }

        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error loading KC collection:", error);
        return NextResponse.json(
            { error: "Failed to load collection" },
            { status: 500 }
        );
    }
}
