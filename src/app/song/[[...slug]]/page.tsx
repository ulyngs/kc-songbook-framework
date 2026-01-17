import { Suspense } from "react";
import SongPageClient from "./song-page-client";

// For static export, Next.js 16 requires at least one param
// The _placeholder generates /song/_placeholder.html which won't be used
// but allows the catch-all to work for all other dynamic IDs
export async function generateStaticParams() {
  return [{ slug: [] }]; // This generates /song.html as the base
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

export default function SongPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SongPageClient />
    </Suspense>
  );
}
