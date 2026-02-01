"use client";

import React, { useState, useRef } from "react";
import { Music2, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allGenres = [
  { name: "Classical", color: "oklch(0.58 0.14 50)", textColor: "#fff" },
  { name: "Techno", color: "oklch(0.58 0.22 200)", textColor: "#fff" },
  { name: "Swing Jazz", color: "oklch(0.82 0.16 95)", textColor: "#000" },
  { name: "Reggae", color: "oklch(0.55 0.20 140)", textColor: "#fff" },
  { name: "Waltz", color: "oklch(0.75 0.12 320)", textColor: "#000" },
  { name: "Latin", color: "oklch(0.48 0.22 25)", textColor: "#fff" },
  { name: "Rock 'n' Roll", color: "oklch(0.50 0.20 260)", textColor: "#fff" },
  { name: "Metal", color: "oklch(0.22 0.02 250)", textColor: "#fff" },
  { name: "Rap / Hip Hop", color: "oklch(0.72 0.16 70)", textColor: "#000" },
];



interface GenreWheelProps {
  songTitle: string;
  songArtist: string;
  isMovie?: boolean;
  onClose: () => void;
}

export function GenreWheel({ songTitle, songArtist, isMovie, onClose }: GenreWheelProps) {
  const [availableGenres, setAvailableGenres] = useState(allGenres);
  const [explodingGenre, setExplodingGenre] = useState<string | null>(null);
  const [genreToRemoveNext, setGenreToRemoveNext] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [wheelKey, setWheelKey] = useState(0);
  const [hasEverSpun, setHasEverSpun] = useState(false);
  const dragStartAngle = useRef(0);
  const lastAngle = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const spinGenresRef = useRef(allGenres);

  const handleReset = () => {
    setAvailableGenres(allGenres);
    setSelectedGenre(null);
    setShowResult(false);
    setExplodingGenre(null);
    setGenreToRemoveNext(null);
    setRotation(0);
    spinGenresRef.current = allGenres;
    setWheelKey((prev) => prev + 1);
    setHasEverSpun(false);
  };

  const getAngleFromCenter = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    return angle;
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    if (isSpinning) return;
    setIsDragging(true);
    setShowResult(false);
    dragStartAngle.current = getAngleFromCenter(clientX, clientY);
    lastAngle.current = dragStartAngle.current;
    lastTime.current = Date.now();
    velocity.current = 0;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const currentAngle = getAngleFromCenter(clientX, clientY);
    const currentTime = Date.now();
    const timeDelta = currentTime - lastTime.current;

    if (timeDelta > 0) {
      let angleDelta = currentAngle - lastAngle.current;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      velocity.current = (angleDelta / timeDelta) * 16;
      setRotation((prev) => prev + angleDelta);
    }

    lastAngle.current = currentAngle;
    lastTime.current = currentTime;
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const speed = Math.abs(velocity.current);

    if (speed < 2) {
      return;
    }

    if (genreToRemoveNext) {
      setExplodingGenre(genreToRemoveNext);

      const newGenres = availableGenres.filter((g) => g.name !== genreToRemoveNext);

      if (newGenres.length === 0) {
        setTimeout(() => {
          setExplodingGenre(null);
          setGenreToRemoveNext(null);
          setAvailableGenres(allGenres);
          spinGenresRef.current = allGenres;
        }, 400);
        startSpin(allGenres);
      } else {
        setAvailableGenres(newGenres);
        setTimeout(() => {
          setExplodingGenre(null);
          setGenreToRemoveNext(null);
        }, 400);
        spinGenresRef.current = newGenres;
        startSpin(newGenres);
      }
    } else {
      spinGenresRef.current = availableGenres;
      startSpin(availableGenres);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  const startSpin = (genresToUse: typeof allGenres) => {
    setIsSpinning(true);
    setShowResult(false);

    const direction = velocity.current >= 0 ? 1 : -1;
    const extraRotations = Math.min(Math.floor(Math.abs(velocity.current) / 3) + 3, 8);
    const randomIndex = Math.floor(Math.random() * genresToUse.length);
    const degreesPerSegment = 360 / genresToUse.length;
    const centerOffset = degreesPerSegment / 2;


    const targetAngle = 270 - (randomIndex * degreesPerSegment + centerOffset);
    const currentRotation = rotation % 360;
    const finalRotation = rotation - currentRotation + direction * extraRotations * 360 + targetAngle;

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const selected = genresToUse[randomIndex].name;
      setSelectedGenre(selected);
      setShowResult(true);
      setHasEverSpun(true);

      setGenreToRemoveNext(selected);
    }, 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col pt-2 items-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.68_0.18_75)_0%,_transparent_50%)] opacity-5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_oklch(0.65_0.15_75)_0%,_transparent_50%)] opacity-5" />

      {/* Header with song title and back button */}
      <div className="w-full flex flex-col items-center px-4 pt-4 pb-4 relative z-10">
        <div className="flex items-center justify-center gap-6">
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-gray-100">{songTitle}</h2>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            className="gap-2 bg-transparent border-gray-500 hover:border-gray-300 hover:bg-gray-800/50 text-gray-200 hover:text-white px-6 py-3 text-lg"
          >
            <ArrowLeft className="h-6 w-6" />
            <span>Back to Lyrics</span>
          </Button>
        </div>
      </div>

      {/* Wheel content */}
      <div className="flex flex-col items-center gap-1 w-full px-4 flex-1 min-h-0 relative z-10 pb-2">
        {/* Result/Instruction header */}
        <div className="h-10 flex flex-col items-center justify-center relative w-full flex-shrink-0">
          <h3
            className={cn(
              "text-xl sm:text-2xl font-medium text-gray-300 tracking-tight text-center transition-opacity duration-500",
              showResult ? "opacity-0 absolute" : "opacity-100"
            )}
          >
            Let&apos;s do it as...
          </h3>

          {selectedGenre && (
            <h3 className={cn("text-xl sm:text-2xl font-bold tracking-tight text-gray-100 transition-opacity duration-500 genre-wheel-bounce-in absolute", showResult ? "opacity-100" : "opacity-0")}>
              Let&apos;s do it as... <span className="text-2xl sm:text-3xl">{selectedGenre}!</span>
            </h3>
          )}
        </div>

        <p className="text-base text-gray-400 flex items-center gap-2 justify-center font-light tracking-wide flex-shrink-0 pb-2">
          {isDragging ? "Release to spin" : isSpinning ? "Spinning..." : "Drag the wheel to spin"}
        </p>

        {/* Wheel container - fills remaining space */}
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
          <div
            ref={wheelRef}
            className="relative aspect-square genre-wheel-glow rounded-3xl bg-black/40 backdrop-blur-sm"
            style={{ height: '100%', maxHeight: '100%', maxWidth: '100%' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Pointer/Arrow */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <div
                className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px]"
                style={{ borderTopColor: "#000000" }}
              />
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-white"
                style={{ marginTop: "4px" }}
              />
            </div>

            <div key={wheelKey} className="relative w-full h-full rounded-full overflow-hidden">
              <svg
                viewBox="0 0 200 200"
                className="w-full h-full drop-shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isSpinning ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                  userSelect: "none",
                  filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))",
                }}
              >
                {availableGenres.length === 1 ? (
                  <g key={availableGenres[0].name}>
                    <defs>
                      <radialGradient id="gradient-single">
                        <stop offset="0%" stopColor={availableGenres[0].color} stopOpacity="1" />
                        <stop offset="100%" stopColor={availableGenres[0].color} stopOpacity="0.85" />
                      </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="95" fill="url(#gradient-single)" stroke="#fff" strokeWidth="1.5" />
                    <text
                      x="100"
                      y="140"
                      fill={availableGenres[0].textColor}
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-sans tracking-wide"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                    >
                      {availableGenres[0].name}
                    </text>
                  </g>
                ) : (
                  availableGenres.map((genre, index) => {
                    const angle = (360 / availableGenres.length) * index;
                    const nextAngle = (360 / availableGenres.length) * (index + 1);
                    const startAngleRad = (angle * Math.PI) / 180;
                    const endAngleRad = (nextAngle * Math.PI) / 180;

                    const x1 = Math.round((100 + 95 * Math.cos(startAngleRad)) * 10000) / 10000;
                    const y1 = Math.round((100 + 95 * Math.sin(startAngleRad)) * 10000) / 10000;
                    const x2 = Math.round((100 + 95 * Math.cos(endAngleRad)) * 10000) / 10000;
                    const y2 = Math.round((100 + 95 * Math.sin(endAngleRad)) * 10000) / 10000;

                    const largeArcFlag = 0;

                    const pathData = `M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                    const midAngle = (startAngleRad + endAngleRad) / 2;
                    const textX = Math.round((100 + 70 * Math.cos(midAngle)) * 10000) / 10000;
                    const textY = Math.round((100 + 70 * Math.sin(midAngle)) * 10000) / 10000;
                    const textRotation = Math.round((((angle + nextAngle) / 2 + 90) % 360) * 10000) / 10000;

                    const isExploding = explodingGenre === genre.name;

                    return (
                      <g key={genre.name} className={isExploding ? "genre-wheel-explode" : ""}>
                        <defs>
                          <radialGradient id={`gradient-${index}`}>
                            <stop offset="0%" stopColor={genre.color} stopOpacity="1" />
                            <stop offset="100%" stopColor={genre.color} stopOpacity="0.85" />
                          </radialGradient>
                        </defs>
                        <path d={pathData} fill={`url(#gradient-${index})`} stroke="#fff" strokeWidth="1.5" />
                        {genre.name === "Rap / Hip Hop" ? (
                          <text
                            x={textX}
                            y={textY}
                            fill={genre.textColor}
                            stroke={genre.textColor === "#000" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)"}
                            strokeWidth="0.5"
                            paintOrder="stroke"
                            fontSize="7"
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                            className="font-sans tracking-wide"
                          >
                            <tspan x={textX} dy="-3">
                              Rap /
                            </tspan>
                            <tspan x={textX} dy="8">
                              Hip Hop
                            </tspan>
                          </text>
                        ) : genre.name === "Rock 'n' Roll" ? (
                          <text
                            x={textX}
                            y={textY}
                            fill={genre.textColor}
                            stroke={genre.textColor === "#000" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)"}
                            strokeWidth="0.5"
                            paintOrder="stroke"
                            fontSize="7"
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                            className="font-sans tracking-wide"
                          >
                            <tspan x={textX} dy="-3">
                              Rock &apos;n&apos;
                            </tspan>
                            <tspan x={textX} dy="8">
                              Roll
                            </tspan>
                          </text>
                        ) : (
                          <text
                            x={textX}
                            y={textY}
                            fill={genre.textColor}
                            stroke={genre.textColor === "#000" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)"}
                            strokeWidth="0.5"
                            paintOrder="stroke"
                            fontSize="7"
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                            className="font-sans tracking-wide"
                          >
                            {genre.name}
                          </text>
                        )}
                      </g>
                    );
                  })
                )}
              </svg>

              {/* Center circle */}
              <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ userSelect: "none" }}
              >
                <circle cx="100" cy="100" r="15" fill="#000000" />
                <circle cx="100" cy="100" r="10" fill="#ffffff" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reset button */}
        {availableGenres.length < allGenres.length && (
          <Button
            onClick={handleReset}
            variant="outline"
            className="gap-2 bg-transparent border-gray-600 hover:border-gray-400 hover:bg-gray-800/50 text-gray-100 hover:text-white flex-shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Wheel
          </Button>
        )}
      </div>
    </div>
  );
}
