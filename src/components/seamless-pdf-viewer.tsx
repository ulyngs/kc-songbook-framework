"use client";

interface SeamlessPdfViewerProps {
  data: string; // Base64 data URL
  isImmersive?: boolean;
}

export function SeamlessPdfViewer({ data, isImmersive = false }: SeamlessPdfViewerProps) {
  // Use native PDF viewer with parameters to hide UI elements
  // navpanes=0 hides sidebar, toolbar=0 hides toolbar, view=FitH fits width
  const pdfUrl = `${data}#navpanes=0&toolbar=0&view=FitH`;
  
  return (
    <iframe
      src={pdfUrl}
      className="w-full border-0"
      style={{ height: isImmersive ? "100vh" : "calc(100vh - 4rem)" }}
      title="Music Sheet PDF"
    />
  );
}
