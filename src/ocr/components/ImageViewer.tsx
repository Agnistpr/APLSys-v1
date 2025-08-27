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
import Tesseract from 'tesseract.js';
import type { ExtractedText } from './DocumentScanner';
import { classifyText } from '@/ocr/lib/ner';


//Mapping function for NER entity to tag
function entityToTag(entity: String): string | null
{
  if (entity.endsWith('NAME') || entity.endsWith('B-PER') || entity.endsWith('I-PER')) return 'name';
  if (entity.endsWith('PHONE')) return 'phone';
  if (entity.endsWith('EMAIL')) return 'email';
  if (entity.endsWith('EDUCATION') || entity.endsWith('B-ORG') || entity.endsWith('I-ORG')) return 'education';
  //TO ADD: address, skills, experience
  if (entity.endsWith('B-LOC') || entity.endsWith('I-LOC')) return 'address';
  return null;
}


interface ImageViewerProps {
  imageUrl: string;
  onTextExtracted: (extraction: ExtractedText | ExtractedText[]) => void;
  extractedData: ExtractedText[];
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
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
  const [mode, setMode] = useState<'pan' | 'select'>('pan');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

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
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [mode, pan, getImageCoords]);

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
    } else if (isDragging && mode === 'pan') {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
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
    toast.loading('Processing full scan OCR...', { id: 'ocr-process' });

    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

      const imageData = canvas.toDataURL('image/png');
      const { data: { text, confidence } } = await Tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(m)
      });

      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      const extractions: ExtractedText[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let tags: string[] = [];
        try {
          const nerResult = await classifyText(line);
          tags = nerResult.entities
            .map((ent: any) => entityToTag(ent.entity))
            .filter((tag: string | null) => tag !== null);
        } catch (e) {
          tags = [];
        }

        extractions.push({
          id: `${Date.now()}-${i}`,
          text: line,
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          tags,
          confidence: Math.round(confidence)
        });
      }

      if (extractions.length > 0) {
        onTextExtracted(extractions);
        toast.success('Full scan OCR completed', { id: 'ocr-process' });
      } else {
        toast.error('No text found in image', { id: 'ocr-process' });
      }
    } catch (error) {
      console.error('Full Scan OCR Error:', error);
      toast.error('Failed to process full scan OCR', { id: 'ocr-process' });
    } finally {
      setIsProcessingOCR(false);
      setCurrentSelection(null);
    }
  }, [onTextExtracted]);

  const performOCR = useCallback(async (selection: SelectionBox) => {
    if (!imageRef.current) return;

    setIsProcessingOCR(true);
    toast.loading('Processing OCR...', { id: 'ocr-process' });

    try {
      const img = imageRef.current;
      const { gapX, gapY, dispWpre, dispHpre } = getPreTransformMetrics();

      // map selection (wrapper-pre coords) -> image-pre coords
      const selXpre = selection.x - gapX;
      const selYpre = selection.y - gapY;

      // scale factors from pre-transform display -> natural pixels
      const scaleX = img.naturalWidth  / dispWpre;
      const scaleY = img.naturalHeight / dispHpre;

      const sx = selXpre * scaleX;
      const sy = selYpre * scaleY;
      const sw = selection.width  * scaleX;
      const sh = selection.height * scaleY;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/png');
      const { data: { text, confidence } } = await Tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(m)
      });

      if (text.trim()) {
        let tags: string[] = [];
        try {
          const nerResult = await classifyText(text.trim());
          tags = nerResult.entities
            .map((ent: any) => entityToTag(ent.entity))
            .filter((tag: string | null) => tag !== null) as string[];
        } catch { tags = []; }

        onTextExtracted({
          id: Date.now().toString(),
          text: text.trim(),
          bbox: selection,  // keep wrapper-pre coords for drawing
          tags,
          confidence: Math.round(confidence)
        });
        toast.success('Text extracted successfully', { id: 'ocr-process' });
      } else {
        toast.error('No text found in selected area', { id: 'ocr-process' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process OCR', { id: 'ocr-process' });
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

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-dark">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'pan' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('pan')}
            className={mode === 'pan' ? 'bg-primary text-primary-foreground' : ''}
          >
            <Move className="w-4 h-4 mr-1" />
            Pan
          </Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('select')}
            className={mode === 'select' ? 'bg-primary text-primary-foreground' : ''}
          >
            <Square className="w-4 h-4 mr-1" />
            Select
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullScanOCR}
            className="ml-2"
          >
            <Square className="w-4 h-4 mr-1" />
            Full Scan OCR
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          {/* <Button variant="outline" size="sm" onClick={handleRotateCounterclockwise}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate}>
            <RotateCw className="w-4 h-4" />
          </Button> */}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="overflow-hidden relative bg-viewer-bg cursor-crosshair h-[600px] w-[800px] flex-none"
        style={{ cursor: mode === 'pan' ? 'grab' : 'crosshair' }}
      >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: 'center',
          transition: isDragging || isSelecting ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Document"
          className="select-none"
          style={{
            width: 'auto',
            height: '100%',
            maxWidth: 'none',
            cursor: mode === 'pan' ? 'grab' : 'crosshair',
            transition: isDragging || isSelecting ? 'none' : 'transform 0.2s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          draggable={false}
        />

        {/* Selection overlay — now inside the transformed wrapper */}
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

        {/* Existing extractions */}
        {extractedData.map((extraction) => (
          <div
            key={extraction.id}
            className="absolute border border-success bg-success/20 pointer-events-none"
            style={{
              left: extraction.bbox.x,
              top: extraction.bbox.y,
              width: extraction.bbox.width,
              height: extraction.bbox.height
            }}
          />
        ))}
      </div>

        {/* Processing overlay */}
        {isProcessingOCR && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="bg-surface rounded-lg p-6 shadow-strong text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Processing OCR...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};