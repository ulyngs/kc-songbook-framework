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
import { FileText, Image, Upload, X, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ChordSheetEditor } from "@/components/chord-sheet-editor";
import { cn } from "@/lib/utils";

// Check if we're running in Tauri (native app)
const isTauri = () => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
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
    const [musicFile, setMusicFile] = useState<File | null>(null);
    const [existingMusicType, setExistingMusicType] = useState<"pdf" | "image" | "text" | undefined>();
    const [existingMusicFileName, setExistingMusicFileName] = useState<string | undefined>();
    const [keepExistingMusic, setKeepExistingMusic] = useState(true);
    // State for native file picker (Tauri/iOS)
    const [nativeFileData, setNativeFileData] = useState<{ name: string; data: string; type: 'pdf' | 'image' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    // Collapsible sections state
    const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);
    const [isMusicExpanded, setIsMusicExpanded] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        setMusicFile(null);
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

            if (song.musicType === "text") {
                setMusicType("text");
                setMusicText(song.musicData || "");
            } else {
                setMusicType("file");
                setMusicText("");
            }
            setMusicFile(null);
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
            musicFile !== null ||
            nativeFileData !== null ||
            (!keepExistingMusic && song.musicData)
        );
    }, [song, title, artist, songKey, tempo, lyrics, isXmas, musicType, musicText, musicFile, nativeFileData, keepExistingMusic]);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const type = getFileType(file);
            if (!type) {
                toast.error("Please upload a PDF or image file");
                return;
            }
            setMusicFile(file);
            setNativeFileData(null); // Clear native file if web file selected
            setKeepExistingMusic(false);
        }
    };

    // Handle file upload click - use native picker on Tauri, HTML input on web
    const handleFileUploadClick = useCallback(async () => {
        if (isTauri()) {
            const result = await openNativeFilePicker();
            if (result) {
                setNativeFileData(result);
                setMusicFile(null);
                setKeepExistingMusic(false);
            }
        } else {
            fileInputRef.current?.click();
        }
    }, []);

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
                lyrics: lyrics.trim() || undefined,
                isXmas,
            };

            // Handle music updates
            if (musicType === "file") {
                if (nativeFileData) {
                    // Native file picked (Tauri/iOS)
                    updates.musicData = nativeFileData.data;
                    updates.musicType = nativeFileData.type;
                    updates.musicFileName = nativeFileData.name;
                } else if (musicFile) {
                    // New web file uploaded
                    updates.musicData = await fileToBase64(musicFile);
                    updates.musicType = getFileType(musicFile) || undefined;
                    updates.musicFileName = musicFile.name;
                } else if (!keepExistingMusic) {
                    // User cleared the existing file
                    updates.musicData = undefined;
                    updates.musicType = undefined;
                    updates.musicFileName = undefined;
                }
                // else: keep existing music (don't update those fields)
            } else if (musicType === "text") {
                if (musicText.trim()) {
                    updates.musicData = musicText.trim();
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
        setMusicFile(null);
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
                                    <div
                                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                        onClick={handleFileUploadClick}
                                    >
                                        {musicFile || nativeFileData ? (
                                            <div className="flex items-center justify-center gap-3">
                                                {(musicFile?.type === "application/pdf" || nativeFileData?.type === "pdf") ? (
                                                    <FileText className="h-8 w-8 text-primary" />
                                                ) : (
                                                    <Image className="h-8 w-8 text-primary" />
                                                )}
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">
                                                        {musicFile?.name || nativeFileData?.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {musicFile
                                                            ? `${(musicFile.size / 1024).toFixed(1)} KB (new file)`
                                                            : "(new file)"}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="ml-auto"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMusicFile(null);
                                                        setNativeFileData(null);
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : keepExistingMusic && existingMusicFileName ? (
                                            <div className="flex items-center justify-center gap-3">
                                                {existingMusicType === "pdf" ? (
                                                    <FileText className="h-8 w-8 text-primary" />
                                                ) : (
                                                    <Image className="h-8 w-8 text-primary" />
                                                )}
                                                <div className="text-left">
                                                    <p className="font-medium text-sm">{existingMusicFileName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Current file - click to replace
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="ml-auto"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveExistingMusic();
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    Click to upload PDF or image
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,image/*"
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
