import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config";

export const BatchOCRPanel = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
    setResults([]);
  };

  const handleBatchOCR = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setResults([]);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    try {
      const res = await axios.post(`${API_BASE_URL}/ocr/batch-ocr`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data.results);
    } catch (err) {
      setResults([{ filename: "Batch", error: "Failed to process batch OCR" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-2">Batch Document OCR</h2>
      <input type="file" accept=".pdf,image/*" multiple onChange={handleFileChange} />
      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleBatchOCR}
        disabled={files.length === 0 || loading}
      >
        {loading ? "Processing..." : "Run Batch OCR"}
      </button>
      <div className="mt-4 grid gap-4">
        {results.map((res, idx) => (
          <div key={idx} className="border rounded p-3 bg-white flex items-center justify-between">
            <div className="font-semibold">{res.filename}</div>
            {res.result ? (
              <button
                className="ml-4 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                onClick={() => {
                  const text =
                    typeof res.result === "string"
                      ? res.result
                      : JSON.stringify(res.result, null, 2);
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${res.filename}_ocr.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                Save Text
              </button>
            ) : (
              <div className="text-red-600">{res.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};