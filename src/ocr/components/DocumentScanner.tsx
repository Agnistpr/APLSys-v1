import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { ImageViewer, entityToTag } from './ImageViewer';
import { OCRPanel } from './OCRPanel';
import { TagsPanel } from './TagsPanel';
import { DocumentUploadOCRPanel } from "./DocumentUploadOCRPanel";
import { MetadataExtractorPanel } from './MetadataExtractorPanel';
import { toast } from 'sonner';
import { parseDocumentText } from "../../api/ocr";
import { useOcrStore } from '../../electron/ocrStore';

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

const DEFAULT_TAGS = [
  // Personal / Identity
  'name', 'full_name', 'first_name', 'last_name', 'middle_name',
  'date_of_birth', 'gender', 'age', 'nationality',
  'address', 'location', 'city', 'country', 'postal_code',
  'phone', 'mobile_number', 'email',
  'id_number', 'passport_number', 'license_number',

  // Professional / Resume
  'skills', 'experience', 'years_of_experience',
  'education', 'degree', 'field_of_study',
  'certifications', 'organization', 'position', 'job_title',
  'achievements', 'projects', 'languages', 'references',

  // Business / Invoice / Receipt
  'invoice_number', 'receipt_number', 'transaction_id',
  'purchase_order', 'vendor_name', 'customer_name',
  'company_name', 'business_name', 'tax_id',
  'subtotal', 'total_amount', 'amount_due', 'amount_paid',
  'discount', 'tax', 'vat_number', 'currency', 'payment_method',
  'issue_date', 'due_date',

  // Financial / Legal
  'account_number', 'bank_name', 'branch_code', 'iban', 'swift_code',
  'balance', 'statement_period', 'policy_number', 'contract_number',
  'signature', 'authorization', 'terms_and_conditions',

  // Misc / Metadata
  'date', 'time', 'document_type', 'reference_number',
  'barcode', 'qrcode', 'website', 'url',
  'notes', 'remarks', 'misc'
];


