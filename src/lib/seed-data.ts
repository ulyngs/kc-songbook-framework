import { getSong, addSong, Song } from "./db";

interface SeedSong {
  title: string;
  artist: string;
  lyrics?: string;
  key?: string;
  isXmas?: boolean;
  isMovie?: boolean;
  isPublicDomain?: boolean;
  musicType?: 'pdf' | 'image' | 'text';
  musicData?: string;
  musicFileName?: string;
}

export async function seedExampleSongs(): Promise<number> {
  try {
    // Try to load seed songs from the public folder
    const response = await fetch("/seed-songs/songs.json");
    if (!response.ok) {
      console.log("No seed songs found");
      return 0;
    }
    
    const songs: SeedSong[] = await response.json();
    let seededCount = 0;
    
    for (const song of songs) {
      const id = song.title
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      // Check if already exists
      const existing = await getSong(id);
      if (existing) {
        continue;
      }
      
      await addSong({
        title: song.title,
        artist: song.artist,
        key: song.key,
        isXmas: song.isXmas,
        isMovie: song.isMovie,
        isPublicDomain: song.isPublicDomain ?? false,
        lyrics: song.lyrics,
        musicType: song.musicType,
        musicData: song.musicData,
        musicFileName: song.musicFileName,
      });
      
      seededCount++;
    }
    
    return seededCount;
  } catch (error) {
    console.warn("Could not seed example songs:", error);
    return 0;
  }
}

// Legacy function for backwards compatibility
export async function seedExampleSong(): Promise<boolean> {
  const count = await seedExampleSongs();
  return count > 0;
}
