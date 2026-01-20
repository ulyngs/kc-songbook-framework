"use client";

import { useState, useEffect, useMemo } from "react";
import { Song, getAllSongs, deleteSong } from "@/lib/db";
import { seedExampleSongs } from "@/lib/seed-data";
import { SongList } from "@/components/song-list";
import { Header } from "@/components/header";
import { AddSongDialog } from "@/components/add-song-dialog";
import { DataManagementDialog } from "@/components/data-management-dialog";
import { EmptyState } from "@/components/empty-state";

export type SortField = "title" | "artist";
export type SortOrder = "asc" | "desc";

export default function Home() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const [christmasMode, setChristmasMode] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<"single" | "kc-collection">("single");

  // Load songs from IndexedDB
  const loadSongs = async () => {
    try {
      const allSongs = await getAllSongs();
      setSongs(allSongs);
    } catch (error) {
      console.error("Failed to load songs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Seed example songs and load all songs
  useEffect(() => {
    const init = async () => {
      try {
        await seedExampleSongs();
      } catch (e) {
        console.warn("Could not seed example songs:", e);
      }
      loadSongs();
    };
    init();
  }, []);

  // Filter and sort songs
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Filter by Christmas mode
    if (christmasMode) {
      // Show only Christmas songs
      result = result.filter((song) => song.isXmas);
    } else {
      // Hide Christmas songs when not in Christmas mode
      result = result.filter((song) => !song.isXmas);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField].toLowerCase();
      const bVal = b[sortField].toLowerCase();
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [songs, searchQuery, sortField, sortOrder, christmasMode]);

  // Count how many songs match the search in the OTHER list (xmas vs non-xmas)
  const otherListMatchCount = useMemo(() => {
    if (!searchQuery) return 0;

    const query = searchQuery.toLowerCase();
    // Get songs from the opposite list
    const otherList = songs.filter((song) => christmasMode ? !song.isXmas : song.isXmas);

    return otherList.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
    ).length;
  }, [songs, searchQuery, christmasMode]);

  const handleSongAdded = () => {
    loadSongs();
    setAddDialogOpen(false);
    // Reset mode to single for next open
    setTimeout(() => setAddDialogMode("single"), 300);
  };


  const handleDeleteSong = async (id: string) => {
    await deleteSong(id);
    loadSongs();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="min-h-screen bg-background bg-pattern">
      <div className="gradient-warm min-h-screen">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddSong={() => {
            setAddDialogMode("single");
            setAddDialogOpen(true);
          }}
          onAddKCCollection={() => {
            setAddDialogMode("kc-collection");
            setAddDialogOpen(true);
          }}
          onDataManagement={() => setDataManagementOpen(true)}
        />

        <main className="container mx-auto px-4 pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-muted-foreground">
                Loading your songbook...
              </div>
            </div>
          ) : songs.length === 0 ? (
            <EmptyState
              onAddSong={() => {
                setAddDialogMode("single");
                setAddDialogOpen(true);
              }}
            />
          ) : (
            <SongList
              songs={filteredSongs}
              sortField={sortField}
              sortOrder={sortOrder}
              onToggleSort={toggleSort}
              onDelete={handleDeleteSong}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              christmasMode={christmasMode}
              onChristmasModeChange={setChristmasMode}
              onSongUpdated={loadSongs}
              otherListMatchCount={otherListMatchCount}
            />
          )}
        </main>

        <AddSongDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSongAdded={handleSongAdded}
          initialMode={addDialogMode}
        />



        <DataManagementDialog
          open={dataManagementOpen}
          onOpenChange={setDataManagementOpen}
          onDataChanged={loadSongs}
        />
      </div>
    </div>
  );
}
