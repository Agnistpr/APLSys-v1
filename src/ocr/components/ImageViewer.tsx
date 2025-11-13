import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Move, 
  Square,
  RotateCcw,
  Maximize
} from 'lucide-react';
import { toast } from 'sonner';
import { ocrFullScan, ocrRegion, parseDocumentText } from '../../api/ocr';
import { API_BASE_URL } from '../../../config';
import type { ExtractedText } from './DocumentScanner';
import axios from "axios";
import { useOcrStore } from '../../electron/ocrStore';


console.log("DEBUG: parseDocumentText =", typeof parseDocumentText, parseDocumentText);

//Mapping function for NER entity to tag
export function entityToTag(entity: string): string | null {
  if (!entity) return null;
  const e = entity.toUpperCase();
  if (e === 'PER' || e === 'PERSON' || e.endsWith('NAME')) return 'name';
  if (e === 'ORG' || e === 'ORGANIZATION') return 'organization';
  if (e === 'LOC' || e === 'LOCATION' || e === 'ADDRESS') return 'location';
  if (e === 'MISC') return 'misc';
  if (e === 'EMAIL' ) return 'email';
  if (e === 'PHONE' ) return 'phone';
  if (e === 'EDUCATION') return 'education';
  if (e === 'SKILL' || e === 'SKILLS') return 'skills';
  if (e === 'EXPERIENCE') return 'experience';
  return null;
}

