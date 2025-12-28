import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Server-side only password - NOT exposed to client
const KC_PASSWORD = process.env.KC_COLLECTION_PASSWORD || "karaokecollective";

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (password !== KC_PASSWORD) {
            return NextResponse.json(
                { error: "Incorrect password" },
                { status: 401 }
            );
        }

        // Read the collection file from the data directory
        const filePath = path.join(process.cwd(), "src", "data", "kc-collection.json");
        const fileContent = await fs.readFile(filePath, "utf-8");

        return new NextResponse(fileContent, {
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

