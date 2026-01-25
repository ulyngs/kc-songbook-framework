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
  const [musicFile, setMusicFile] = useState<File[]>([]);
  // State for native file picker (Tauri/iOS) - array for multi-page support
  const [nativeFileData, setNativeFileData] = useState<{ name: string; data: string; type: 'pdf' | 'image' }[]>([]);
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
    setMusicFile([]);
    setNativeFileData([]);
    setShowPasswordInput(false);
    setPassword("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const type = getFileType(file);
        if (!type) {
          toast.error(`${file.name}: Please upload PDF or image files only`);
          continue;
        }
        newFiles.push(file);
      }
      if (newFiles.length > 0) {
        setMusicFile(prev => [...prev, ...newFiles]);
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
        setNativeFileData(prev => [...prev, result]);
        setMusicFile([]); // Clear web files if native file selected
      }
    } else {
      // Use HTML file input on web and iOS (iOS handles camera via HTML input)
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

      if (musicType === "file" && (musicFile.length > 0 || nativeFileData.length > 0)) {
        if (nativeFileData.length > 0) {
          // Use native file data (already base64)
          if (nativeFileData.length === 1) {
            // Single file - use existing format for backwards compatibility
            musicData = nativeFileData[0].data;
            resolvedMusicType = nativeFileData[0].type;
            musicFileName = nativeFileData[0].name;
          } else {
            // Multiple files - JSON encode array of base64 strings
            musicData = JSON.stringify(nativeFileData.map(f => f.data));
            resolvedMusicType = nativeFileData[0].type; // All should be same type (image)
            musicFileName = `${nativeFileData.length} images`;
          }
        } else if (musicFile.length > 0) {
          // Use web files
          if (musicFile.length === 1) {
            // Single file - use existing format
            musicData = await fileToBase64(musicFile[0]);
            resolvedMusicType = getFileType(musicFile[0]) || undefined;
            musicFileName = musicFile[0].name;
          } else {
            // Multiple files - convert all to base64 and JSON encode
            const base64Array = await Promise.all(musicFile.map(f => fileToBase64(f)));
            musicData = JSON.stringify(base64Array);
            resolvedMusicType = getFileType(musicFile[0]) || undefined;
            musicFileName = `${musicFile.length} images`;
          }
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
                    <div className="space-y-3">
                      {/* Show selected files */}
                      {(musicFile.length > 0 || nativeFileData.length > 0) && (
                        <div className="space-y-2">
                          {musicFile.map((file, index) => (
                            <div key={`web-${index}`} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                              {file.type?.includes("pdf") ? (
                                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                              ) : (
                                <Image className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMusicFile(prev => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {nativeFileData.map((file, index) => (
                            <div key={`native-${index}`} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                              {file.type === "pdf" ? (
                                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                              ) : (
                                <Image className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNativeFileData(prev => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload area / Add more button */}
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onClick={handleFileUploadClick}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {musicFile.length > 0 || nativeFileData.length > 0
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




