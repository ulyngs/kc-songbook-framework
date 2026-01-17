import SongPageClient from "./song-page-client";

// For static export, Next.js 16 requires at least one param
// The _placeholder generates /song/_placeholder.html which won't be used
// but allows the catch-all to work for all other dynamic IDs
export async function generateStaticParams() {
  return [{ slug: [] }]; // This generates /song.html as the base
}

export default function SongPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  return <SongPageClient params={params} />;
}
