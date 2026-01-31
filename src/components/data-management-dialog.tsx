"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  downloadSongsBackup,
  importSongsFromFile,
  clearAllSongs,
  getAllSongs,
  updateSong,
} from "@/lib/db";
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface DataManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChanged: () => void;
}

export function DataManagementDialog({
  open,
  onOpenChange,
  onDataChanged,
}: DataManagementDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingMetadata, setIsExportingMetadata] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingMetadata, setIsImportingMetadata] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [songCount, setSongCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const metadataInputRef = useRef<HTMLInputElement>(null);

  // Load song count when dialog opens
  const loadSongCount = async () => {
    const songs = await getAllSongs();
    setSongCount(songs.length);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadSongsBackup();
      toast.success("Backup downloaded successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMetadata = async () => {
    setIsExportingMetadata(true);
    try {
      const songs = await getAllSongs();
      const metadata = songs.map(song => ({
        title: song.title,
        artist: song.artist,
        key: song.key,
        tempo: song.tempo,
        isXmas: song.isXmas,
        isMovie: song.isMovie,
        isFavourite: song.isFavourite,
        isPublicDomain: song.isPublicDomain,
      }));

      const json = JSON.stringify(metadata, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `songbook-metadata-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Metadata exported successfully!");
    } catch (error) {
      console.error("Metadata export failed:", error);
      toast.error("Failed to export metadata");
    } finally {
      setIsExportingMetadata(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const count = await importSongsFromFile(file);
      toast.success(`Imported ${count} songs!`);
      onDataChanged();
      loadSongCount();
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import backup. Make sure it's a valid JSON file.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportMetadata = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingMetadata(true);
    try {
      const text = await file.text();
      const metadataList = JSON.parse(text);

      if (!Array.isArray(metadataList)) {
        throw new Error("Invalid metadata file format");
      }

      // Get all existing songs
      const existingSongs = await getAllSongs();

      // Create a lookup map by normalized title+artist
      const songMap = new Map<string, typeof existingSongs[0]>();
      for (const song of existingSongs) {
        const key = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
        songMap.set(key, song);
      }

      let updatedCount = 0;
      for (const meta of metadataList) {
        if (!meta.title || !meta.artist) continue;

        const key = `${meta.title.toLowerCase().trim()}|${meta.artist.toLowerCase().trim()}`;
        const existingSong = songMap.get(key);

        if (existingSong) {
          // Update only metadata fields
          await updateSong(existingSong.id, {
            key: meta.key,
            tempo: meta.tempo,
            isXmas: meta.isXmas,
            isMovie: meta.isMovie,
            isFavourite: meta.isFavourite,
            isPublicDomain: meta.isPublicDomain,
          });
          updatedCount++;
        }
      }

      toast.success(`Updated metadata for ${updatedCount} song${updatedCount !== 1 ? 's' : ''}!`);
      onDataChanged();
    } catch (error) {
      console.error("Metadata import failed:", error);
      toast.error("Failed to import metadata. Make sure it's a valid JSON file.");
    } finally {
      setIsImportingMetadata(false);
      if (metadataInputRef.current) {
        metadataInputRef.current.value = "";
      }
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearAllSongs();
      toast.success("All songs deleted");
      setShowClearConfirm(false);
      onDataChanged();
      loadSongCount();
    } catch (error) {
      console.error("Clear failed:", error);
      toast.error("Failed to clear songs");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) loadSongCount();
        setShowClearConfirm(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Data Management
          </DialogTitle>
          <DialogDescription>
            Export your songbook for backup or import from a previous backup.
            {songCount !== null && (
              <span className="block mt-1 text-foreground font-medium">
                You have {songCount} song{songCount !== 1 ? "s" : ""} in your
                library.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Export */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <Download className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium">Export Backup</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download all your songs as a JSON file. Keep this file private -
                it contains your personal songbook.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleExport}
                  disabled={isExporting || songCount === 0}
                  size="sm"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Full Backup
                </Button>
                <Button
                  onClick={handleExportMetadata}
                  disabled={isExportingMetadata || songCount === 0}
                  size="sm"
                  variant="outline"
                >
                  {isExportingMetadata ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Metadata Only
                </Button>
              </div>
            </div>
          </div>

          {/* Import */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <Upload className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium">Import Backup</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Restore songs from a backup file. Existing songs with the same
                ID will be updated.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Full Backup
                </Button>
                <Button
                  onClick={() => metadataInputRef.current?.click()}
                  disabled={isImportingMetadata || songCount === 0}
                  size="sm"
                  variant="outline"
                >
                  {isImportingMetadata ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Metadata Only
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <input
                ref={metadataInputRef}
                type="file"
                accept=".json"
                onChange={handleImportMetadata}
                className="hidden"
              />
            </div>
          </div>

          {/* Clear */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive">Delete All Songs</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete all songs from your library. This cannot be
                undone.
              </p>
              {showClearConfirm ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive font-medium">
                    Are you sure?
                  </span>
                  <Button
                    onClick={handleClear}
                    disabled={isClearing}
                    size="sm"
                    variant="destructive"
                  >
                    {isClearing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Yes, Delete All
                  </Button>
                  <Button
                    onClick={() => setShowClearConfirm(false)}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={songCount === 0}
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





