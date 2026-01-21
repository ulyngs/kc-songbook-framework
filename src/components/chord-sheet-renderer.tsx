"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ChordSheetRendererProps {
    text: string;
    className?: string;
    fontSize?: number;
}

interface ParsedLine {
    type: "chord" | "lyrics" | "section-header" | "empty";
    content: string;
    sectionLabel?: string;
    hasBorder?: boolean;
    isInlineLabel?: boolean; // [chorus] text on same line
}

interface Section {
    label?: string;
    hasBorder: boolean;
    lines: ParsedLine[];
}

// Common chord patterns for detection
const CHORD_PATTERN = /\|[A-Ga-g][#b]?(?:m|maj|min|dim|aug|sus|add|7|9|11|13|M)?[0-9]?(?:\s+(?:break|[A-Ga-g][#b]?(?:m|maj|min|dim|aug|sus|add|7|9|11|13|M)?[0-9]?))*\s*\|?/;

function isChordLine(line: string): boolean {
    // Lines that start with | are chord lines
    if (line.trimStart().startsWith("|")) {
        return true;
    }
    // Lines with chord patterns
    return CHORD_PATTERN.test(line);
}

function isSectionHeader(line: string): { isHeader: boolean; label?: string; hasBorder?: boolean; inlineContent?: string } {
    const trimmed = line.trim();

    // Match [label]* or [label] optionally followed by content
    const match = trimmed.match(/^\[([^\]]+)\](\*)?(?:\s+(.+))?$/);
    if (match) {
        return {
            isHeader: true,
            label: match[1],
            hasBorder: match[2] === "*",
            inlineContent: match[3],
        };
    }
    return { isHeader: false };
}

function parseText(text: string): Section[] {
    const lines = text.split("\n");
    const sections: Section[] = [];
    let currentSection: Section = { hasBorder: false, lines: [] };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headerInfo = isSectionHeader(line);

        if (headerInfo.isHeader) {
            // Save current section if it has content
            if (currentSection.lines.length > 0 || currentSection.label) {
                sections.push(currentSection);
            }

            // Start new section
            currentSection = {
                label: headerInfo.label,
                hasBorder: headerInfo.hasBorder || false,
                lines: [],
            };

            // If there's inline content after the label, add it
            if (headerInfo.inlineContent) {
                currentSection.lines.push({
                    type: isChordLine(headerInfo.inlineContent) ? "chord" : "lyrics",
                    content: headerInfo.inlineContent,
                    isInlineLabel: true,
                });
            }
        } else if (line.trim() === "") {
            currentSection.lines.push({ type: "empty", content: "" });
        } else if (isChordLine(line)) {
            currentSection.lines.push({ type: "chord", content: line });
        } else {
            currentSection.lines.push({ type: "lyrics", content: line });
        }
    }

    // Don't forget the last section
    if (currentSection.lines.length > 0 || currentSection.label) {
        sections.push(currentSection);
    }

    return sections;
}

// Render underlines within text
function renderUnderlines(text: string, keyPrefix: string = ""): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const underlinePattern = /_([^_]+)_/;

    while (remaining.length > 0) {
        const match = remaining.match(underlinePattern);

        if (match && match.index !== undefined) {
            // Add text before the match
            if (match.index > 0) {
                parts.push(
                    <span key={`${keyPrefix}${key++}`}>{remaining.substring(0, match.index)}</span>
                );
            }

            // Add the underlined text
            parts.push(
                <span key={`${keyPrefix}${key++}`} className="underline decoration-2 underline-offset-2">
                    {match[1]}
                </span>
            );

            remaining = remaining.substring(match.index + match[0].length);
        } else {
            // No more matches, add remaining text
            parts.push(<span key={`${keyPrefix}${key++}`}>{remaining}</span>);
            break;
        }
    }

    return parts;
}

// Render text with formatting markers: _underline_ and ~smaller~
// Supports nested underlines within smaller text: ~When _you_ look~
function renderWithFormatting(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Pattern to match ~smaller~ blocks (process these first, then underlines inside)
    const smallerPattern = /~([^~]+)~/;

    while (remaining.length > 0) {
        const match = remaining.match(smallerPattern);

        if (match && match.index !== undefined) {
            // Add text before the match (with underline processing)
            if (match.index > 0) {
                const beforeText = remaining.substring(0, match.index);
                parts.push(...renderUnderlines(beforeText, `before-${key}-`));
                key++;
            }

            // Add the smaller text block (with underline processing inside)
            parts.push(
                <span key={`small-${key++}`} className="text-[0.75em]">
                    {renderUnderlines(match[1], `inner-${key}-`)}
                </span>
            );

            remaining = remaining.substring(match.index + match[0].length);
        } else {
            // No more smaller blocks, process remaining for underlines
            parts.push(...renderUnderlines(remaining, `end-${key}-`));
            break;
        }
    }

    return parts;
}

function SectionRenderer({ section, fontSize }: { section: Section; fontSize?: number }) {
    const content = (
        <div>
            {section.label && (
                <div
                    className="font-normal text-muted-foreground uppercase text-[0.85em] tracking-wide"
                    style={{ fontSize: fontSize ? `${fontSize * 0.85}px` : undefined }}
                >
                    {section.label}
                </div>
            )}
            {section.lines.map((line, idx) => {
                if (line.type === "empty") {
                    return <div key={idx} className="h-4" />;
                }

                const style = {
                    fontSize: fontSize ? `${fontSize}px` : undefined,
                };

                if (line.type === "chord") {
                    return (
                        <div
                            key={idx}
                            className="text-blue-600 dark:text-blue-400 font-semibold whitespace-pre"
                            style={style}
                        >
                            {renderWithFormatting(line.content)}
                        </div>
                    );
                }

                // lyrics
                return (
                    <div
                        key={idx}
                        className="text-foreground whitespace-pre"
                        style={style}
                    >
                        {renderWithFormatting(line.content)}
                    </div>
                );
            })}
        </div>
    );

    if (section.hasBorder) {
        // Use negative margins so the border extends outward, keeping content aligned
        return (
            <div className="border border-border rounded-md my-2 -mx-3 px-3 py-1">
                {content}
            </div>
        );
    }

    return content;
}

export function ChordSheetRenderer({ text, className, fontSize }: ChordSheetRendererProps) {
    const sections = parseText(text);

    return (
        <div className={cn("font-mono", className)} style={{ tabSize: 8 }}>
            {sections.map((section, idx) => (
                <SectionRenderer key={idx} section={section} fontSize={fontSize} />
            ))}
        </div>
    );
}

// Export the parser for potential future use (e.g., export to PDF)
export { parseText, isChordLine, isSectionHeader };
