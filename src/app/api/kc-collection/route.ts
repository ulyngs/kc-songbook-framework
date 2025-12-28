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
        const { password } = await request.json();

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
