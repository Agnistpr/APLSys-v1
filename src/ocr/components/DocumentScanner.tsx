import React, { useState, useRef, useCallback } from 'react';
import { Card } from '@/ocr/components/ui/card';
import { Button } from '@/ocr/components/ui/button';
import { Badge } from '@/ocr/components/ui/badge';
import { 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Move, 
  Square,
  FileText,
  Download,
  Settings,
  Eye
} from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { OCRPanel } from './OCRPanel';
import { TagsPanel } from './TagsPanel';
import { ExportPanel } from './ExportPanel';
import { toast } from 'sonner';
// import '../ocr.generated.css';

export interface ExtractedText {
  id: string;
  text: string; //Paul Jonas
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tags: string[];
  confidence?: number;
}

export interface DocumentData {
  filename: string;
  extractedData: ExtractedText[];
  customTags: string[];
  timestamp: string;
}

const DEFAULT_TAGS = ['name', 'phone','address', 'skills', 'email','experience', 'education'];

export const DocumentScanner: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedText[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePanel, setActivePanel] = useState<'viewer' | 'ocr' | 'tags' | 'export'>('viewer');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setCurrentImage(url);
        setExtractedData([]);
        toast.success('Document loaded successfully');
      } else {
        toast.error('Please select a valid image file');
      }
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setCurrentImage(url);
      setExtractedData([]);
      toast.success('Document loaded successfully');
    } else {
      toast.error('Please drop a valid image file');
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleTextExtracted = useCallback(async (newExtraction: ExtractedText | ExtractedText[]) => {
    const blocks = Array.isArray(newExtraction) ? newExtraction : [newExtraction];

    try {
      const results: ExtractedText[] = [];

      for (const block of blocks) {
        const response = await fetch("http://localhost:8000/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: block.text }), // match backend schema
        });

        const data = await response.json();

        // Backend returns: { entities: [...] }
        const tags = data.entities.map((ent: any) => ent.entity.toLowerCase());

        results.push({
          ...block,
          tags,
        });
      }

      setExtractedData((prev) => [...prev, ...results]);
      setActivePanel("ocr");
      toast.success("Text extracted and tagged successfully");
    } catch (err) {
      console.error(err);
      setExtractedData((prev) => [...prev, ...blocks]);
      toast.error("Text extracted, but tagging failed");
    }
  }, []);

  const handleUpdateExtraction = useCallback((id: string, updates: Partial<ExtractedText>) => {
    setExtractedData(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }, []);

  const handleDeleteExtraction = useCallback((id: string) => {
    setExtractedData(prev => prev.filter(item => item.id !== id));
    toast.success('Extraction deleted');
  }, []);

  const allTags = [...DEFAULT_TAGS, ...customTags];

  const documentData: DocumentData = {
    filename: 'document.jpg',
    extractedData,
    customTags,
    timestamp: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-surface shadow-soft">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">DocScanner</h1>
                <p className="text-sm text-muted-foreground">APLSys Intelligent Scanner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-success-soft text-success-foreground">
                {extractedData.length} Extractions
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="bg-surface-dark hover:bg-muted"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          {/* Main Content */}
          <div className="col-span-8">
            <Card className="h-full bg-surface border-border shadow-medium">
              {currentImage ? (
                <ImageViewer
                  imageUrl={currentImage}
                  onTextExtracted={handleTextExtracted}
                  extractedData={extractedData}
                />
              ) : (
                <div
                  className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-lg bg-viewer-bg"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="w-16 h-16 bg-primary-soft rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Upload Document to Start
                  </h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Drag and drop your document here or click the upload button to begin OCR processing
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-primary hover:bg-primary-hover"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Document
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Side Panel */}
          <div className="col-span-4">
            <Card className="h-full bg-surface border-border shadow-medium">
              {/* Panel Navigation */}
              <div className="border-b border-border p-4">
                <div className="grid grid-cols-4 gap-1 bg-muted rounded-lg p-1">
                  {[
                    { id: 'viewer', icon: Eye, label: 'View' },
                    { id: 'ocr', icon: FileText, label: 'OCR' },
                    { id: 'tags', icon: Settings, label: 'Tags' },
                    { id: 'export', icon: Download, label: 'Export' }
                  ].map(({ id, icon: Icon, label }) => (
                    <Button
                      key={id}
                      variant={activePanel === id ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActivePanel(id as any)}
                      className={`h-8 text-xs ${
                        activePanel === id 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-3 h-3 mr-1" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Panel Content */}
              <div className="p-4 h-[calc(100%-80px)] overflow-auto custom-scrollbar">
                {activePanel === 'viewer' && (
                  <div className="text-center text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      Upload a document to start viewing and extracting text with OCR
                    </p>
                  </div>
                )}
                
                {activePanel === 'ocr' && (
                  <OCRPanel
                    extractedData={extractedData}
                    availableTags={allTags}
                    onUpdateExtraction={handleUpdateExtraction}
                    onDeleteExtraction={handleDeleteExtraction}
                  />
                )}
                
                {activePanel === 'tags' && (
                  <TagsPanel
                    customTags={customTags}
                    defaultTags={DEFAULT_TAGS}
                    onUpdateTags={setCustomTags}
                  />
                )}
                
                {activePanel === 'export' && (
                  <ExportPanel
                    documentData={documentData}
                    hasData={extractedData.length > 0}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
};