export const DocumentScanner: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFileUrl, setCurrentFileUrl] = useState<string | null>(null);
  const [currentFileType, setCurrentFileType] = useState<string | null>(null);
  const [currentFileData, setCurrentFileData] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedText[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePanel, setActivePanel] = useState<'viewer' | 'ocr' | 'tags' | 'docupload' >('ocr');
  const [inputText, setInputText] = useState("");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- store selectors ---
  const addFileMeta = useOcrStore(s => s.addFile);
  const addTask = useOcrStore(s => s.addTask);
  const addResult = useOcrStore(s => s.addResult);
  const markFileProcessed = useOcrStore(s => s.markFileProcessed);
  const currentStoredFile = useOcrStore(s => s.currentFile);
  const setCurrentStoredFile = useOcrStore(s => s.setCurrentFile);
  const storedExtractedData = useOcrStore(s => s.currentExtractedData);
  const setStoredExtractedData = useOcrStore(s => s.setCurrentExtractedData);
  const isOcrProcessing = useOcrStore(s => s.isProcessing);
  const setOcrProcessing = useOcrStore(s => s.setProcessing);

  // Load persisted state on mount
  useEffect(() => {
    if (currentStoredFile) {
      setCurrentFile(currentStoredFile.file);
      setCurrentFileUrl(currentStoredFile.url);
      setCurrentFileType(currentStoredFile.type);
    }
    
    if (storedExtractedData) {
      setExtractedData(storedExtractedData);
    }
  }, [currentStoredFile, storedExtractedData]);

  //to delete
  // const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (file) {
  //     if (file.type.startsWith('image/')) {
  //       const url = URL.createObjectURL(file);
  //       setCurrentImage(url);
  //       setExtractedData([]);
  //       toast.success('Document loaded successfully');
  //     } else {
  //       toast.error('Please select a valid image file');
  //     }
  //   }
  // }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      
      // Store File object immediately
      setCurrentFile(file);
      setCurrentFileUrl(url);
      setCurrentFileType(file.type);
      setExtractedData([]);

      // Store in Zustand
      setCurrentStoredFile({
        file,
        url,
        type: file.type,
        name: file.name
      });
      
      toast.success('Document loaded successfully', {
        description: file.name,
        duration: 4000,
      });

      addFileMeta({ name: file.name, type: file.type, url, addedAt: Date.now() });
      addTask({ id: `local-${Date.now()}`, filename: file.name, status: 'pending', createdAt: Date.now() });
    }
  }, [addFileMeta, addTask, setCurrentStoredFile]);

  // ✅ SEPARATE useEffect: Convert File to base64 AFTER currentFile is set
  useEffect(() => {
    if (!currentFile) {
      setCurrentFileData(null);
      return;
    }

    // Only convert once per file
    if (currentFileData) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      setCurrentFileData(base64Data);
      console.log("✅ Base64 data ready for:", currentFile.name);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setCurrentFileData(null);
    };
    
    // ✅ CRITICAL: Pass the File object (not URL)
    reader.readAsDataURL(currentFile);
  }, [currentFile, currentFileData]); // Only run when currentFile changes

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCurrentFile(file);
      setCurrentFileUrl(url);
      setCurrentFileType(file.type);
      setExtractedData([]);
      toast.success('Document loaded successfully', {
        description: file.name,
        duration: 4000,
      });

      // Persist file metadata & create task
      addFileMeta({ name: file.name, type: file.type, url, addedAt: Date.now() });
      addTask({ id: `local-${Date.now()}`, filename: file.name, status: 'pending', createdAt: Date.now() });
    } else {
      toast.error('Please drop a valid file', {
        description: 'Only images and documents are supported',
        duration: 4000,
      });
    }
  }, [addFileMeta, addTask]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleTextExtracted = useCallback(async (newExtraction: ExtractedText | ExtractedText[]) => {
    const blocks = Array.isArray(newExtraction) ? newExtraction : [newExtraction];
    
    // Update local state
    setExtractedData((prev) => [...prev, ...blocks]);
    setActivePanel("ocr");

    // Persist extracted data
    setStoredExtractedData((prev) => [...prev, ...blocks]);
    
    // Update processing state
    setOcrProcessing(false);

    toast.success('Text extracted successfully', {
      description: `${blocks.length} items extracted`,
      duration: 4000,
    });

    // Persist OCR result to store
    const filename = currentFile?.name || `unsaved-${Date.now()}`;
    addResult(filename, { extracted: blocks, timestamp: Date.now() });
    markFileProcessed(filename);
  }, [currentFile, addResult, markFileProcessed, setStoredExtractedData, setOcrProcessing]);

  const handleUpdateExtraction = useCallback((id: string, updates: Partial<ExtractedText>) => {
    setExtractedData(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }, []);

  const handleDeleteExtraction = useCallback((id: string) => {
    setExtractedData(prev => prev.filter(item => item.id !== id));
    toast.success('Extraction deleted', {
      duration: 4000,
    });
  }, []);

  const handleParse = async () => {
    setLoading(true);
    setEntities([]);
    try {
      const result = await parseDocumentText(inputText);
      setEntities(result);
    } catch (err) {
      setEntities([]);
      alert("Failed to parse document.");
    } finally {
      setLoading(false);
    }
  };

  const handleOcrStart = useCallback(() => {
    setOcrProcessing(true);
  }, [setOcrProcessing]);

  const allTags = [...DEFAULT_TAGS, ...customTags];

  const documentData: DocumentData = {
    filename: 'document.jpg',
    extractedData,
    customTags,
    timestamp: new Date().toISOString()
  };

  // Cleanup on unmount
  useEffect(() => {
    // Track any object URLs created by this component so we only revoke those.
    const createdUrlsRef = { current: new Set<string>() };

    // Helper to register created blob URLs when you call URL.createObjectURL in this component.
    // (If you already call URL.createObjectURL elsewhere in this file, call registerCreatedUrl(url) there.)
    const registerCreatedUrl = (url: string | null) => {
      if (typeof url === "string" && url.startsWith("blob:")) {
        createdUrlsRef.current.add(url);
      }
    };

    // Expose the helper in case other handlers in this component need it
    (window as any).__docScanner_registerCreatedUrl = registerCreatedUrl;

    return () => {
      // Revoke only blob URLs that this component actually created
      try {
        createdUrlsRef.current.forEach((u) => {
          try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
        });
      } finally {
        // clean up the temporary global (if set)
        try { delete (window as any).__docScanner_registerCreatedUrl; } catch {}
      }
    };
  }, [currentFileUrl, currentStoredFile]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-surface shadow-soft">
        <div className="max-w-7xl mx-auto px-6 py-6">
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
        {/* Use explicit grid and fixed viewport height so inner flex/min-h-0 works correctly */}
        <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 140px)' }}>
          {/* Left: Image viewer (8 cols) */}
          <div className="col-span-8 flex flex-col min-h-0">
            <div className="bg-surface rounded-lg border border-border shadow-medium flex-1 min-h-0 overflow-hidden">
              {/* Ensure the viewer container fills available space */}
              <div className="image-viewer-container h-full min-h-0 flex items-center justify-center">
                <ImageViewer
                  fileUrl={currentFileUrl}
                  fileType={currentFileType || ""}
                  fileName={currentFile?.name || "untitled"}
                  onTextExtracted={handleTextExtracted}
                  extractedData={extractedData}
                />
              </div>
            </div>
          </div>

          {/* Right: OCR / metadata panel (4 cols) */}
          <div className="col-span-4 flex flex-col min-h-0">
            <div className="bg-surface rounded-lg border border-border shadow-medium flex flex-col h-full min-h-0">
              {/* Panel header (fixed) */}
              <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                {/* keep navigation / tabs here */}
                <div className="grid grid-cols-4 gap-1 bg-muted rounded-lg p-1">
                  {[
                    { id: 'viewer', icon: Eye, label: 'View' },
                    { id: 'ocr', icon: FileText, label: 'OCR' },
                    { id: 'tags', icon: Settings, label: 'Tags' },
                    //{ id: 'export', icon: Download, label: 'Export' },
                    {id: 'docupload', icon: Upload, label: 'Doc Parse'},
                    //{ id: 'batch', icon: Upload, label: 'Batch OCR' },
                    //{id: 'parse', icon: Upload, label: 'Parse'}
                    //{ id: 'metadata', icon: FileText, label: 'Metadata'},
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
              <div className="flex-1 min-h-0">
                <div className="h-full overflow-auto custom-scrollbar p-4">
                  {activePanel === 'viewer' && (
                    <div className="text-center text-muted-foreground">
                      <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        Upload a document to start viewing and extracting text with OCR
                      </p>
                    </div>
                  )}
                  
                  {activePanel === 'ocr' && (
                    <div className="space-y-4 h-full">
                      <OCRPanel
                        extractedData={extractedData}
                        availableTags={allTags}
                        currentFileName={currentFile?.name || "document"}
                        currentFileData={currentFileData}  //Now properly set after delay
                        onUpdateExtraction={handleUpdateExtraction}
                        onDeleteExtraction={handleDeleteExtraction}
                      />
                    </div>
                  )}
                  
                  {activePanel === 'tags' && (
                    <TagsPanel
                      customTags={customTags}
                      defaultTags={DEFAULT_TAGS}
                      onUpdateTags={setCustomTags}
                    />
                  )}
                  
                  {/* {activePanel === 'export' && (
                    <ExportPanel
                      documentData={documentData}
                      hasData={extractedData.length > 0}
                    />
                  )} */}
                  {/* {activePanel === 'batch' && (
                    <BatchOCRPanel />
                  )} */}
                  {activePanel === 'docupload' && (
                    <DocumentUploadOCRPanel />
                  )}
                  {/* {activePanel === 'metadata' && (
                    <MetadataExtractorPanel file={currentFile} fileUrl={currentFileUrl} />
                  )} */}
                  {/* {activePanel === 'parse' && (
                    <GeneralDocumentParser />
                  )} */}
                </div>
              </div>
            
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  </div>
  );
};
