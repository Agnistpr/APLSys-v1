import React, { useState } from "react";
import { Button } from "@/ocr/components/ui/button";
import { API_BASE_URL } from "../../config";

export const MetadataExtractorPanel = ({ file, fileUrl }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleExtractMetadata = async () => {
    setLoading(true);
    setMetadata(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/ai/gemini-extract-metadata`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMetadata(data);
    } catch (err) {
      setMetadata({ error: "Failed to extract metadata" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="font-bold mb-2">Metadata Extractor</h2>
      <Button onClick={handleExtractMetadata} disabled={loading || !file}>
        {loading ? "Extracting..." : "Extract Metadata"}
      </Button>
      {metadata && (
        <pre className="mt-4 bg-gray-100 p-2 rounded text-xs overflow-auto max-h-96">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
      <Button
        onClick={() => {
          const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "metadata.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
        disabled={!metadata}
        className="ml-2"
      >
        Download Metadata
      </Button>
    </div>
  );
};