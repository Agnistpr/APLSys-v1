import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

export const DocumentUploadOCRPanel = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
    setResults([]);
    setTables([]);
  };

  const handleRunOCR = async () => {
    setLoading(true);
    setResults([]);
    setTables([]);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      // OCR text extraction
      const ocrRes = await axios.post("http://127.0.0.1:8000/ocr/run-ocr-on-document-upload", formData);
      setResults(prev => [
        ...prev,
        {
          filename: file.name,
          text: ocrRes.data.pages?.[0]?.text || "",
        },
      ]);

      // Table extraction
      const tableRes = await axios.post("http://127.0.0.1:8000/parser/camelot_extract", formData);
      setTables(prev => [
        ...prev,
        {
          filename: file.name,
          tables: tableRes.data.tables || [],
        },
      ]);
    }
    setLoading(false);
  };

  // Helper to download CSV
  const downloadCSV = (filename: string, table: any[], idx: number) => {
    if (!table || !Array.isArray(table) || table.length === 0) return;
    const headers = Object.keys(table[0]);
    const csvRows = [
      headers.join(","),
      ...table.map(row => headers.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_tbl${idx + 1}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to download XLSX
  const downloadXLSX = (filename: string, table: any[], idx: number) => {
    if (!table || !Array.isArray(table) || table.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table");
    const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([xlsxBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_tbl${idx + 1}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-2">Document OCR & Table Extraction</h2>
      <p className="text-gray-600 text-sm mb-4">
          Supported formats: PDF, DOCX
        </p>
      <input type="file" accept=".pdf,.docx" multiple onChange={handleFileChange} />
      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleRunOCR}
        disabled={files.length === 0 || loading}
      >
        {loading ? "Processing..." : "Run OCR & Table Extraction"}
      </button>
      <div className="mt-4 grid gap-4">
        {/* OCR Text Results */}
        {results.map((res, idx) => (
          <div key={idx} className="border rounded p-3 bg-white flex items-center justify-between">
            <div className="font-semibold">{res.filename}</div>
            <button
              className="ml-4 px-2 py-1 bg-blue-500 text-white rounded text-xs"
              onClick={() => {
                const blob = new Blob([res.text], { type: "text/plain" });
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
          </div>
        ))}
        {/* Table Results */}
        {tables.map((tbl, idx) =>
          tbl.tables.map((table: any[], tIdx: number) => (
            <div key={tIdx} className="border rounded p-3 bg-white flex items-center justify-between">
              <div className="font-semibold">{`${tbl.filename}_tbl${tIdx + 1}.xlsx`}</div>
              <button
                className="ml-4 px-2 py-1 bg-green-500 text-white rounded text-xs"
                onClick={() => downloadXLSX(tbl.filename, table, tIdx)}
              >
                Save Table
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};