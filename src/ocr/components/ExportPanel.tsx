import React, { useState } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { Card } from '@/ocr/components/ui/card';
import { Badge } from '@/ocr/components/ui/badge';
import { Textarea } from '@/ocr/components/ui/textarea';
import { 
  Download, 
  FileJson, 
  Copy,
  Check,
  FileText,
  Database
} from 'lucide-react';
import type { DocumentData } from './DocumentScanner';
import { toast } from 'sonner';

interface ExportPanelProps {
  documentData: DocumentData;
  hasData: boolean;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  documentData,
  hasData
}) => {
  const [copied, setCopied] = useState(false);

  const formatJsonData = () => {
    const formatted = {
      document: {
        filename: documentData.filename,
        processed_at: documentData.timestamp,
        total_extractions: documentData.extractedData.length
      },
      extracted_data: documentData.extractedData.map((item, index) => ({
        id: index + 1,
        text: item.text,
        // confidence: item.confidence || null,
        tags: item.tags,
        // bounding_box: {
        //   x: Math.round(item.bbox.x),
        //   y: Math.round(item.bbox.y),
        //   width: Math.round(item.bbox.width),
        //   height: Math.round(item.bbox.height)
        // }
      })),
      metadata: {
        custom_tags: documentData.customTags,
        total_tags: documentData.customTags.length
      }
    };

    return JSON.stringify(formatted, null, 2);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatJsonData());
      setCopied(true);
      toast.success('JSON copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy JSON');
    }
  };

  const handleDownloadJson = () => {
    if (!hasData) {
      toast.error('No data to export');
      return;
    }

    const jsonData = formatJsonData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('JSON file downloaded');
  };

  const getStats = () => {
    const totalCharacters = documentData.extractedData.reduce(
      (sum, item) => sum + item.text.length, 0
    );
    const taggedItems = documentData.extractedData.filter(item => item.tags.length > 0).length;
    const avgConfidence = documentData.extractedData.length > 0 
      ? Math.round(
          documentData.extractedData.reduce((sum, item) => sum + (item.confidence || 0), 0) / 
          documentData.extractedData.length
        )
      : 0;

    return { totalCharacters, taggedItems, avgConfidence };
  };

  const stats = getStats();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Export Data</h3>
        <Badge 
          variant={hasData ? "default" : "secondary"} 
          className={hasData ? "bg-success text-success-foreground" : ""}
        >
          {hasData ? 'Ready' : 'No Data'}
        </Badge>
      </div>

      {/* Statistics */}
      <Card className="p-4 bg-surface border-border">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Document Statistics</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-center p-2 bg-background/50 rounded">
            <div className="font-semibold text-primary">{documentData.extractedData.length}</div>
            <div className="text-xs text-muted-foreground">Extractions</div>
          </div>
          <div className="text-center p-2 bg-background/50 rounded">
            <div className="font-semibold text-primary">{stats.totalCharacters}</div>
            <div className="text-xs text-muted-foreground">Characters</div>
          </div>
          <div className="text-center p-2 bg-background/50 rounded">
            <div className="font-semibold text-primary">{stats.taggedItems}</div>
            <div className="text-xs text-muted-foreground">Tagged</div>
          </div>
          <div className="text-center p-2 bg-background/50 rounded">
            <div className="font-semibold text-primary">{stats.avgConfidence}%</div>
            <div className="text-xs text-muted-foreground">Avg. Confidence</div>
          </div>
        </div>
      </Card>

      {/* Export Options */}
      <Card className="p-4 bg-surface border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileJson className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Export Options</h4>
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={handleDownloadJson}
            disabled={!hasData}
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Download JSON File
          </Button>
          
          <Button
            variant="outline"
            onClick={handleCopyJson}
            disabled={!hasData}
            className="w-full"
          >
            {copied ? (
              <Check className="w-4 h-4 mr-2 text-success" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? 'Copied!' : 'Copy JSON'}
          </Button>
        </div>
      </Card>

      {/* JSON Preview */}
      {hasData && (
        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium text-foreground">JSON Preview</h4>
          </div>
          <Textarea
            value={formatJsonData()}
            readOnly
            className="font-mono text-xs bg-background/50 h-40 custom-scrollbar"
            placeholder="JSON data will appear here..."
          />
        </Card>
      )}

      {!hasData && (
        <Card className="p-6 bg-muted/30 border-muted text-center">
          <FileJson className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">No data to export</p>
          <p className="text-xs text-muted-foreground">
            Extract text from your document first to enable export functionality
          </p>
        </Card>
      )}

      {/* Format Information */}
      <Card className="p-4 bg-accent-soft/50 border-accent/20">
        <h4 className="font-medium text-foreground mb-2">Export Format</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• JSON format with structured data</li>
          <li>• Includes text, tags, and bounding boxes</li>
          <li>• OCR confidence scores when available</li>
          <li>• Compatible with data processing tools</li>
        </ul>
      </Card>
    </div>
  );
};