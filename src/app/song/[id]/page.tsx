"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Song, getSong, updateSong, getAllSongs } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
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
  Maximize2,
  Minimize2,
  Heart,
  ALargeSmall,
  ZoomIn,
  Gauge,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SonglistSheet } from "@/components/songlist-sheet";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import { SeamlessPdfViewer } from "@/components/seamless-pdf-viewer";

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
      if (!isNaN(parsed) && parsed >= 14 && parsed <= 72) {
        return parsed;
      }
    }
  }
  return 22; // Default font size
}

export default function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
  const [isSaving, setIsSaving] = useState(false);

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
  const [scrollSpeed, setScrollSpeed] = useState(30); // pixels per second
  const lyricsRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatedScrollRef = useRef<number>(0);

  // Font size state
  const [lyricsFontSize, setLyricsFontSizeState] = useState(22);
  const DEFAULT_FONT_SIZE = 22;
  
  // Font size zoom indicator state (for immersive mode)
  const [showFontSizeIndicator, setShowFontSizeIndicator] = useState(false);
  const hideFontSizeIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Font size input editing state
  const [isEditingFontSize, setIsEditingFontSize] = useState(false);
  const [fontSizeInputValue, setFontSizeInputValue] = useState("22");
  
  // Touch state for pinch-to-zoom on lyrics
  const lyricsTouchStateRef = useRef<{
    initialDistance: number;
    initialFontSize: number;
  } | null>(null);

  // PDF zoom state
  const [pdfZoom, setPdfZoom] = useState(1);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("100");

  const handleZoomChange = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.5, Math.min(5, newZoom));
    setPdfZoom(clampedZoom);
    setZoomInputValue(Math.round(clampedZoom * 100).toString());
  }, []);

  const handleZoomInputSubmit = useCallback(() => {
    const parsed = parseInt(zoomInputValue, 10);
    if (!isNaN(parsed) && parsed >= 50 && parsed <= 500) {
      handleZoomChange(parsed / 100);
    } else {
      // Reset to current zoom if invalid
      setZoomInputValue(Math.round(pdfZoom * 100).toString());
    }
    setIsEditingZoom(false);
  }, [zoomInputValue, pdfZoom, handleZoomChange]);

  // Flash font size indicator (for immersive mode)
  const flashFontSizeIndicator = useCallback(() => {
    if (!isHeaderHiddenState) return; // Only flash in immersive mode
    setShowFontSizeIndicator(true);
    if (hideFontSizeIndicatorTimeoutRef.current) {
      clearTimeout(hideFontSizeIndicatorTimeoutRef.current);
    }
    hideFontSizeIndicatorTimeoutRef.current = setTimeout(() => {
      setShowFontSizeIndicator(false);
    }, 2000);
  }, [isHeaderHiddenState]);

  // Wrapper to persist font size to localStorage
  const setLyricsFontSize = useCallback((size: number, flash = false) => {
    const clampedSize = Math.max(14, Math.min(72, size));
    setLyricsFontSizeState(clampedSize);
    setFontSizeInputValue(String(clampedSize));
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-lyrics-font-size", String(clampedSize));
    }
    if (flash) {
      flashFontSizeIndicator();
    }
  }, [flashFontSizeIndicator]);
  
  // Handle font size input submit
  const handleFontSizeInputSubmit = useCallback(() => {
    const parsed = parseInt(fontSizeInputValue, 10);
    if (!isNaN(parsed) && parsed >= 14 && parsed <= 72) {
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
      setLyricsFontSizeRef.current(newSize, true);
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
      setLyricsFontSizeRef.current(newSize, true);
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

  // Auto-scroll effect
  useEffect(() => {
    if (!isScrolling || viewMode !== "lyrics" || isEditing) {
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

      if (lyricsRef.current) {
        // Accumulate fractional scroll amounts
        accumulatedScrollRef.current += scrollSpeed * deltaTime;

        // Only scroll when we have at least 1 pixel accumulated
        if (accumulatedScrollRef.current >= 1) {
          const scrollAmount = Math.floor(accumulatedScrollRef.current);
          lyricsRef.current.scrollTop += scrollAmount;
          accumulatedScrollRef.current -= scrollAmount;
        }

        // Stop at the bottom
        const { scrollTop, scrollHeight, clientHeight } = lyricsRef.current;
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

  // Stop scrolling when switching views or editing
  useEffect(() => {
    if (viewMode !== "lyrics" || isEditing) {
      setIsScrolling(false);
    }
  }, [viewMode, isEditing]);

  const adjustSpeed = useCallback((delta: number) => {
    setScrollSpeed((prev) => Math.max(10, Math.min(150, prev + delta)));
  }, []);

  useEffect(() => {
    const loadSong = async () => {
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
      <div className="gradient-warm min-h-screen">
        {/* Invisible hover zone at top of screen to reveal header */}
        {mounted && isHeaderHidden && createPortal(
          <div
            className="fixed top-0 left-0 right-0 h-4 z-[99999]"
            onMouseEnter={() => setIsHeaderHovered(true)}
            onTouchStart={() => setIsHeaderHovered(true)}
          />,
          document.body
        )}

        {/* Header */}
        <header
          className={`sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all duration-300 ${showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
            }`}
          onMouseLeave={() => {
            if (isHeaderHidden) {
              setIsHeaderHovered(false);
            }
          }}
        >
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center gap-4">
              <div className="flex items-center gap-1">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <SonglistSheet currentSongId={song.id} />
              </div>

              <div className="flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground",
                    !prevSongId && "opacity-0 pointer-events-none"
                  )}
                  onClick={() => prevSongId && router.push(`/song/${prevSongId}`)}
                  disabled={!prevSongId}
                  title="Previous song"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div
                  className="flex flex-col items-center text-center min-w-0 transition-[width] duration-300 shrink-0"
                  style={{ width: maxTitleWidth ? `${Math.max(20, maxTitleWidth)}ch` : 'auto', maxWidth: '60vw' }}
                >
                  <h1 className="font-display font-semibold truncate w-full flex items-center justify-center gap-3">
                    <span className="truncate">{song.title}</span>
                    <button
                      onClick={handleToggleFavourite}
                      className="inline-flex shrink-0 hover:scale-110 transition-transform"
                      title={song.isFavourite ? "Remove from favourites" : "Add to favourites"}
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4 transition-colors",
                          song.isFavourite
                            ? "fill-current text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      />
                    </button>
                  </h1>
                  <p className="text-sm text-muted-foreground truncate w-full">
                    {song.artist}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground",
                    !nextSongId && "opacity-0 pointer-events-none"
                  )}
                  onClick={() => nextSongId && router.push(`/song/${nextSongId}`)}
                  disabled={!nextSongId}
                  title="Next song"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* PDF Zoom controls - show in music view */}
              {viewMode === "music" && hasMusic && (
                <div className="flex items-center border rounded-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-r-none border-r"
                    onClick={() => handleZoomChange(pdfZoom - 0.15)}
                    disabled={pdfZoom <= 0.5}
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
              )}

              {/* Font size controls - only show in lyrics view when not editing */}
              {viewMode === "lyrics" && hasLyrics && !isEditing && (
                <div className="flex items-center border rounded-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-r-none border-r"
                    onClick={() => setLyricsFontSize(lyricsFontSize - 2)}
                    disabled={lyricsFontSize <= 14}
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
                      min={14}
                      max={72}
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
                      <span>{lyricsFontSize}</span>
                    </button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-l-none border-l"
                    onClick={() => setLyricsFontSize(lyricsFontSize + 2)}
                    disabled={lyricsFontSize >= 72}
                    title="Increase font size"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Edit button - only show in lyrics view */}
              {viewMode === "lyrics" && (
                isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedLyrics(song.lyrics || "");
                      }}
                    >
                      <X className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                    <Button size="sm" onClick={handleSaveLyrics} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 sm:mr-1.5" />
                      )}
                      <span className="hidden sm:inline">Save</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )
              )}

              {/* View toggle */}
              {(hasLyrics || hasMusic) && (
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => v && setViewMode(v as ViewMode)}
                  className="bg-muted rounded-lg p-1"
                >
                  <ToggleGroupItem
                    value="lyrics"
                    aria-label="View lyrics"
                    disabled={!hasLyrics}
                    className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Lyrics</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="music"
                    aria-label="View music"
                    disabled={!hasMusic}
                    className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3"
                  >
                    <Music className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Music</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              )}

              {/* Immersive mode toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsHeaderHidden(!isHeaderHidden);
                  setIsHeaderHovered(false);
                }}
                className="text-muted-foreground hover:text-foreground"
                title={isHeaderHidden ? "Exit immersive mode" : "Enter immersive mode"}
              >
                {isHeaderHidden ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main
          className={`transition-all duration-300 ${viewMode === "lyrics" ? "container mx-auto px-4 py-3" : "px-0 py-0"
            } ${isHeaderHidden && !isHeaderHovered ? "-mt-16" : ""}`}
        >
          <div className="page-transition">
            {viewMode === "lyrics" ? (
              <div className="mx-auto" style={{ width: 'fit-content', maxWidth: '100%' }}>
                {/* Lyrics content */}
                {isEditing ? (
                  <Textarea
                    value={editedLyrics}
                    onChange={(e) => setEditedLyrics(e.target.value)}
                    className="min-h-[60vh] font-mono text-base leading-relaxed w-[600px] max-w-full"
                    placeholder="Enter lyrics here..."
                  />
                ) : hasLyrics ? (
                  <div 
                    className="relative flex flex-col bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden transition-all duration-300"
                    style={{ height: isHeaderHidden && !isHeaderHovered ? "calc(100vh - 1.5rem)" : "calc(100vh - 5.5rem)" }}
                  >
                    {/* Font size indicator - only show in immersive mode */}
                    {isHeaderHidden && lyricsFontSize !== DEFAULT_FONT_SIZE && (
                      <div 
                        className={`absolute top-4 right-4 z-20 transition-opacity duration-300 ${
                          showFontSizeIndicator ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                      >
                        <div className="bg-black/70 backdrop-blur-sm rounded-xl overflow-hidden text-white text-sm font-medium">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <ALargeSmall className="h-4 w-4" />
                            <span>{lyricsFontSize}px</span>
                          </div>
                          <button
                            onClick={() => {
                              setLyricsFontSize(DEFAULT_FONT_SIZE);
                              setShowFontSizeIndicator(false);
                            }}
                            className="w-full px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors border-t border-white/20 text-center"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Scrollable lyrics container */}
                    <div
                      ref={lyricsRefCallback}
                      className="flex-1 p-8 sm:p-12 overflow-y-auto"
                      style={{ touchAction: "pan-y" }}
                    >
                      <div className="lyrics-text font-sans max-w-none whitespace-nowrap" style={{ fontSize: `${lyricsFontSize}px` }}>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="whitespace-pre mb-0 last:mb-0" style={{ lineHeight: 1.4 }}>{children}</p>,
                            em: ({ children }) => <em className="text-muted-foreground not-italic opacity-70">{children}</em>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          }}
                        >
                          {/* Convert (*text*) to *(text)* for consistent markdown parsing */}
                          {song.lyrics?.replace(/\(\*([^*]+)\*\)/g, '*($1)*')}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Auto-scroll controls - bottom bar */}
                    <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-border/50 bg-card/90 backdrop-blur-sm">
                      <Button
                        variant={isScrolling ? "default" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => setIsScrolling(!isScrolling)}
                      >
                        {isScrolling ? (
                          <>
                            <Pause className="h-4 w-4" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            <span>Auto-scroll</span>
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => adjustSpeed(-10)}
                          disabled={scrollSpeed <= 10}
                          title="Slower"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex items-center gap-1 px-1">
                          <span className="text-sm text-muted-foreground w-2 text-center font-mono">
                            {scrollSpeed / 10}
                          </span>
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => adjustSpeed(10)}
                          disabled={scrollSpeed >= 150}
                          title="Faster"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
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
              <div className="w-full">
                {hasMusic ? (
                  <MusicViewer
                    type={song.musicType!}
                    data={song.musicData!}
                    fileName={song.musicFileName}
                    isImmersive={isHeaderHidden && !isHeaderHovered}
                    zoom={pdfZoom}
                    onZoomChange={handleZoomChange}
                  />
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
    </div>
  );
}

function MusicViewer({
  type,
  data,
  fileName,
  isImmersive = false,
  zoom,
  onZoomChange,
}: {
  type: "pdf" | "image" | "text";
  data: string;
  fileName?: string;
  isImmersive?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  if (type === "text") {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-6 sm:p-8 shadow-sm">
        <pre className="font-mono text-sm sm:text-base whitespace-pre-wrap overflow-x-auto">
          {data}
        </pre>
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data}
          alt={fileName || "Music sheet"}
          className="max-w-full h-auto rounded-lg mx-auto"
        />
      </div>
    );
  }

  // Use seamless PDF viewer for better multi-page experience
  return (
    <SeamlessPdfViewer 
      data={data} 
      isImmersive={isImmersive}
      zoom={zoom}
      onZoomChange={onZoomChange}
    />
  );
}

