import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Move, 
  Square,
  RotateCcw,
  Maximize,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { ocrFullScan, ocrRegion } from '../../api/ocr';
import { API_BASE_URL, DEV_TEST_URL } from '../../../config';
import type { ExtractedText } from './DocumentScanner';
import axios from "axios";
import { useOcrStore } from '../../electron/ocrStore';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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

//utility for bboxes
function bboxFromRotatedUI(
  sel: SelectionBox,
  rotation: number,
  imgW: number,
  imgH: number
) {
  switch (rotation % 360) {
    case 90:
      return {
        x: sel.y,
        y: imgW - sel.x - sel.width,
        width: sel.height,
        height: sel.width
      };
    case 180:
      return {
        x: imgW - sel.x - sel.width,
        y: imgH - sel.y - sel.height,
        width: sel.width,
        height: sel.height
      };
    case 270:
      return {
        x: imgH - sel.y - sel.height,
        y: sel.x,
        width: sel.height,
        height: sel.width
      };
    default:
      return sel;
  }
}


// Example usage inside your OCR handler (e.g., handleFullScanOCR or performOCR)
const sendImageToClassifier = async (imageDataUrl: string) => {
  const file = dataURLtoFile(imageDataUrl, "image.png");
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(`${DEV_TEST_URL}/parser/parse-document`, formData, {
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
  /**
   * Called when the user finishes a drag-selection and the editor should open.
   * Payload contains a snapshot (dataUrl) of the rotated canvas and an initial px crop
   * along with the preview display size so the caller can size the preview image.
   */
  onOpenCropEditor?: (payload: { dataUrl: string; crop: Crop; previewSize: { width:number; height:number } }) => void;
  /**
   * Register a handler that DocumentScanner can call to ask ImageViewer to perform OCR
   * for a provided crop (px or %). ImageViewer will normalize to displayed pixels and call performOCR().
   */
  registerPerformCrop?: (fn: (crop: Crop, previewSize?: { width:number; height:number } | null) => Promise<void>) => void;
  /**
   * Register a handler so parent can request removal of a persisted bbox.
   * The parent calls the provided function with the Crop (px) and ImageViewer will remove a matching persisted box.
   */
  registerRemovePersisted?: (fn: (crop: Crop) => void) => void;
  /**
   * Called when a persisted region is moved/resized in the main viewer.
   * crop is in displayed px coordinates (unit: 'px').
   */
  onCropChange?: (crop: Crop, previewSize: { width:number; height:number }) => void;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  frozen?: boolean; // <-- NEW: mark boxes frozen after OCR
}

// Update the classification function
export async function classifyTextWithAI(text: string) {
  try {
    const res = await axios.post(`${DEV_TEST_URL}/ai/deepseek-label-extracted-text`, { 
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
  , onOpenCropEditor, registerPerformCrop, registerRemovePersisted
  , onCropChange
 }) => {
  const [isRegionMode, setIsRegionMode] = useState<boolean>(false);
  const [zoom, setZoom] = useState(1);
  // rotation now lives in the global OCR store
  const rotation = useOcrStore(s => s.rotation ?? 0);
  const setRotationStore = useOcrStore(s => s.setRotation);
  // pan is in displayed pixels (applied as CSS translate)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // store pan at the moment a drag starts so we can compute relative movement
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [currentSelection, setCurrentSelection] = useState<SelectionBox | null>(null);
  const [mode, setMode] = useState<'' | 'select'>(''); // Change default to empty string
  const [persistedSelections, setPersistedSelections] = useState<SelectionBox[]>([]); // persist boxes after creation
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [parsing, setParsing] = useState(false);

  const editRef = useRef<{
    index: number | null;
    mode: 'move' | 'resize-se' | null;
    startX: number;
    startY: number;
    origBox?: SelectionBox;
  } | null>(null);

  // --- NEW: ReactCrop integration state ---
  const [crop, setCrop] = useState<Crop | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);

  // NEW: preview size for crop editor (match canvas display dims)
  const [cropPreviewSize, setCropPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const normalizeCropToPx = useCallback((c: Crop | null, imgW: number, imgH: number) : Crop | null => {
    if (!c) return null;
    const unit = (c.unit || 'px') as 'px' | '%';
    if (unit === 'px') return c;
    // convert percent -> px using image displayed dimensions
    const cx = Math.round(((c.x || 0) / 100) * imgW);
    const cy = Math.round(((c.y || 0) / 100) * imgH);
    const cw = Math.max(1, Math.round(((c.width || 0) / 100) * imgW));
    const ch = Math.max(1, Math.round(((c.height || 0) / 100) * imgH));
    return { unit: 'px', x: cx, y: cy, width: cw, height: ch };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null); // offscreen loader
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  // Persist per-file drawn word boxes (keyed by fileUrl or fileName)
  const persistedWordBoxesRef = useRef<Record<string, Array<{ x:number; y:number; width:number; height:number; label?:string }>>>({});
  const isGlobalProcessing = useOcrStore(s => s.isProcessing);
  const setGlobalProcessing = useOcrStore(s => s.setProcessing);
  const processingMap = useOcrStore(s => s.processingMap);
  const setProcessingMap = useOcrStore(s => s.setProcessingMap);

  // Persisted current file (object saved to Zustand) and setter for rotation persistence
  const currentStoredFile = useOcrStore(s => s.currentFile);
  const setCurrentStoredFile = useOcrStore(s => s.setCurrentFile);
  
  // persistence actions
  const addResult = useOcrStore(s => s.addResult);
  const setCurrentExtractedData = useOcrStore(s => s.setCurrentExtractedData);
  const markFileProcessed = useOcrStore(s => s.markFileProcessed);

  // store selection start in displayed (client) pixels relative to image top-left
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selectionDisplay, setSelectionDisplay] = useState<SelectionBox | null>(null);

  // get mapping between displayed canvas size and canvas pixel coordinates
  const displayedToCanvasScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 1, sy: 1, rect: null as DOMRect | null };
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { sx, sy, rect };
  }, []);

  // Helper: convert a ReactCrop crop -> displayed-pixel SelectionBox
  const cropToDisplayedSelection = useCallback((c: Crop | null, imgEl: HTMLImageElement | null): SelectionBox | null => {
    if (!c || !imgEl) return null;
    const unit = (c.unit || 'px') as 'px' | '%';
    const dispW = imgEl.width;
    const dispH = imgEl.height;
    let x = 0, y = 0, width = 0, height = 0;
    if (unit === '%') {
      x = Math.round((Number(c.x || 0) / 100) * dispW);
      y = Math.round((Number(c.y || 0) / 100) * dispH);
      width = Math.round((Number(c.width || 0) / 100) * dispW);
      height = Math.round((Number(c.height || 0) / 100) * dispH);
    } else {
      x = Math.round(Number(c.x || 0));
      y = Math.round(Number(c.y || 0));
      width = Math.max(1, Math.round(Number(c.width || 0)));
      height = Math.max(1, Math.round(Number(c.height || 0)));
    }

    // clamp to image bounds
    x = Math.max(0, Math.min(dispW - 1, x));
    y = Math.max(0, Math.min(dispH - 1, y));
    width = Math.max(1, Math.min(dispW - x, width));
    height = Math.max(1, Math.min(dispH - y, height));
    return { x, y, width, height };
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
      // Use client-side crop (handles rotation) and send cropped PNG to server.
      let text = "";
      let confidence = 0;
      try {
        // --- NEW: scale UI selection -> canvas (rotated) pixels ---
        const { sx, sy } = displayedToCanvasScale();
        const selCanvas = {
          x: Math.max(0, Math.round(selection.x * sx)),
          y: Math.max(0, Math.round(selection.y * sy)),
          width: Math.max(1, Math.round(selection.width * sx)),
          height: Math.max(1, Math.round(selection.height * sy)),
        };

        // Build original (unrotated) image bytes so server can re-orient + crop reliably.
        const origImg = imageRef.current;
        if (!origImg) throw new Error("Original image not available");

        // Remap the selection from the rotated canvas space back to original-image pixel coords
        const bbox = bboxFromRotatedUI(
          selCanvas,
          rotation,
          origImg.naturalWidth,
          origImg.naturalHeight
        );

        // Draw the original image into a canvas and send full image bytes + bbox
        const origCanvas = document.createElement("canvas");
        origCanvas.width = origImg.naturalWidth;
        origCanvas.height = origImg.naturalHeight;
        const origCtx = origCanvas.getContext("2d");
        if (!origCtx) throw new Error("Canvas context not available");
        origCtx.drawImage(origImg, 0, 0, origImg.naturalWidth, origImg.naturalHeight);
        const fullImageData = origCanvas.toDataURL("image/png");

        // Send full image + bbox + UI rotation to server — server will remap/normalize bbox -> original coords
        const resp = await ocrRegion(fullImageData, rotation, bbox);
        text = resp?.text || "";
        confidence = resp?.confidence || 0;

        console.log("UI bbox:", selection);
        console.log("Sent bbox (orig-px):", bbox);
        console.log("Rotation:", rotation);
      } catch (postErr) {
        console.error("performOCR: ocrRegion failed:", postErr);
        text = "";
        confidence = 0;
      }

      if (typeof text === "string" && text.trim()) {
        // Classify region text using the /classify endpoint.
        // If the classifier returns nothing (204) or errors, continue without tags.
        let tags: string[] = [];
        // try {
        //   const payload = { text: String(text || "").trim() };
        //   const r = await axios.post(`${API_BASE_URL}/ai/classify`, payload, { validateStatus: () => true });
        //   if (r.status === 204) {
        //     // no content / rate-limited — leave tags empty
        //     tags = [];
        //     toast(`Warning: No Tags`, {
        //       id: toastId,
        //       description: "Extracted text weren't tagged due to rate limit",
        //       icon: "⚠️",
        //       dismissible: true,
        //       duration: 5000,
        //     });
        //   } else if (r.data) {
        //     const tag = (r.data.tag || r.data || "").toString().trim();
        //     if (tag) tags = [tag];
        //   }
        // } catch (e) {
        //   console.warn("Classifier call failed:", e);
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
      console.error("performOCR: caught error:", err, "stack:", err?.stack);
      // Add delay before showing error toast
      setTimeout(() => {
        toast(`Extracting from ${fileName} failed`, {
          id: toastId,
          description: "Something went wrong. Please try again.",
          icon: "❌",
          dismissible: true,
          duration: 10000,
        });
      }, 1000); // 1 second delay
    } finally {
      setProcessingMap(prev => {
        const updated = { ...(prev || {}) };
        delete updated[processingKey];
        console.log("🔄 performOCR (finally): removing key, updated map =", updated);
        return updated;
      });
      setIsProcessingOCR(false);
      setGlobalProcessing(false);
      toast.dismiss(toastId); // Dismiss the "Processing..." toast
    }
  }, [fileName, onTextExtracted, setGlobalProcessing, setProcessingMap, addResult, setCurrentExtractedData, markFileProcessed, rotation, displayedToCanvasScale]);

  // inverse mapping: original-image -> rotated-canvas coordinates
  function origToRotatedUI(orig: SelectionBox, rotation: number, imgW: number, imgH: number): SelectionBox {
    const r = ((rotation % 360) + 360) % 360;
    switch (r) {
      case 90:
        return {
          x: Math.round(imgW - orig.y - orig.height),
          y: Math.round(orig.x),
          width: Math.round(orig.height),
          height: Math.round(orig.width)
        };
      case 180:
        return {
          x: Math.round(imgW - orig.x - orig.width),
          y: Math.round(imgH - orig.y - orig.height),
          width: Math.round(orig.width),
          height: Math.round(orig.height)
        };
      case 270:
        return {
          x: Math.round(orig.y),
          y: Math.round(imgH - orig.x - orig.width),
          width: Math.round(orig.height),
          height: Math.round(orig.width)
        };
      default:
        return { ...orig };
    }
  }

  function ensureOverlayCanvas() {
    const base = canvasRef.current;
    const container = containerRef.current;
    if (!base || !container) return null;
    let overlay = overlayRef.current;
    if (!overlay) {
      overlay = document.createElement("canvas");
      overlayRef.current = overlay;
      overlay.style.position = "absolute";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "11";
      container.appendChild(overlay);
    }
    // sync pixel dims and visual size/transform to base canvas
    overlay.width = base.width;
    overlay.height = base.height;
    overlay.style.width = base.style.width || `${base.width}px`;
    overlay.style.height = base.style.height || `${base.height}px`;
    overlay.style.transform = (base as HTMLCanvasElement).style.transform || "";
    return overlay;
  }

  // Draw word boxes returned by server. Supports normalized (0..1) bbox or pixel bbox.
  function drawWordBoxes(result: any) {
    try {
      const overlay = ensureOverlayCanvas();
      if (!overlay || !imageRef.current) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Determine coordinate space used by server result:
      // - If result.pages[0].dimensions matches the original image natural size, the bboxes
      //   are relative to the original image and must be remapped to the rotated canvas.
      // - Otherwise assume bboxes are relative to the image bytes we sent (the rotated canvas).
      const canvas = canvasRef.current;
      const origImg = imageRef.current;
      const pages = Array.isArray(result?.pages) ? result.pages : [];
      const pageDim = pages[0]?.dimensions;

      const canvasW = canvas?.width ?? origImg.naturalWidth;
      const canvasH = canvas?.height ?? origImg.naturalHeight;
      const origW = origImg.naturalWidth;
      const origH = origImg.naturalHeight;

      const boxesToPersist: Array<{ x:number; y:number; width:number; height:number; label?:string }> = [];

      const coordSpaceIsOriginal = Array.isArray(pageDim) && pageDim[0] === origW && pageDim[1] === origH;

      pages.forEach((page: any) => {
        (page.blocks || []).forEach((block: any) => {
          (block.lines || []).forEach((line: any) => {
            (line.words || []).forEach((word: any) => {
              const b = word.bbox || word.box || word;
              if (!b) return;

              const isNormalized = [b.x, b.y, b.width, b.height].every((v: number) => typeof v === "number" && v <= 1);

              // Map normalized -> pixels in the coordinate space the bbox is reported in.
              const spaceW = coordSpaceIsOriginal ? origW : canvasW;
              const spaceH = coordSpaceIsOriginal ? origH : canvasH;

              const spaceBox = {
                x: isNormalized ? Math.round(b.x * spaceW) : Math.round(b.x),
                y: isNormalized ? Math.round(b.y * spaceH) : Math.round(b.y),
                width: isNormalized ? Math.max(1, Math.round((b.width || 0) * spaceW)) : Math.max(1, Math.round(b.width || 0)),
                height: isNormalized ? Math.max(1, Math.round((b.height || 0) * spaceH)) : Math.max(1, Math.round(b.height || 0))
              };

              // If bbox is reported relative to the original image, transform to rotated canvas coords:
              const drawBox = coordSpaceIsOriginal
                ? origToRotatedUI(spaceBox, rotation % 360, origW, origH)
                : spaceBox;

              ctx.strokeStyle = "rgba(255,80,80,0.95)";
              ctx.lineWidth = Math.max(1, Math.round(Math.max(1, Math.min(4, overlay.width / 800))));
              ctx.strokeRect(drawBox.x, drawBox.y, drawBox.width, drawBox.height);

              // optional: draw text label (small)
              const label = (word.value || word.text || "").toString().slice(0, 30);
              if (label) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.font = "12px sans-serif";
                const padding = 3;
                const textW = ctx.measureText(label).width + padding * 2;
                ctx.fillRect(drawBox.x, Math.max(0, drawBox.y - 16), textW, 16);
                ctx.fillStyle = "white";
                ctx.fillText(label, drawBox.x + padding, Math.max(0, drawBox.y - 4));
              }

              // collect for persistence
              boxesToPersist.push({
                x: Math.round(drawBox.x),
                y: Math.round(drawBox.y),
                width: Math.round(drawBox.width),
                height: Math.round(drawBox.height),
                label: label || undefined
              });
            });
          });
        });
      });

      // Persist boxes keyed by fileUrl (fallback to fileName)
      const key = fileUrl || fileName || "unsaved";
      if (key) persistedWordBoxesRef.current[key] = boxesToPersist;
    } catch (e) {
      console.warn("drawWordBoxes failed", e);
    }
  }

  // insert helper to redraw persisted boxes for a given key
  function redrawPersistedBoxesForKey(key: string) {
    if (!key) return;
    const overlay = ensureOverlayCanvas();
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const boxes = persistedWordBoxesRef.current[key] || [];
    boxes.forEach(b => {
      ctx.strokeStyle = "rgba(255,80,80,0.95)";
      ctx.lineWidth = Math.max(1, Math.round(Math.max(1, Math.min(4, overlay.width / 800))));
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      if (b.label) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "12px sans-serif";
        const padding = 3;
        const textW = ctx.measureText(b.label).width + padding * 2;
        ctx.fillRect(b.x, Math.max(0, b.y - 16), textW, 16);
        ctx.fillStyle = "white";
        ctx.fillText(b.label, b.x + padding, Math.max(0, b.y - 4));
      }
    });
  }

  // --- NEW helper: crop selection to a PNG dataURL, handles rotation (0/90/180/270) ---
  // New: crop against the main rotated canvas (canvasRef). Canvas already contains the rotated image pixels.
  async function cropSelectionToDataUrl(selection: SelectionBox): Promise<string> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Image canvas not available");
    const { sx, sy, rect } = displayedToCanvasScale();
    if (!rect) throw new Error("Canvas rect missing");

    // Map displayed selection -> canvas pixels
    const x = Math.max(0, Math.round(selection.x * sx));
    const y = Math.max(0, Math.round(selection.y * sy));
    const w = Math.max(1, Math.round(selection.width * sx));
    const h = Math.max(1, Math.round(selection.height * sy));

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("Canvas context not available");
    outCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return out.toDataURL("image/png");
  }

  // map mouse -> displayed canvas local coords (pixels relative to canvas top-left)
  const getImageCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const localX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const localY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    return { x: localX, y: localY };
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleRotate = useCallback(() => {
    const next = (rotation + 90) % 360;
    try { setRotationStore(next); } catch (e) { /* ignore */ }
  }, [rotation, setRotationStore]);
   
  const handleRotateCounterclockwise = useCallback(() => {
    const next = (rotation - 90 + 360) % 360;
    try { setRotationStore(next); } catch (e) { /* ignore */ }
  }, [rotation, setRotationStore]);


  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCurrentSelection(null);
  }, []);

   // Begin editing (move) when overlay is pressed
  const handlePersistedMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const imgRect = canvasRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    // If this persisted selection is frozen (sent to OCR), do not allow edits
    if (persistedSelections[idx]?.frozen) {
      toast?.("This region has been scanned and is locked", { duration: 2000, dismissible: true });
      return;
    }
    editRef.current = { index: idx, mode: 'move', startX: e.clientX, startY: e.clientY, origBox: { ...persistedSelections[idx] } };
    // attach global listeners
    const onMove = (ev: MouseEvent) => {
      if (!editRef.current) return;
      const dX = ev.clientX - editRef.current.startX;
      const dY = ev.clientY - editRef.current.startY;
      const orig = editRef.current.origBox!;
      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const maxW = Math.round(canvasRect.width);
      const maxH = Math.round(canvasRect.height);
      const nx = Math.max(0, Math.min(maxW - orig.width, Math.round(orig.x + dX)));
      const ny = Math.max(0, Math.min(maxH - orig.height, Math.round(orig.y  + dY)));
      setPersistedSelections(prev => {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], x: nx, y: ny };
        return copy;
      });
      // notify crop panel
      const previewSize = { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) };
      onCropChange?.({ unit: 'px', x: nx, y: ny, width: persistedSelections[idx].width, height: persistedSelections[idx].height }, previewSize);
    };
    const onUp = () => { editRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [persistedSelections, onCropChange]);

  // Resize (bottom-right corner) handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (persistedSelections[idx]?.frozen) {
      toast?.("This region has been scanned and is locked", { duration: 2000, dismissible: true });
      return;
    }
    editRef.current = { index: idx, mode: 'resize-se', startX: e.clientX, startY: e.clientY, origBox: { ...persistedSelections[idx] } };
    const onMove = (ev: MouseEvent) => {
      if (!editRef.current) return;
      const dX = ev.clientX - editRef.current.startX;
      const dY = ev.clientY - editRef.current.startY;
      const orig = editRef.current.origBox!;
      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const maxW = Math.round(canvasRect.width);
      const maxH = Math.round(canvasRect.height);
      const nw = Math.max(10, Math.min(maxW - orig.x, Math.round(orig.width + dX)));
      const nh = Math.max(10, Math.min(maxH - orig.y, Math.round(orig.height + dY)));
      setPersistedSelections(prev => {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], width: nw, height: nh };
        return copy;
      });
      // notify crop panel
      const previewSize = { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) };
      onCropChange?.({ unit: 'px', x: persistedSelections[idx].x, y: persistedSelections[idx].y, width: nw, height: nh }, previewSize);
    };
    const onUp = () => { editRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [persistedSelections, onCropChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgRect = canvas.getBoundingClientRect();
    const { left, top, width, height } = imgRect;

    // If in select mode, begin a region selection
    if (mode === 'select') {
      // Guard: prevent starting a new region selection while another scan is running
      if (isProcessingOCR || isGlobalProcessing) {
        toast("A scan is already in progress. Please wait for it to finish before selecting a new region.", {
          id: "scan-lock",
          description: "Current scan is running",
          duration: 3000,
          icon: "⏳",
        });
        return;
      }
       // start coordinates relative to visible canvas top-left
       const startX = Math.max(0, Math.min(e.clientX - left, width));
       const startY = Math.max(0, Math.min(e.clientY - top, height));

       selectionStartRef.current = { x: startX, y: startY };
       setSelectionDisplay({ x: startX, y: startY, width: 0, height: 0 });
       setIsSelecting(true);
       return;
     }

    // Otherwise start dragging (panning) the canvas view
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    panStartRef.current = { x: pan.x, y: pan.y };
  }, [mode, pan.x, pan.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // dragging (panning)
    if (isDragging && panStartRef.current) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      // NOTE: invert the sign so dragging follows cursor (user moves mouse right -> image moves right)
      setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
      return;
    }

    // selection: use the visible canvas rect (not the offscreen image) so coords match display
    if (!isSelecting || !canvasRef.current || !selectionStartRef.current) return;
    const imgRect = canvasRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - imgRect.left, imgRect.width));
    const curY = Math.max(0, Math.min(e.clientY - imgRect.top, imgRect.height));
    const s = selectionStartRef.current;
    const x = Math.min(s.x, curX);
    const y = Math.min(s.y, curY);
    const w = Math.abs(curX - s.x);
    const h = Math.abs(curY - s.y);
    setSelectionDisplay({ x, y, width: w, height: h });
  }, [isDragging, dragStart.x, dragStart.y, zoom, isSelecting]);

  // Wheel zoom: only when cursor is inside the visible canvas; zoom around cursor point
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = canvas.getBoundingClientRect();
    e.preventDefault();
    e.stopPropagation();
    // ignore wheel if cursor is outside canvas
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const step = 1.1;
    const factor = e.deltaY > 0 ? 1 / step : step;

    // Use functional updates to avoid stale state
    setZoom((prevZoom) => {
      const prev = prevZoom;
      const next = Math.max(0.1, Math.min(5, prev * factor));

      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Derivation:
      // screenX = (imgX + pan) * scale
      // imgX_prev = cx / prev - pan.x
      // newPan = pan + cx*(1/next - 1/prev)
      setPan((prevPan) => {
        const newX = prevPan.x + cx * (1 / next - 1 / prev);
        const newY = prevPan.y + cy * (1 / next - 1 / prev);

        // optional clamping so the image doesn't completely escape the viewport
        const displayedWidth = rect.width * (next / prev);
        const displayedHeight = rect.height * (next / prev);
        const containerRect = container.getBoundingClientRect();
        const margin = 20;
        const minX = Math.min(margin, containerRect.width - displayedWidth - margin);
        const maxX = Math.max(-margin, margin);
        const minY = Math.min(margin, containerRect.height - displayedHeight - margin);
        const maxY = Math.max(-margin, margin);

        const clampedX = Math.max(minX, Math.min(maxX, newX));
        const clampedY = Math.max(minY, Math.min(maxY, newY));
        return { x: clampedX, y: clampedY };
      });

      return next;
    });
  }, []);

  // Attach a native non-passive wheel listener to ensure preventDefault works across browsers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nativeHandler = (ev: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    el.addEventListener('wheel', nativeHandler, { passive: false });
    return () => el.removeEventListener('wheel', nativeHandler);
  }, []);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    // finish dragging if active
    if (isDragging) {
      setIsDragging(false);
      panStartRef.current = null;
    }
 
    if (!isSelecting) return;
    setIsSelecting(false);
 
    // Instead of calling performOCR directly, open the ReactCrop editor for adjustment.
    if (selectionDisplay && selectionDisplay.width > 5 && selectionDisplay.height > 5 && canvasRef.current) {
       // capture selection and notify host (DocumentScanner) to open the side-panel crop editor
       const sel = { ...selectionDisplay };
       try {
         const canvas = canvasRef.current;
         const dataUrl = canvas.toDataURL("image/png");
         const rect = canvas.getBoundingClientRect();
         const previewSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
         // Prepare a px crop that matches displayed canvas coordinates
         const initialCrop: Crop = {
           unit: 'px',
           x: sel.x,
           y: sel.y,
           width: sel.width,
           height: sel.height
         };

        // Persist the selection so it stays visible and editable on the main canvas
        setPersistedSelections(prev => [...prev, { ...sel, frozen: false }]);
        
        // Notify parent immediately so the crop panel shows the same region preview
        if (typeof onCropChange === 'function') {
          onCropChange(initialCrop, previewSize);
        }

         // Notify parent so it can show the crop UI in the side panel (no modal here)
         if (typeof onOpenCropEditor === 'function') {
           onOpenCropEditor({ dataUrl, crop: initialCrop, previewSize });
         } else {
           // fallback: keep internal state (shouldn't normally happen)
           setCropPreviewSize(previewSize);
           setCropImageUrl(dataUrl);
           setCrop(initialCrop);
         }
       } catch (err) {
         console.warn("Failed to open crop editor:", err);
       }
    }
 
    // clear transient selection
    selectionStartRef.current = null;
    setSelectionDisplay(null);
  }, [isDragging, isSelecting, selectionDisplay, onOpenCropEditor, onCropChange]);

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
      // Use the already-prepared rotated canvas (canvasRef) for full scan (it contains the rotated image at natural pixels)
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not ready");
      const imageData = canvas.toDataURL("image/png");
      const result = await ocrFullScan(imageData);
      console.log("OCR result:", result);

      // draw per-word boxes if server returned bboxes
      try {
        drawWordBoxes(result);
      } catch (e) {
        console.warn("Failed to draw OCR boxes:", e);
      }

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
      
      // ✅ Add delay before success toast (so it doesn't overlap with "Processing Full scan...")
      setTimeout(() => {
        toast(`${fileName} extracted successfully.`, {
          id: toastId,
          description: `${items.length} lines extracted. You may now return to the scanner tab to look at the results`,
          icon: "✅",
          dismissible: true,
          duration: 10000,
        });
      }, 1000);
    } catch (error) {
      console.error("Full Scan OCR Error:", error);
      
      // ✅ Add delay before error toast
      setTimeout(() => {
        toast(`Extracting from ${fileName} failed`, {
          id: toastId,
          description: "Something went wrong. Please try again.",
          icon: "❌",
          dismissible: true,
          duration: 10000,
        });
      }, 1000);
    } finally {
      setProcessingMap(prev => {
        const updated = { ...(prev || {}) };
        delete updated[processingKey];
        return updated;
      });
      setIsProcessingOCR(false);
      setGlobalProcessing(false);
      toast.dismiss(toastId); // Dismiss "Processing Full scan..." toast
    }
  }, [fileName, onTextExtracted, setGlobalProcessing, setProcessingMap, addResult, setCurrentExtractedData, markFileProcessed]);

  // User action: send the current crop to OCR (explicit button)
  // keep the internal handler around but the UI will be hosted by DocumentScanner.
  // Register a handler so DocumentScanner can ask ImageViewer to run OCR for a given crop.
  useEffect(() => {
    if (typeof registerPerformCrop !== 'function') return;
    const handler = async (c: Crop, previewSize?: { width:number; height:number } | null) => {
      const processingKey = `scanner:${fileName}`;
      // mark global/store processing so Sidebar shows spinner
      try { setGlobalProcessing(true); } catch (e) { /* noop */ }
      setProcessingMap(prev => ({ ...(prev || {}), [processingKey]: true }));
       // This handler crops the rotated canvas to a PNG and sends the PNG to the server via ocrRegion.
       try {
         // Normalize crop -> displayed px selection
         let norm: Crop = c;
         if (c.unit === '%' && previewSize) {
          norm = {
            unit: 'px',
            x: Math.round((c.x || 0) * previewSize.width / 100),
            y: Math.round((c.y || 0) * previewSize.height / 100),
            width: Math.max(1, Math.round((c.width || 0) * previewSize.width / 100)),
            height: Math.max(1, Math.round((c.height || 0) * previewSize.height / 100))
          };
        }
        const selection: SelectionBox = {
          x: Math.max(0, Math.round(norm.x || 0)),
          y: Math.max(0, Math.round(norm.y || 0)),
          width: Math.max(1, Math.round(norm.width || 1)),
          height: Math.max(1, Math.round(norm.height || 1))
        };

        // Create cropped PNG from rotated canvas (canvasRef already contains rotated image)
        const dataUrl = await cropSelectionToDataUrl(selection);

        // Persist the cropped preview into the global store so Crop tab / OCRPanel can read it even if the side panel is closed
        try {
          useOcrStore.setState({ currentCropDataUrl: dataUrl });
        } catch (e) {
          console.warn("Failed to persist crop preview to store:", e);
        }
        // Keep a local copy too (optional UI usage)
        setCropImageUrl(dataUrl);

        // Send cropped PNG to server using ocrRegion (rotation = 0 because canvas is already rotated)
        setIsProcessingOCR(true);
        const toastId = `ocr-region-${Date.now()}`;
        toast("Scanning cropped image...", { id: toastId, duration: 10000, dismissible: true});
        const resp = await ocrRegion(dataUrl, 0, undefined);
        const text = resp?.text || "";
        const confidence = resp?.confidence || 0;

        if (text && text.trim()) {
          // optional: try to classify tags (reuse existing classifier logic)
          let tags: string[] = [];
          // try {
          //   const payload = { text: String(text || "").trim() };
          //   const r = await axios.post(`${API_BASE_URL}/ai/classify`, payload, { validateStatus: () => true });
          //   if (r.status === 204) {
          //     tags = [];
          //   } else if (r.data) {
          //     const tag = (r.data.tag || r.data || "").toString().trim();
          //     if (tag) tags = [tag];
          //   }
          // } catch (e) {
          //   tags = [];
          // }

          const extractedItems = [{
            id: Date.now().toString(),
            text: String(text).trim(),
            bbox: selection,
            tags,
            confidence: typeof confidence === "number" ? confidence : undefined
          }];

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
          } catch (err) {
            console.warn("Failed to persist region OCR result:", err);
          }

          onTextExtracted(extractedItems);
          toast.success("Region OCR complete", { id: toastId });
        } else {
          toast(`No text found in region`, { id: toastId, duration: 4000, icon: "⚠️", dismissible: true });
        }
       } catch (err) {
         console.error("performCrop handler failed:", err);
         toast.error("Region OCR failed");
         throw err;
       } finally {
         setIsProcessingOCR(false);
         // clear processing map / global flag so Sidebar spinner clears
         setProcessingMap(prev => {
           const updated = { ...(prev || {}) };
           delete updated[processingKey];
           return updated;
         });
         try { setGlobalProcessing(false); } catch (e) { /* noop */ }
       }
     };
     registerPerformCrop(handler);
   }, [registerPerformCrop, performOCR]);

  useEffect(() => {
    const key = fileUrl || fileName || 'unsaved';
    try {
      const s = useOcrStore.getState();
      const vs = s.viewerState?.[key];
      if (vs) {
        if (typeof vs.zoom === 'number') setZoom(vs.zoom);
        if (vs.pan) setPan(vs.pan);
        if (Array.isArray(vs.persistedSelections)) setPersistedSelections(vs.persistedSelections);
      }
    } catch (e) {
      // noop
    }
  }, [fileUrl, fileName]);
  
  useEffect(() => {
    const key = fileUrl || fileName || 'unsaved';
    try {
      const s = useOcrStore.getState();
      const existing = s.viewerState || {};
      existing[key] = { ...(existing[key] || {}), zoom, pan, persistedSelections };
      useOcrStore.setState({ viewerState: existing });
    } catch (e) {
      // noop
    }
  }, [zoom, pan, persistedSelections, fileUrl, fileName]);

  // Register removal handler so parent can request deletion of a persisted selection
  useEffect(() => {
    if (typeof registerRemovePersisted !== 'function') return;
    const remover = (c: Crop) => {
      try {
        // normalize px crop if unit is '%' (defensive)
        let rx = Math.round(c.x || 0), ry = Math.round(c.y || 0), rw = Math.max(1, Math.round(c.width || 1)), rh = Math.max(1, Math.round(c.height || 1));
        if (c.unit === '%') {
          // best-effort: map % to current canvas display size
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            rx = Math.round(((c.x || 0) / 100) * rect.width);
            ry = Math.round(((c.y || 0) / 100) * rect.height);
            rw = Math.max(1, Math.round(((c.width || 0) / 100) * rect.width));
            rh = Math.max(1, Math.round(((c.height || 0) / 100) * rect.height));
          }
        }

        setPersistedSelections(prev => {
          // remove the first persisted box that matches coordinates (allow small tolerance)
          const tol = 2;
          const idx = prev.findIndex(p => Math.abs(p.x - rx) <= tol && Math.abs(p.y - ry) <= tol && Math.abs(p.width - rw) <= tol && Math.abs(p.height - rh) <= tol);
          if (idx === -1) return prev;
          const copy = prev.slice();
          copy.splice(idx, 1);
          return copy;
        });
      } catch (err) {
        console.warn("removePersisted handler failed", err);
      }
    };
    registerRemovePersisted(remover);
  }, [registerRemovePersisted, setPersistedSelections, canvasRef]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsSelecting(false);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Reset zoom/pan/selection when a new file is loaded — rotation is managed in the store
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCurrentSelection(null);
    setSelectionDisplay(null);

    // Clear persisted region boxes when the current file is cleared/removed
    if (!fileUrl) {
      setPersistedSelections([]);
    }
  }, [fileUrl]);

  // Draw rotated image into canvasRef at natural pixels when fileUrl/rotation changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear when no file
    if (!fileUrl) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.width = "0px";
      canvas.style.height = "0px";
      imageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    imageRef.current = img;
    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const angle = ((rotation % 360) + 360) % 360;
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Set canvas pixel dims according to rotation
      if (angle === 90 || angle === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      switch (angle) {
        case 90:
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
          break;
        case 180:
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate(Math.PI);
          break;
        case 270:
          ctx.translate(0, canvas.height);
          ctx.rotate((3 * Math.PI) / 2);
          break;
        default:
          break;
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();

      // Fit canvas visually in container (keep natural pixels in canvas.width/height)
      const container = containerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        const maxW = cRect.width * 0.85;
        const scale = Math.min(1, maxW / canvas.width);
        canvas.style.width = `${Math.round(canvas.width * scale)}px`;
        canvas.style.height = `${Math.round(canvas.height * scale)}px`;
      } else {
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
      }
    };

    img.onerror = (e) => {
      console.error("Image load error:", e, fileUrl);
    };

    img.src = fileUrl;
    return () => {
      cancelled = true;
      imageRef.current = null;
    };
  }, [fileUrl, rotation, zoom]);

  useEffect(() => {
   // if there's no file, remove all persisted boxes and clear overlay
   if (!fileUrl) {
     persistedWordBoxesRef.current = {};
     const overlay = overlayRef.current;
     if (overlay) {
       const ctx = overlay.getContext("2d");
       if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
     }
     return;
   }

   // redraw persisted boxes for this file (if present)
   const key = fileUrl || fileName || "unsaved";
   if (persistedWordBoxesRef.current[key]) {
     redrawPersistedBoxesForKey(key);
   }
 }, [fileUrl, fileName, rotation, zoom]);

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
    const res = await axios.post(`${DEV_TEST_URL}/ocr/extract-full`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    //const data = await res.json();
    return res?.data?.result?.text ?? res?.data?.text ?? "";
    } catch (err) {
      console.error("Text extraction failed:", err);
      throw new Error("Text extraction failed");
    }
  };

  const handleSaveUploadedFile = useCallback(async () => {
    if (!fileUrl) {
      toast.error("No file to save");
      return;
    }

    try {
      toast.loading("Saving file to documents...", { id: "save-file" });

      // Fetch the file and convert to base64
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = async (e) => {
        const base64Data = (e.target?.result as string).split(',')[1]; // Extract base64 part
        
        const result = await window.fileAPI.saveUploadedFile({
          fileName: fileName,
          base64Data: base64Data
        });

        if (result.success) {
          toast.success("File saved to documents", {
            id: "save-file",
            description: `${fileName} has been saved`,
            duration: 4000
          });
        } else {
          toast.error("Failed to save file", {
            id: "save-file",
            description: result.error || "Unknown error"
          });
        }
      };

      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to save uploaded file:", err);
      toast.error("Failed to save file", {
        id: "save-file",
        description: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }, [fileUrl, fileName]);

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
        onWheel={handleWheel}
        style={{ cursor: mode === 'select' ? "crosshair" : "default", zIndex: 0, pointerEvents: 'auto', overscrollBehavior: 'contain'}}
      >
        {/* single image element used for all coordinate math */}
        {fileUrl ? (
          <canvas
            ref={canvasRef}
            style={{
              // apply zoom via CSS transform so displayed rect changes and mapping to canvas pixels remains correct
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: "transform 0.05s",
              display: 'block',
              cursor: mode === 'select' ? 'crosshair' : 'grab'
            }}
            draggable={false}
          />
        ) : (
          <div className="text-muted-foreground">No document loaded</div>
        )}

        {/* Selection overlay: position relative to container using canvas rect offsets */}
        {selectionDisplay && canvasRef.current && containerRef.current && (
          (() => {
            const imgRect = canvasRef.current.getBoundingClientRect();
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

        {/* Persisted selection overlays (remain visible after OCR) */}
        {persistedSelections && persistedSelections.length > 0 && canvasRef.current && containerRef.current && (
          persistedSelections.map((sel, i) => {
            const imgRect = canvasRef.current!.getBoundingClientRect();
            const containerRect = containerRef.current!.getBoundingClientRect();
            const left = imgRect.left - containerRect.left + sel.x;
            const top = imgRect.top - containerRect.top + sel.y;
            const style = {
              position: "absolute" as const,
              left: `${left}px`,
              top: `${top}px`,
              width: `${sel.width}px`,
              height: `${sel.height}px`,
              border: "2px dashed rgba(0,120,215,0.9)",
              background: "rgba(0,120,215,0.06)",
              pointerEvents: "auto" as const,
              zIndex: 12,
              boxSizing: 'border-box' as const,
              touchAction: 'none' as const,
            };
            return (
              <div key={`persisted-${i}`} style={style}
                   onMouseDown={(ev) => handlePersistedMouseDown(ev, i)}
              >
                {/* bottom-right handle */}
                <div
                  onMouseDown={(ev) => handleResizeMouseDown(ev, i)}
                  style={{
                    position: 'absolute',
                    right: -6,
                    bottom: -6,
                    width: 12,
                    height: 12,
                    background: 'white',
                    border: '2px solid rgba(0,120,215,0.9)',
                    borderRadius: 2,
                    cursor: 'se-resize'
                  }}
                />
              </div>
            );
          })
        )}

        {/* NOTE: crop editor UI is hosted in DocumentScanner side panel.
            ImageViewer only emits onOpenCropEditor and registers a performCrop handler. */}

        {/* toolbar (absolute) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-row gap-2 z-10 pointer-events-auto">
          <Button size="sm" onClick={handleZoomIn} title="Zoom In"><ZoomIn /></Button>
          <Button size="sm" onClick={handleZoomOut} title="Zoom Out"><ZoomOut /></Button>
          <Button size="sm" onClick={handleRotateCounterclockwise} title="Rotate Left"><RotateCcw /></Button>
          <Button size="sm" onClick={handleRotate} title="Rotate Right"><RotateCw /></Button>
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
            disabled={isProcessingOCR || isGlobalProcessing}
            onClick={() => {
              if (isProcessingOCR || isGlobalProcessing) return;
              setIsRegionMode(!isRegionMode);
              setMode(mode === 'select' ? '' : 'select');
            }}
            title={isProcessingOCR || isGlobalProcessing ? "Processing..." : (mode === 'select' ? "Exit Region Scan" : "Region Scan")}
           >
             <Square className="w-4 h-4 mr-1" />
             Region Scan
           </Button>
        </div>
      </div>
    );
  } else if (!fileType) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No file loaded.
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Unsupported file type. Upload only Images (PNGs/JPGs)
      </div>
    );
  }
};