// Utility to convert a data URL to a File object
function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// Example usage inside your OCR handler (e.g., handleFullScanOCR or performOCR)
const sendImageToClassifier = async (imageDataUrl: string) => {
  const file = dataURLtoFile(imageDataUrl, "image.png");
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(`${API_BASE_URL}/parser/parse-document`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
};

interface ImageViewerProps {
  //imageUrl: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  onTextExtracted: (extraction: ExtractedText | ExtractedText[]) => void;
  extractedData: ExtractedText[];
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function classifyTextWithNER(text: string) {
  const res = await axios.post(`${API_BASE_URL}/parser/parse-document`, { text });
  return res.data.entities;
}

// Update the classification function
export async function classifyTextWithAI(text: string) {
  try {
    const res = await axios.post(`${API_BASE_URL}/ai/deepseek-label-extracted-text`, { 
      text,
      fileName: "document.txt" // Add filename for context
    });
    
    // Ensure we handle both array and object responses
    if (Array.isArray(res.data)) {
      return res.data.map(item => item.tag || item.label || item.key).filter(Boolean);
    } else if (typeof res.data === 'object') {
      return Object.keys(res.data).filter(key => res.data[key] && typeof res.data[key] === 'string');
    }
    return [];
  } catch (err) {
    console.error('AI classification failed:', err);
    return [];
  }
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  fileUrl,
  fileType,
  fileName,
  onTextExtracted,
  extractedData
}) => {
  const [isRegionMode, setIsRegionMode] = useState<boolean>(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [currentSelection, setCurrentSelection] = useState<SelectionBox | null>(null);
  const [mode, setMode] = useState<'' | 'select'>(''); // Change default to empty string
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [parsing, setParsing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isGlobalProcessing = useOcrStore(s => s.isProcessing);
  const setGlobalProcessing = useOcrStore(s => s.setProcessing);
  const processingMap = useOcrStore(s => s.processingMap);
  const setProcessingMap = useOcrStore(s => s.setProcessingMap);

  // persistence actions
  const addResult = useOcrStore(s => s.addResult);
  const setCurrentExtractedData = useOcrStore(s => s.setCurrentExtractedData);
  const markFileProcessed = useOcrStore(s => s.markFileProcessed);

  // store selection start in displayed (client) pixels relative to image top-left
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selectionDisplay, setSelectionDisplay] = useState<SelectionBox | null>(null);

  // compute display -> natural scale when needed
  const displayToNatural = useCallback(() => {
    if (!imageRef.current) return { sx: 1, sy: 1, imgRect: null as DOMRect | null };
    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;
    return { sx: scaleX, sy: scaleY, imgRect };
  }, []);

  const getPreTransformMetrics = () => {
    if (!containerRef.current || !imageRef.current) {
      return { gapX: 0, gapY: 0, dispWpre: 0, dispHpre: 0 };
    }
    const containerRect = containerRef.current.getBoundingClientRect(); // NOT transformed
    const imgRect = imageRef.current.getBoundingClientRect();           // transformed

    const dispWpre = imgRect.width / zoom;   // image width before wrapper scale
    const dispHpre = imgRect.height / zoom;  // image height before wrapper scale

    const gapX = (containerRect.width  - dispWpre) / 2;
    const gapY = (containerRect.height - dispHpre) / 2;

    return { gapX, gapY, dispWpre, dispHpre };
  };

  const performOCR = useCallback(async (selection: SelectionBox) => {
    if (!imageRef.current) return;

    const toastId = `ocr-${fileName || 'unsaved'}`;
    setIsProcessingOCR(true);
    setGlobalProcessing(true);

    // use functional update and namespaced key
    const processingKey = `scanner:${fileName}`;
    
    // ✅ IMPORTANT: Use setState with callback to ensure it completes before continuing
    setProcessingMap(prev => {
      const updated = { ...(prev || {}), [processingKey]: true };
      console.log("🔄 performOCR: setProcessingMap called with:", updated);
      return updated;
    });

    // DEBUG: verify store updated immediately after
    setTimeout(() => {
      const storeState = useOcrStore.getState().processingMap;
      console.log("🔍 performOCR (after timeout): processingMap in store =", storeState);
    }, 0);

    toast(`Processing region scan for ${fileName}...`, {
        id: toastId,
        description: "Region scan is being performed. Please wait",
        icon: "🕓",
        dismissible: true,
        duration: 10000,
      });

    // After starting OCR task
    console.log("DEBUG processingMap after task start:", useOcrStore.getState().processingMap);

    try {
      const img = imageRef.current;
      // Get displayed image rect and compute scale to natural pixels
      const imgRect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      // selection is in displayed-image pixels relative to image top-left (x,y,width,height)
      const sx = Math.max(0, Math.round(selection.x * scaleX));
      const sy = Math.max(0, Math.round(selection.y * scaleY));
      const sw = Math.max(1, Math.round(selection.width * scaleX));
      const sh = Math.max(1, Math.round(selection.height * scaleY));

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL("image/png");
      const { text, confidence } = await ocrRegion(imageData);

      if (typeof text === "string" && text.trim()) {
        // Use Gemini to label the region text
        let tags: string[] = [];
        // try {
        //   const geminiResult = await classifyTextWithAI(text.trim());
        //   // normalize into array of strings
        //   if (Array.isArray(geminiResult)) {
        //     tags = geminiResult
        //       .map((it: any) => {
        //         if (typeof it === "string") return it;
        //         if (it && typeof it === "object") return it.tag || it.label || it.key || "";
        //         return "";
        //       })
        //       .filter(Boolean);
        //   } else if (geminiResult && typeof geminiResult === "object") {
        //     // object -> prefer keys with truthy value or string values
        //     tags = Object.keys(geminiResult).filter(k => {
        //       const v = (geminiResult as any)[k];
        //       return (typeof v === "string" && v.trim() !== "") || Boolean(v);
        //     });
        //   } else {
        //     tags = [];
        //   }
        // } catch (e) {
        //   console.warn("AI classification failed:", e);
        //   tags = [];
        // }

        // build items array from OCR result (items was undefined)
        const extractedItems = [
          {
            id: Date.now().toString(),
            text: String(text || "").trim(),
            bbox: selection,
            tags: tags || [],
            confidence: typeof confidence === "number" ? confidence : undefined
          }
        ];
        // persist the result so Management / Docs can restore after navigation/restart
        const resultPayload = {
          filename: fileName || `unnamed-${Date.now()}`,
          extractedData: extractedItems,
          customTags: [],
          timestamp: new Date().toISOString()
        };
        try {
          if (typeof setCurrentExtractedData === "function") setCurrentExtractedData(resultPayload.extractedData);
          if (typeof addResult === "function") addResult(resultPayload);
          if (typeof markFileProcessed === "function") markFileProcessed(resultPayload.filename);
        } catch (persistErr) {
          console.warn("Failed to persist OCR result:", persistErr);
        }

        onTextExtracted(resultPayload.extractedData);
        toast(`${fileName} extracted successfully.`, {
          id: toastId,
          description: "You may now return to the scanner tab to look at the results",
          icon: "✅",
          dismissible: true,
          duration: 10000,
        });
      } else {
        toast(`${fileName}: Warning`, {
          id: toastId,
          description: "No text was found here",
          icon: "⚠️",
          dismissible: true,
          duration: 10000,
        });
      }
    } catch (err) {
      console.error(err);
      toast(`Extracting from ${fileName} failed`, {
        id: toastId,
        description: "Something went wrong. Please try again.",
        icon: "❌",
        dismissible: true,
        duration: 10000,
      });
    } finally {
      // always clear both the per-file key AND the global processing flag
      setProcessingMap(prev => {
        const updated = { ...(prev || {}) };
        delete updated[processingKey];
        console.log("🔄 performOCR (finally): removing key, updated map =", updated);
        return updated;
      });
      setIsProcessingOCR(false);
      setGlobalProcessing(false);
      toast.dismiss(toastId);
    }
    //CRITICAL: add setProcessingMap to dependency array
  }, [fileName, onTextExtracted, setGlobalProcessing, setProcessingMap, addResult, setCurrentExtractedData, markFileProcessed]);

  //Mouse mapping helper
  const getImageCoords = useCallback((e: React.MouseEvent) => {
    if (!imageRef.current || !containerRef.current) return { x: 0, y: 0 };

    const imgRect = imageRef.current.getBoundingClientRect(); // transformed
    const { gapX, gapY } = getPreTransformMetrics();

    // distance from image’s transformed top-left
    const dx = e.clientX - imgRect.left;
    const dy = e.clientY - imgRect.top;

    // convert to pre-transform units and shift by pre-transform gaps
    const x = gapX + (dx / zoom);
    const y = gapY + (dy / zoom);

    return { x, y };
  }, [zoom]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleRotateCounterclockwise = useCallback(() => {
    setRotation(prev => (prev - 90 + 360) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setCurrentSelection(null);
    toast.success('View reset to default');
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageRef.current || !containerRef.current) return;
    const { left, top, width, height } = imageRef.current.getBoundingClientRect();
    // Only start selection when in select mode
    if (mode !== 'select') return;

    const startX = e.clientX - left;
    const startY = e.clientY - top;
    // clamp
    const sx = Math.max(0, Math.min(startX, width));
    const sy = Math.max(0, Math.min(startY, height));

    selectionStartRef.current = { x: sx, y: sy };
    setSelectionDisplay({ x: sx, y: sy, width: 0, height: 0 });
    setIsSelecting(true);
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !imageRef.current || !selectionStartRef.current) return;
    const imgRect = imageRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - imgRect.left, imgRect.width));
    const curY = Math.max(0, Math.min(e.clientY - imgRect.top, imgRect.height));
    const s = selectionStartRef.current;
    const x = Math.min(s.x, curX);
    const y = Math.min(s.y, curY);
    const w = Math.abs(curX - s.x);
    const h = Math.abs(curY - s.y);
    setSelectionDisplay({ x, y, width: w, height: h });
  }, [isSelecting]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isSelecting) return;
    setIsSelecting(false);

    // IMPORTANT: selectionDisplay is in displayed-image pixels relative to image top-left.
    // Pass that directly to performOCR which will convert it to natural pixels exactly once.
    if (selectionDisplay && selectionDisplay.width > 5 && selectionDisplay.height > 5 && imageRef.current) {
      await performOCR(selectionDisplay);
    }

    // clear
    selectionStartRef.current = null;
    setSelectionDisplay(null);
  }, [isSelecting, selectionDisplay, performOCR]);

  const handleFullScanOCR = useCallback(async () => {
    if (!imageRef.current) return;
    const toastId = `ocr-${fileName || 'unsaved'}`;
    setIsProcessingOCR(true);
    setGlobalProcessing(true);
    
    const processingKey = `scanner:${fileName}`;
    setProcessingMap(prev => ({ ...(prev || {}), [processingKey]: true }));
    
    toast(`Processing Full scan for ${fileName}...`, {
        id: toastId,
        description: "Full scan is being performed. Please wait",
        icon: "🕓",
        dismissible: true,
        duration: 10000,
      });

    try {
      const img = imageRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

      const imageData = canvas.toDataURL("image/png");
      const result = await ocrFullScan(imageData);
      console.log("OCR result:", result);

      // If result is the doctr structured output:
      let items: ExtractedText[] = [];
      
      if (result.pages) {
        // Extract lines (not words) to maintain top-to-bottom order
        result.pages.forEach((page: any) => {
          (page.blocks || []).forEach((block: any) => {
            (block.lines || []).forEach((line: any) => {
              // Join all words in this line together
              const lineText = (line.words || [])
                .map((word: any) => word.value || "")
                .join(" ")
                .trim();
              
              // Only create an item if the line has text
              if (lineText) {
                items.push({
                  id: `${Date.now()}-${items.length}`,
                  text: lineText,
                  bbox: { x: 0, y: 0, width: 0, height: 0 },
                  tags: [],
                });
              }
            });
          });
        });
      }

      if (items.length === 0) {
        toast(`${fileName}: Warning`, {
          id: toastId,
          description: "No text was extracted. Please try again.",
          icon: "⚠️",
          dismissible: true,
          duration: 10000,
        });
        return;
      }

      // persist the result so Management / Docs can restore after navigation/restart
      const resultPayload = {
        filename: fileName || `unnamed-${Date.now()}`,
        extractedData: items,
        customTags: [],
        timestamp: new Date().toISOString()
      };
      try {
        if (typeof setCurrentExtractedData === "function") setCurrentExtractedData(resultPayload.extractedData);
        if (typeof addResult === "function") addResult(resultPayload);
        if (typeof markFileProcessed === "function") markFileProcessed(resultPayload.filename);
      } catch (persistErr) {
        console.warn("Failed to persist OCR result:", persistErr);
      }

      onTextExtracted(items);
      toast(`${fileName} extracted successfully.`, {
          id: toastId,
          description: `${items.length} lines extracted. You may now return to the scanner tab to look at the results`,
          icon: "✅",
          dismissible: true,
          duration: 10000,
        });
    } catch (error) {
      console.error("Full Scan OCR Error:", error);
      toast(`Extracting from ${fileName} failed`, {
        id: toastId,
        description: "Something went wrong. Please try again.",
        icon: "❌",
        dismissible: true,
        duration: 10000,
      });
    } finally {
      setProcessingMap(prev => {
        const updated = { ...(prev || {}) };
        delete updated[processingKey];
        return updated;
      });
      setIsProcessingOCR(false);
      setGlobalProcessing(false);
      toast.dismiss(toastId);
    }
  }, [fileName, onTextExtracted, setGlobalProcessing, setProcessingMap, addResult, setCurrentExtractedData, markFileProcessed]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsSelecting(false);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Handler to send the displayed image to the classifier endpoint
  const handleSendToClassifier = useCallback(async () => {
    if (!imageRef.current) return;
    // Draw the image to a canvas to get a data URL
    const img = imageRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Canvas context not available");
      return;
    }
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    const imageData = canvas.toDataURL("image/png");

    try {
      toast.loading("Sending image to classifier...", { id: "classifier-process" });
      const result = await sendImageToClassifier(imageData);
      toast.success("Image classified!", { id: "classifier-process" });
      // You can handle the result here, e.g., display it or pass to parent
      console.log("Classifier result:", result);
    } catch (err) {
      toast.error("Failed to classify image", { id: "classifier-process" });
      console.error(err);
    }
  }, []);

  // Helper to extract text from digital documents (PDF, TXT, DOCX)
  const extractTextFromDocument = async (fileUrl: string, fileType: string) => {
    // For PDF: use pdfjs or send to backend for extraction
    // For DOCX/TXT: send to backend for extraction
    // Here, assume you have a backend endpoint /extract-text that returns { text }
    try{
    const blob = await fetch(fileUrl).then(r => r.blob());
    const formData = new FormData();
    formData.append("file", new File([blob], fileName || "document", { type: fileType || blob.type }));
    const res = await axios.post(`${API_BASE_URL}/ocr/extract-full`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    //const data = await res.json();
    return res?.data?.result?.text ?? res?.data?.text ?? "";
    } catch (err) {
      console.error("Text extraction failed:", err);
      throw new Error("Text extraction failed");
    }
  };

  const handleParseDocument = async () => {
    setParsing(true);
    try {
      const text = await extractTextFromDocument(fileUrl, "application/pdf");
      const entities = await parseDocumentText(text);
      onTextExtracted(
        entities.map((ent: any, idx: number) => ({
          id: `${Date.now()}-${idx}`,
          text: ent.word,
          tags: [entityToTag(ent.entity_group)].filter(Boolean),
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          confidence: ent.score,
        }))
      );
      toast.success("Document parsed successfully!");
    } catch (err) {
      console.error("handleParseDocument error:", err);
      toast.error("Failed to parse document.", {
        description: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      setParsing(false);
    }
  };

  // Render logic (image area) — ensure only ONE <img ref={imageRef} ... /> is present
  // Remove the duplicated image and keep a single image element that the handlers reference
  if (fileType.startsWith("image/")) {
    // Image OCR UI
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: mode === 'select' ? "crosshair" : "default", zIndex: 0, pointerEvents: 'auto'}}
      >
        {/* single image element used for all coordinate math */}
        {fileUrl ? (
          <img
            ref={imageRef}
            src={fileUrl}
            alt="Document"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x}px, ${pan.y}px)`,
              transition: "transform 0.2s",
              maxWidth: "100%",
              maxHeight: "100%",
              userSelect: "none",
              pointerEvents: "auto",
              display: 'block'
            }}
            draggable={false}
          />
        ) : (
          <div className="text-muted-foreground">No document loaded</div>
        )}

        {/* Selection overlay: position relative to container using image rect offsets */}
        {selectionDisplay && imageRef.current && containerRef.current && (
          (() => {
            const imgRect = imageRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            const left = imgRect.left - containerRect.left + selectionDisplay.x;
            const top = imgRect.top - containerRect.top + selectionDisplay.y;
            return (
              <div
                className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                style={{
                  left,
                  top,
                  width: selectionDisplay.width,
                  height: selectionDisplay.height,
                }}
              />
            );
          })()
        )}

        {/* toolbar (absolute) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-row gap-2 z-10 pointer-events-auto">
          <Button size="sm" onClick={handleZoomIn} title="Zoom In"><ZoomIn /></Button>
          <Button size="sm" onClick={handleZoomOut} title="Zoom Out"><ZoomOut /></Button>
          {/* <Button size="sm" onClick={handleRotate} title="Rotate Clockwise"><RotateCw /></Button> */}
          {/* <Button size="sm" onClick={handleRotateCounterclockwise} title="Rotate Counterclockwise"><RotateCcw /></Button> */}
          <Button size="sm" onClick={handleReset} title="Reset View"><Maximize /></Button>
          <Button 
            size="sm" 
            variant={!isRegionMode ? 'default' : 'outline'}
            onClick={handleFullScanOCR} 
            disabled={isProcessingOCR || isGlobalProcessing} 
            title={isProcessingOCR || isGlobalProcessing ? "Processing..." : "Full Scan OCR"}
          >
            { (isProcessingOCR || isGlobalProcessing) ? "Processing..." : "Full Scan OCR" }
          </Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setIsRegionMode(!isRegionMode);
              setMode(mode === 'select' ? '' : 'select');
            }}
          >
            <Square className="w-4 h-4 mr-1" />
            Region Scan
          </Button>
        </div>
      </div>
    );
  } else if (fileType === "application/pdf") {
    // PDF preview + Parse button
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <iframe
          src={fileUrl}
          title="PDF Preview"
          style={{ width: "100%", height: "60vh", border: "1px solid #ccc", marginBottom: 16 }}
        />
        <Button onClick={handleParseDocument} disabled={parsing}>
          {parsing ? "Parsing..." : "Parse Document"}
        </Button>
      </div>
    );
  } else if (fileType === "text/plain") {
    // Text file preview + Parse button
    const [textPreview, setTextPreview] = useState<string>("");
    useEffect(() => {
      fetch(fileUrl)
        .then(res => res.text())
        .then(setTextPreview)
        .catch(() => setTextPreview("Failed to load text preview."));
    }, [fileUrl]);
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <pre style={{ width: "100%", maxHeight: 300, overflow: "auto", background: "#f9f9f9", border: "1px solid #ccc", marginBottom: 16 }}>
          {textPreview}
        </pre>
        <Button onClick={handleParseDocument} disabled={parsing}>
          {parsing ? "Parsing..." : "Parse Document"}
        </Button>
      </div>
    );
  } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // DOCX preview not natively supported, show a message + Parse button
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="mb-4 text-muted-foreground">
          DOCX preview not supported. You can still parse the document.
        </div>
        <Button onClick={handleParseDocument} disabled={parsing}>
          {parsing ? "Parsing..." : "Parse Document"}
        </Button>
      </div>
    );
  } else {
    // Unsupported file type
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Unsupported file type.
      </div>
    );
  }
};
