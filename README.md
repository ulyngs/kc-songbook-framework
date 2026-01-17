# Karaoke Collective Songbook

A beautiful Progressive Web App for managing your karaoke songbook with lyrics and music sheets.

## Features

- 🎤 **Personal Songbook** - Store lyrics and music sheets locally on your device
- 📱 **Works Offline** - Install as a PWA and use without internet
- 🔍 **Search & Sort** - Quickly find songs by title or artist
- 📄 **Multiple Formats** - Support for PDF, images, or text-based music sheets
- 🎵 **Lyrics & Music Toggle** - Switch between lyrics and sheet music views
- 🎬 **Film Songs** - Movie songs are marked with 🎥 emoji
- 🎄 **Christmas Songs** - Seasonal songs are flagged for easy filtering
- ⭐ **Favourites** - Mark your favourite songs for quick access
- 📦 **Bulk Import** - Import multiple songs at once
- 🔐 **KC Collection** - Password-protected collection import for members
- 🌙 **Dark Mode** - Beautiful light and dark themes
- 📤 **Backup & Restore** - Export/import your entire songbook

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

### Environment Variables

Create a `.env.local` file:

```env
# Password for KC Collection (server-side only)
KC_COLLECTION_PASSWORD=your-secret-password
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

### KC Collection (Members Only)

For importing the full Karaoke Collective songbook:

1. Click **Add Song** → **Add KC Collection**
2. Enter the password
3. The collection is downloaded and imported (requires internet)
4. Once imported, all songs work offline

### Bulk Upload

For importing multiple songs from CSV or JSON:

1. Click **Add Song** → **Bulk Upload**
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

### Data Management

Access via the **Data Management** dialog (gear icon):

- **Export Backup** - Download your entire songbook as JSON
- **Import Backup** - Restore from a previous backup
- **Delete All Songs** - Clear your songbook

### Installing as PWA

1. Open the app in your browser
2. On **iOS/iPadOS**: Tap Share → Add to Home Screen
3. On **Android/Chrome**: Click the install prompt or Menu → Install App
4. On **Desktop**: Click the install icon in the address bar

## Data Storage

All songs are stored locally in your browser's IndexedDB. Data persists across sessions and works offline.

## Tech Stack

- **Next.js 15** - React framework
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **IndexedDB (idb)** - Local storage
- **Serwist** - PWA support
- **Netlify Blobs** - Secure collection storage
- **pdf.js** - PDF rendering

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home page with songlist
│   ├── song/[id]/page.tsx    # Song detail view
│   ├── layout.tsx            # Root layout with theme
│   ├── globals.css           # Global styles & theme
│   └── api/
│       └── kc-collection/    # KC Collection API endpoint
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── header.tsx            # App header with search
│   ├── song-list.tsx         # Song listing component
│   ├── add-song-dialog.tsx   # Add song modal
│   ├── data-management-dialog.tsx
│   └── seamless-pdf-viewer.tsx
├── data/
│   └── kc-collection.json    # Local KC collection (gitignored)
└── lib/
    ├── db.ts                 # IndexedDB operations
    ├── kc-collection.ts      # KC Collection import logic
    └── utils.ts              # Utility functions
```

## KC Collection Management

The KC Collection is stored securely in **Netlify Blobs** and is not included in the git repository.

### Updating the Collection

1. Make sure you have the Netlify CLI installed and linked:
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify link
   ```

2. Update the local file (`src/data/kc-collection.json`)

3. Upload to Netlify Blobs:
   ```bash
   netlify blobs:set kc-collection kc-collection.json --input ./src/data/kc-collection.json
   ```

### Security Architecture

- **Password** is stored as server-side environment variable (not in client code)
- **Collection file** is stored in Netlify Blobs (not publicly accessible)
- **API route** validates password before fetching from Blobs
- **Local development** reads from local file; production uses Blobs

## Deployment

Deployed on **Netlify**:
- **Admin**: https://app.netlify.com/projects/kc-songbook
- **Live site**: https://songbook.karaokecollective.com

### Environment Variables (Netlify Dashboard)

Set these in Site settings → Environment variables:
- `KC_COLLECTION_PASSWORD` - Password for KC Collection access

## Terms of Use

This code is licensed under the [CC BY-NC-ND 3.0](https://creativecommons.org/licenses/by-nc-nd/3.0/) licence.

## License

This is a private songbook application. Only add songs you have the rights to use.

---

Built for **Karaoke Collective** 🎤
