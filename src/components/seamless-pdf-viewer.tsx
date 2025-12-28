"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ZoomIn } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

interface SeamlessPdfViewerProps {
  data: string; // Base64 data URL
  isImmersive?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

interface TouchState {
  initialDistance: number;
  initialScale: number;
  lastCenter: { x: number; y: number };
}

interface PageInfo {
  width: number;
  height: number;
}

export function SeamlessPdfViewer({ 
  data, 
  isImmersive = false,
  zoom: controlledZoom,
  onZoomChange,
}: SeamlessPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTasksRef = useRef<(RenderTask | null)[]>([]);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Zoom state - can be controlled or uncontrolled
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = controlledZoom ?? internalZoom;
  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, 0.5), 5);
    if (onZoomChange) {
      onZoomChange(clampedZoom);
    } else {
      setInternalZoom(clampedZoom);
    }
  }, [onZoomChange]);

  const [renderedZoom, setRenderedZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const touchStateRef = useRef<TouchState | null>(null);
  
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRenderingRef = useRef(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Base scale for fitting width
  const baseScaleRef = useRef(1);

  // Auto-hide zoom controls (only used in immersive mode)
  const [showZoomControls, setShowZoomControls] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show controls and schedule auto-hide
  const flashZoomControls = useCallback(() => {
    if (!isImmersive) return; // Only flash in immersive mode
    setShowZoomControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowZoomControls(false);
    }, 2000);
  }, [isImmersive]);

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches
  const getTouchCenter = useCallback((touches: TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  // Clamp scale to valid range
  const clampZoom = useCallback((s: number) => Math.min(Math.max(s, 0.5), 5), []);

  // Cancel all ongoing render tasks
  const cancelRenderTasks = useCallback(() => {
    renderTasksRef.current.forEach(task => {
      if (task) {
        task.cancel();
      }
    });
    renderTasksRef.current = [];
  }, []);

  // Re-render pages at target zoom level using double-buffering to prevent flicker
  const renderPages = useCallback(async (targetZoom: number) => {
    const pdf = pdfDocRef.current;
    if (!pdf || isRenderingRef.current) return;

    // Cancel any ongoing renders
    cancelRenderTasks();
    
    isRenderingRef.current = true;

    const baseScale = baseScaleRef.current;
    const actualRenderScale = baseScale * targetZoom;
    const dpr = window.devicePixelRatio || 1;

    try {
      // First, render all pages to offscreen canvases
      const offscreenCanvases: { canvas: HTMLCanvasElement; width: number; height: number }[] = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: actualRenderScale * dpr });
        
        // Create offscreen canvas for this page
        const offscreen = document.createElement("canvas");
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        
        const offscreenCtx = offscreen.getContext("2d");
        if (!offscreenCtx) continue;

        // Render to offscreen canvas
        const renderTask = page.render({
          canvasContext: offscreenCtx,
          viewport: viewport,
        });
        
        renderTasksRef.current[pageNum - 1] = renderTask;
        
        await renderTask.promise;
        renderTasksRef.current[pageNum - 1] = null;
        
        offscreenCanvases.push({
          canvas: offscreen,
          width: viewport.width / dpr,
          height: viewport.height / dpr,
        });
      }

      // Store canvas data for swap
      const canvasData = offscreenCanvases;
      
      // First: update all React state at once (batched)
      // This ensures cssScale becomes 1 and translate resets BEFORE we resize canvases
      setIsSwapping(true);
      setRenderedZoom(targetZoom);
      setTranslate({ x: 0, y: 0 });
      
      // Wait for React to commit the state changes, then swap canvases
      requestAnimationFrame(() => {
        // Now swap all canvases (React has already updated cssScale to 1)
        for (let i = 0; i < canvasData.length; i++) {
          const visibleCanvas = canvasRefs.current[i];
          const { canvas: offscreen, width, height } = canvasData[i];
          
          if (!visibleCanvas) continue;
          
          visibleCanvas.width = offscreen.width;
          visibleCanvas.height = offscreen.height;
          visibleCanvas.style.width = `${width}px`;
          visibleCanvas.style.height = `${height}px`;
          
          const ctx = visibleCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(offscreen, 0, 0);
          }
        }
        
        // Re-enable transitions after another frame
        requestAnimationFrame(() => {
          setIsSwapping(false);
        });
      });
    } catch (e: any) {
      // Ignore cancellation errors
      if (e?.name !== "RenderingCancelledException") {
        console.error("Render error:", e);
      }
    } finally {
      isRenderingRef.current = false;
    }
  }, [cancelRenderTasks]);

  // Schedule re-render after gesture ends or zoom changes
  const scheduleRerender = useCallback((targetZoom: number) => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    // Debounce re-renders to avoid flickering during rapid zoom changes
    renderTimeoutRef.current = setTimeout(() => {
      renderPages(targetZoom);
    }, 150);
  }, [renderPages]);

  // Re-render when controlled zoom changes
  useEffect(() => {
    if (controlledZoom !== undefined && Math.abs(controlledZoom - renderedZoom) > 0.01) {
      scheduleRerender(controlledZoom);
    }
  }, [controlledZoom, renderedZoom, scheduleRerender]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsGesturing(true);
      touchStateRef.current = {
        initialDistance: getTouchDistance(e.touches),
        initialScale: zoom,
        lastCenter: getTouchCenter(e.touches),
      };
    }
  }, [zoom, getTouchDistance, getTouchCenter]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current) {
      e.preventDefault();
      
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      
      // Calculate new zoom
      const scaleChange = currentDistance / touchStateRef.current.initialDistance;
      const newZoom = clampZoom(touchStateRef.current.initialScale * scaleChange);
      setZoom(newZoom);
      flashZoomControls();
      
      // Calculate pan movement
      const panX = currentCenter.x - touchStateRef.current.lastCenter.x;
      const panY = currentCenter.y - touchStateRef.current.lastCenter.y;
      
      touchStateRef.current.lastCenter = currentCenter;
      
      // Update translation
      setTranslate(prev => ({
        x: prev.x + panX,
        y: prev.y + panY,
      }));
    }
  }, [getTouchDistance, getTouchCenter, clampZoom, setZoom, flashZoomControls]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (touchStateRef.current && isGesturing) {
      // Schedule re-render at final zoom for crisp output
      scheduleRerender(zoom);
    }
    touchStateRef.current = null;
    setIsGesturing(false);
  }, [zoom, isGesturing, scheduleRerender]);

  // Double-tap to reset zoom
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      setZoom(1);
      setTranslate({ x: 0, y: 0 });
      scheduleRerender(1);
      setShowZoomControls(false);
    }
    lastTapRef.current = now;
  }, [scheduleRerender, setZoom]);

  // Handle wheel/trackpad zoom (desktop)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      
      const zoomFactor = 1 - e.deltaY * 0.01;
      const newZoom = clampZoom(zoom * zoomFactor);
      
      setZoom(newZoom);
      scheduleRerender(newZoom);
      flashZoomControls();
    }
  }, [zoom, clampZoom, scheduleRerender, setZoom, flashZoomControls]);

  // Attach wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // Convert data URL to array buffer
        const base64 = data.split(",")[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        renderTasksRef.current = new Array(pdf.numPages).fill(null);

        // Get page dimensions and calculate base scale
        const pageInfosTemp: PageInfo[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          pageInfosTemp.push({ width: viewport.width, height: viewport.height });
        }

        if (cancelled) return;
        setPageInfos(pageInfosTemp);

        // Calculate base scale to fit container width
        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const maxPageWidth = Math.max(...pageInfosTemp.map(p => p.width));
        const targetWidth = Math.min(containerWidth * 0.95, 900);
        baseScaleRef.current = targetWidth / maxPageWidth;

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (!cancelled) {
          setError("Failed to load PDF");
          setIsLoading(false);
        }
      }
    };

    loadPdf();
    return () => { 
      cancelled = true;
      cancelRenderTasks();
    };
  }, [data, cancelRenderTasks]);

  // Initial render when canvases are ready
  const canvasReadyCount = useRef(0);
  const setCanvasRef = useCallback((index: number) => (el: HTMLCanvasElement | null) => {
    canvasRefs.current[index] = el;
    if (el) {
      canvasReadyCount.current++;
      // All canvases ready - do initial render
      if (canvasReadyCount.current === pageInfos.length && pdfDocRef.current) {
        renderPages(zoom);
      }
    }
  }, [pageInfos.length, renderPages, zoom]);

  const containerHeight = isImmersive ? "100vh" : "calc(100vh - 4rem)";

  // Calculate CSS transform scale (zoom relative to what we've rendered)
  const cssScale = zoom / renderedZoom;

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-muted/30"
        style={{ height: containerHeight }}
      >
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto bg-neutral-800 dark:bg-neutral-900"
      style={{ 
        height: containerHeight,
        touchAction: "pan-x pan-y",
      }}
      onTouchStart={(e) => {
        handleDoubleTap(e);
        handleTouchStart(e);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading PDF...</p>
          </div>
        </div>
      )}

      {/* Zoom controls - only show in immersive mode, auto-hide after 2 seconds */}
      {isImmersive && zoom !== 1 && (
        <div 
          className={`fixed top-20 right-4 z-20 transition-opacity duration-300 ${
            showZoomControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-xl overflow-hidden text-white text-sm font-medium">
            <div className="flex items-center gap-2 px-3 py-2">
              <ZoomIn className="h-4 w-4" />
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <button
              onClick={() => {
                setZoom(1);
                setTranslate({ x: 0, y: 0 });
                scheduleRerender(1);
                setShowZoomControls(false);
              }}
              className="w-full px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors border-t border-white/20 text-center"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* PDF pages container */}
      <div
        ref={contentRef}
        className="flex flex-col items-center gap-4 py-4 px-2 min-h-full"
        style={{
          transform: `scale(${cssScale}) translate(${translate.x / cssScale}px, ${translate.y / cssScale}px)`,
          transformOrigin: "center top",
          // Smooth transition for button-triggered zooms, but not during gestures or canvas swaps
          transition: (isGesturing || isSwapping) ? "none" : "transform 0.15s ease-out",
        }}
      >
        {pageInfos.map((info, i) => (
          <canvas
            key={i}
            ref={setCanvasRef(i)}
            className="shadow-lg rounded-sm bg-white"
            style={{
              // Initial size before render
              width: info.width * baseScaleRef.current * renderedZoom,
              height: info.height * baseScaleRef.current * renderedZoom,
            }}
          />
        ))}
        
        {/* Placeholder while loading */}
        {pageInfos.length === 0 && !error && (
          <div className="w-full max-w-[900px] aspect-[8.5/11] bg-white/10 rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}
