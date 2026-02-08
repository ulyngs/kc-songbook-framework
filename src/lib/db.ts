import { openDB, IDBPDatabase } from 'idb';

export interface Song {
  id: string;
  title: string;
  artist: string;
  key?: string;
  tempo?: string;
  isMovie?: boolean;
  isXmas?: boolean;
  isFavourite?: boolean;
  lyrics?: string;
  musicType?: 'pdf' | 'image' | 'text';
  musicData?: string; // Base64 for files, plain text for text
  musicFileName?: string;
  isPublicDomain?: boolean;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'karaoke-songbook';
const DB_VERSION = 1;
const STORE_NAME = 'songs';

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('title', 'title');
        store.createIndex('artist', 'artist');
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });

  return dbInstance;
}

// Generate a URL-friendly slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Get all songs
export async function getAllSongs(): Promise<Song[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

// Get a single song by ID
export async function getSong(id: string): Promise<Song | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

// Add a new song
export async function addSong(song: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>): Promise<Song> {
  const db = await getDB();
  const now = Date.now();
  const id = generateSlug(song.title);

  const newSong: Song = {
    ...song,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.put(STORE_NAME, newSong);
  return newSong;
}

// Update a song
export async function updateSong(id: string, updates: Partial<Song>): Promise<Song | undefined> {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);

  if (!existing) return undefined;

  const updated: Song = {
    ...existing,
    ...updates,
    id, // Preserve original ID
    updatedAt: Date.now(),
  };

  await db.put(STORE_NAME, updated);
  return updated;
}

// Delete a song
export async function deleteSong(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

// Restore a song (for undo functionality)
export async function restoreSong(song: Song): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, song);
}

// Bulk add songs
export async function bulkAddSongs(songs: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Song[]> {
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  const newSongs: Song[] = songs.map((song, index) => ({
    ...song,
    id: generateSlug(song.title),
    createdAt: now + index, // Slight offset to maintain order
    updatedAt: now + index,
  }));

  await Promise.all([
    ...newSongs.map(song => tx.store.put(song)),
    tx.done,
  ]);

  return newSongs;
}

// Search songs
export async function searchSongs(query: string): Promise<Song[]> {
  const songs = await getAllSongs();
  const lowerQuery = query.toLowerCase();

  return songs.filter(song =>
    song.title.toLowerCase().includes(lowerQuery) ||
    song.artist.toLowerCase().includes(lowerQuery)
  );
}

// File helpers
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getFileType(file: File): 'pdf' | 'image' | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

// Export all songs as JSON for backup
export async function exportSongs(): Promise<string> {
  const songs = await getAllSongs();
  return JSON.stringify(songs, null, 2);
}

// Export songs as a downloadable file
export async function downloadSongsBackup(): Promise<void> {
  const json = await exportSongs();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `songbook-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import songs from JSON backup
export async function importSongs(json: string): Promise<number> {
  const songs: Song[] = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  await Promise.all([
    ...songs.map(song => tx.store.put(song)),
    tx.done,
  ]);

  return songs.length;
}

// Import a batch of pre-parsed songs into IndexedDB
export async function importSongsBatch(songs: Song[]): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  await Promise.all([
    ...songs.map(song => tx.store.put(song)),
    tx.done,
  ]);

  return songs.length;
}

// Import songs from a File object
export async function importSongsFromFile(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        const count = await importSongs(json);
        resolve(count);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Clear all songs from the database
export async function clearAllSongs(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  await tx.done;
}

