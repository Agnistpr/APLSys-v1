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

interface OCRPanelProps {
  extractedData: ExtractedText[];
  availableTags: string[];
  onUpdateExtraction: (id: string, updates: Partial<ExtractedText>) => void;
  onDeleteExtraction: (id: string) => void;
}

export const OCRPanel: React.FC<OCRPanelProps> = ({
  extractedData,
  availableTags,
  onUpdateExtraction,
  onDeleteExtraction
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [visibleExtractions, setVisibleExtractions] = useState<Set<string>>(
    new Set(extractedData.map(item => item.id))
  );

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Extracted Text</h3>
        <Badge variant="secondary" className="bg-primary-soft text-primary">
          {extractedData.length} items
        </Badge>
      </div>

      <div className="space-y-3">
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
                {item.confidence && (
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      item.confidence > 80 
                        ? 'bg-success-soft text-success' 
                        : item.confidence > 60 
                        ? 'bg-warning-soft text-warning' 
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {item.confidence}%
                  </Badge>
                )}
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
              <div className="flex flex-wrap gap-1">
                {availableTags.map(tag => (
                  <Button
                    key={tag}
                    variant={item.tags.includes(tag) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleTag(item.id, tag)}
                    className={`h-6 text-xs px-2 ${
                      item.tags.includes(tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            {/* Bounding Box Info */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Position: {Math.round(item.bbox.x)}, {Math.round(item.bbox.y)} • 
                Size: {Math.round(item.bbox.width)} × {Math.round(item.bbox.height)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};