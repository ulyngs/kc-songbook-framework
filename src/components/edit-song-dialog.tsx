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
import { FileText, Image, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize form when song changes
    useEffect(() => {
        if (song && open) {
            setTitle(song.title);
            setArtist(song.artist);
            setSongKey(song.key || "");
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
    }, [song, open]);

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
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                        <Label htmlFor="edit-lyrics">Lyrics</Label>
                        <Textarea
                            id="edit-lyrics"
                            value={lyrics}
                            onChange={(e) => setLyrics(e.target.value)}
                            placeholder="Paste or type the lyrics here..."
                            className="min-h-[150px] font-mono text-sm"
                        />
                    </div>

                    {/* Music */}
                    <div className="space-y-3">
                        <Label>Music Sheet</Label>
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
                                <Textarea
                                    value={musicText}
                                    onChange={(e) => setMusicText(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Allow Tab key to insert a tab character instead of moving focus
                                        if (e.key === "Tab") {
                                            e.preventDefault();
                                            const target = e.target as HTMLTextAreaElement;
                                            const start = target.selectionStart;
                                            const end = target.selectionEnd;
                                            const newValue = musicText.substring(0, start) + "\t" + musicText.substring(end);
                                            setMusicText(newValue);
                                            // Move cursor after the tab
                                            setTimeout(() => {
                                                target.selectionStart = target.selectionEnd = start + 1;
                                            }, 0);
                                        }
                                    }}
                                    placeholder="Type chord charts, tabs, or notation..."
                                    className="min-h-[150px] font-mono text-sm"
                                />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
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
