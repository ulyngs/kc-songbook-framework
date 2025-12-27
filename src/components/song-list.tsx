"use client";

import { useState } from "react";
import { Song, updateSong } from "@/lib/db";
import { SortField, SortOrder } from "@/app/page";
import { ArrowUpDown, ArrowUp, ArrowDown, Music, MoreHorizontal, Pencil, Trash2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SongListProps {
  songs: Song[];
  sortField: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  christmasMode: boolean;
  onChristmasModeChange: (enabled: boolean) => void;
  onSongUpdated?: () => void;
}

export function SongList({
  songs,
  sortField,
  sortOrder,
  onToggleSort,
  onDelete,
  searchQuery,
  christmasMode,
  onChristmasModeChange,
  onSongUpdated,
}: SongListProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editIsXmas, setEditIsXmas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    setEditTitle(song.title);
    setEditArtist(song.artist);
    setEditIsXmas(song.isXmas || false);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSong) return;
    
    setIsSaving(true);
    try {
      await updateSong(editingSong.id, {
        title: editTitle,
        artist: editArtist,
        isXmas: editIsXmas,
      });
      toast.success("Song updated!");
      setEditDialogOpen(false);
      onSongUpdated?.();
    } catch (error) {
      console.error("Failed to update song:", error);
      toast.error("Failed to update song");
    } finally {
      setIsSaving(false);
    }
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

  if (songs.length === 0 && searchQuery) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Music className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">No songs found</h3>
        <p className="text-muted-foreground">
          No songs match &quot;{searchQuery}&quot;
          {christmasMode && " in Christmas mode"}
        </p>
      </div>
    );
  }

  if (songs.length === 0 && christmasMode) {
    return (
      <div className="page-transition">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-sm text-muted-foreground">
            0 songs
          </span>
          <div className="flex items-center gap-2">
            <Switch
              id="christmas-mode"
              checked={christmasMode}
              onCheckedChange={onChristmasModeChange}
            />
            <Label htmlFor="christmas-mode" className="text-sm cursor-pointer">
              🎄 Christmas Mode
            </Label>
          </div>
        </div>
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <span className="text-3xl">🎄</span>
          </div>
          <h3 className="font-display text-lg font-semibold mb-1">No Christmas songs</h3>
          <p className="text-muted-foreground">
            No songs are marked as Christmas songs yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition flex flex-col items-center">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 mt-4 w-fit min-w-[400px]">
        <p className="text-sm text-muted-foreground">
          {songs.length} song{songs.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Switch
            id="christmas-mode"
            checked={christmasMode}
            onCheckedChange={onChristmasModeChange}
          />
          <Label htmlFor="christmas-mode" className="text-sm cursor-pointer">
            🎄 Christmas Mode
          </Label>
        </div>
      </div>

      {/* Song table */}
      <div className="rounded-md border w-fit">
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
                    "-ml-4 h-8 data-[state=open]:bg-accent",
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
                    "-ml-4 h-8 data-[state=open]:bg-accent",
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
                <TableCell>
                  <Link
                    href={`/song/${song.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    {song.title}
                    {song.isXmas && <span className="text-sm">🎄</span>}
                    {song.isMovie && <span className="text-sm">🎬</span>}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {song.artist}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Song</DialogTitle>
            <DialogDescription>
              Make changes to the song details here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Song Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter song title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                placeholder="Enter artist name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-xmas"
                checked={editIsXmas}
                onCheckedChange={(checked) => setEditIsXmas(checked === true)}
              />
              <Label htmlFor="edit-xmas" className="cursor-pointer">
                🎄 Christmas Song
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
