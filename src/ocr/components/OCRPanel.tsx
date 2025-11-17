import React, { useState } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { Card } from '@/ocr/components/ui/card';
import { Badge } from '@/ocr/components/ui/badge';
import { Textarea } from '@/ocr/components/ui/textarea';
import { 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Tag,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ChevronDown
} from 'lucide-react';
import type { ExtractedText } from './DocumentScanner';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import Select from 'react-select';
import { useOcrStore } from '../../electron/ocrStore';
interface OCRPanelProps {
  extractedData: ExtractedText[];
  availableTags: string[];
  currentFileName?: string;
  currentFileData?: string;
  onUpdateExtraction: (id: string, updates: Partial<ExtractedText>) => void;
  onDeleteExtraction: (id: string) => void;
}

export const OCRPanel: React.FC<OCRPanelProps> = ({
  extractedData,
  availableTags,
  currentFileName = "document",
  currentFileData,
  onUpdateExtraction,
  onDeleteExtraction
}) => {
  // ✅ Guard: ensure extractedData is always an array
  const safeExtractedData = Array.isArray(extractedData) ? extractedData : [];
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [visibleExtractions, setVisibleExtractions] = useState<Set<string>>(
    new Set(safeExtractedData.map(item => item.id))
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');

  // Helper to convert base64 to Blob
  const base64ToBlob = (base64: string) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  // Combined handler: save metadata JSON + original file to documents
  const handleSaveToDocuments = async () => {
    // use safeExtractedData (guarded) instead of raw prop
    if (safeExtractedData.length === 0) {
      toast.error("No data to save");
      return;
    }

    try {
      toast.loading("Saving to documents...", { id: "save-docs" });

      // 1. Save metadata JSON
      if (window.fileAPI?.writeFile) {
        const metadata = {
          extractedData: safeExtractedData,
          exported_at: new Date().toISOString(),
        };
        const metadataFileName = `${currentFileName}.json`;
        const jsonContent = JSON.stringify(metadata, null, 2);

        await window.fileAPI.writeFile(`ocr_results/${metadataFileName}`, jsonContent);
        console.log("✅ Metadata saved:", metadataFileName);
      }

      // 2. Save original file (robustly handle different shapes)
      let fileSaved = false;

      // Try prop first, then fall back to store
      const fileDataRaw = currentFileData ?? useOcrStore.getState().currentFileData;

      console.log("DEBUG fileDataRaw type:", typeof fileDataRaw, fileDataRaw);

      // Helper to actually call saveUploadedFile with a base64 payload (no data: prefix)
      const callSave = async (maybeBase64: string) => {
        if (!maybeBase64) return false;
        const base64Part = maybeBase64.includes(",") ? maybeBase64.split(",")[1] : maybeBase64;
        const result = await window.fileAPI.saveUploadedFile({
          fileName: currentFileName,
          base64Data: base64Part
        });
        return result?.success === true;
      };

      if (!window.fileAPI?.saveUploadedFile) {
        console.warn("⚠️ window.fileAPI.saveUploadedFile not available");
      } else if (typeof fileDataRaw === "string") {
        // string could be data:<mime>;base64,AAAA... or raw base64
        try {
          fileSaved = await callSave(fileDataRaw);
          if (!fileSaved) console.warn("⚠️ saveUploadedFile returned falsy for string input");
        } catch (err) {
          console.warn("⚠️ saveUploadedFile error for string input:", err);
        }
      } else if (fileDataRaw && typeof fileDataRaw === "object") {
        // possible shapes: { data: 'data:...base64,...' } or { base64: 'AAA...' }
        const maybe = (fileDataRaw.data || fileDataRaw.base64 || fileDataRaw.content) as any;
        if (typeof maybe === "string") {
          try {
            fileSaved = await callSave(maybe);
            if (!fileSaved) console.warn("⚠️ saveUploadedFile returned falsy for object.data input");
          } catch (err) {
            console.warn("⚠️ saveUploadedFile error for object.data input:", err);
          }
        } else if (fileDataRaw instanceof Blob || fileDataRaw instanceof File) {
          // convert Blob/File -> base64 then save
          try {
            const reader = new FileReader();
            const base64Str: string = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(fileDataRaw as Blob);
            });
            fileSaved = await callSave(base64Str);
          } catch (err) {
            console.warn("⚠️ Error converting Blob/File to base64:", err);
          }
        } else {
          // unexpected object shape — log for debugging
          console.warn("⚠️ Unexpected fileDataRaw shape:", fileDataRaw);
        }
      } else {
        console.warn("⚠️ fileData missing or not usable:", typeof fileDataRaw);
      }

      toast.success("Saved to Documents", {
        id: "save-docs",
        description: fileSaved
          ? `${currentFileName}.json + ${currentFileName}`
          : `${currentFileName}.json only (file data unavailable)`,
        duration: 4000,
      });

    } catch (err) {
      console.error("Failed to save:", err);
      toast.error("Failed to save", {
        id: "save-docs",
        description: err instanceof Error ? err.message : "Unknown error"
      });
    }
  };

  const handleStartEdit = (item: ExtractedText) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      onUpdateExtraction(editingId, { text: editText });
      setEditingId(null);
      setEditText('');
      toast.success('Text updated');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleToggleTag = (itemId: string, tag: string) => {
    const item = extractedData.find(item => item.id === itemId);
    if (item) {
      const newTags = item.tags.includes(tag)
        ? item.tags.filter(t => t !== tag)
        : [...item.tags, tag];
      onUpdateExtraction(itemId, { tags: newTags });
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Text copied to clipboard');
  };

  const toggleVisibility = (id: string) => {
    const newVisible = new Set(visibleExtractions);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleExtractions(newVisible);
  };

  if (safeExtractedData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No extractions yet. Use OCR to extract text from your document.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="sticky top-0 bg-background z-10 p-4 border-b flex flex-col">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Extracted Text</h3>
            <Badge variant="secondary" className="bg-primary-soft text-primary">
              {safeExtractedData.length} items
            </Badge>
          </div>

          {/* Single unified button */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleSaveToDocuments}
              disabled={safeExtractedData.length === 0}
              title="Save metadata JSON to ocr_results and original file to documents"
            >
              <Download className="w-4 h-4 mr-1" /> 
              Save All
            </Button>
          </div>
        </div>
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {safeExtractedData.map((item) => (
          <div key={item.id} className="mb-3 p-3 bg-muted rounded border border-border">
            {editingId === item.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold text-foreground">{item.text}</p>
                
                {/* Tag selector dropdown */}
                <div className="relative">
                  <label className="text-xs text-muted-foreground block mb-1">Tags</label>
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                    className="w-full px-3 py-2 text-sm border border-border rounded bg-surface hover:bg-muted text-foreground text-left flex items-center justify-between transition-colors"
                  >
                    <span className="truncate">
                      {item.tags.length > 0 
                        ? item.tags.join(', ') 
                        : 'Select tags...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${
                      openDropdownId === item.id ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {/* Dropdown menu */}
                  {openDropdownId === item.id && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded bg-surface shadow-lg z-50 max-h-48 overflow-y-auto">
                      {/* Search input */}
                      <div className="sticky top-0 p-2 bg-surface border-b">
                        <input
                          type="text"
                          placeholder="Search tags..."
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-muted text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Tags list */}
                      {availableTags
                        .filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              const newTags = item.tags.includes(tag)
                                ? item.tags.filter((t) => t !== tag)
                                : [...item.tags, tag];
                              onUpdateExtraction(item.id, { tags: newTags });
                              setTagSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                              item.tags.includes(tag) ? 'bg-primary-soft' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.tags.includes(tag)}
                              onChange={() => {}}
                              className="w-4 h-4 cursor-pointer"
                              tabIndex={-1}
                            />
                            <span className={item.tags.includes(tag) ? 'text-primary font-medium' : ''}>
                              {tag}
                            </span>
                          </button>
                        ))
                      }
                      
                      {availableTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                          No tags found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Current tags display */}
                {item.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {item.tags.map((tag, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="text-xs flex items-center gap-1 cursor-pointer hover:opacity-75"
                        onClick={() => {
                          const newTags = item.tags.filter(t => t !== tag);
                          onUpdateExtraction(item.id, { tags: newTags });
                        }}
                      >
                        {tag}
                        <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleStartEdit(item)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteExtraction(item.id)}>Delete</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};