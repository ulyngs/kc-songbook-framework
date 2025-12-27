"use client";

import { useState, useRef } from "react";
import { addSong, fileToBase64, getFileType } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Image, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSongAdded: () => void;
}

export function AddSongDialog({
  open,
  onOpenChange,
  onSongAdded,
}: AddSongDialogProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [musicType, setMusicType] = useState<"file" | "text">("file");
  const [musicText, setMusicText] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setArtist("");
    setSongKey("");
    setLyrics("");
    setMusicType("file");
    setMusicText("");
    setMusicFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = getFileType(file);
      if (!type) {
        toast.error("Please upload a PDF or image file");
        return;
      }
      setMusicFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !artist.trim()) {
      toast.error("Please enter a title and artist");
      return;
    }

    setIsSubmitting(true);

    try {
      let musicData: string | undefined;
      let resolvedMusicType: "pdf" | "image" | "text" | undefined;
      let musicFileName: string | undefined;

      if (musicType === "file" && musicFile) {
        musicData = await fileToBase64(musicFile);
        resolvedMusicType = getFileType(musicFile) || undefined;
        musicFileName = musicFile.name;
      } else if (musicType === "text" && musicText.trim()) {
        musicData = musicText;
        resolvedMusicType = "text";
      }

      await addSong({
        title: title.trim(),
        artist: artist.trim(),
        key: songKey.trim() || undefined,
        lyrics: lyrics.trim() || undefined,
        musicType: resolvedMusicType,
        musicData,
        musicFileName,
        isPublicDomain: false,
      });

      toast.success(`"${title}" added to your songbook!`);
      resetForm();
      onSongAdded();
    } catch (error) {
      console.error("Failed to add song:", error);
      toast.error("Failed to add song. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New Song</DialogTitle>
          <DialogDescription>
            Add lyrics and music sheets to your songbook
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title & Artist */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Song Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bohemian Rhapsody"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Artist *</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Queen"
                required
              />
            </div>
          </div>

          {/* Key */}
          <div className="space-y-2">
            <Label htmlFor="key">Key (optional)</Label>
            <Input
              id="key"
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              placeholder="e.g. Bb, Am, G#m"
              className="max-w-32"
            />
          </div>

          {/* Lyrics */}
          <div className="space-y-2">
            <Label htmlFor="lyrics">Lyrics</Label>
            <Textarea
              id="lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste or type the lyrics here..."
              className="min-h-[150px] font-mono text-sm"
            />
          </div>

          {/* Music */}
          <div className="space-y-3">
            <Label>Music Sheet</Label>
            <Tabs value={musicType} onValueChange={(v) => setMusicType(v as "file" | "text")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Type Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-3">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {musicFile ? (
                    <div className="flex items-center justify-center gap-3">
                      {musicFile.type === "application/pdf" ? (
                        <FileText className="h-8 w-8 text-primary" />
                      ) : (
                        <Image className="h-8 w-8 text-primary" />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-sm">{musicFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(musicFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMusicFile(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload PDF or image
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </TabsContent>

              <TabsContent value="text" className="mt-3">
                <Textarea
                  value={musicText}
                  onChange={(e) => setMusicText(e.target.value)}
                  placeholder="Type chord charts, tabs, or notation..."
                  className="min-h-[150px] font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Song
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

