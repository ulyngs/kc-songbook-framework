"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Song, updateSong } from "@/lib/db";
import { SortField, SortOrder } from "@/app/page";
import { ArrowUpDown, ArrowUp, ArrowDown, Music, MoreHorizontal, Pencil, Trash2, Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditSongDialog } from "@/components/edit-song-dialog";
// Link import removed - using router.push for Tauri SPA compatibility
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SongListProps {
  songs: Song[];
  sortField: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  christmasMode: boolean;
  onChristmasModeChange: (enabled: boolean) => void;
  onSongUpdated?: () => void;
  otherListMatchCount?: number;
}

export function SongList({
  songs,
  sortField,
  sortOrder,
  onToggleSort,
  onDelete,
  searchQuery,
  onSearchChange,
  christmasMode,
  onChristmasModeChange,
  onSongUpdated,
  otherListMatchCount = 0,
}: SongListProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const router = useRouter();

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const handleEdit = (song: Song) => {
    setEditingSong(song);
    setEditDialogOpen(true);
  };

  const handleDelete = (song: Song) => {
    if (confirm(`Delete "${song.title}"?`)) {
      onDelete(song.id);
    }
  };

  const handleToggleFavourite = async (song: Song) => {
    try {
      await updateSong(song.id, {
        isFavourite: !song.isFavourite,
      });
      onSongUpdated?.();
    } catch (error) {
      console.error("Failed to toggle favourite:", error);
      toast.error("Failed to update favourite");
    }
  };

  // Helper to render "no results" message
  const renderNoResults = () => {
    if (songs.length === 0 && searchQuery) {
      return (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-1">No songs found</h3>
          <p className="text-muted-foreground">
            No songs match &quot;{searchQuery}&quot;
            {christmasMode ? " in Christmas songs" : ""}
          </p>
          {otherListMatchCount > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {otherListMatchCount} match{otherListMatchCount !== 1 ? "es" : ""} found in{" "}
              <button
                type="button"
                className="text-primary hover:underline cursor-pointer"
                onClick={() => onChristmasModeChange(!christmasMode)}
              >
                {christmasMode ? "regular songs" : "Christmas songs"}
              </button>
            </p>
          )}
        </div>
      );
    }

    if (songs.length === 0 && christmasMode) {
      return (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <span className="text-3xl">🎄</span>
          </div>
          <h3 className="font-display text-lg font-semibold mb-1">No Christmas songs</h3>
          <p className="text-muted-foreground">
            No songs are marked as Christmas songs yet.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="page-transition flex flex-col items-center w-full">
      {/* Controls */}
      <div className="sticky top-0 z-40 flex items-center justify-between mb-4 mt-4 w-full max-w-3xl px-3 gap-4 py-3 bg-background/80 backdrop-blur-xl rounded-md border">
        <div className="flex items-center gap-4 flex-1">
          {/* Search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {songs.length} song{songs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-2 sm:px-3 py-1.5">
          <Switch
            id="christmas-mode"
            checked={christmasMode}
            onCheckedChange={onChristmasModeChange}
            className="data-[state=unchecked]:bg-muted-foreground/30"
          />
          <Label htmlFor="christmas-mode" className="text-sm sm:text-base cursor-pointer">
            🎄 <span className="hidden sm:inline">Christmas </span>songs
          </Label>
        </div>
      </div>

      {/* No results message */}
      {renderNoResults()}

      {/* Mobile card layout - only show if there are songs */}
      {songs.length > 0 && (
        <div className="md:hidden w-full px-2 space-y-2">
          {/* Mobile sort controls */}
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleSort("title")}
              className={cn(
                "flex-1 text-sm",
                sortField === "title" && "bg-accent"
              )}
            >
              Song
              <SortIcon field="title" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleSort("artist")}
              className={cn(
                "flex-1 text-sm",
                sortField === "artist" && "bg-accent"
              )}
            >
              Artist
              <SortIcon field="artist" />
            </Button>
          </div>

          {/* Song cards */}
          {songs.map((song) => (
            <div
              key={song.id}
              className="bg-background/80 backdrop-blur-xl rounded-lg border p-3 flex items-center gap-3"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleToggleFavourite(song)}
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

              <button
                type="button"
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={() => {
                  console.log(`[SongList] Navigating to: /song?id=${song.id}`);
                  router.push(`/song?id=${song.id}`);
                }}
              >
                <div className="font-medium text-base truncate flex items-center gap-1.5">
                  {song.title}
                  {song.isXmas && <span className="text-sm flex-shrink-0">🎄</span>}
                </div>
                <div className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                  {song.artist}
                  {song.isMovie && <span className="text-sm flex-shrink-0">🎬</span>}
                </div>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex h-8 w-8 p-0 data-[state=open]:bg-muted flex-shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                  <DropdownMenuItem onClick={() => handleEdit(song)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(song)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table layout */}
      {songs.length > 0 && (
        <div className="hidden md:block rounded-md border w-full max-w-3xl bg-background/80 backdrop-blur-xl [&_*]:text-black dark:[&_*]:text-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] text-center">
                  <Heart className="h-4 w-4 text-muted-foreground inline-block" />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => onToggleSort("title")}
                    className={cn(
                      "-ml-4 h-10 text-base data-[state=open]:bg-accent",
                      sortField === "title" && "text-foreground"
                    )}
                  >
                    Song
                    <SortIcon field="title" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => onToggleSort("artist")}
                    className={cn(
                      "-ml-4 h-10 text-base data-[state=open]:bg-accent",
                      sortField === "artist" && "text-foreground"
                    )}
                  >
                    Artist
                    <SortIcon field="artist" />
                  </Button>
                </TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id}>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleFavourite(song)}
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
                  </TableCell>
                  <TableCell className="pr-6">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium hover:underline text-lg cursor-pointer text-left"
                      onClick={() => {
                        console.log(`[SongList] Navigating to: /song?id=${song.id}`);
                        router.push(`/song?id=${song.id}`);
                      }}
                    >
                      {song.title}
                      {song.isXmas && <span className="text-base">🎄</span>}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-lg">
                    <span className="flex items-center gap-2">
                      {song.artist}
                      {song.isMovie && <span className="text-base">🎬</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onClick={() => handleEdit(song)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(song)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <EditSongDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        song={editingSong}
        onSongUpdated={() => onSongUpdated?.()}
      />
    </div>
  );
}
