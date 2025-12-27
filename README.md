# Karaoke Collective Songbook

A beautiful Progressive Web App for managing your karaoke songbook with lyrics and music sheets.

## Features

- 🎤 **Personal Songbook** - Store lyrics and music sheets locally on your device
- 📱 **Works Offline** - Install as a PWA and use without internet
- 🔍 **Search & Sort** - Quickly find songs by title or artist
- 📄 **Multiple Formats** - Support for PDF, images, or text-based music sheets
- 🎵 **Lyrics & Music Toggle** - Switch between lyrics and sheet music views
- 📦 **Bulk Import** - Import multiple public domain songs at once
- 🌙 **Dark Mode** - Beautiful light and dark themes

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Generate App Icons

If you modify `public/icons/icon.svg`, regenerate PNG icons:

```bash
npm run generate-icons
```

## Usage

### Adding Songs

1. Click the **Add Song** button in the header
2. Enter the song title and artist (required)
3. Optionally add the musical key
4. Paste or type the lyrics
5. Upload a PDF/image music sheet or type chord charts

### Bulk Upload (Public Domain)

For importing multiple public domain songs:

1. Click **Add Song** → **Bulk Upload (Public Domain)**
2. Choose CSV or JSON format
3. Paste your data and import

**CSV Format:**
```csv
title,artist,key
Silent Night,Traditional,Bb
Jingle Bells,Traditional,G
```

**JSON Format:**
```json
[
  {
    "title": "Silent Night",
    "artist": "Traditional",
    "key": "Bb",
    "lyrics": "Silent night, holy night...",
    "isPublicDomain": true
  }
]
```

### Installing as PWA

1. Open the app in your browser
2. On **iOS/iPadOS**: Tap Share → Add to Home Screen
3. On **Android/Chrome**: Click the install prompt or Menu → Install App
4. On **Desktop**: Click the install icon in the address bar

## Data Storage

All songs are stored locally in your browser's IndexedDB. Data persists across sessions and works offline. To backup your songbook:

1. Export as JSON from the browser console:
   ```javascript
   // In browser dev tools
   const { exportSongs } = await import('/lib/db');
   const json = await exportSongs();
   console.log(json);
   ```

2. Save the JSON file for backup

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **IndexedDB (idb)** - Local storage
- **next-pwa** - PWA support

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Home page with songlist
│   ├── song/[id]/page.tsx # Song detail view
│   ├── layout.tsx        # Root layout with theme
│   └── globals.css       # Global styles & theme
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── header.tsx        # App header with search
│   ├── song-list.tsx     # Song listing component
│   ├── add-song-dialog.tsx
│   └── bulk-upload-dialog.tsx
└── lib/
    ├── db.ts             # IndexedDB operations
    └── utils.ts          # Utility functions
```

## License

This is a private songbook application. Only add songs you have the rights to use.

---

Built for **Karaoke Collective** 🎤
