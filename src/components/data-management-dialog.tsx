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
} from "@/lib/db";
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
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
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [songCount, setSongCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                Download Backup
              </Button>
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
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
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

