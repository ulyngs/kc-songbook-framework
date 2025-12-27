"use client";

import { Music, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddSong: () => void;
  onBulkUpload: () => void;
}

export function EmptyState({ onAddSong, onBulkUpload }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 page-transition">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-xl">
          <Music className="h-12 w-12 text-primary-foreground" />
        </div>
      </div>

      <h2 className="font-display text-2xl font-bold mb-2 text-center">
        Your Songbook is Empty
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Add your favorite karaoke songs with lyrics and music sheets. 
        Start building your personal collection!
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onAddSong} size="lg" className="shadow-lg shadow-primary/20">
          <Plus className="h-5 w-5 mr-2" />
          Add Your First Song
        </Button>
        <Button onClick={onBulkUpload} variant="outline" size="lg">
          <Upload className="h-5 w-5 mr-2" />
          Bulk Upload
        </Button>
      </div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🎤</div>
          <h3 className="font-display font-semibold mb-1">Add Lyrics</h3>
          <p className="text-sm text-muted-foreground">
            Paste or type song lyrics
          </p>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🎼</div>
          <h3 className="font-display font-semibold mb-1">Upload Music</h3>
          <p className="text-sm text-muted-foreground">
            Add PDF or image sheets
          </p>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">📱</div>
          <h3 className="font-display font-semibold mb-1">Works Offline</h3>
          <p className="text-sm text-muted-foreground">
            Install as app on any device
          </p>
        </div>
      </div>
    </div>
  );
}

