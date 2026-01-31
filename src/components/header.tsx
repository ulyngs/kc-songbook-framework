"use client";

import Image from "next/image";

export function Header() {

  return (
    <header
      className="border-b border-border/50 bg-background/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-tauri-drag-region
    >
      <div className="flex flex-col items-center w-full" data-tauri-drag-region>
        <div className="flex h-16 items-center justify-center w-full px-3" data-tauri-drag-region>
          {/* Logo and title */}
          <div className="flex items-center gap-2.5" data-tauri-drag-region>
            <Image
              src="/icons/icon.svg"
              alt="Songbook"
              width={40}
              height={40}
              className="rounded-xl shadow-lg shadow-[#1a2744]/25"
            />
            <div className="hidden sm:block" data-tauri-drag-region>
              <h1 className="font-display text-xl font-semibold tracking-tight">
                The Karaoke Collective Songbook
              </h1>
              <p className="text-xs text-muted-foreground/70 -mt-0.5">
                Made with ♥ by Ulrik Lyngs
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

