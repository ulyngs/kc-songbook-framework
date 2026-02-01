"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Song, getSong, updateSong, getAllSongs } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LetterText,
  Music,
  Edit3,
  Save,
  X,
  Loader2,
  Moon,
  Sun,
  Play,
  Pause,
  Minus,
  Plus,
  PanelTopClose,
  PanelBottomClose,
  Maximize2,
  Minimize2,
  Heart,
  ALargeSmall,
  ZoomIn,
  Gauge,
  MoreVertical,
  Home,
  Pencil,
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SonglistSheet } from "@/components/songlist-sheet";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import { SeamlessPdfViewer } from "@/components/seamless-pdf-viewer";
import { ChordSheetRenderer } from "@/components/chord-sheet-renderer";
import { ChordSheetEditor } from "@/components/chord-sheet-editor";
import { EditSongDialog } from "@/components/edit-song-dialog";

type ViewMode = "lyrics" | "music";

// Get initial view mode from localStorage
function getInitialViewMode(): ViewMode {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("songbook-view-mode");
    if (saved === "lyrics" || saved === "music") {
      return saved;
    }
  }
  return "lyrics";
}

// Get initial immersive mode from localStorage
function getInitialImmersiveMode(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("songbook-immersive-mode") === "true";
  }
  return false;
}

// Get initial font size from localStorage
function getInitialFontSize(): number {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("songbook-lyrics-font-size");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 8 && parsed <= 120) {
        return parsed;
      }
    }
  }
  return 22; // Default font size
}

// Get initial lyrics fullscreen mode from localStorage
function getInitialLyricsFullscreen(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("songbook-lyrics-fullscreen") === "true";
  }
  return false;
}

