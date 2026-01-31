"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Song, updateSong, fileToBase64, getFileType } from "@/lib/db";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Image, Upload, X, Loader2, ChevronDown, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ChordSheetEditor } from "@/components/chord-sheet-editor";
import { cn } from "@/lib/utils";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Check if we're running in Tauri (native app)
const isTauri = () => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Check if we're on iOS (Tauri iOS or browser on iOS)
const isIOS = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
        (userAgent.includes('mac') && 'ontouchend' in document);
};

// Use native Tauri file picker only on desktop, NOT on iOS
// (Tauri dialog plugin doesn't properly handle iOS camera capture)
const shouldUseNativeDialog = () => {
    return isTauri() && !isIOS();
};

// Pick file using Tauri's native dialog (for iOS/desktop native apps)
async function openNativeFilePicker(): Promise<{ name: string; data: string; type: 'pdf' | 'image' } | null> {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');

        const result = await open({
            multiple: false,
            filters: [{
                name: 'Music Sheets',
                extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']
            }]
        });

        if (!result) return null;

        const filePath = typeof result === 'string' ? result : result;
        const response = await fetch(filePath);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const extension = filePath.split('.').pop()?.toLowerCase() || '';
        const type: 'pdf' | 'image' = extension === 'pdf' ? 'pdf' : 'image';
        const fileName = filePath.split('/').pop() || 'file';

        return { name: fileName, data: base64, type };
    } catch (error) {
        console.error('Failed to open native file picker:', error);
        return null;
    }
}

// Sortable page item component for drag-and-drop reordering
interface SortablePageItemProps {
    id: string;
    pageData: string;
    index: number;
    isPdf: boolean;
    isNew?: boolean;
    onRemove: () => void;
}

function SortablePageItem({ id, pageData, index, isPdf, isNew, onRemove }: SortablePageItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative aspect-[3/4] rounded-lg overflow-hidden border bg-muted/30",
                isDragging && "ring-2 ring-primary shadow-lg"
            )}
        >
            {isPdf || !pageData ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
            ) : (
                <img
                    src={pageData}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                    onError={(e) => {
                        // Hide broken images
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            )}

            {/* Drag handle - always visible */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 left-1 h-6 w-6 rounded bg-black/60 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
                <GripVertical className="h-4 w-4 text-white" />
            </div>

            {/* Delete button - always visible */}
            <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
            >
                <X className="h-3 w-3" />
            </Button>

            {/* Page number / new badge */}
            <span className={cn(
                "absolute bottom-1 left-1 text-[10px] text-white px-1 rounded",
                isNew ? "bg-green-600/80" : "bg-black/50"
            )}>
                {isNew ? "new" : index + 1}
            </span>
        </div>
    );
}

interface EditSongDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    song: Song | null;
    onSongUpdated: () => void;
}

