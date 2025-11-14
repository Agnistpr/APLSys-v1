import React, { useState } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { Input } from '@/ocr/components/ui/input';
import { Badge } from '@/ocr/components/ui/badge';
import { Card } from '@/ocr/components/ui/card';
import { 
  Plus, 
  Trash2, 
  Tag,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface TagsPanelProps {
  customTags: string[];
  defaultTags: string[];
  onUpdateTags: (tags: string[]) => void;
}

export const TagsPanel: React.FC<TagsPanelProps> = ({
  customTags,
  defaultTags,
  onUpdateTags
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTag = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }

    const tagName = newTagName.trim().toLowerCase();
    
    if (defaultTags.includes(tagName) || customTags.includes(tagName)) {
      toast.error('Tag already exists');
      return;
    }

    onUpdateTags([...customTags, tagName]);
    setNewTagName('');
    setIsAdding(false);
    toast.success('Tag added successfully');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    onUpdateTags(customTags.filter(tag => tag !== tagToDelete));
    toast.success('Tag deleted successfully');
  };

  const handleCancel = () => {
    setNewTagName('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Manage Tags</h3>
        <Badge variant="secondary" className="bg-primary-soft text-primary">
          {defaultTags.length + customTags.length} total
        </Badge>
      </div>

      {/* Default Tags */}
      <Card className="p-4 bg-surface border-border">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Default Tags</h4>
          <Badge variant="outline" className="text-xs">
            Built-in
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {defaultTags.map(tag => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="bg-secondary text-secondary-foreground cursor-default"
            >
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          These are the standard tags for document processing. They cannot be modified.
        </p>
      </Card>

      {/* Custom Tags */}
      <Card className="p-4 bg-surface border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium text-foreground">Custom Tags</h4>
            <Badge variant="outline" className="text-xs">
              {customTags.length}
            </Badge>
          </div>
          {!isAdding && (
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-7 bg-primary hover:bg-primary-hover text-primary-foreground"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Add New Tag Input */}
        {isAdding && (
          <div className="mb-3 p-3 bg-background/50 rounded border border-border">
            <div className="flex gap-2 mb-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                  if (e.key === 'Escape') handleCancel();
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAddTag} className="h-6 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} className="h-6 text-xs">
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Custom Tags List */}
        {customTags.length > 0 ? (
          <div className="space-y-2">
            {customTags.map(tag => (
              <div 
                key={tag} 
                className="flex items-center justify-between p-2 bg-background/30 rounded border border-border"
              >
                <Badge variant="outline" className="bg-accent-soft text-accent">
                  {tag}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteTag(tag)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No custom tags yet</p>
            <p className="text-xs">
              Create custom tags to better organize your document data
            </p>
          </div>
        )}
      </Card>

      {/* Usage Guidelines */}
      <Card className="p-4 bg-accent-soft/50 border-accent/20">
        <h4 className="font-medium text-foreground mb-2">Tag Guidelines</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Use lowercase, single words or short phrases</li>
          <li>• Examples: "phone", "email", "company", "date"</li>
          <li>• Keep tags specific to your document types</li>
          <li>• Tags help organize extracted information</li>
        </ul>
      </Card>
    </div>
  );
};