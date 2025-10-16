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
import type { ExtractedText } from './DocumentScanner';
import axios from "axios";

//Mapping function for NER entity to tag
export function entityToTag(entity: string): string | null {
  if (!entity) return null;
  const e = entity.toUpperCase();
  if (e === 'PER' || e === 'PERSON' || e.endsWith('NAME')) return 'name';
  if (e === 'ORG' || e === 'ORGANIZATION') return 'organization';
  if (e === 'LOC' || e === 'LOCATION' || e === 'ADDRESS') return 'location';
  if (e === 'MISC') return 'misc';
  if (e === 'EMAIL') return 'email';
  if (e === 'PHONE') return 'phone';
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

  const response = await axios.post("http://localhost:8000/parser/parse-document", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
};

interface ImageViewerProps {
  //imageUrl: string;
  fileUrl: string;
  fileType: string;
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
  const res = await axios.post("http://localhost:8000/parser/parse-document", { text });
  return res.data.entities;
}

export async function classifyTextWithAI(text: string) {
  const res = await axios.post("http://localhost:8000/ai/gemini-label-extracted-text", { text });
  return res.data;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  fileUrl,
  fileType,
  onTextExtracted,
  extractedData
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [currentSelection, setCurrentSelection] = useState<SelectionBox | null>(null);
  const [mode, setMode] = useState<'' | 'select'>('select');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [parsing, setParsing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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
    if (!imageRef.current) return;

    const { x, y } = getImageCoords(e);

    if (mode === 'select') {
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setCurrentSelection({ x, y, width: 0, height: 0 });
    } else {
      setIsDragging(false);
      //setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [mode, getImageCoords]);// pan,

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!imageRef.current) return;

    const { x: currentX, y: currentY } = getImageCoords(e);

    if (isSelecting && mode === 'select') {
      const width = currentX - selectionStart.x;
      const height = currentY - selectionStart.y;

      setCurrentSelection({
        x: width >= 0 ? selectionStart.x : currentX,
        y: height >= 0 ? selectionStart.y : currentY,
        width: Math.abs(width),
        height: Math.abs(height),
      });
    } 
    // else if (isDragging) { // && mode === 'pan'
    //   setPan({
    //     x: e.clientX - dragStart.x,
    //     y: e.clientY - dragStart.y,
    //   });
    // }
  }, [isSelecting, isDragging, mode, selectionStart, dragStart, getImageCoords]);

  const handleMouseUp = useCallback(async () => {
    if (isSelecting && currentSelection && currentSelection.width > 10 && currentSelection.height > 10) {
      // Perform OCR on selected area
      await performOCR(currentSelection);
    }
    
    setIsSelecting(false);
    setIsDragging(false);
  }, [isSelecting, currentSelection]);

  const handleFullScanOCR = useCallback(async () => {
  if (!imageRef.current) return;

  setIsProcessingOCR(true);
  toast.loading("Processing full scan OCR...", { id: "ocr-process" });

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
    let text = "";
    if (result.pages) {
      text = result.pages
        .map(page =>
          page.blocks
            .map(block =>
              block.lines
                .map(line =>
                  line.words.map(word => word.value).join(" ")
                ).join("\n")
            ).join("\n")
        ).join("\n\n");
      console.log("Extracted text for Gemini:", text);
    }
    if (!text.trim()) {
      toast.error("No text found in image", { id: "ocr-process" });
      return;
    }

    // Use Gemini to label the full extracted text
    const geminiResult = await classifyTextWithAI(text);
    // Assume geminiResult has a structure like { tags: [...], ... }
    // If it returns a flat object, convert to array for extraction display
    let extractions: ExtractedText[] = [];
    if (Array.isArray(geminiResult)) {
      extractions = geminiResult.map((item: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        text: item.text || item.word || "",
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        tags: (item.entities || item.tags || [])
          .map((ent: any) => typeof ent === "string" ? entityToTag(ent) : entityToTag(ent.entity || ent.tag || ent.key))
          .filter(Boolean),
        confidence: item.confidence || undefined,
      }));
    } else if (geminiResult && typeof geminiResult === "object" && Array.isArray(geminiResult.entities)) {
      extractions = geminiResult.entities.map((ent: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        text: ent.text || ent.word || "",
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        tags: [entityToTag(ent.entity || ent.tag || ent.key)].filter(Boolean),
        confidence: ent.confidence || undefined,
      }));
    } else if (geminiResult && typeof geminiResult === "object") {
      extractions = Object.entries(geminiResult)
        .filter(([_, value]) => typeof value === "string" && value.trim() !== "")
        .map(([key, value], i) => ({
          id: `${Date.now()}-${i}`,
          text: String(value),
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          tags: [entityToTag(key)].filter(Boolean),
          confidence: undefined,
        }));
    }

    if (extractions.length > 0) {
      onTextExtracted(extractions);
      toast.success("Full scan OCR completed", { id: "ocr-process" });
    } else {
      toast.error("No text found in image", { id: "ocr-process" });
    }
  } catch (error) {
    console.error("Full Scan OCR Error:", error);
    toast.error("Failed to process full scan OCR", { id: "ocr-process" });
  } finally {
    setIsProcessingOCR(false);
    setCurrentSelection(null);
  }
}, [onTextExtracted]);

  const performOCR = useCallback(async (selection: SelectionBox) => {
  if (!imageRef.current) return;

  setIsProcessingOCR(true);
  toast.loading("Processing OCR...", { id: "ocr-process" });

  try {
    const img = imageRef.current;
    const { gapX, gapY, dispWpre, dispHpre } = getPreTransformMetrics();

    const selXpre = selection.x - gapX;
    const selYpre = selection.y - gapY;

    const scaleX = img.naturalWidth / dispWpre;
    const scaleY = img.naturalHeight / dispHpre;

    const sx = selXpre * scaleX;
    const sy = selYpre * scaleY;
    const sw = selection.width * scaleX;
    const sh = selection.height * scaleY;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");

    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    const { text, confidence } = await ocrRegion(imageData);

    if (typeof text === "string" && text.trim()) {
      // Use Gemini to label the region text
      let tags: string[] = [];
      try {
        const geminiResult = await classifyTextWithAI(text.trim());
        if (geminiResult && geminiResult.tags) {
          tags = (geminiResult.entities || []);
        } else if (Array.isArray(geminiResult)) {
          tags = geminiResult.map((item: any) => item.tag || item.key || "").filter(Boolean);
        } else if (typeof geminiResult === "object") {
          tags = Object.entries(geminiResult)
            .filter(([_, value]) => typeof value === "string" && value.trim() !== "")
            .map(([key]) => key);
        }
      } catch {
        tags = [];
      }

      onTextExtracted({
        id: Date.now().toString(),
        text: text.trim(),
        bbox: selection,
        tags,
        confidence: Math.round(confidence),
      });
      toast.success("Text extracted successfully", { id: "ocr-process" });
    } else {
      toast.error("No text found in selected area", { id: "ocr-process" });
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to process OCR", { id: "ocr-process" });
  } finally {
    setIsProcessingOCR(false);
    setCurrentSelection(null);
  }
}, [onTextExtracted, zoom]);

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
    const formData = new FormData();
    formData.append("file", await fetch(fileUrl).then(r => r.blob()), "document");
    const res = await fetch("http://localhost:8000/extract-text", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.text;
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
      toast.error("Failed to parse document.");
    } finally {
      setParsing(false);
    }
  };

  // Render logic
  if (fileType.startsWith("image/")) {
    // Image OCR UI
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: mode === 'select' ? "crosshair" : "default"}}
      >
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
          }}
          draggable={false}
        />
        {/* Selection overlay */}
        {currentSelection && mode === 'select' && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
            style={{
              left: currentSelection.x,
              top: currentSelection.y,
              width: currentSelection.width,
              height: currentSelection.height,
            }}
          />
        )}
        {/* ...OCR image controls... */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-row gap-2 z-10">
          <Button size="sm" onClick={handleZoomIn} title="Zoom In"><ZoomIn /></Button>
          <Button size="sm" onClick={handleZoomOut} title="Zoom Out"><ZoomOut /></Button>
          <Button size="sm" onClick={handleRotate} title="Rotate Clockwise"><RotateCw /></Button>
          <Button size="sm" onClick={handleRotateCounterclockwise} title="Rotate Counterclockwise"><RotateCcw /></Button>
          <Button size="sm" onClick={handleReset} title="Reset View"><Maximize /></Button>
          <Button size="sm" onClick={handleFullScanOCR} disabled={isProcessingOCR} title="Full Scan OCR">Full Scan OCR</Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode(mode === 'select' ? '' : 'select')}
            className={mode === 'select' ? 'bg-primary text-primary-foreground' : ''}
          >
            <Square className="w-4 h-4 mr-1" />
            Select
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
