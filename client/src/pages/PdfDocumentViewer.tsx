import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfDocumentViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError(null);

    void (async () => {
      try {
        const document = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(1, (container.clientWidth - 24) / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement("canvas");
          canvas.className = "w-full h-auto rounded border border-slate-200 bg-white shadow-sm";
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError("The schedule could not be displayed. Please try again or contact management.");
      }
    })();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [url]);

  return <div ref={containerRef} className="space-y-3">{error && <p className="text-sm text-red-600">{error}</p>}</div>;
}
