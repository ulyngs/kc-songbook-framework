"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addSong, fileToBase64, getFileType } from "@/lib/db";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Image, Upload, X, Loader2, Lock, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { importKCCollection } from "@/lib/kc-collection";
import { ChordSheetEditor } from "@/components/chord-sheet-editor";
import { cn } from "@/lib/utils";

// Check if we're running in Tauri (native app)
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Pick file using Tauri's native dialog (for iOS/desktop native apps)
async function openNativeFilePicker(): Promise<{ name: string; data: string; type: 'pdf' | 'image' } | null> {
  try {
    // Dynamically import to avoid issues on web
    const { open } = await import('@tauri-apps/plugin-dialog');

    const result = await open({
      multiple: false,
      filters: [{
        name: 'Music Sheets',
        extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']
      }]
    });

    if (!result) return null;

    // result is a file path on iOS/desktop
    const filePath = typeof result === 'string' ? result : result;

    // Read the file using fetch (works with Tauri's asset protocol)
    const response = await fetch(filePath);
    const blob = await response.blob();

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Determine file type from path
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const type: 'pdf' | 'image' = extension === 'pdf' ? 'pdf' : 'image';
    const fileName = filePath.split('/').pop() || 'file';

    return { name: fileName, data: base64, type };
  } catch (error) {
    console.error('Failed to open native file picker:', error);
    return null;
  }
}

interface AddSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSongAdded: () => void;
  initialMode?: "single" | "kc-collection";
}

export function AddSongDialog({
  open,
  onOpenChange,
  onSongAdded,
  initialMode = "single",
}: AddSongDialogProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [tempo, setTempo] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [musicType, setMusicType] = useState<"file" | "text">("file");
  const [musicText, setMusicText] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  // State for native file picker (Tauri/iOS)
  const [nativeFileData, setNativeFileData] = useState<{ name: string; data: string; type: 'pdf' | 'image' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // KC Collection Import State
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

  // Collapsible sections state
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);
  const [isMusicExpanded, setIsMusicExpanded] = useState(true);

  // Reset or set mode when dialog opens
  useEffect(() => {
    if (open) {
      if (initialMode === "kc-collection") {
        setShowPasswordInput(true);
      } else {
        setShowPasswordInput(false);
      }
    }
  }, [open, initialMode]);


  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setArtist("");
    setSongKey("");
    setTempo("");
    setLyrics("");
    setMusicType("file");
    setMusicText("");
    setMusicFile(null);
    setNativeFileData(null);
    setShowPasswordInput(false);
    setPassword("");
  };

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
    }
  };

  // Handle file upload click - use native picker on Tauri, HTML input on web
  const handleFileUploadClick = useCallback(async () => {
    if (isTauri()) {
      // Use native file picker on Tauri (iOS/desktop)
      const result = await openNativeFilePicker();
      if (result) {
        setNativeFileData(result);
        setMusicFile(null); // Clear web file if native file selected
      }
    } else {
      // Use HTML file input on web
      fileInputRef.current?.click();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !artist.trim()) {
      toast.error("Please enter a title and artist");
      return;
    }

    setIsSubmitting(true);

    try {
      let musicData: string | undefined;
      let resolvedMusicType: "pdf" | "image" | "text" | undefined;
      let musicFileName: string | undefined;

      if (musicType === "file" && (musicFile || nativeFileData)) {
        if (nativeFileData) {
          // Use native file data (already base64)
          musicData = nativeFileData.data;
          resolvedMusicType = nativeFileData.type;
          musicFileName = nativeFileData.name;
        } else if (musicFile) {
          // Use web file
          musicData = await fileToBase64(musicFile);
          resolvedMusicType = getFileType(musicFile) || undefined;
          musicFileName = musicFile.name;
        }
      } else if (musicType === "text" && musicText.trim()) {
        musicData = musicText;
        resolvedMusicType = "text";
      }

      await addSong({
        title: title.trim(),
        artist: artist.trim(),
        key: songKey.trim() || undefined,
        tempo: tempo.trim() || undefined,
        lyrics: lyrics.trim() || undefined,
        musicType: resolvedMusicType,
        musicData,
        musicFileName,
        isPublicDomain: false,
      });

      toast.success(`"${title}" added to your songbook!`);
      resetForm();
      onSongAdded();
    } catch (error) {
      console.error("Failed to add song:", error);
      toast.error("Failed to add song. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKCImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsImporting(true);
    const success = await importKCCollection(password);
    setIsImporting(false);

    if (success) {
      setPassword("");
      setShowPasswordInput(false);
      onSongAdded();
      onOpenChange(false);
    }
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
          <DialogTitle className="font-display text-xl">
            {showPasswordInput ? "Unlock Collection" : "Add New Song"}
          </DialogTitle>
          <DialogDescription>
            {showPasswordInput
              ? "Enter password to unlock the KC Collection"
              : "Add lyrics and music sheets to your songbook"
            }
          </DialogDescription>
        </DialogHeader>

        {showPasswordInput ? (
          <form onSubmit={handleKCImport} className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter collection password"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordInput(false);
                  setPassword("");
                }}
              >
                Back
              </Button>
              <Button type="submit" disabled={isImporting || !password}>
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Unlock & Import
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title & Artist */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Song Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bohemian Rhapsody"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="artist">Artist *</Label>
                <Input
                  id="artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Queen"
                  required
                />
              </div>
            </div>

            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="key">Key (optional)</Label>
              <Input
                id="key"
                value={songKey}
                onChange={(e) => setSongKey(e.target.value)}
                placeholder="e.g. Bb, Am, G#m"
                className="max-w-32"
              />
            </div>

            {/* Tempo */}
            <div className="space-y-2">
              <Label htmlFor="tempo">BPM (optional)</Label>
              <Input
                id="tempo"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                placeholder="e.g. 80 BPM"
                className="max-w-32"
              />
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
                  id="lyrics"
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
                          {(musicFile?.type?.includes("pdf") || nativeFileData?.type === "pdf") ? (
                            <FileText className="h-6 w-6 text-primary" />
                          ) : (
                            <Image className="h-6 w-6 text-primary" />
                          )}
                          <span className="text-sm font-medium">
                            {musicFile?.name || nativeFileData?.name}
                          </span>
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
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Song
              </Button>
            </div>

            {!showPasswordInput && (
              <div className="pt-4 mt-2 border-t border-border/50 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswordInput(true)}
                >
                  <Lock className="h-3 w-3" />
                  <span className="text-xs">Have the KC Collection password? Import it here</span>
                </Button>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}




