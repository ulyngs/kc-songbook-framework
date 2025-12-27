"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Song, getSong, updateSong } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
  import {
  ArrowLeft,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SonglistSheet } from "@/components/songlist-sheet";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";

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
      if (!isNaN(parsed) && parsed >= 14 && parsed <= 48) {
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
  const { theme, setTheme } = useTheme();
  const [song, setSong] = useState<Song | null>(null);
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

  // Wrapper to persist font size to localStorage
  const setLyricsFontSize = useCallback((size: number) => {
    const clampedSize = Math.max(14, Math.min(48, size));
    setLyricsFontSizeState(clampedSize);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-lyrics-font-size", String(clampedSize));
    }
  }, []);

  // Load saved font size on mount
  useEffect(() => {
    const saved = getInitialFontSize();
    setLyricsFontSizeState(saved);
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
          className={`sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all duration-300 ${
            showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
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

              <div className="flex-1 min-w-0">
                <h1 className="font-display font-semibold truncate">
                  {song.title}
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  {song.artist}
                </p>
              </div>

              {/* Key badge */}
              {song.key && (
                <Badge variant="secondary" className="hidden sm:inline-flex font-mono">
                  {song.key}
                </Badge>
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
          className={`transition-all duration-300 ${
            viewMode === "lyrics" ? "container mx-auto px-4 py-3" : "px-0 py-0"
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
                  <>
                    {/* Auto-scroll controls - fixed to right side */}
                    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl border border-border/50 p-2 shadow-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleToggleFavourite}
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4 transition-colors",
                            song.isFavourite
                              ? "fill-foreground text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        />
                      </Button>
                      
                      <div className="w-full h-px bg-border my-1" />
                      
                      {/* Font size controls */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setLyricsFontSize(lyricsFontSize - 2)}
                          disabled={lyricsFontSize <= 14}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <ALargeSmall className="h-4 w-4 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setLyricsFontSize(lyricsFontSize + 2)}
                          disabled={lyricsFontSize >= 48}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="w-full h-px bg-border my-1" />
                      
                      <Button
                        variant={isScrolling ? "default" : "outline"}
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => setIsScrolling(!isScrolling)}
                      >
                        {isScrolling ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </Button>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => adjustSpeed(-10)}
                          disabled={scrollSpeed <= 10}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground w-2 text-center font-mono">
                          {scrollSpeed / 10}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => adjustSpeed(10)}
                          disabled={scrollSpeed >= 150}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Scrollable lyrics container */}
                    <div
                      ref={lyricsRef}
                      className="bg-card rounded-xl border border-border/50 p-8 sm:p-12 shadow-sm overflow-y-auto transition-all duration-300"
                      style={{ height: isHeaderHidden && !isHeaderHovered ? "calc(100vh - 1.5rem)" : "calc(100vh - 5.5rem)" }}
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
                  </>
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
}: {
  type: "pdf" | "image" | "text";
  data: string;
  fileName?: string;
  isImmersive?: boolean;
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

  // PDF - add params to hide sidebar, toolbar and fit page
  // navpanes=0 hides sidebar, toolbar=0 hides toolbar, view=FitH fits width
  const pdfUrl = `${data}#navpanes=0&toolbar=0&view=FitH`;
  
  return (
    <iframe
      src={pdfUrl}
      className="w-full border-0 transition-all duration-300"
      style={{ height: isImmersive ? "100vh" : "calc(100vh - 4rem)" }}
      title="Music Sheet PDF"
    />
  );
}

