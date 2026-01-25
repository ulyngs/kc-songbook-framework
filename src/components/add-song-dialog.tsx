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
import { FileText, Image, Upload, X, Loader2, Lock, ChevronDown, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { importKCCollection } from "@/lib/kc-collection";
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

// Sortable page item component for drag-and-drop reordering
interface SortablePageItemProps {
  id: string;
  pageData: string;
  index: number;
  isPdf: boolean;
  onRemove: () => void;
}

function SortablePageItem({ id, pageData, index, isPdf, onRemove }: SortablePageItemProps) {
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

      {/* Page number */}
      <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">
        {index + 1}
      </span>
    </div>
  );
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
  // State for native file picker (Tauri/iOS) - array with stable IDs for drag-drop
  const [nativeFileData, setNativeFileData] = useState<{ id: string; name: string; data: string; type: 'pdf' | 'image' }[]>([]);
  // Store previews for new web files (as base64) with stable IDs
  const [newFilePreviews, setNewFilePreviews] = useState<{ id: string; data: string; file: File }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // KC Collection Import State
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

  // Collapsible sections state
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);
  const [isMusicExpanded, setIsMusicExpanded] = useState(true);

  // Client-side mounted check for dnd-kit
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Handle drag end for reordering pages
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Handle reordering within native files
    const nativeActiveIdx = nativeFileData.findIndex(f => f.id === activeId);
    const nativeOverIdx = nativeFileData.findIndex(f => f.id === overId);

    if (nativeActiveIdx !== -1 && nativeOverIdx !== -1) {
      setNativeFileData(prev => arrayMove(prev, nativeActiveIdx, nativeOverIdx));
      return;
    }

    // Handle reordering within web previews
    const previewActiveIdx = newFilePreviews.findIndex(p => p.id === activeId);
    const previewOverIdx = newFilePreviews.findIndex(p => p.id === overId);

    if (previewActiveIdx !== -1 && previewOverIdx !== -1) {
      setNewFilePreviews(prev => arrayMove(prev, previewActiveIdx, previewOverIdx));
      return;
    }
  }, [nativeFileData, newFilePreviews]);

  const resetForm = () => {
    setTitle("");
    setArtist("");
    setSongKey("");
    setTempo("");
    setLyrics("");
    setMusicType("file");
    setMusicText("");
    setNativeFileData([]);
    setNewFilePreviews([]);
    setShowPasswordInput(false);
    setPassword("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: File[] = [];
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

      if (musicType === "file" && (newFilePreviews.length > 0 || nativeFileData.length > 0)) {
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
        } else if (newFilePreviews.length > 0) {
          // Use web files
          if (newFilePreviews.length === 1) {
            // Single file - use existing format
            const preview = newFilePreviews[0];
            musicData = preview.data || await fileToBase64(preview.file);
            resolvedMusicType = getFileType(preview.file) || undefined;
            musicFileName = preview.file.name;
          } else {
            // Multiple files - convert all to base64 and JSON encode
            const base64Array = await Promise.all(newFilePreviews.map(async p => p.data || await fileToBase64(p.file)));
            musicData = JSON.stringify(base64Array);
            resolvedMusicType = getFileType(newFilePreviews[0].file) || undefined;
            musicFileName = `${newFilePreviews.length} images`;
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
                      {isMounted ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          {/* Show selected files as thumbnails */}
                          {(newFilePreviews.length > 0 || nativeFileData.length > 0) && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Pages ({newFilePreviews.length + nativeFileData.length})</p>
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
                        </DndContext>
                      ) : null}

                      {/* Upload area / Add more button */}
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onClick={handleFileUploadClick}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {newFilePreviews.length > 0 || nativeFileData.length > 0
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




