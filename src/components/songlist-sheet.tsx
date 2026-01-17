"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Song, getAllSongs } from "@/lib/db";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Search, Heart } from "lucide-react";
// Link import removed - using router.push for Tauri SPA compatibility
import { cn } from "@/lib/utils";

type FilterTab = "all" | "xmas" | "favourites";

// Get initial tab from localStorage
function getInitialTab(): FilterTab {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("songbook-sheet-tab");
    if (saved === "all" || saved === "xmas" || saved === "favourites") {
      return saved;
    }
  }
  return "all";
}

interface SonglistSheetProps {
  currentSongId?: string;
}

export function SonglistSheet({ currentSongId }: SonglistSheetProps) {
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTabState] = useState<FilterTab>("all");
  const router = useRouter();

  // Wrapper to persist tab to localStorage
  const setActiveTab = (tab: FilterTab) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("songbook-sheet-tab", tab);
    }
  };

  // Load saved tab on mount
  useEffect(() => {
    setMounted(true);
    setActiveTabState(getInitialTab());
  }, []);

  useEffect(() => {
    const loadSongs = async () => {
      const allSongs = await getAllSongs();
      // Sort alphabetically by title
      allSongs.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(allSongs);
    };
    loadSongs();
  }, []);

  // Reload songs when sheet opens (to get updated favourites)
  useEffect(() => {
    if (open) {
      const loadSongs = async () => {
        const allSongs = await getAllSongs();
        allSongs.sort((a, b) => a.title.localeCompare(b.title));
        setSongs(allSongs);
      };
      loadSongs();
    }
  }, [open]);

  // Filter songs based on tab and search
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Filter by tab
    switch (activeTab) {
      case "all":
        // All songs except Christmas ones
        result = result.filter((song) => !song.isXmas);
        break;
      case "xmas":
        // Only Christmas songs
        result = result.filter((song) => song.isXmas);
        break;
      case "favourites":
        // Only favourited songs
        result = result.filter((song) => song.isFavourite);
        break;
    }

    // Then filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      );
    }

    return result;
  }, [songs, activeTab, searchQuery]);

  // Hover trigger zone - rendered via portal to ensure it's above everything
  const hoverZone = mounted && !open ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '12px',
        height: '100vh',
        zIndex: 99999,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setOpen(true)}
      onTouchStart={() => setOpen(true)}
      aria-hidden="true"
    />,
    document.body
  ) : null;

  return (
    <>
      {hoverZone}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Songs</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="font-display">Songlist</SheetTitle>
          </SheetHeader>

          {/* Tabs */}
          <div className="px-4 pb-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all" className="text-sm">
                  All (–🎄)
                </TabsTrigger>
                <TabsTrigger value="xmas" className="text-sm">
                  🎄
                </TabsTrigger>
                <TabsTrigger value="favourites" className="text-sm">
                  <Heart className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Song list */}
          <ScrollArea className="h-[calc(100vh-11rem)]">
            <div className="px-2 pb-4">
              {filteredSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {activeTab === "favourites"
                    ? "No favourites yet"
                    : activeTab === "xmas"
                      ? "No Christmas songs"
                      : "No songs found"}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        console.log(`[SonglistSheet] Navigating to: /song?id=${song.id}`);
                        setOpen(false);
                        router.push(`/song?id=${song.id}`);
                      }}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          song.id === currentSongId
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate flex items-center gap-1.5",
                              song.id === currentSongId && "text-primary"
                            )}
                          >
                            {song.isFavourite && (
                              <Heart className="h-3 w-3 fill-foreground text-foreground shrink-0" />
                            )}
                            {song.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </p>
                        </div>
                        {song.key && (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs shrink-0"
                          >
                            {song.key}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