//   params: Promise<{ slug?: string[] }>;
// }) {
//   const { slug } = use(params);
export default function SongPageClient() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [song, setSong] = useState<Song | null>(null);
  const [prevSongId, setPrevSongId] = useState<string | null>(null);
  const [nextSongId, setNextSongId] = useState<string | null>(null);
  const [maxTitleWidth, setMaxTitleWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewModeState] = useState<ViewMode>("lyrics");
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const [isEditingMusic, setIsEditingMusic] = useState(false);
  const [editedMusicText, setEditedMusicText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const searchParams = useSearchParams();

  // Get song ID from URL search params (reactive to URL changes)
  const id = searchParams?.get("id") || undefined;

  // Debug logging
  useEffect(() => {
    console.log("[SongPageClient] URL changed, ID:", id, "URL:", window.location.href);
  }, [id]);

  // Track mount state
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Redirect to home if no song ID provided (only after mount)
  useEffect(() => {
    if (hasMounted && !id) {
      console.log("[SongPageClient] No ID found after mount, redirecting to home");
      router.replace("/");
    }
  }, [hasMounted, id, router]);

  // Wrapper to persist view mode to localStorage
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-view-mode", mode);
    }
  }, []);

  // Load saved view mode on mount
  useEffect(() => {
    const saved = getInitialViewMode();
    setViewModeState(saved);
  }, []);

  // Immersive mode (hide header)
  const [isHeaderHiddenState, setIsHeaderHiddenState] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Wrapper to persist immersive mode to localStorage
  const setIsHeaderHidden = useCallback((hidden: boolean) => {
    setIsHeaderHiddenState(hidden);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-immersive-mode", String(hidden));
    }
  }, []);

  // Alias for reading
  const isHeaderHidden = isHeaderHiddenState;

  // Load saved immersive mode on mount
  useEffect(() => {
    const saved = getInitialImmersiveMode();
    setIsHeaderHiddenState(saved);
  }, []);

  // Auto-scroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(5); // pixels per second (1:1 with displayed value, range 1-15)
  const lyricsRef = useRef<HTMLDivElement>(null);
  const musicScrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatedScrollRef = useRef<number>(0);

  // Font size state
  const [lyricsFontSize, setLyricsFontSizeState] = useState(22);
  const DEFAULT_FONT_SIZE = 22;

  // Font size input editing state
  const [isEditingFontSize, setIsEditingFontSize] = useState(false);
  const [fontSizeInputValue, setFontSizeInputValue] = useState("22");

  // Speed input editing state
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [speedInputValue, setSpeedInputValue] = useState("3");

  // Touch state for pinch-to-zoom on lyrics
  const lyricsTouchStateRef = useRef<{
    initialDistance: number;
    initialFontSize: number;
  } | null>(null);

  // Lyrics fullscreen (expanded) state
  const [isLyricsFullscreen, setIsLyricsFullscreenState] = useState(false);

  // Music fullscreen (expanded) state
  const [isMusicFullscreen, setIsMusicFullscreenState] = useState(false);

  // Wrapper to persist lyrics fullscreen to localStorage
  const setIsLyricsFullscreen = useCallback((value: boolean) => {
    setIsLyricsFullscreenState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-lyrics-fullscreen", String(value));
    }
  }, []);

  // Wrapper to persist music fullscreen to localStorage
  const setIsMusicFullscreen = useCallback((value: boolean) => {
    setIsMusicFullscreenState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-music-fullscreen", String(value));
    }
  }, []);

  // Load saved lyrics fullscreen mode on mount
  useEffect(() => {
    const saved = getInitialLyricsFullscreen();
    setIsLyricsFullscreenState(saved);
    // Also load music fullscreen
    if (typeof window !== "undefined") {
      const musicSaved = localStorage.getItem("songbook-music-fullscreen");
      if (musicSaved === "true") {
        setIsMusicFullscreenState(true);
      }
    }
  }, []);

  // PDF zoom state
  const [pdfZoom, setPdfZoom] = useState(1.1);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("100");

  // Edit song dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Toggle lyrics fullscreen
  const toggleLyricsFullscreen = useCallback(() => {
    setIsLyricsFullscreen(!isLyricsFullscreen);
  }, [isLyricsFullscreen, setIsLyricsFullscreen]);

  // Toggle music fullscreen
  const toggleMusicFullscreen = useCallback(() => {
    setIsMusicFullscreen(!isMusicFullscreen);
  }, [isMusicFullscreen, setIsMusicFullscreen]);

  // Exit fullscreen on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isLyricsFullscreen) {
          setIsLyricsFullscreen(false);
        }
        if (isMusicFullscreen) {
          setIsMusicFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLyricsFullscreen, setIsLyricsFullscreen, isMusicFullscreen, setIsMusicFullscreen]);

  const handleZoomChange = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
    setPdfZoom(clampedZoom);
    setZoomInputValue(Math.round(clampedZoom * 100).toString());
  }, []);

  const handleZoomInputSubmit = useCallback(() => {
    const parsed = parseInt(zoomInputValue, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 500) {
      handleZoomChange(parsed / 100);
    } else {
      // Reset to current zoom if invalid
      setZoomInputValue(Math.round(pdfZoom * 100).toString());
    }
    setIsEditingZoom(false);
  }, [zoomInputValue, pdfZoom, handleZoomChange]);

  // Wrapper to persist font size to localStorage
  const setLyricsFontSize = useCallback((size: number) => {
    const clampedSize = Math.max(8, Math.min(120, size));
    setLyricsFontSizeState(clampedSize);
    setFontSizeInputValue(String(clampedSize));
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-lyrics-font-size", String(clampedSize));
    }
  }, []);

  // Handle font size input submit
  const handleFontSizeInputSubmit = useCallback(() => {
    const parsed = parseInt(fontSizeInputValue, 10);
    if (!isNaN(parsed) && parsed >= 8 && parsed <= 120) {
      setLyricsFontSize(parsed);
    } else {
      // Reset to current font size if invalid
      setFontSizeInputValue(String(lyricsFontSize));
    }
    setIsEditingFontSize(false);
  }, [fontSizeInputValue, lyricsFontSize, setLyricsFontSize]);

  // Store setLyricsFontSize in a ref so event handlers always have latest version
  const setLyricsFontSizeRef = useRef(setLyricsFontSize);
  useEffect(() => {
    setLyricsFontSizeRef.current = setLyricsFontSize;
  }, [setLyricsFontSize]);

  // Track current font size in a ref so event handlers always have latest value
  const lyricsFontSizeRef = useRef(lyricsFontSize);
  useEffect(() => {
    lyricsFontSizeRef.current = lyricsFontSize;
  }, [lyricsFontSize]);

  // Callback ref for lyrics container - attaches event listeners when element mounts
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsRefCallback = useCallback((node: HTMLDivElement | null) => {
    // Cleanup old listeners if we had a previous node
    if (lyricsContainerRef.current) {
      const oldNode = lyricsContainerRef.current;
      oldNode.removeEventListener("wheel", handleWheel);
      oldNode.removeEventListener("touchstart", handleTouchStart);
      oldNode.removeEventListener("touchmove", handleTouchMove);
      oldNode.removeEventListener("touchend", handleTouchEnd);
      oldNode.removeEventListener("touchcancel", handleTouchEnd);
    }

    // Store the new node
    lyricsContainerRef.current = node;
    // Also update lyricsRef for scrolling functionality
    lyricsRef.current = node;

    // Attach new listeners if we have a node
    if (node) {
      node.addEventListener("wheel", handleWheel, { passive: false });
      node.addEventListener("touchstart", handleTouchStart, { passive: false });
      node.addEventListener("touchmove", handleTouchMove, { passive: false });
      node.addEventListener("touchend", handleTouchEnd);
      node.addEventListener("touchcancel", handleTouchEnd);
    }
  }, []);

  // Stable event handler functions that use refs to access current state
  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = 1 - e.deltaY * 0.01;
      const newSize = Math.round(lyricsFontSizeRef.current * zoomFactor);
      setLyricsFontSizeRef.current(newSize);
    }
  }

  function getTouchDistance(touches: TouchList) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      lyricsTouchStateRef.current = {
        initialDistance: getTouchDistance(e.touches),
        initialFontSize: lyricsFontSizeRef.current,
      };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && lyricsTouchStateRef.current) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / lyricsTouchStateRef.current.initialDistance;
      const newSize = Math.round(lyricsTouchStateRef.current.initialFontSize * scaleChange);
      setLyricsFontSizeRef.current(newSize);
    }
  }

  function handleTouchEnd() {
    lyricsTouchStateRef.current = null;
  }

  // Load saved font size on mount
  useEffect(() => {
    const saved = getInitialFontSize();
    setLyricsFontSizeState(saved);
    setFontSizeInputValue(String(saved));
  }, []);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll effect - works for both lyrics and music views
  useEffect(() => {
    if (!isScrolling || isEditing) {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
      accumulatedScrollRef.current = 0;
      return;
    }

    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = currentTime;

      // Use the appropriate scroll container based on view mode
      const scrollContainer = viewMode === "music" ? musicScrollRef.current : lyricsRef.current;

      if (scrollContainer) {
        // Accumulate fractional scroll amounts
        accumulatedScrollRef.current += scrollSpeed * deltaTime;

        // Only scroll when we have at least 1 pixel accumulated
        if (accumulatedScrollRef.current >= 1) {
          const scrollAmount = Math.floor(accumulatedScrollRef.current);
          scrollContainer.scrollTop += scrollAmount;
          accumulatedScrollRef.current -= scrollAmount;
        }

        // Stop at the bottom
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        if (scrollTop + clientHeight >= scrollHeight - 10) {
          setIsScrolling(false);
          return;
        }
      }

      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    accumulatedScrollRef.current = 0;
    scrollAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, [isScrolling, scrollSpeed, viewMode, isEditing]);

  // Stop scrolling when editing
  useEffect(() => {
    if (isEditing) {
      setIsScrolling(false);
    }
  }, [isEditing]);

  const adjustSpeed = useCallback((delta: number) => {
    setScrollSpeed((prev) => Math.max(1, Math.min(30, prev + delta)));
  }, []);

  // Hold-to-repeat for speed buttons
  const speedRepeatRef = useRef<NodeJS.Timeout | null>(null);
  const startSpeedRepeat = useCallback((delta: number) => {
    // Prevent double-triggering from touch+mouse events
    if (speedRepeatRef.current) return;
    // Immediately adjust once
    adjustSpeed(delta);
    // Start repeating after a short delay
    speedRepeatRef.current = setTimeout(() => {
      speedRepeatRef.current = setInterval(() => {
        adjustSpeed(delta);
      }, 100);
    }, 300);
  }, [adjustSpeed]);

  const stopSpeedRepeat = useCallback(() => {
    if (speedRepeatRef.current) {
      clearTimeout(speedRepeatRef.current);
      clearInterval(speedRepeatRef.current);
      speedRepeatRef.current = null;
    }
  }, []);

  // Handle speed input submit
  const handleSpeedInputSubmit = useCallback(() => {
    const parsed = parseInt(speedInputValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
      setScrollSpeed(parsed);
    } else {
      // Reset to current speed if invalid
      setSpeedInputValue(String(scrollSpeed));
    }
    setIsEditingSpeed(false);
  }, [speedInputValue, scrollSpeed]);

  useEffect(() => {
    const loadSong = async () => {
      // Guard: don't load if no ID (will redirect to home)
      if (!id) {
        setIsLoading(false);
        return;
      }
      try {
        const songData = await getSong(id);
        if (songData) {
          setSong(songData);
          setEditedLyrics(songData.lyrics || "");

          // Adjust view mode based on what's available
          const savedMode = getInitialViewMode();
          if (savedMode === "lyrics" && !songData.lyrics && songData.musicData) {
            // Prefer saved mode, but fall back if not available
            setViewModeState("music");
          } else if (savedMode === "music" && !songData.musicData && songData.lyrics) {
            setViewModeState("lyrics");
          }

          // Calculate previous and next songs
          try {
            const allSongs = await getAllSongs();
            // Filter by same type (Xmas vs Normal)
            const isXmas = !!songData.isXmas;
            const sameTypeSongs = allSongs
              .filter(s => !!s.isXmas === isXmas)
              .sort((a, b) => a.title.localeCompare(b.title));

            const currentIndex = sameTypeSongs.findIndex(s => s.id === songData.id);
            if (currentIndex !== -1) {
              setPrevSongId(currentIndex > 0 ? sameTypeSongs[currentIndex - 1].id : null);
              setNextSongId(currentIndex < sameTypeSongs.length - 1 ? sameTypeSongs[currentIndex + 1].id : null);
            }

            // Calculate max width for stable navigation buttons
            // finding the longest title in the entire library
            const maxLen = Math.max(...allSongs.map(s => s.title.length));
            setMaxTitleWidth(maxLen);
          } catch (err) {
            console.error("Failed to load neighbor songs:", err);
          }
        }
      } catch (error) {
        console.error("Failed to load song:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSong();
  }, [id]);

  const handleSaveLyrics = async () => {
    if (!song) return;
    setIsSaving(true);
    try {
      await updateSong(song.id, { lyrics: editedLyrics });
      setSong({ ...song, lyrics: editedLyrics });
      setIsEditing(false);
      toast.success("Lyrics saved!");
    } catch (error) {
      console.error("Failed to save lyrics:", error);
      toast.error("Failed to save lyrics");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMusicText = async () => {
    if (!song) return;
    setIsSaving(true);
    try {
      await updateSong(song.id, { musicData: editedMusicText });
      setSong({ ...song, musicData: editedMusicText });
      setIsEditingMusic(false);
      toast.success("Music saved!");
    } catch (error) {
      console.error("Failed to save music:", error);
      toast.error("Failed to save music");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavourite = async () => {
    if (!song) return;
    try {
      const newValue = !song.isFavourite;
      await updateSong(song.id, { isFavourite: newValue });
      setSong({ ...song, isFavourite: newValue });
    } catch (error) {
      console.error("Failed to toggle favourite:", error);
      toast.error("Failed to update favourite");
    }
  };

  const handleExport = () => {
    if (!song) return;
    // Create a clean export object (excluding internal id and timestamps)
    const exportData = {
      title: song.title,
      artist: song.artist,
      key: song.key,
      tempo: song.tempo,
      lyrics: song.lyrics,
      isXmas: song.isXmas,
      isMovie: song.isMovie,
      isFavourite: song.isFavourite,
      musicType: song.musicType,
      musicData: song.musicData,
      musicFileName: song.musicFileName,
      isPublicDomain: song.isPublicDomain,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported "${song.title}"`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background bg-pattern">
        <div className="gradient-warm min-h-screen">
          <div className="container mx-auto px-4 py-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Songbook
            </Link>
            <div className="text-center py-20">
              <h1 className="font-display text-2xl font-bold mb-2">
                Song Not Found
              </h1>
              <p className="text-muted-foreground">
                This song doesn&apos;t exist in your songbook.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasLyrics = !!song.lyrics;
  const hasMusic = !!song.musicData;

  // Determine if header should be visible
  const showHeader = !isHeaderHidden || isHeaderHovered;

  return (
    <div className="min-h-screen bg-background bg-pattern">
      {/* Drag region for macOS window dragging */}
      <div
        data-tauri-drag-region
        className="fixed top-0 left-0 right-0 h-8 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <div className="gradient-warm min-h-screen">
        {/* Content */}
        <main
          className={cn(
            "transition-all duration-300 flex flex-col",
            viewMode === "lyrics"
              ? isLyricsFullscreen
                ? "px-0 py-0"
                : "container mx-auto px-4 py-3"
              : "px-0 py-0 flex-1 min-h-0"
          )}
          style={viewMode === "music" ? { height: '100vh' } : undefined}
        >
          <div className={cn("page-transition", viewMode === "music" && "flex flex-col flex-1 min-h-0")}>
            {viewMode === "lyrics" ? (
              <div className="mx-auto" style={(isLyricsFullscreen || isEditing) ? { width: '100%' } : { width: 'fit-content', maxWidth: '100%' }}>
                {/* Lyrics content */}
                {isEditing ? (
                  <div
                    className={cn(
                      "relative flex flex-col bg-card overflow-hidden transition-all duration-300",
                      isLyricsFullscreen
                        ? "rounded-none border-0"
                        : "rounded-xl border border-border/50 shadow-sm"
                    )}
                    style={{
                      height: isLyricsFullscreen ? "100vh" : "calc(100vh - 1.5rem)"
                    }}
                  >
                    {/* Textarea for editing */}
                    <div
                      className={cn(
                        "flex-1 p-8 sm:p-12 overflow-y-auto",
                        isLyricsFullscreen && "pl-12 sm:pl-20"
                      )}
                    >
                      <Textarea
                        value={editedLyrics}
                        onChange={(e) => setEditedLyrics(e.target.value)}
                        className="min-h-full font-sans leading-relaxed w-full resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent"
                        style={{ fontSize: `${lyricsFontSize}px`, lineHeight: 1.4 }}
                        placeholder="Enter lyrics here..."
                      />
                    </div>

                    {/* Edit controls - bottom bar */}
                    <div
                      className="flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 border-t border-border/50 bg-card/90 backdrop-blur-sm w-full overflow-x-auto"
                      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                    >
                      {/* Font size controls */}
                      <div className="flex items-center border rounded-md bg-card">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none border-r"
                          onClick={() => setLyricsFontSize(lyricsFontSize - 2)}
                          disabled={lyricsFontSize <= 8}
                          title="Decrease font size"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>

                        <div className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium">
                          <ALargeSmall className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">{lyricsFontSize}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none border-l"
                          onClick={() => setLyricsFontSize(lyricsFontSize + 2)}
                          disabled={lyricsFontSize >= 120}
                          title="Increase font size"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Divider */}
                      <div className="h-6 w-px bg-border" />

                      {/* Cancel/Save buttons */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedLyrics(song.lyrics || "");
                        }}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveLyrics} disabled={isSaving} className="gap-2">
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : hasLyrics ? (
                  <div
                    className={cn(
                      "relative flex flex-col bg-card overflow-hidden transition-all duration-300",
                      isLyricsFullscreen
                        ? "rounded-none border-0"
                        : "rounded-xl border border-border/50 shadow-sm"
                    )}
                    style={{
                      height: isLyricsFullscreen ? "100vh" : "calc(100vh - 1.5rem)"
                    }}
                  >
                    {/* Scrollable lyrics container */}
                    <div
                      ref={lyricsRefCallback}
                      className={cn(
                        "flex-1 p-8 sm:p-12 overflow-y-auto",
                        isLyricsFullscreen && "pl-12 sm:pl-20"
                      )}
                      style={{ touchAction: "pan-y" }}
                    >
                      <div className="lyrics-text font-sans max-w-none" style={{ fontSize: `${lyricsFontSize}px` }}>
                        {/* Song title and artist header */}
                        <div className="text-center mb-6">
                          <h2 className="font-bold leading-tight">{song.title}</h2>
                          <p className="text-muted-foreground italic mt-0.5" style={{ fontSize: `${lyricsFontSize * 0.75}px` }}>
                            {song.isMovie ? 'from' : 'by'} {song.artist}
                          </p>
                        </div>

                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="whitespace-pre-wrap mb-0 last:mb-0" style={{ lineHeight: 1.4 }}>{children}</p>,
                            em: ({ children }) => <em className="text-muted-foreground not-italic opacity-70">{children}</em>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          }}
                        >
                          {/* Convert (*text*) to *(text)* for consistent markdown parsing */}
                          {song.lyrics?.replace(/\(\*([^*]+)\*\)/g, '*($1)*')}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Lyrics controls - bottom bar */}
                    <div
                      className="flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 border-t border-border/50 bg-card/90 backdrop-blur-sm w-full overflow-x-auto"
                      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                    >
                      {/* Songlist button */}
                      <SonglistSheet currentSongId={song.id} />

                      {/* Divider */}
                      <div className="h-6 w-px bg-border" />

                      {/* Font size controls */}
                      <div className="flex items-center border rounded-md bg-card">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none border-r"
                          onClick={() => setLyricsFontSize(lyricsFontSize - 2)}
                          disabled={lyricsFontSize <= 8}
                          title="Decrease font size"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>

                        {isEditingFontSize ? (
                          <Input
                            type="number"
                            value={fontSizeInputValue}
                            onChange={(e) => setFontSizeInputValue(e.target.value)}
                            onBlur={handleFontSizeInputSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleFontSizeInputSubmit();
                              } else if (e.key === "Escape") {
                                setFontSizeInputValue(String(lyricsFontSize));
                                setIsEditingFontSize(false);
                              }
                            }}
                            className="w-14 h-8 text-center text-sm px-1 border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={8}
                            max={120}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setFontSizeInputValue(String(lyricsFontSize));
                              setIsEditingFontSize(true);
                            }}
                            className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium hover:bg-accent rounded-none transition-colors"
                            title="Click to enter custom font size"
                          >
                            <ALargeSmall className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs hidden sm:inline">{lyricsFontSize}</span>
                          </button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none border-l"
                          onClick={() => setLyricsFontSize(lyricsFontSize + 2)}
                          disabled={lyricsFontSize >= 120}
                          title="Increase font size"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Auto-scroll controls */}
                      <div className="flex items-center border rounded-md bg-card">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "gap-2 rounded-r-none border-r",
                            isScrolling && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          )}
                          onClick={() => setIsScrolling(!isScrolling)}
                        >
                          {isScrolling ? (
                            <>
                              <Pause className="h-4 w-4" />
                              <span className="hidden sm:inline">Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              <span className="hidden sm:inline">Auto-scroll</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none select-none touch-manipulation"
                          style={{ WebkitTouchCallout: 'none' }}
                          onMouseDown={() => startSpeedRepeat(-1)}
                          onMouseUp={stopSpeedRepeat}
                          onMouseLeave={stopSpeedRepeat}
                          onTouchStart={() => startSpeedRepeat(-1)}
                          onTouchEnd={stopSpeedRepeat}
                          disabled={scrollSpeed <= 1}
                          title="Slower (hold to repeat)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        {isEditingSpeed ? (
                          <Input
                            type="number"
                            value={speedInputValue}
                            onChange={(e) => setSpeedInputValue(e.target.value)}
                            onBlur={handleSpeedInputSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSpeedInputSubmit();
                              } else if (e.key === "Escape") {
                                setSpeedInputValue(String(scrollSpeed));
                                setIsEditingSpeed(false);
                              }
                            }}
                            className="w-10 h-8 text-center text-xs px-1 border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={30}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setSpeedInputValue(String(scrollSpeed));
                              setIsEditingSpeed(true);
                            }}
                            className="flex items-center gap-0.5 pl-1 pr-1 h-8 hover:bg-accent rounded-none transition-colors"
                            title="Click to enter custom speed"
                          >
                            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-2 text-center font-mono">
                              {scrollSpeed}
                            </span>
                          </button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none select-none touch-manipulation"
                          style={{ WebkitTouchCallout: 'none' }}
                          onMouseDown={() => startSpeedRepeat(1)}
                          onMouseUp={stopSpeedRepeat}
                          onMouseLeave={stopSpeedRepeat}
                          onTouchStart={() => startSpeedRepeat(1)}
                          onTouchEnd={stopSpeedRepeat}
                          disabled={scrollSpeed >= 30}
                          title="Faster (hold to repeat)"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* View toggle - only show if both lyrics and music are available */}
                      {hasLyrics && hasMusic && (
                        <>
                          {/* Divider */}
                          <div className="h-6 w-px bg-border" />

                          <ToggleGroup
                            type="single"
                            value={viewMode}
                            onValueChange={(v) => v && setViewMode(v as ViewMode)}
                            className="gap-1"
                          >
                            <ToggleGroupItem
                              value="lyrics"
                              aria-label="View lyrics"
                              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/50 hover:bg-transparent hover:text-foreground px-2"
                            >
                              <LetterText className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="music"
                              aria-label="View music"
                              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/50 hover:bg-transparent hover:text-foreground px-2"
                            >
                              <Music className="h-4 w-4" />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </>
                      )}

                      {/* Home button */}
                      <Link href="/">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Home className="h-4 w-4" />
                        </Button>
                      </Link>

                      {/* More options menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={handleToggleFavourite}>
                            <Heart className={cn("h-4 w-4 mr-2", song.isFavourite && "fill-current")} />
                            {song.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={toggleLyricsFullscreen}>
                            {isLyricsFullscreen ? (
                              <>
                                <Minimize2 className="h-4 w-4 mr-2" />
                                Exit Full Width
                              </>
                            ) : (
                              <>
                                <Maximize2 className="h-4 w-4 mr-2" />
                                Full Width
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                            {theme === "dark" ? (
                              <>
                                <Sun className="h-4 w-4 mr-2" />
                                Light Mode
                              </>
                            ) : (
                              <>
                                <Moon className="h-4 w-4 mr-2" />
                                Dark Mode
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Song
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExport}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Export Song
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <LetterText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No lyrics added yet
                    </p>
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Add Lyrics
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col flex-1 min-h-0">
                {hasMusic ? (
                  <>
                    {/* PDF Viewer or Music Text Editor */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      {isEditingMusic && song.musicType === "text" ? (
                        <div className="flex flex-col h-full">
                          <div className="flex-1 overflow-hidden">
                            <ChordSheetEditor
                              value={editedMusicText}
                              onChange={setEditedMusicText}
                              className="h-full border-0 rounded-none"
                              minHeight="100%"
                            />
                          </div>
                          {/* Edit controls */}
                          <div className="flex items-center justify-center gap-2 sm:gap-4 px-4 py-2 border-t border-border/50 bg-card/90 backdrop-blur-sm">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditingMusic(false);
                                setEditedMusicText(song.musicData || "");
                              }}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveMusicText} disabled={isSaving} className="gap-2">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <MusicViewer
                          key={song.id}
                          type={song.musicType!}
                          data={song.musicData!}
                          fileName={song.musicFileName}
                          isImmersive={true}
                          isFullscreen={isMusicFullscreen}
                          zoom={pdfZoom}
                          onZoomChange={handleZoomChange}
                          scrollRef={musicScrollRef}
                          title={song.title}
                          artist={song.artist}
                          isMovie={song.isMovie}
                          tempo={song.tempo}
                        />
                      )}
                    </div>

                    {/* Music controls - bottom bar */}
                    <div
                      className="flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 border-t border-border/50 bg-card/90 backdrop-blur-sm w-full overflow-x-auto shrink-0"
                      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                    >
                      {/* Songlist button */}
                      <SonglistSheet currentSongId={song.id} />

                      {/* Divider */}
                      <div className="h-6 w-px bg-border" />

                      {/* PDF Zoom controls */}
                      <div className="flex items-center border rounded-md bg-card">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none border-r"
                          onClick={() => handleZoomChange(pdfZoom - 0.15)}
                          disabled={pdfZoom <= 0.1}
                          title="Zoom out (15%)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>

                        {isEditingZoom ? (
                          <Input
                            type="number"
                            value={zoomInputValue}
                            onChange={(e) => setZoomInputValue(e.target.value)}
                            onBlur={handleZoomInputSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleZoomInputSubmit();
                              } else if (e.key === "Escape") {
                                setZoomInputValue(Math.round(pdfZoom * 100).toString());
                                setIsEditingZoom(false);
                              }
                            }}
                            className="w-16 h-8 text-center text-sm px-1 border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={50}
                            max={500}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setZoomInputValue(Math.round(pdfZoom * 100).toString());
                              setIsEditingZoom(true);
                            }}
                            className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium hover:bg-accent rounded-none transition-colors"
                            title="Click to enter custom zoom"
                          >
                            <ZoomIn className="h-4 w-4 text-muted-foreground" />
                            <span>{Math.round(pdfZoom * 100)}%</span>
                          </button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none border-l"
                          onClick={() => handleZoomChange(pdfZoom + 0.15)}
                          disabled={pdfZoom >= 5}
                          title="Zoom in (15%)"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Divider */}
                      <div className="h-6 w-px bg-border" />

                      {/* Auto-scroll controls */}
                      <div className="flex items-center border rounded-md bg-card">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "gap-2 rounded-r-none border-r",
                            isScrolling && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          )}
                          onClick={() => setIsScrolling(!isScrolling)}
                        >
                          {isScrolling ? (
                            <>
                              <Pause className="h-4 w-4" />
                              <span className="hidden sm:inline">Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              <span className="hidden sm:inline">Auto-scroll</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none select-none touch-manipulation"
                          style={{ WebkitTouchCallout: 'none' }}
                          onMouseDown={() => startSpeedRepeat(-1)}
                          onMouseUp={stopSpeedRepeat}
                          onMouseLeave={stopSpeedRepeat}
                          onTouchStart={() => startSpeedRepeat(-1)}
                          onTouchEnd={stopSpeedRepeat}
                          disabled={scrollSpeed <= 1}
                          title="Slower (hold to repeat)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        {isEditingSpeed ? (
                          <Input
                            type="number"
                            value={speedInputValue}
                            onChange={(e) => setSpeedInputValue(e.target.value)}
                            onBlur={handleSpeedInputSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSpeedInputSubmit();
                              } else if (e.key === "Escape") {
                                setSpeedInputValue(String(scrollSpeed));
                                setIsEditingSpeed(false);
                              }
                            }}
                            className="w-10 h-8 text-center text-xs px-1 border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={30}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setSpeedInputValue(String(scrollSpeed));
                              setIsEditingSpeed(true);
                            }}
                            className="flex items-center gap-0.5 pl-1 pr-1 h-8 hover:bg-accent rounded-none transition-colors"
                            title="Click to enter custom speed"
                          >
                            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-2 text-center font-mono">
                              {scrollSpeed}
                            </span>
                          </button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none select-none touch-manipulation"
                          style={{ WebkitTouchCallout: 'none' }}
                          onMouseDown={() => startSpeedRepeat(1)}
                          onMouseUp={stopSpeedRepeat}
                          onMouseLeave={stopSpeedRepeat}
                          onTouchStart={() => startSpeedRepeat(1)}
                          onTouchEnd={stopSpeedRepeat}
                          disabled={scrollSpeed >= 30}
                          title="Faster (hold to repeat)"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* View toggle - only show if both lyrics and music are available */}
                      {hasLyrics && hasMusic && (
                        <>
                          {/* Divider */}
                          <div className="h-6 w-px bg-border" />

                          <ToggleGroup
                            type="single"
                            value={viewMode}
                            onValueChange={(v) => v && setViewMode(v as ViewMode)}
                            className="gap-1"
                          >
                            <ToggleGroupItem
                              value="lyrics"
                              aria-label="View lyrics"
                              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/50 hover:bg-transparent hover:text-foreground px-2"
                            >
                              <LetterText className="h-4 w-4" />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="music"
                              aria-label="View music"
                              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/50 hover:bg-transparent hover:text-foreground px-2"
                            >
                              <Music className="h-4 w-4" />
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </>
                      )}

                      {/* Home button */}
                      <Link href="/">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Home className="h-4 w-4" />
                        </Button>
                      </Link>

                      {/* More options menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={handleToggleFavourite}>
                            <Heart className={cn("h-4 w-4 mr-2", song.isFavourite && "fill-current")} />
                            {song.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={toggleMusicFullscreen}>
                            {isMusicFullscreen ? (
                              <>
                                <Minimize2 className="h-4 w-4 mr-2" />
                                Exit Full Width
                              </>
                            ) : (
                              <>
                                <Maximize2 className="h-4 w-4 mr-2" />
                                Full Width
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                            {theme === "dark" ? (
                              <>
                                <Sun className="h-4 w-4 mr-2" />
                                Light Mode
                              </>
                            ) : (
                              <>
                                <Moon className="h-4 w-4 mr-2" />
                                Dark Mode
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Song
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExport}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Export Song
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16">
                    <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      No music sheet added yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

      </div>

      {/* Edit Song Dialog */}
      <EditSongDialog
        song={song}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSongUpdated={async () => {
          // Refresh the song data after edit
          const updatedSong = await getSong(song.id);
          if (updatedSong) {
            setSong(updatedSong);
          }
        }}
      />
    </div>
  );
}

function MusicViewer({
  type,
  data,
  fileName,
  isImmersive = false,
  isFullscreen = false,
  zoom,
  onZoomChange,
  scrollRef,
  title,
  artist,
  isMovie,
  tempo,
}: {
  type: "pdf" | "image" | "text";
  data: string;
  fileName?: string;
  isImmersive?: boolean;
  isFullscreen?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  title?: string;
  artist?: string;
  isMovie?: boolean;
  tempo?: string;
}) {
  // Refs for text and image pinch-to-zoom
  const textMusicContainerRef = useRef<HTMLDivElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageTouchStateRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);
  const textTouchStateRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);

  // Pinch-to-zoom for text music
  useEffect(() => {
    if (type !== "text" || !textMusicContainerRef.current || !onZoomChange) return;

    const node = textMusicContainerRef.current;

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const currentZoom = zoom || 1;
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newZoom = Math.max(0.1, Math.min(5, currentZoom * zoomFactor));
        onZoomChange(newZoom);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        textTouchStateRef.current = {
          initialDistance: getTouchDistance(e.touches),
          initialZoom: zoom || 1,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && textTouchStateRef.current) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scaleChange = currentDistance / textTouchStateRef.current.initialDistance;
        const newZoom = Math.max(0.1, Math.min(5, textTouchStateRef.current.initialZoom * scaleChange));
        onZoomChange(newZoom);
      }
    };

    const handleTouchEnd = () => {
      textTouchStateRef.current = null;
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    node.addEventListener("touchstart", handleTouchStart, { passive: false });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", handleTouchEnd);
    node.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [type, zoom, onZoomChange]);

  // Pinch-to-zoom for image music
  useEffect(() => {
    if (type !== "image" || !imageContainerRef.current || !onZoomChange) return;

    const node = imageContainerRef.current;

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const currentZoom = zoom || 1;
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newZoom = Math.max(0.1, Math.min(5, currentZoom * zoomFactor));
        onZoomChange(newZoom);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        imageTouchStateRef.current = {
          initialDistance: getTouchDistance(e.touches),
          initialZoom: zoom || 1,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && imageTouchStateRef.current) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scaleChange = currentDistance / imageTouchStateRef.current.initialDistance;
        const newZoom = Math.max(0.1, Math.min(5, imageTouchStateRef.current.initialZoom * scaleChange));
        onZoomChange(newZoom);
      }
    };

    const handleTouchEnd = () => {
      imageTouchStateRef.current = null;
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    node.addEventListener("touchstart", handleTouchStart, { passive: false });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", handleTouchEnd);
    node.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [type, zoom, onZoomChange]);
  // Metronome state and logic
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playClick = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, []);

  const toggleMetronome = useCallback(() => {
    if (isMetronomeActive) {
      // Stop metronome
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      setIsMetronomeActive(false);
    } else {
      // Parse BPM from tempo string (e.g., "170", "80 BPM", "120bpm")
      const bpmMatch = tempo?.match(/\d+/);
      if (bpmMatch) {
        const bpm = parseInt(bpmMatch[0], 10);
        const intervalMs = 60000 / bpm;

        // Play first click immediately
        playClick();

        // Start interval
        metronomeIntervalRef.current = setInterval(playClick, intervalMs);
        setIsMetronomeActive(true);
      }
    }
  }, [isMetronomeActive, tempo, playClick]);

  // Clean up metronome on unmount
  useEffect(() => {
    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    };
  }, []);

  if (type === "text") {
    // Base font size is 14px, zoom is a decimal (e.g., 1.1 = 110%)
    const fontSize = zoom ? Math.round(14 * zoom) : 14;
    return (
      <div ref={(node) => {
        textMusicContainerRef.current = node;
        if (scrollRef) {
          scrollRef.current = node;
        }
      }} className={cn(
        "flex h-full overflow-auto",
        isFullscreen ? "p-0" : "justify-center py-8 px-4"
      )}>
        <div className={cn(
          "relative bg-card shadow-sm h-fit",
          isFullscreen
            ? "w-full rounded-none border-0 p-4 sm:p-6"
            : "rounded-xl border border-border/50 p-6 sm:p-8"
        )}>
          {/* Tempo badge in top-right corner - clickable for metronome if numeric */}
          {tempo && (() => {
            const hasNumericBpm = /\d+/.test(tempo);
            return hasNumericBpm ? (
              <button
                onClick={toggleMetronome}
                className={cn(
                  "fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer flex items-center gap-1 group shadow-lg",
                  isMetronomeActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm"
                )}
                title={isMetronomeActive ? "Click to stop metronome" : "Click to start metronome"}
              >
                <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
                {isMetronomeActive ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <>
                    <Play className="h-4 w-4 hidden group-hover:block" />
                    <span className="group-hover:hidden">{tempo}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm bg-black/70 text-white shadow-lg backdrop-blur-sm flex items-center gap-1">
                <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
                {tempo}
              </div>
            );
          })()}
          {/* Song header */}
          {title && (
            <div className="text-center mb-6">
              <h2 className="font-bold leading-tight" style={{ fontSize: `${fontSize * 1.5}px` }}>{title}</h2>
              <p className="text-muted-foreground italic" style={{ fontSize: `${fontSize * 0.85}px` }}>
                {isMovie ? 'from' : 'by'} {artist}
              </p>
            </div>
          )}
          <ChordSheetRenderer text={data} fontSize={fontSize} />
        </div>
      </div>
    );
  }

  if (type === "image") {
    // Zoom prop controls image width relative to container
    // 1.0 (100%) = fit container width, >1 = zoom in, <1 = zoom out
    const imageScale = zoom || 1;

    // Parse data - could be single base64 or JSON array of base64 strings
    let imageSources: string[] = [];
    try {
      // Guard against null/undefined data
      if (!data) {
        imageSources = [];
      } else if (data.startsWith('[') && data.endsWith(']')) {
        // Only try to parse as JSON if it looks like a JSON array (starts with '[' and ends with ']')
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          imageSources = parsed;
        } else {
          // Not a valid array of strings, treat as single image
          imageSources = [data];
        }
      } else {
        // Single image (backwards compatibility)
        imageSources = [data];
      }
    } catch {
      // Fallback to single image if parse fails
      imageSources = data ? [data] : [];
    }

    // Calculate width: at 100% zoom, image fits container (minus padding)
    // Width is percentage of container, so 100% * zoom gives us the right behavior
    const imageWidthPercent = Math.min(100 * imageScale, 500); // Cap at 500% to prevent performance issues

    return (
      <div
        ref={(node) => {
          imageContainerRef.current = node;
          if (scrollRef) {
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        className="relative flex flex-col items-center gap-4 py-4 px-2 overflow-auto bg-neutral-800 dark:bg-neutral-900"
        style={{
          height: isImmersive ? '100vh' : 'calc(100vh - 4rem)',
          touchAction: "pan-x pan-y",
        }}
      >
        {/* Tempo badge overlay - fixed in top right corner */}
        {tempo && (() => {
          const hasNumericBpm = /\d+/.test(tempo);
          return hasNumericBpm ? (
            <button
              onClick={toggleMetronome}
              className={cn(
                "fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer flex items-center gap-1 group shadow-lg",
                isMetronomeActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm"
              )}
              title={isMetronomeActive ? "Click to stop metronome" : "Click to start metronome"}
            >
              <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
              {isMetronomeActive ? (
                <Pause className="h-4 w-4" />
              ) : (
                <>
                  <Play className="h-4 w-4 hidden group-hover:block" />
                  <span className="group-hover:hidden">{tempo}</span>
                </>
              )}
            </button>
          ) : (
            <div className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm bg-black/70 text-white shadow-lg backdrop-blur-sm flex items-center gap-1">
              <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
              {tempo}
            </div>
          );
        })()}
        {imageSources.map((imgSrc, index) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={index}
            src={imgSrc}
            alt={fileName ? `${fileName} - Page ${index + 1}` : `Music sheet page ${index + 1}`}
            className="rounded-lg shadow-lg"
            style={{
              width: `${imageWidthPercent}%`,
              maxWidth: 'none',
              height: 'auto',
            }}
          />
        ))}
      </div>
    );
  }

  // Use seamless PDF viewer for better multi-page experience
  return (
    <div className="relative h-full">
      {/* Tempo badge overlay - fixed in top right corner */}
      {tempo && (() => {
        const hasNumericBpm = /\d+/.test(tempo);
        return hasNumericBpm ? (
          <button
            onClick={toggleMetronome}
            className={cn(
              "fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer flex items-center gap-1 group shadow-lg",
              isMetronomeActive
                ? "bg-primary text-primary-foreground"
                : "bg-black/70 text-white hover:bg-black/80 backdrop-blur-sm"
            )}
            title={isMetronomeActive ? "Click to stop metronome" : "Click to start metronome"}
          >
            <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
            {isMetronomeActive ? (
              <Pause className="h-4 w-4" />
            ) : (
              <>
                <Play className="h-4 w-4 hidden group-hover:block" />
                <span className="group-hover:hidden">{tempo}</span>
              </>
            )}
          </button>
        ) : (
          <div className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-md text-sm bg-black/70 text-white shadow-lg backdrop-blur-sm flex items-center gap-1">
            <img src="/icons/noun-metronome-7664072-FFFFFF.svg" alt="" className="h-5 w-5" />
            {tempo}
          </div>
        );
      })()}
      <SeamlessPdfViewer
        data={data}
        isImmersive={isImmersive}
        zoom={zoom}
        onZoomChange={onZoomChange}
        scrollRef={scrollRef}
      />
    </div>
  );
}

