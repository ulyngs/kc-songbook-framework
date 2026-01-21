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

        // Check for border end marker [/]
        if (line.trim() === "[/]") {
            // Save current section if it has content
            if (currentSection.lines.length > 0 || currentSection.label) {
                sections.push(currentSection);
            }
            // Start new section without border
            currentSection = { hasBorder: false, lines: [] };
        } else if (headerInfo.isHeader) {
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

// Render inline formatting: **bold**, *italics*, _underline_
// Process bold first (to avoid **text** matching * twice), then italics, then underline
function renderInlineFormatting(text: string, keyPrefix: string = ""): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Combined pattern: **bold** or *italics* or _underline_
    // Process in order: bold first (greedy), then italics, then underline
    const boldPattern = /\*\*([^*]+)\*\*/;
    const italicsPattern = /\*([^*]+)\*/;
    const underlinePattern = /_([^_]+)_/;

    while (remaining.length > 0) {
        // Try to find the first match of any pattern
        const boldMatch = remaining.match(boldPattern);
        const italicsMatch = remaining.match(italicsPattern);
        const underlineMatch = remaining.match(underlinePattern);

        // Find which match comes first
        const matches = [
            { type: 'bold', match: boldMatch, index: boldMatch?.index ?? Infinity },
            { type: 'italics', match: italicsMatch, index: italicsMatch?.index ?? Infinity },
            { type: 'underline', match: underlineMatch, index: underlineMatch?.index ?? Infinity },
        ].filter(m => m.match !== null).sort((a, b) => a.index - b.index);

        if (matches.length === 0) {
            // No more matches, add remaining text
            parts.push(remaining);
            break;
        }

        const firstMatch = matches[0];
        const match = firstMatch.match!;
        const matchIndex = match.index!;

        // Add text before the match
        if (matchIndex > 0) {
            parts.push(remaining.substring(0, matchIndex));
        }

        // Add the formatted text
        if (firstMatch.type === 'bold') {
            parts.push(
                <strong key={`${keyPrefix}bold-${key++}`} className="font-bold">
                    {match[1]}
                </strong>
            );
        } else if (firstMatch.type === 'italics') {
            parts.push(
                <em key={`${keyPrefix}italic-${key++}`} className="italic">
                    {match[1]}
                </em>
            );
        } else {
            parts.push(
                <span key={`${keyPrefix}underline-${key++}`} className="underline decoration-2 underline-offset-2">
                    {match[1]}
                </span>
            );
        }

        remaining = remaining.substring(matchIndex + match[0].length);
    }

    return parts;
}

// Legacy function for backward compatibility
function renderUnderlines(text: string, keyPrefix: string = ""): React.ReactNode[] {
    return renderInlineFormatting(text, keyPrefix);
}

// Time signature component - renders as stacked numbers
function TimeSignature({ top, bottom }: { top: string; bottom: string }) {
    return (
        <span className="inline-flex flex-col items-center justify-center leading-none mx-0.5 align-middle" style={{ verticalAlign: 'middle' }}>
            <span className="text-[0.7em] font-bold leading-none">{top}</span>
            <span className="text-[0.7em] font-bold leading-none">{bottom}</span>
        </span>
    );
}

