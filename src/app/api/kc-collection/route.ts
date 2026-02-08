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

        // Check for chunked request parameters
        const url = new URL(request.url);
        const chunkParam = url.searchParams.get("chunk");

        if (chunkParam !== null) {
            // Chunked mode: return a pre-split chunk from Netlify Blobs
            const chunkIndex = parseInt(chunkParam, 10) || 0;

            if (isNetlifyEnvironment) {
                const store = getStore("kc-collection");

                // Read manifest for metadata
                const manifestData = await store.get("manifest.json", { type: "text" });
                if (!manifestData) {
                    return NextResponse.json(
                        { error: "Collection manifest not found. Re-upload with the latest upload script." },
                        { status: 404 }
                    );
                }
                const manifest = JSON.parse(manifestData);

                // Read the specific chunk
                const chunkData = await store.get(`chunk-${chunkIndex}.json`, { type: "text" });
                if (!chunkData) {
                    return NextResponse.json(
                        { error: `Chunk ${chunkIndex} not found` },
                        { status: 404 }
                    );
                }

                return new NextResponse(chunkData, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "X-Total-Songs": String(manifest.totalSongs),
                        "X-Total-Chunks": String(manifest.totalChunks),
                    },
                });
            } else {
                // Local development: read from filesystem and split on the fly
                const filePath = path.join(process.cwd(), "src", "data", "kc-collection.json");
                try {
                    const data = await fs.readFile(filePath, "utf-8");
                    const allSongs = JSON.parse(data);
                    const chunkSize = 20;
                    const totalSongs = allSongs.length;
                    const totalChunks = Math.ceil(totalSongs / chunkSize);
                    const start = chunkIndex * chunkSize;
                    const end = Math.min(start + chunkSize, totalSongs);
                    const chunk = allSongs.slice(start, end);

                    return new NextResponse(JSON.stringify(chunk), {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "X-Total-Songs": String(totalSongs),
                            "X-Total-Chunks": String(totalChunks),
                        },
                    });
                } catch {
                    return NextResponse.json(
                        { error: "Collection not found locally" },
                        { status: 404 }
                    );
                }
            }
        }

        // Default: return entire collection (backward compat, non-chunked)
        let data: string | null = null;

        if (isNetlifyEnvironment) {
            const store = getStore("kc-collection");
            data = await store.get("kc-collection.json", { type: "text" });
        } else {
            const filePath = path.join(process.cwd(), "src", "data", "kc-collection.json");
            try {
                data = await fs.readFile(filePath, "utf-8");
            } catch {
                data = null;
            }
        }

        if (!data) {
            return NextResponse.json(
                { error: "Collection not found." },
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
