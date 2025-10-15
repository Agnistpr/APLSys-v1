import axios from "axios";


const BACKEND_URL = "http://127.0.0.1:8000";

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

async function handleWordSearch(filePath, query) {
  setSearchingDoc(filePath);
  setWordMatches([]);
  try {
    const res = await fetch(`${BACKEND_URL}/ocr/search-word`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: filePath, query }),
    });
    const data = await res.json();
    setWordMatches(data.matches || []);
  } catch (err) {
    alert("Failed to search document.");
  } finally {
    setSearchingDoc(null);
  }
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