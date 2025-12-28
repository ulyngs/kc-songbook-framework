"use client";

import { useState } from "react";
import { bulkAddSongs, importSongs } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, FileJson, Loader2, ListMusic, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

const EXAMPLE_CSV = `title,artist,key
Silent Night,Traditional,Bb
Jingle Bells,Traditional,G
O Come All Ye Faithful,Traditional,G`;

const EXAMPLE_JSON = `[
  {
    "title": "Silent Night",
    "artist": "Traditional",
    "key": "Bb",
    "lyrics": "Silent night, holy night...",
    "isPublicDomain": true
  }
]`;

export function BulkUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: BulkUploadDialogProps) {
  const [inputType, setInputType] = useState<"csv" | "json">("csv");
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const resetForm = () => {
    setTextInput("");
    setResults(null);
  };

  const parseCSV = (csv: string): Array<{ title: string; artist: string; key?: string }> => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const titleIdx = headers.indexOf("title");
    const artistIdx = headers.indexOf("artist");
    const keyIdx = headers.indexOf("key");

    if (titleIdx === -1 || artistIdx === -1) {
      throw new Error("CSV must have 'title' and 'artist' columns");
    }

    return lines.slice(1).map((line, index) => {
      const values = line.split(",").map((v) => v.trim());
      if (!values[titleIdx] || !values[artistIdx]) {
        throw new Error(`Row ${index + 2}: Missing title or artist`);
      }
      return {
        title: values[titleIdx],
        artist: values[artistIdx],
        key: keyIdx !== -1 ? values[keyIdx] : undefined,
      };
    });
  };

  const handleSubmit = async () => {
    if (!textInput.trim()) {
      toast.error("Please enter some data to import");
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      let count = 0;

      if (inputType === "csv") {
        const songs = parseCSV(textInput);
        await bulkAddSongs(
          songs.map((s) => ({
            ...s,
            isPublicDomain: true, // Bulk uploads are assumed public domain
          }))
        );
        count = songs.length;
      } else {
        // JSON format - can include full song data
        count = await importSongs(textInput);
      }

      setResults({ success: count, errors: [] });
      toast.success(`Successfully imported ${count} songs!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResults({ success: 0, errors: [message] });
      toast.error("Import failed: " + message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            Bulk Upload Songs
          </DialogTitle>
          <DialogDescription>
            Import multiple public domain songs at once. Only upload songs you have the rights to distribute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Public Domain Only
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                Only upload songs that are in the public domain or that you have explicit rights to distribute.
              </p>
            </div>
          </div>

          {/* Input type tabs */}
          <Tabs value={inputType} onValueChange={(v) => setInputType(v as "csv" | "json")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv" className="gap-2">
                CSV Format
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <FileJson className="h-4 w-4" />
                JSON Format
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>CSV Data</Label>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={EXAMPLE_CSV}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Required columns: <code className="bg-muted px-1 rounded">title</code>, <code className="bg-muted px-1 rounded">artist</code>. 
                Optional: <code className="bg-muted px-1 rounded">key</code>
              </p>
            </TabsContent>

            <TabsContent value="json" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>JSON Data</Label>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={EXAMPLE_JSON}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                JSON array with song objects. Can include full song data with lyrics.
              </p>
            </TabsContent>
          </Tabs>

          {/* Results */}
          {results && (
            <div
              className={`p-3 rounded-lg ${
                results.errors.length > 0
                  ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                  : "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
              }`}
            >
              {results.errors.length > 0 ? (
                <div className="text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Import failed</p>
                  {results.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <p>Successfully imported {results.success} songs!</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              {results?.success ? "Done" : "Cancel"}
            </Button>
            {!results?.success && (
              <Button onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import Songs
              </Button>
            )}
            {results?.success ? (
              <Button onClick={onUploadComplete}>
                View Songbook
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