export function EditSongDialog({
    open,
    onOpenChange,
    song,
    onSongUpdated,
}: EditSongDialogProps) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [songKey, setSongKey] = useState("");
    const [tempo, setTempo] = useState("");
    const [lyrics, setLyrics] = useState("");
    const [isXmas, setIsXmas] = useState(false);
    const [musicType, setMusicType] = useState<"file" | "text">("file");
    const [musicText, setMusicText] = useState("");
    const [existingMusicType, setExistingMusicType] = useState<"pdf" | "image" | "text" | undefined>();
    const [existingMusicFileName, setExistingMusicFileName] = useState<string | undefined>();
    // Store existing music pages as array with stable IDs for drag-and-drop
    const [existingMusicPages, setExistingMusicPages] = useState<{ id: string; data: string }[]>([]);
    const [keepExistingMusic, setKeepExistingMusic] = useState(true);
    // State for native file picker (Tauri/iOS) - array for multi-page support with IDs
    const [nativeFileData, setNativeFileData] = useState<{ id: string; name: string; data: string; type: 'pdf' | 'image' }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    // Collapsible sections state
    const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);
    const [isMusicExpanded, setIsMusicExpanded] = useState(true);

    // Store previews for new web files (as base64) with stable IDs
    const [newFilePreviews, setNewFilePreviews] = useState<{ id: string; data: string; file: File }[]>([]);

    // Client-side mounted check for dnd-kit
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const STORAGE_KEY = 'edit-song-dialog-draft';

    // Save draft to localStorage whenever form state changes
    const saveDraft = useCallback(() => {
        if (song && open) {
            const draft = {
                songId: song.id,
                title,
                artist,
                songKey,
                tempo,
                lyrics,
                isXmas,
                musicType,
                musicText,
                keepExistingMusic,
                isEditorFullscreen,
                timestamp: Date.now(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        }
    }, [song, open, title, artist, songKey, tempo, lyrics, isXmas, musicType, musicText, keepExistingMusic, isEditorFullscreen]);

    // Clear draft from localStorage
    const clearDraft = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Check for existing draft on mount
    useEffect(() => {
        if (song && open) {
            const savedDraft = localStorage.getItem(STORAGE_KEY);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    // Only restore if it's for the same song and less than 24 hours old
                    if (draft.songId === song.id && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
                        setTitle(draft.title || song.title);
                        setArtist(draft.artist || song.artist);
                        setSongKey(draft.songKey || song.key || "");
                        setTempo(draft.tempo || song.tempo || "");
                        setLyrics(draft.lyrics || song.lyrics || "");
                        setIsXmas(draft.isXmas ?? song.isXmas ?? false);
                        setMusicType(draft.musicType || (song.musicType === "text" ? "text" : "file"));
                        setMusicText(draft.musicText || song.musicData || "");
                        setKeepExistingMusic(draft.keepExistingMusic ?? !!song.musicData);
                        setIsEditorFullscreen(draft.isEditorFullscreen ?? false);
                        // Set existing music info
                        setExistingMusicType(song.musicType);
                        setExistingMusicFileName(song.musicFileName);

                        return; // Don't run the default initialization
                    }
                } catch (e) {
                    console.error("Failed to restore draft:", e);
                    clearDraft();
                }
            }

            // Default initialization (no draft or different song)
            setTitle(song.title);
            setArtist(song.artist);
            setSongKey(song.key || "");
            setTempo(song.tempo || "");
            setLyrics(song.lyrics || "");
            setIsXmas(song.isXmas || false);
            setExistingMusicType(song.musicType);
            setExistingMusicFileName(song.musicFileName);
            setKeepExistingMusic(!!song.musicData);

            // Parse existing music data into pages array with stable IDs
            if (song.musicData && song.musicType !== "text") {
                try {
                    // Only try to parse as JSON if it looks like a JSON array
                    if (song.musicData.startsWith('[') && song.musicData.endsWith(']')) {
                        const parsed = JSON.parse(song.musicData);
                        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                            setExistingMusicPages(parsed.map((data: string, i: number) => ({ id: `existing-${i}-${Date.now()}`, data })));
                        } else {
                            setExistingMusicPages([{ id: `existing-0-${Date.now()}`, data: song.musicData }]);
                        }
                    } else {
                        // Single image
                        setExistingMusicPages([{ id: `existing-0-${Date.now()}`, data: song.musicData }]);
                    }
                } catch {
                    // Not JSON, single page
                    setExistingMusicPages([{ id: `existing-0-${Date.now()}`, data: song.musicData }]);
                }
            } else {
                setExistingMusicPages([]);
            }

            if (song.musicType === "text") {
                setMusicType("text");
                setMusicText(song.musicData || "");
            } else {
                setMusicType("file");
                setMusicText("");
            }
            setNativeFileData([]);
            setNewFilePreviews([]);
        }
    }, [song, open, clearDraft]);

    // Save draft whenever form state changes
    useEffect(() => {
        if (song && open) {
            saveDraft();
        }
    }, [song, open, title, artist, songKey, tempo, lyrics, isXmas, musicType, musicText, keepExistingMusic, isEditorFullscreen, saveDraft]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        if (!song) return false;
        return (
            title !== song.title ||
            artist !== song.artist ||
            songKey !== (song.key || "") ||
            tempo !== (song.tempo || "") ||
            lyrics !== (song.lyrics || "") ||
            isXmas !== (song.isXmas || false) ||
            (musicType === "text" && musicText !== (song.musicData || "")) ||
            newFilePreviews.length > 0 ||
            nativeFileData.length > 0 ||
            (!keepExistingMusic && song.musicData)
        );
    }, [song, title, artist, songKey, tempo, lyrics, isXmas, musicType, musicText, newFilePreviews, nativeFileData, keepExistingMusic]);

    // Handle cancel with confirmation if there are unsaved changes
    const handleCancel = useCallback(() => {
        if (hasUnsavedChanges() && !confirmingCancel) {
            setConfirmingCancel(true);
            // Reset after 2 seconds if not clicked again
            setTimeout(() => setConfirmingCancel(false), 2000);
        } else {
            setConfirmingCancel(false);
            clearDraft();
            onOpenChange(false);
        }
    }, [hasUnsavedChanges, confirmingCancel, clearDraft, onOpenChange]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const newPreviews: { id: string; data: string; file: File }[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const type = getFileType(file);
                if (!type) {
                    toast.error(`${file.name}: Please upload PDF or image files only`);
                    continue;
                }
                // Generate base64 preview for images
                if (type === 'image') {
                    const base64 = await fileToBase64(file);
                    newPreviews.push({ id: `new-${Date.now()}-${i}`, data: base64, file });
                } else {
                    newPreviews.push({ id: `new-${Date.now()}-${i}`, data: '', file }); // PDF placeholder
                }
            }
            if (newPreviews.length > 0) {
                setNewFilePreviews(prev => [...prev, ...newPreviews]);
                setNativeFileData([]); // Clear native files if web files selected
            }
        }
        // Reset the input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle file upload click - use native picker on desktop Tauri only, HTML input on iOS and web
    const handleFileUploadClick = useCallback(async () => {
        if (shouldUseNativeDialog()) {
            // Use native file picker on desktop Tauri only
            const result = await openNativeFilePicker();
            if (result) {
                setNativeFileData(prev => [...prev, { id: `native-${Date.now()}`, ...result }]);
                setNewFilePreviews([]);
            }
        } else {
            // Use HTML file input on web and iOS (iOS handles camera via HTML input)
            fileInputRef.current?.click();
        }
    }, []);

    // Handle drag end for reordering pages
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        // Handle reordering within existing pages
        const existingActiveIdx = existingMusicPages.findIndex(p => p.id === activeId);
        const existingOverIdx = existingMusicPages.findIndex(p => p.id === overId);

        if (existingActiveIdx !== -1 && existingOverIdx !== -1) {
            setExistingMusicPages(prev => arrayMove(prev, existingActiveIdx, existingOverIdx));
            return;
        }

        // Handle reordering within new pages (native files)
        const nativeActiveIdx = nativeFileData.findIndex(f => f.id === activeId);
        const nativeOverIdx = nativeFileData.findIndex(f => f.id === overId);

        if (nativeActiveIdx !== -1 && nativeOverIdx !== -1) {
            setNativeFileData(prev => arrayMove(prev, nativeActiveIdx, nativeOverIdx));
            return;
        }

        // Handle reordering within new pages (web previews)
        const previewActiveIdx = newFilePreviews.findIndex(p => p.id === activeId);
        const previewOverIdx = newFilePreviews.findIndex(p => p.id === overId);

        if (previewActiveIdx !== -1 && previewOverIdx !== -1) {
            setNewFilePreviews(prev => arrayMove(prev, previewActiveIdx, previewOverIdx));
            return;
        }
    }, [existingMusicPages, nativeFileData, newFilePreviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!song) return;

        if (!title.trim() || !artist.trim()) {
            toast.error("Please enter a title and artist");
            return;
        }

        setIsSubmitting(true);

        try {
            const updates: Partial<Song> = {
                title: title.trim(),
                artist: artist.trim(),
                key: songKey.trim() || undefined,
                tempo: tempo.trim() || undefined,
                lyrics: lyrics || undefined,
                isXmas,
            };

            // Handle music updates
            if (musicType === "file") {
                // Collect all new file data (base64 strings)
                let newFilesData: string[] = [];
                let newFileType: 'pdf' | 'image' | undefined;

                if (nativeFileData.length > 0) {
                    newFilesData = nativeFileData.map(f => f.data);
                    newFileType = nativeFileData[0].type;
                } else if (newFilePreviews.length > 0) {
                    // For web files, convert to base64 if not already done
                    newFilesData = await Promise.all(newFilePreviews.map(async p => {
                        if (p.data) return p.data;
                        return await fileToBase64(p.file);
                    }));
                    newFileType = getFileType(newFilePreviews[0].file) || undefined;
                }

                // Combine existing pages (possibly with some removed) with new files
                const existingPageData = existingMusicPages.map(p => p.data);
                const combinedPages = [...existingPageData, ...newFilesData];

                if (combinedPages.length > 0) {
                    if (combinedPages.length === 1) {
                        // Single page - store as raw base64
                        updates.musicData = combinedPages[0];
                        updates.musicType = newFileType || existingMusicType;
                        updates.musicFileName = nativeFileData[0]?.name || newFilePreviews[0]?.file.name || existingMusicFileName || "image";
                    } else {
                        // Multiple pages - store as JSON array
                        updates.musicData = JSON.stringify(combinedPages);
                        updates.musicType = newFileType || existingMusicType;
                        updates.musicFileName = `${combinedPages.length} images`;
                    }
                } else {
                    // All pages removed
                    updates.musicData = undefined;
                    updates.musicType = undefined;
                    updates.musicFileName = undefined;
                }
            } else if (musicType === "text") {
                if (musicText.trim()) {
                    updates.musicData = musicText;
                    updates.musicType = "text";
                    updates.musicFileName = undefined;
                } else {
                    updates.musicData = undefined;
                    updates.musicType = undefined;
                    updates.musicFileName = undefined;
                }
            }

            await updateSong(song.id, updates);
            toast.success(`"${title}" updated!`);
            clearDraft(); // Clear saved draft after successful save
            onSongUpdated();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update song:", error);
            toast.error("Failed to update song. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveExistingMusic = () => {
        setKeepExistingMusic(false);
        setNativeFileData([]);
        setNewFilePreviews([]);
        setExistingMusicPages([]);
        setExistingMusicFileName(undefined);
        setExistingMusicType(undefined);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "overflow-y-auto transition-all duration-200",
                    isEditorFullscreen
                        ? "!max-w-[100vw] !w-[100vw] !max-h-[100vh] !h-[100vh] !rounded-none !translate-x-[-50%] !translate-y-[-50%]"
                        : cn("max-h-[90vh]", musicType === "text" ? "sm:max-w-5xl" : "sm:max-w-2xl")
                )}
                resizable={musicType === "text" && !isEditorFullscreen}
            >
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">Edit Song</DialogTitle>
                    <DialogDescription>
                        Update the song details, lyrics, and music sheet
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Title & Artist */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Song Title *</Label>
                            <Input
                                id="edit-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Bohemian Rhapsody"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-artist">Artist *</Label>
                            <Input
                                id="edit-artist"
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                placeholder="e.g. Queen"
                                required
                            />
                        </div>
                    </div>

                    {/* Key */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-key">Key (optional)</Label>
                        <Input
                            id="edit-key"
                            value={songKey}
                            onChange={(e) => setSongKey(e.target.value)}
                            placeholder="e.g. Bb, Am, G#m"
                            className="max-w-32"
                        />
                    </div>

                    {/* Tempo */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-tempo">BPM (optional)</Label>
                        <Input
                            id="edit-tempo"
                            value={tempo}
                            onChange={(e) => setTempo(e.target.value)}
                            placeholder="e.g. 80 BPM"
                            className="max-w-32"
                        />
                    </div>

                    {/* Christmas checkbox */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="edit-xmas"
                            checked={isXmas}
                            onCheckedChange={(checked) => setIsXmas(checked === true)}
                        />
                        <Label htmlFor="edit-xmas" className="cursor-pointer">
                            🎄 Christmas Song
                        </Label>
                    </div>

                    {/* Lyrics */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
                            className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-foreground/80 transition-colors"
                        >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", !isLyricsExpanded && "-rotate-90")} />
                            Lyrics
                        </button>
                        {isLyricsExpanded && (
                            <Textarea
                                id="edit-lyrics"
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder="Paste or type the lyrics here..."
                                className="min-h-[150px] font-mono text-sm"
                            />
                        )}
                    </div>

                    {/* Music */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setIsMusicExpanded(!isMusicExpanded)}
                            className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-foreground/80 transition-colors"
                        >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", !isMusicExpanded && "-rotate-90")} />
                            Music Sheet
                        </button>
                        {isMusicExpanded && (
                            <Tabs value={musicType} onValueChange={(v) => setMusicType(v as "file" | "text")}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="file" className="gap-2">
                                        <Upload className="h-4 w-4" />
                                        Upload File
                                    </TabsTrigger>
                                    <TabsTrigger value="text" className="gap-2">
                                        <FileText className="h-4 w-4" />
                                        Type Text
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="file" className="mt-3">
                                    <div className="space-y-3">
                                        {isMounted ? (
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleDragEnd}
                                            >
                                                {/* Show selected new files as thumbnails */}
                                                {(newFilePreviews.length > 0 || nativeFileData.length > 0) && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-muted-foreground">New pages ({newFilePreviews.length + nativeFileData.length})</p>
                                                        <SortableContext
                                                            items={nativeFileData.length > 0
                                                                ? nativeFileData.map(f => f.id)
                                                                : newFilePreviews.map(p => p.id)
                                                            }
                                                            strategy={rectSortingStrategy}
                                                        >
                                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                                {nativeFileData.length > 0
                                                                    ? nativeFileData.map((file, index) => (
                                                                        <SortablePageItem
                                                                            key={file.id}
                                                                            id={file.id}
                                                                            pageData={file.data}
                                                                            index={index}
                                                                            isPdf={file.type === 'pdf'}
                                                                            isNew={true}
                                                                            onRemove={() => setNativeFileData(prev => prev.filter(f => f.id !== file.id))}
                                                                        />
                                                                    ))
                                                                    : newFilePreviews.map((preview, index) => (
                                                                        <SortablePageItem
                                                                            key={preview.id}
                                                                            id={preview.id}
                                                                            pageData={preview.data || ''}
                                                                            index={index}
                                                                            isPdf={!preview.data}
                                                                            isNew={true}
                                                                            onRemove={() => {
                                                                                setNewFilePreviews(prev => prev.filter(p => p.id !== preview.id));
                                                                            }}
                                                                        />
                                                                    ))
                                                                }
                                                            </div>
                                                        </SortableContext>
                                                    </div>
                                                )}

                                                {/* Show existing music pages with thumbnails */}
                                                {existingMusicPages.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-muted-foreground">Current pages ({existingMusicPages.length})</p>
                                                        <SortableContext
                                                            items={existingMusicPages.map(p => p.id)}
                                                            strategy={rectSortingStrategy}
                                                        >
                                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                                {existingMusicPages.map((page, index) => (
                                                                    <SortablePageItem
                                                                        key={page.id}
                                                                        id={page.id}
                                                                        pageData={page.data}
                                                                        index={index}
                                                                        isPdf={existingMusicType === 'pdf'}
                                                                        onRemove={() => setExistingMusicPages(prev => prev.filter(p => p.id !== page.id))}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </div>
                                                )}
                                            </DndContext>
                                        ) : null}

                                        {/* Upload area / Add more button */}
                                        <div
                                            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                            onClick={handleFileUploadClick}
                                        >
                                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                {newFilePreviews.length > 0 || nativeFileData.length > 0 || existingMusicPages.length > 0
                                                    ? "Add more pages"
                                                    : "Click to upload PDF or take photos"}
                                            </p>
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,image/*"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </TabsContent>

                                <TabsContent value="text" className="mt-3">
                                    <ChordSheetEditor
                                        value={musicText}
                                        onChange={setMusicText}
                                        minHeight="250px"
                                        onFullscreenChange={setIsEditorFullscreen}
                                    />
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant={confirmingCancel ? "destructive" : "outline"}
                            onClick={handleCancel}
                            className={confirmingCancel ? "flex-col h-auto py-2" : ""}
                        >
                            {confirmingCancel ? (
                                <>
                                    <span>Are you sure?</span>
                                    <span className="text-xs opacity-80">Unsaved changes will be lost</span>
                                </>
                            ) : (
                                "Cancel"
                            )}
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
