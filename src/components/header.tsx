"use client";

import Image from "next/image";

export function Header() {

  return (
    <header
      className="border-b border-border/50 bg-background/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/icons/icon.svg"
              alt="Songbook"
              width={40}
              height={40}
              className="rounded-xl shadow-lg shadow-[#1a2744]/25"
            />
            <div className="hidden sm:block">
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

