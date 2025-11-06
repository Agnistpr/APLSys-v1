import axios from "axios";
import * as pdfjs from "pdfjs-dist"
import { API_BASE_URL } from "../config";

const BACKEND_URL = API_BASE_URL;

// Helper to convert base64 to Blob
function base64ToBlob(base64: string) {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

export async function ocrFullScan(imageData: string) {
  const formData = new FormData();
  formData.append("file", base64ToBlob(imageData), "scan.png");
  const res = await axios.post(`${BACKEND_URL}/ocr/extract-full`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data.result;
}

export async function parseDocumentText(text: string) {
  const res = await axios.post(`${BACKEND_URL}/parser/parse-document`, { text });
  return res.data.entities;
}

export async function ocrRegion(imageData: string) {
  const formData = new FormData();
  formData.append("file", base64ToBlob(imageData), "region.png");
  try {
    const res = await axios.post(`${BACKEND_URL}/ocr/extract-region`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    // The backend now returns { text, confidence }
    const { text = "", confidence = 0 } = res.data || {};
    return { text, confidence };
  } catch (err) {
    console.error("ocrRegion error:", err);
    return { text: "", confidence: 0 };
  }
}

export async function ocrSearch(imageData: string, query: string) {
  const formData = new FormData();
  formData.append("file", base64ToBlob(imageData), "scan.png");
  formData.append("query", query);
  const res = await axios.post(`${BACKEND_URL}/ocr/search`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data.matches;
}


export async function batchProcessFolder(files: File[]) {
  if (!files || files.length === 0) {
    throw new Error("No files provided for OCR processing");
  }

  // Allowed mime prefixes/types (client should already filter by ext but double-check)
  const allowedMimePrefixes = ["image/", "application/pdf"];

  // Filter files to only allowed types
  const acceptedFiles = files.filter((f) => {
    if (!f) return false;
    const t = (f.type || "").toLowerCase();
    const ok = allowedMimePrefixes.some(p => t.startsWith(p));
    if (!ok) {
      console.warn(`[OCR][client] Skipping unsupported file sent to batchProcessFolder: ${f.name} (${f.type})`);
    }
    return ok;
  });

  if (acceptedFiles.length === 0) {
    console.log("[OCR] No accepted files to send for OCR after filtering unsupported types.");
    return [];
  }

  try {
    // First ensure the ocr_results directory exists
    await window.fileAPI.createDirectory('ocr_results');

    // Create FormData for file upload
    const formData = new FormData();
    //acceptedFiles.forEach(file => formData.append('files', file));

    // Process each file
    for (const file of files) {
      if (!file) continue;
      
      const fileType = file.type.toLowerCase();
      
      // If PDF, convert pages to images first
      if (fileType === 'application/pdf') {
        try {
          // Load PDF
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument(arrayBuffer).promise;
          
          // Convert first page to image
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 3.0 }); // Increase scale for better quality
          
          // Create canvas and render PDF page
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
          }).promise;
          
          const imageBlob = await new Promise<Blob>(resolve => {
            canvas.toBlob(resolve, 'image/png', 1.0);
          });
          
          
          formData.append('files', new File([imageBlob], file.name.replace('.pdf', '.png'), {
            type: 'image/png'
          }));// Add converted image to form data
          
        } catch (err) {
          console.error(`[OCR] Failed to convert PDF ${file.name}:`, err);
          continue;
        }
      } else {
        // For images, add directly
        formData.append('files', file);
      }
    }

    // Send to backend API endpoint
    const res = await axios.post(`${BACKEND_URL}/ocr/process-folder`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    // Save results
    for (const result of (res.data?.results || [])) {
      const content = result?.result ? 
        JSON.stringify(result.result, null, 2) :
        JSON.stringify(result, null, 2);
      await window.fileAPI.writeFile
      (`ocr_results/${result.filename.replace('.png', '.pdf')}.json`, content);
    }

    return res.data.results;
  } catch (err) {
    console.error("Batch OCR processing failed:", err);
    throw err;
  }
}

export async function searchOcrResults(query: string) {
  try {
    // Use IPC to read OCR results directory
    const files = await window.fileAPI.readDirectory('ocr_results');
    const matches = [];

    // Normalize query
    const q = (query || "").toLowerCase().trim();

    // Process each JSON file
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await window.fileAPI.readFile(`ocr_results/${file}`);
          const ocrData = JSON.parse(content);

          // Extract searchable text: handle legacy flat result { text: "..." }
          // or structured result { pages: [ { blocks: [ { lines: [ { words: [{ value }] } ] } ] } ] }
          let text = "";
          if (typeof ocrData === "string") {
            text = ocrData;
          } else if (ocrData && typeof ocrData.text === "string" && ocrData.text.trim().length > 0) {
            text = ocrData.text;
          } else if (ocrData && ocrData.pages) {
            text = extractTextFromOcrData(ocrData);
          } else {
            // Fallback: stringify small fields
            text = JSON.stringify(ocrData);
          }
          
          if (text.toLowerCase().includes(q)) {
            matches.push({
              filename: file.replace('.json', '')
            });
          }
        } catch (err) {
          console.error(`Error processing ${file}:`, err);
        }
      }
    }

    return matches;
  } catch (err) {
    console.error("OCR search failed:", err);
    return [];
  }
}

function extractTextFromOcrData(ocrData: any): string {
  if (!ocrData) return '';

  // If pages structure exists, walk it safely
  if (Array.isArray(ocrData.pages)) {
    try {
      return ocrData.pages
        .map((page: any) =>
          (page.blocks || [])
            .map((block: any) =>
              (block.lines || [])
                .map((line: any) =>
                  (line.words || []).map((w: any) => w?.value || '').join(' ')
                ).join('\n')
            ).join('\n')
        ).join('\n\n');
    } catch (e) {
      // fallback to JSON string if structure differs
      return JSON.stringify(ocrData);
    }
  }

  // If OCR result stores plain paragraphs in other keys, prefer them
  if (typeof ocrData.text === 'string') return ocrData.text;
  if (typeof ocrData.content === 'string') return ocrData.content;

  return JSON.stringify(ocrData);
}