// Render time signatures in text (e.g., 3/4, 6/4, 12/8)
function renderTimeSignatures(text: string, keyPrefix: string = ""): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Match time signatures: 1 or 2 digit numbers separated by / 
    // Must be at word boundary (not part of a chord like Bb/d)
    const timeSignaturePattern = /(?<![A-Ga-g#b])(\d{1,2})\/(\d{1,2})(?![A-Ga-g])/;

    while (remaining.length > 0) {
        const match = remaining.match(timeSignaturePattern);

        if (match && match.index !== undefined) {
            // Add text before the match
            if (match.index > 0) {
                parts.push(
                    <span key={`${keyPrefix}${key++}`}>{remaining.substring(0, match.index)}</span>
                );
            }

            // Add the time signature
            parts.push(
                <TimeSignature key={`${keyPrefix}ts-${key++}`} top={match[1]} bottom={match[2]} />
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

// Render chord line with time signatures - processes time sigs first, then formatting
function renderChordLineWithTimeSignatures(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Match time signatures: 1 or 2 digit numbers separated by / 
    // Only need to check it's not preceded by a chord letter (to avoid matching Bb/d)
    // No need to check what follows - 2/4D is "2/4 time sig + D chord", not a chord
    const timeSignaturePattern = /(?<![A-Ga-g#b])(\d{1,2})\/(\d{1,2})/;

    while (remaining.length > 0) {
        const match = remaining.match(timeSignaturePattern);

        if (match && match.index !== undefined) {
            // Add text before the match (with chord formatting)
            if (match.index > 0) {
                const beforeText = remaining.substring(0, match.index);
                parts.push(...renderChordsWithSuperscript(beforeText, `before-${key}`));
                key++;
            }

            // Add the time signature
            parts.push(
                <TimeSignature key={`ts-${key++}`} top={match[1]} bottom={match[2]} />
            );

            remaining = remaining.substring(match.index + match[0].length);
        } else {
            // No more time signatures, process remaining for chord formatting
            parts.push(...renderChordsWithSuperscript(remaining, `end-${key}`));
            break;
        }
    }

    return parts;
}

// Render chords with superscript suffixes (e.g., Asus4 -> A^sus4, Cmaj7 -> C^maj7)
// Also processes inline formatting (**bold**, *italics*, _underline_) for non-chord text
function renderChordsWithSuperscript(text: string, keyPrefix: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Chord pattern: root note (A-G with optional # or b) followed by modifier
    // We split into: root (letter + accidental + optional m for minor) and suffix (the rest)
    const chordPattern = /([A-G][#b]?)(m(?!aj)|)(sus[24]?|maj7?|min7?|dim7?|aug|add\d+|7|9|11|13|6|M7|Δ7?)/g;

    let lastIndex = 0;
    let match;

    while ((match = chordPattern.exec(text)) !== null) {
        // Add text before this chord (if any) - with inline formatting
        if (match.index > lastIndex) {
            const beforeText = text.substring(lastIndex, match.index);
            parts.push(...renderInlineFormatting(beforeText, `${keyPrefix}-before-${key++}-`));
        }

        const root = match[1] + match[2]; // e.g., "A" or "Am"
        const suffix = match[3]; // e.g., "sus4", "maj7"
        const fullChord = match[0]; // e.g., "Asus4"

        // Render the full chord text but with the suffix styled as superscript
        // We need to maintain the original character width for alignment
        parts.push(
            <span key={`${keyPrefix}-chord-${key++}`} className="relative inline">
                {/* Invisible text to maintain spacing */}
                <span className="invisible">{fullChord}</span>
                {/* Visible overlay with superscript styling */}
                <span className="absolute left-0 top-0">
                    {root}
                    <sup className="text-[0.65em] relative" style={{ top: '-0.3em' }}>{suffix}</sup>
                </span>
            </span>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last chord - with inline formatting
    if (lastIndex < text.length) {
        parts.push(...renderInlineFormatting(text.substring(lastIndex), `${keyPrefix}-after-${key++}-`));
    }

    // If no chords found, process through inline formatting
    if (parts.length === 0) {
        return renderInlineFormatting(text, keyPrefix);
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
                <span key={`small-${key++}`} className="text-[0.85em]">
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

                const style: React.CSSProperties = {
                    fontSize: fontSize ? `${fontSize}px` : undefined,
                    tabSize: 8,
                };

                // Check if this chord line is followed by a lyrics line
                const nextLine = section.lines[idx + 1];
                const isChordFollowedByLyrics = line.type === "chord" && nextLine && nextLine.type === "lyrics";

                if (line.type === "chord") {
                    return (
                        <div
                            key={idx}
                            className={cn(
                                "text-blue-600 dark:text-blue-400 whitespace-pre font-mono",
                                isChordFollowedByLyrics && "mb-[-0.15em]"
                            )}
                            style={style}
                        >
                            {renderChordLineWithTimeSignatures(line.content)}
                        </div>
                    );
                }

                // Check if this lyrics line follows a chord line
                const prevLine = section.lines[idx - 1];
                const lyricsFollowsChord = line.type === "lyrics" && prevLine && prevLine.type === "chord";

                // lyrics
                return (
                    <div
                        key={idx}
                        className={cn(
                            "text-foreground whitespace-pre font-mono",
                            lyricsFollowsChord && "mb-0.5"
                        )}
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
