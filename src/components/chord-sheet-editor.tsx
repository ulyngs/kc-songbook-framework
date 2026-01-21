"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChordSheetRenderer } from "./chord-sheet-renderer";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Button } from "./ui/button";
import { Pencil, Eye, Columns2, Maximize2, Minimize2 } from "lucide-react";

type ViewMode = "edit" | "preview" | "split";

interface ChordSheetEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    minHeight?: string;
    fontSize?: number;
    onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function ChordSheetEditor({
    value,
    onChange,
    className,
    placeholder = "Enter chord chart...\n\nUse | for chord lines, e.g.:\n|C      |G   F   |C      |\nI see a bad moon arising\n\nUse [section] for labels, [section]* for borders\nUse _word_ to underline\nUse ~text~ for smaller text",
    minHeight = "300px",
    fontSize = 14,
    onFullscreenChange,
}: ChordSheetEditorProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("split");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const toggleFullscreen = useCallback(() => {
        const newState = !isFullscreen;
        setIsFullscreen(newState);
        onFullscreenChange?.(newState);
    }, [isFullscreen, onFullscreenChange]);

    // Handle Tab key to insert tab character
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const newValue = value.substring(0, start) + "\t" + value.substring(end);
                onChange(newValue);
                // Move cursor after the tab
                setTimeout(() => {
                    target.selectionStart = target.selectionEnd = start + 1;
                }, 0);
            }
            // Escape exits fullscreen
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        },
        [value, onChange, isFullscreen]
    );

    // Sync scroll between editor and preview in split mode
    const handleEditorScroll = useCallback(() => {
        if (viewMode === "split" && textareaRef.current && previewRef.current) {
            const editor = textareaRef.current;
            const preview = previewRef.current;
            const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
            preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
        }
    }, [viewMode]);

    const editorContent = (
        <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="h-8 px-2"
                        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>

                    <ToggleGroup
                        type="single"
                        value={viewMode}
                        onValueChange={(v) => v && setViewMode(v as ViewMode)}
                        className="gap-1"
                    >
                        <ToggleGroupItem
                            value="edit"
                            aria-label="Edit only"
                            className="h-8 px-3 gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">Edit</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="split"
                            aria-label="Split view"
                            className="h-8 px-3 gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                            <Columns2 className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">Split</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="preview"
                            aria-label="Preview only"
                            className="h-8 px-3 gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">Preview</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <div className="text-xs text-muted-foreground hidden md:block">
                    <span className="font-mono">_text_</span> = underline •
                    <span className="font-mono ml-1">~text~</span> = smaller •
                    <span className="font-mono ml-1">[section]*</span> = border
                </div>
            </div>

            {/* Editor/Preview area */}
            <div
                className={cn(
                    "flex flex-1",
                    viewMode === "split" ? "flex-row" : "flex-col"
                )}
                style={{ minHeight: isFullscreen ? undefined : minHeight }}
            >
                {/* Editor pane */}
                {(viewMode === "edit" || viewMode === "split") && (
                    <div
                        className={cn(
                            "flex-1",
                            viewMode === "split" && "border-r"
                        )}
                    >
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onScroll={handleEditorScroll}
                            placeholder={placeholder}
                            className={cn(
                                "w-full h-full p-4 font-mono resize-none bg-transparent",
                                "focus:outline-none focus-visible:ring-0 border-0",
                                "placeholder:text-muted-foreground/50"
                            )}
                            style={{
                                fontSize: `${fontSize}px`,
                                lineHeight: 1.5,
                                tabSize: 8,
                                minHeight: isFullscreen ? "100%" : (viewMode === "split" ? "100%" : minHeight),
                            }}
                        />
                    </div>
                )}

                {/* Preview pane */}
                {(viewMode === "preview" || viewMode === "split") && (
                    <div
                        ref={previewRef}
                        className={cn(
                            "flex-1 p-4 overflow-auto"
                        )}
                        style={{ minHeight: isFullscreen ? "100%" : (viewMode === "split" ? "100%" : minHeight) }}
                    >
                        {value ? (
                            <ChordSheetRenderer text={value} fontSize={fontSize} />
                        ) : (
                            <div className="text-muted-foreground/50 font-mono" style={{ fontSize: `${fontSize}px` }}>
                                Preview will appear here...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-card flex flex-col">
                {editorContent}
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col border rounded-lg overflow-hidden bg-card", className)}>
            {editorContent}
        </div>
    );
}
