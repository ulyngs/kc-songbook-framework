"use client";

import Image from "next/image";
import { Search, Plus, Upload, Moon, Sun, Settings, Download, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddSong: () => void;
  onAddKCCollection: () => void;
  onDataManagement: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onAddSong,
  onAddKCCollection,
  onDataManagement,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
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
                Made with ♥ by{" "}
                <a
                  href="https://ulriklyngs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors underline decoration-muted-foreground/30 underline-offset-2 hover:decoration-muted-foreground/60"
                >
                  Ulrik Lyngs
                </a>
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search songs or artists..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-11 text-base bg-secondary/50 border-transparent focus:border-primary/50 focus:bg-background transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                  >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="default" className="shadow-lg shadow-primary/20 text-base">
                  <Plus className="h-5 w-5 mr-1.5" />
                  <span className="hidden sm:inline">Add Song</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onAddSong} className="text-base py-2">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Single Song
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddKCCollection} className="text-base py-2">
                  <Lock className="h-5 w-5 mr-2" />
                  Add KC Collection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDataManagement} className="text-base py-2">
                  <Download className="h-5 w-5 mr-2" />
                  Backup & Restore
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

