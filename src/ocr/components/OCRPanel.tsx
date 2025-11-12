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
  EyeOff
} from 'lucide-react';
import type { ExtractedText } from './DocumentScanner';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import Select from 'react-select';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [visibleExtractions, setVisibleExtractions] = useState<Set<string>>(
    new Set(extractedData.map(item => item.id))
  );

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

  // Helper to download metadata AND copy original file
  const handleDownloadMetadata = async (format: "json" | "txt" = "json") => {
    if (extractedData.length === 0) {
      toast.error("No metadata to export");
      return;
    }

    try {
      // Prepare metadata
      const metadata = {
        extractedData,
        exported_at: new Date().toISOString(),
      };

      // Generate filename from current file (e.g., "samp2.jpg.json")
      const metadataFileName = `${currentFileName}.json`;

      // 1. Save metadata to ocr_results folder
      if (window.fileAPI?.writeFile) {
        const jsonContent = JSON.stringify(metadata, null, 2);
        await window.fileAPI.writeFile(
          `ocr_results/${metadataFileName}`,
          jsonContent
        );
        console.log("✅ Metadata saved to ocr_results:", metadataFileName);
      } else {
        throw new Error("File API not available for metadata");
      }

      // 2. Copy original file to documents folder (if data is available)
      if (currentFileData && window.fileAPI?.writeFile) {
        try {
          // Extract base64 part only (remove data:mime;base64, prefix)
          const base64Part = currentFileData.includes(',') 
            ? currentFileData.split(',')[1] 
            : currentFileData;
          
          await window.fileAPI.writeFile(
            `${currentFileName}`,
            base64Part,
            //{ encoding: 'base64' }
          );
          console.log("✅ Original file copied to documents:", currentFileName);
        } catch (fileErr) {
          console.warn("⚠️ Failed to copy original file:", fileErr);
          // Don't fail the entire operation if file copy fails
        }
      }

      toast.success("Moved to Documents", {
        description: `${metadataFileName} + ${currentFileName}`,
        duration: 4000,
      });
    } catch (err) {
      console.error("Failed to move to documents:", err);
      toast.error("Failed to move to Documents");
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

  if (extractedData.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm mb-2">No text extracted yet</p>
        <p className="text-xs">
          Use the selection tool to draw a box around text in the document
        </p>
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
              {extractedData.length} items
            </Badge>
          </div>

          {/* Single button for moving to documents */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleDownloadMetadata("json")}
              disabled={extractedData.length === 0}
            >
              <Download className="w-4 h-4 mr-1" /> Move to Documents
            </Button>
          </div>
        </div>
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-4">
          {extractedData.map((item, index) => (
            <Card 
              key={item.id} 
              className={`p-4 border transition-all ${
                visibleExtractions.has(item.id) 
                  ? 'border-border bg-surface' 
                  : 'border-muted bg-muted/30 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    #{index + 1}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleVisibility(item.id)}
                    className="h-7 w-7 p-0"
                  >
                    {visibleExtractions.has(item.id) ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(item.text)}
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(item)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteExtraction(item.id)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Text Content */}
              {editingId === item.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[80px] bg-background"
                    placeholder="Edit extracted text..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-foreground bg-background/50 p-3 rounded border border-border">
                    {item.text}
                  </p>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2 mt-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Tags:
                </label>
                <Select
                  isMulti
                  name="tags"
                  options={availableTags.map(tag => ({ value: tag, label: tag }))}
                  className="tag-selector"
                  classNamePrefix="select"
                  value={item.tags.map(tag => ({ value: tag, label: tag }))}
                  onChange={(selected) => {
                    const newTags = selected ? selected.map(option => option.value) : [];
                    onUpdateExtraction(item.id, { tags: newTags });
                  }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '35px',
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)'
                    }),
                    menu: (base) => ({
                      ...base,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--background)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? 'var(--primary)' : 'var(--background)',
                      '&:hover': {
                        backgroundColor: 'var(--accent)'
                      }
                    })
                  }}
                />
              </div>

              {/* Bounding Box Info */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Position: {Math.round(item.bbox.x)}, {Math.round(item.bbox.y)} • Size: {Math.round(item.bbox.width)} × {Math.round(item.bbox.height)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};