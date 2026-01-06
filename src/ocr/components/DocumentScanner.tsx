import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { useOcrStore } from '../../electron/ocrStore';
import ReactCrop, { Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { cropCanvasPreview } from '../lib/cropcanvaspreview';

export interface ExtractedText {
  id: string;
  text: string;
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
  const [activePanel, setActivePanel] = useState<'viewer' | 'ocr' | 'tags' | 'docupload' | 'crop' >('ocr');
  const [inputText, setInputText] = useState("");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadWarning, setShowUploadWarning] = useState(false); // <<< NEW
  const [pendingFile, setPendingFile] = useState<File | null>(null); // <<< NEW
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Crop panel state
  const [cropPanelPayload, setCropPanelPayload] = useState<{ dataUrl: string; crop: Crop; previewSize: { width:number; height:number } } | null>(null);
  const performCropHandlerRef = useRef<null | ((crop: Crop, previewSize?: { width:number;height:number }|null) => Promise<void> )>(null);
  const performRemoveHandlerRef = useRef<null | ((crop: Crop) => void)>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // expose the currently-rendered crop preview (data URL) so OCRPanel can save it
  const [currentCropDataUrl, setCurrentCropDataUrl] = useState<string | null>(null);
 
  // --- store selectors ---
  const addFileMeta = useOcrStore(s => s.addFile);
  const addTask = useOcrStore(s => s.addTask);
  const addResult = useOcrStore(s => s.addResult);
  const markFileProcessed = useOcrStore(s => s.markFileProcessed);
  const currentStoredFile = useOcrStore(s => s.currentFile);
  const setCurrentStoredFile = useOcrStore(s => s.setCurrentFile);
  const setRotationStore = useOcrStore(s => s.setRotation);
  const storedExtractedData = useOcrStore(s => s.currentExtractedData);
  const setStoredExtractedData = useOcrStore(s => s.setCurrentExtractedData);
  const isOcrProcessing = useOcrStore(s => s.isProcessing);
  const setOcrProcessing = useOcrStore(s => s.setProcessing);
  const selectedFolder = useOcrStore(s => s.selectedFolder);
  const processingMap = useOcrStore(s => s.processingMap);

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

    // restore persisted crop preview (if any)
    try {
      const persistedCrop = useOcrStore.getState().currentCropDataUrl;
      if (persistedCrop) setCurrentCropDataUrl(persistedCrop);
    } catch (e) {
      // noop
    }
  }, [currentStoredFile, storedExtractedData]);

  // Persist current crop preview dataURL into store
  useEffect(() => {
    try {
      useOcrStore.setState({ currentCropDataUrl });
    } catch (e) {
      // noop
    }
  }, [currentCropDataUrl]);
  
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

  // ✅ NEW: Handle confirmed file upload
  const handleConfirmUpload = useCallback((file: File) => {
    if (currentFileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentFileUrl);
    }

    const url = URL.createObjectURL(file);

    // Store File object immediately
    setCurrentFile(file);
    setCurrentFileUrl(url);
    setCurrentFileType(file.type);
    setExtractedData([]); // ✅ Clear extracted data
    setCustomTags([]); // ✅ Clear custom tags
    setActivePanel("ocr"); // Reset panel

    // Read file to data URL so other components can save the original file later
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result);
        setCurrentFileData(dataUrl); // ensure local state is set
        // Also persist into the global stored-file so other components (OCRPanel) can read it immediately
        try {
          setCurrentStoredFile({
            file,
            url,
            type: file.type,
            name: file.name,
            data: dataUrl,            // <-- add data field
            dataUrl
          });
        } catch (e) {
          console.warn("Failed to update stored file with dataUrl:", e);
        }
      } catch (e) {
        console.warn("Failed to set currentFileData:", e);
      }
    };
    reader.onerror = (e) => {
      console.warn("Failed to read file as dataURL:", e);
    };
    reader.readAsDataURL(file);
 
    // Store in Zustand
    // keep initial minimal stored file (will be updated with data in reader.onload)
    setCurrentStoredFile({
      file,
      url,
      type: file.type,
      name: file.name
    });
    // Reset rotation for newly uploaded file
    try { setRotationStore(0); } catch (e) { /* noop */ }

    // Clear store's extracted data
    setStoredExtractedData([]); // ✅ NEW

    toast.success('Document loaded successfully', {
      description: file.name,
      duration: 4000,
    });

    addFileMeta({ name: file.name, type: file.type, url, addedAt: Date.now() });
    addTask({ id: `local-${Date.now()}`, filename: file.name, status: 'pending', createdAt: Date.now() });

    // Close modal and reset pending
    setShowUploadWarning(false);
    setPendingFile(null);
  }, [currentFileUrl, setCurrentStoredFile, setStoredExtractedData, addFileMeta, addTask]);

  // ✅ NEW: Handle file upload click (show warning if file exists)
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // If there's already a file or extracted data, show warning
    if (currentFile || extractedData.length > 0) {
      setPendingFile(file);
      setShowUploadWarning(true);
      // Reset file input so user can select the same file again if they cancel
      event.target.value = '';
    } else {
      // No existing file, proceed directly
      handleConfirmUpload(file);
      // ✅ Reset input after upload succeeds
      event.target.value = '';
    }
  }, [currentFile, extractedData.length, handleConfirmUpload]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    // If there's already a file or extracted data, show warning
    if (currentFile || extractedData.length > 0) {
      setPendingFile(file);
      setShowUploadWarning(true);
    } else {
      // No existing file, proceed directly
      handleConfirmUpload(file);
    }
  }, [currentFile, extractedData.length, handleConfirmUpload]);

  // --- file handling logic ---
  const handleClearFile = useCallback(() => {
    // Revoke blob URL if it exists
    if (currentFileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentFileUrl);
    }
    
    // Clear all file and extracted data state
    setCurrentFile(null);
    setCurrentFileUrl(null);
    setCurrentFileType(null);
    setCurrentFileData(null);
    setExtractedData([]); // This is key
    setCustomTags([]); // Also clear custom tags
    setActivePanel("ocr"); // Reset to OCR panel

    // Clear crop preview (explicit when file cleared)
    setCurrentCropDataUrl(null);
    try { useOcrStore.setState({ currentCropDataUrl: null }); } catch (e) { /* noop */ }
    
    // Clear stored file and extracted data from Zustand store
    setCurrentStoredFile(null);
    setStoredExtractedData([]); // explicitly clear store's extracted data
    // Reset global rotation when file is cleared
    try { setRotationStore(0); } catch (e) { /* noop */ }
    
    // ✅ NEW: Reset file input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    toast.success('File cleared', {
      description: 'Document has been removed',
      duration: 3000,
    });
  }, [currentFileUrl, setCurrentStoredFile, setStoredExtractedData]);

  const handleTextExtracted = useCallback(async (newExtraction: ExtractedText | ExtractedText[]) => {
    const blocks = Array.isArray(newExtraction) ? newExtraction : [newExtraction];

    // Append new blocks to current extracted data (don't replace) so multiple region scans on same image accumulate
    setExtractedData(prev => {
      const combined = [...(prev || []), ...blocks];

      // Persist combined into store and docs immediately
      try {
        setStoredExtractedData(combined);
        const filename = currentFile?.name || `unsaved-${Date.now()}`;
        const resultPayload = {
          filename,
          extractedData: combined,
          customTags: [],
          timestamp: new Date().toISOString()
        };
        // addResult expects the result object
        addResult(resultPayload);
        markFileProcessed(filename);
      } catch (err) {
        console.warn("Failed to persist appended OCR result:", err);
      }

      return combined;
    });

    setActivePanel("ocr");
    // Update processing flag
    setOcrProcessing(false);
  }, [currentFile, addResult, markFileProcessed, setStoredExtractedData]);

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

  const handleSaveUploadedFile = useCallback(async () => {
    if (!currentFile || !currentFile.name) {
      toast.error("No file to save");
      return;
    }

    try {
      toast.loading("Saving file to documents...", { id: "save-file" });

      // Save file to default documents folder first
      const response = await window.fileAPI.saveUploadedFile({
        fileName: currentFile.name,
        base64Data: currentFileData?.split(",")[1] // Remove data: prefix
      });

      if (response.success && selectedFolder) {
        // Move/copy file to user-selected folder
        const moveResult = await window.fileAPI.moveFileToFolder(response.path, selectedFolder);
        if (moveResult.success) {
          toast.success("File moved to selected folder", {
            id: "save-file",
            description: `${currentFile.name} has been moved`,
            duration: 4000
          });
        } else {
          toast.error("Failed to move file", {
            id: "save-file",
            description: moveResult.error || "Unknown error"
          });
        }
      } else if (response.success) {
        toast.success("File saved to documents", {
          id: "save-file",
          description: `${currentFile.name} has been saved`,
          duration: 4000
        });
      } else {
        toast.error("Failed to save file", {
          id: "save-file",
          description: response.error || "Unknown error"
        });
      }
    } catch (err) {
      toast.error("Failed to save/move file", {
        id: "save-file",
        description: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }, [currentFile, currentFileData, selectedFolder]);
  
  // NEW: Save current crop preview to documents / selectedFolder
  const handleSaveCrop = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      toast.error("No preview available to save");
      return;
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const baseName = (currentFile && currentFile.name) ? currentFile.name.replace(/\.[^/.]+$/, "") : "crop";
      // Mark cropped images clearly and include timestamp to avoid collisions
      const fileName = `${baseName}_CROPPED_${Date.now()}.png`;

      toast.loading("Saving cropped image...", { id: "save-crop" });

      const res = await window.fileAPI.saveUploadedFile({ fileName, base64Data: base64 });
      if (!res || !res.success) {
        toast.error("Failed to save cropped image", { id: "save-crop", description: res?.error || "Unknown error" });
        return;
      }

      // If user has selected a folder, move the saved file there
      if (selectedFolder) {
        const mv = await window.fileAPI.moveFileToFolder(res.path, selectedFolder);
        if (mv && mv.success) {
          toast.success("Cropped image saved to selected folder", {
            id: "save-crop",
            description: `${fileName} -> ${selectedFolder}`,
            duration: 4000
          });
        } else {
          toast.error("Saved but failed to move to folder", {
            id: "save-crop",
            description: mv?.error || "Move failed"
          });
        }
      } else {
        toast.success("Cropped image saved to documents", {
          id: "save-crop",
          description: fileName,
          duration: 4000
        });
      }
    } catch (err) {
      console.error("Save crop failed:", err);
      toast.error("Saving cropped image failed", { id: "save-crop", description: String(err) });
    }
  }, [previewCanvasRef, currentFile, selectedFolder]);

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
      // only run when DocumentScanner unmounts, not on every dependency change
        // Revoke and clear any blob URLs created this session
      try {
        const setRef = createdUrlsRef && createdUrlsRef.current;
        if (setRef && typeof setRef.forEach === "function") {
          setRef.forEach((u: string) => {
            try { URL.revokeObjectURL(u); } catch { /* ignore */ }
          });
          setRef.clear();
        }
      } catch (e) {
        console.warn("Failed to revoke created blob URLs:", e);
      } finally {
        delete (window as any).__docScanner_registerCreatedUrl;
      }
    };
  }, []);

  useEffect(() => {
    if (!cropPanelPayload || !previewImgRef.current || !previewCanvasRef.current) return;
    const imgEl = previewImgRef.current;
    const canvasEl = previewCanvasRef.current;
    const payload = cropPanelPayload;
    // --- Normalize crop to PixelCrop ---
    const crop = payload.crop;
    const previewSize = payload.previewSize;

    const pixelCrop: PixelCrop = (crop.unit === '%' ? {
      unit: 'px',
      x: Math.round((crop.x || 0) * previewSize.width / 100),
      y: Math.round((crop.y || 0) * previewSize.height / 100),
      width: Math.max(1, Math.round((crop.width || 0) * previewSize.width / 100)),
      height: Math.max(1, Math.round((crop.height || 0) * previewSize.height / 100)),
    } : {
      unit: 'px',
      x: Math.round(crop.x || 0),
      y: Math.round(crop.y || 0),
      width: Math.max(1, Math.round(crop.width || 0)),
      height: Math.max(1, Math.round(crop.height || 0)),
    });

    // Set canvas size to match the bbox
    canvasEl.style.width = `${pixelCrop.width}px`;
    canvasEl.style.height = `${pixelCrop.height}px`;

    // Ensure image is loaded
    const draw = async () => {
      if (!imgEl.complete) {
        await new Promise<void>((res) => {
          imgEl.onload = () => res();
          imgEl.onerror = () => res();
        });
      }

      // Draw the crop
      cropCanvasPreview(imgEl, canvasEl, pixelCrop, 1, 0);
      // update data url after preview draw so children (OCRPanel) can save cropped image
      try {
        setCurrentCropDataUrl(canvasEl.toDataURL("image/png"));
      } catch (e) {
        console.warn("Failed to read preview canvas dataURL:", e);
        setCurrentCropDataUrl(null);
      }
    };

    draw();
  }, [cropPanelPayload]);
 
  // When crop panel is closed / cleared, clear the preview data URL (UNUSED YET)
  // useEffect(() => {
  //   if (!cropPanelPayload) setCurrentCropDataUrl(null);
  //   // also clear persisted store crop preview
  //   if (!cropPanelPayload) {
  //     try { useOcrStore.setState({ currentCropDataUrl: null }); } catch (e) { /* noop */ }
  //   }
  // }, [cropPanelPayload]);

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/*NEW: Upload Warning Modal */}
      {showUploadWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md mx-auto border border-border">
            <h2 className="text-lg font-bold text-foreground mb-2">Upload New File?</h2>
            <p className="text-muted-foreground mb-6">
              Uploading a new file will clear your currently uploaded document and all extracted text data. 
              {extractedData.length > 0 && ` You have ${extractedData.length} extraction(s) that will be lost.`}
            </p>
            <p className="text-sm text-muted-foreground mb-6 font-semibold">
              Do you want to continue?
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadWarning(false);
                  setPendingFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  //Close modal immediately
                  setShowUploadWarning(false);
                  setPendingFile(null);
                  
                  // Then process the upload
                  if (pendingFile) {
                    // Small delay to ensure modal closes before upload logic runs
                    setTimeout(() => {
                      handleConfirmUpload(pendingFile);
                    }, 0);
                  }
                }}
              >
                Upload & Clear
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-sm text-muted-foreground">APLSys Scanner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentFile && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearFile}
                  title="Clear current file and extractions"
                >
                  ✕ Clear File
                </Button>
              )}
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
                  onOpenCropEditor={({ dataUrl, crop, previewSize }) => {
                    setCropPanelPayload({ dataUrl, crop, previewSize });
                    setActivePanel('crop');
                  }}
                  registerPerformCrop={(fn) => {
                    performCropHandlerRef.current = fn;
                  }}
                  registerRemovePersisted={(fn) => {
                    performRemoveHandlerRef.current = fn;
                    console.debug('[DocumentScanner] removePersisted handler registered');
                  }}
                  onCropChange={(crop, previewSize) => {
                    // update current payload's crop so preview refreshes as the user moves/resizes in viewer
                    setCropPanelPayload(prev => prev ? { ...prev, crop } : prev);
                  }}
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
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {[
                    //{ id: 'viewer', icon: Eye, label: 'View' },
                    { id: 'ocr', icon: FileText, label: 'OCR' },
                    { id: 'tags', icon: Settings, label: 'Tags' },
                    //{ id: 'export', icon: Download, label: 'Export' },
                    //{id: 'docupload', icon: Upload, label: 'Doc Parse'},
                    //{ id: 'batch', icon: Upload, label: 'Batch OCR' },
                    //{id: 'parse', icon: Upload, label: 'Parse'}
                    //{ id: 'metadata', icon: FileText, label: 'Metadata'},
                    { id: 'crop', icon: Settings, label: 'Crop' },
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
                        currentCropData={currentCropDataUrl}
                        onUpdateExtraction={handleUpdateExtraction}
                        onDeleteExtraction={handleDeleteExtraction}
                        onClearFile={handleClearFile} // <<< pass clear handler
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
                  
                  {activePanel === 'crop' && (
                    <div className="space-y-4">
                      {!cropPanelPayload && (
                        <div className="text-sm text-muted-foreground">
                          Create a region in the viewer to edit here.
                        </div>
                      )}
                      {cropPanelPayload && (
                        <div className="flex flex-col gap-3">
                          <div className="text-sm text-muted-foreground">
                            Preview of the selected region.
                          </div>

                          {/* Cropped region preview only */}
                          <div className="flex justify-center items-start gap-3 overflow-auto bg-black p-2">
                            <div style={{ position: 'relative' }}>
                              {/* Hidden but sized snapshot image used as source for cropCanvasPreview.
                                  Use offscreen positioning so image.width / image.naturalWidth are correct. */}
                              <img
                                ref={previewImgRef}
                                src={cropPanelPayload.dataUrl}
                                alt="crop-snapshot"
                                style={{
                                  position: 'absolute',
                                  left: -9999,
                                  top: -9999,
                                  width: `${cropPanelPayload.previewSize.width}px`,
                                  height: `${cropPanelPayload.previewSize.height}px`,
                                  objectFit: 'contain',
                                }}
                              />

                              <div className="flex flex-col items-center" style={{ minWidth: 10 }}>
                                <div className="text-xs text-muted-foreground mb-2">
                                  Crop Preview
                                </div>
                                <canvas
                                  ref={previewCanvasRef}
                                  style={{
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    objectFit: 'contain',
                                    display: 'block',
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-2 justify-end mt-3">
                            <Button variant="outline" onClick={() => {
                              // remove corresponding bbox in ImageViewer (if registered)
                              if (cropPanelPayload && typeof performRemoveHandlerRef.current === 'function') {
                                try { performRemoveHandlerRef.current(cropPanelPayload.crop); } catch (e) { console.warn("removePersisted call failed", e); }
                              }
                              setCropPanelPayload(null);
                            }}>Close</Button>

                            {/* NEW: Save the preview crop to Documents / selected folder */}
                            {/* <Button variant="ghost" onClick={async () => {
                              if (!previewCanvasRef.current) {
                                toast.error("No preview available");
                                return;
                              }
                              await handleSaveCrop();
                            }}>
                              Save Crop
                            </Button> */}

                             <Button
                               onClick={async () => {
                                 if (!cropPanelPayload) return;
                                 const handler = performCropHandlerRef.current;
                                 if (typeof handler !== 'function') {
                                   console.error('[DocumentScanner] performCrop handler missing or invalid:', handler);
                                   toast.error("Crop handler not available");
                                   return;
                                 }
                                 try {
                                   await handler(cropPanelPayload.crop, cropPanelPayload.previewSize);
                                   // close panel after sending
                                   setCropPanelPayload(null);
                                   setActivePanel('ocr');
                                 } catch (err) {
                                   console.error('[DocumentScanner] performCrop call failed:', err);
                                   toast.error("Region OCR failed");
                                 }
                               }}
                                disabled={ isOcrProcessing || (processingMap && Object.keys(processingMap || {}).length > 0) }
                                title={ (isOcrProcessing || (processingMap && Object.keys(processingMap || {}).length > 0)) ? "OCR in progress" : "Scan Cropped Area" }
                             >
                               Scan Cropped Area
                             </Button>
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            
          </div>
        </div>
      </div>

      {/* Hidden file input */} {/*application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,text/plain"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  </div>
  );
};