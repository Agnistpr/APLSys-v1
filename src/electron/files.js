import { app, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { shell } from "electron";
import { spawn } from "child_process";
import os from "os";
const FormData = (await import("form-data")).default;

// Resolve API_BASE_URL / BACKEND_URL at runtime:
// 1) prefer explicit env var (BACKEND_URL)
// 2) try compiled config.js (when app is built)
// 3) fallback to default localhost
let API_BASE_URL_RUNTIME = process.env.BACKEND_URL || process.env.API_BASE_URL || process.env.VITE_API_URL || "https://aplsys-backend-production.up.railway.app";
if (!API_BASE_URL_RUNTIME) {
  try {
    // try to import compiled config next to src (config.js) — works in production build
    const cfg = await import(path.join(__dirname, "..", "config.js")).catch(() => null);
    API_BASE_URL_RUNTIME = cfg?.API_BASE_URL || cfg?.BACKEND_URL || null;
  } catch (e) {
    API_BASE_URL_RUNTIME = null;
  }
}

// Backend URL used by Electron handlers. Set BACKEND_URL in the environment for production.
const BACKEND_URL = API_BASE_URL_RUNTIME;

const fileFilters = {
  pdf: [{ name: "PDF Files", extensions: ["pdf"] }],
  images: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
  documents: [
    { name: "Documents", extensions: ["pdf", "docx", "csv"] },
    { name: "Images", extensions: ["png", "jpg", "jpeg"] },
  ],
  all: [{ name: "All Files", extensions: ["*"] }],
};

function getDocumentsFolder() {
  const isDev = !app.isPackaged;
  return isDev
    ? path.resolve(process.cwd(), "documents")
    : path.join(path.dirname(app.getPath("exe")), "documents");
}

// open file
ipcMain.handle("dialog:openFile", async (event, { type = "all", multi = false } = {}) => {
  const filters = fileFilters[type] || fileFilters.all;

  const result = await dialog.showOpenDialog({
    properties: multi ? ["openFile", "multiSelections"] : ["openFile"],
    filters,
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths;
});

// Save file to documents folder (for now)
ipcMain.handle("file:saveToFolder", async (event, { sourcePath, customDir }) => {
  const isDev = !app.isPackaged;
  let baseDir = customDir;

  if (!baseDir) {
    baseDir = isDev
      ? path.resolve(process.cwd(), "documents")
      : path.join(path.dirname(app.getPath("exe")), "documents");
  }

  fs.mkdirSync(baseDir, { recursive: true });

  const fileName = path.basename(sourcePath);
  const destination = path.join(baseDir, fileName);
  fs.copyFileSync(sourcePath, destination);

  return destination;
});

ipcMain.handle("file:listDocuments", async () => {
  const baseDir = getDocumentsFolder();
  const ocrDir = path.join(baseDir, "ocr_results"); // Directory for OCR results
  
  
  fs.mkdirSync(baseDir, { recursive: true }); // ensure folder exists
  fs.mkdirSync(ocrDir, { recursive: true }); // ensure OCR results folder exists

  // Get list of processed files (files that have OCR results)
  const processedFiles = new Set(
    fs.readdirSync(ocrDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  );

  // Only include regular files (skip directories like 'ocr_results')
  const entries = fs.readdirSync(baseDir);
  const files = entries.filter((name) => {
    try {
      const full = path.join(baseDir, name);
      return fs.statSync(full).isFile();
    } catch (e) {
      return false;
    }
  });

  //const files = fs.readdirSync(baseDir);
  return files.map((file) => {
    const filePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    return {
      name: file,
      type: path.extname(file).substring(1),
      size: `${(stat.size / 1024).toFixed(1)} KB`,
      date: stat.mtime,
      path: filePath,
      isProcessed: processedFiles.has(file)
    };
  });
});

ipcMain.handle("file:delete", async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    console.error("Failed to delete file:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("file:readAsBase64", async (event, filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer.toString("base64");
  } catch (err) {
    console.error("Failed to read file as base64:", err);
    throw err;
  }
});

// ipcMain.handle("file:hexToBase64", async (_, hex) => {
//   try {
//     // remove any potential "0x" prefix and spaces
//     const cleanHex = hex.replace(/0x/g, "").replace(/\s+/g, "");
//     const buffer = Buffer.from(cleanHex, "hex"); // convert hex -> bytes
//     return buffer.toString("base64"); // bytes -> base64
//   } catch (err) {
//     console.error("hexToBase64 failed:", err);
//     throw err;
//   }
// });

ipcMain.handle("file:openDocument", async (_, filePath) => {
  try {
    await shell.openPath(filePath);
  } catch (err) {
    console.error("Failed to open document:", err);
  }
});

ipcMain.handle("open-folder", async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      // Reveal the file in its folder
      shell.showItemInFolder(filePath);
      return { success: true };
    } else {
      return { success: false, error: "File does not exist" };
    }
  } catch (err) {
    console.error("Error opening folder:", err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('file:createDirectory', async (event, dirPath) => {
  try {
    const baseDir = getDocumentsFolder();
    const fullPath = path.join(baseDir, dirPath);
    fs.mkdirSync(fullPath, { recursive: true });
    return { success: true };
  } catch (err) {
    console.error("Failed to create directory:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:writeFile', async (event, filePath, content) => {
  try {
    if (content === undefined || content === null) {
      console.error(`Failed to write file: content is ${String(content)} for path ${filePath}`);
      throw new Error('Invalid file content: undefined or null');
    }

    const baseDir = getDocumentsFolder();
    const fullPath = path.join(baseDir, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    // Accept string or Buffer-like input
    let dataToWrite;
    if (typeof content === 'string') {
      dataToWrite = content;
    } else if (Buffer.isBuffer(content)) {
      dataToWrite = content;
    } else {
      // attempt conversion for TypedArray / ArrayBuffer etc.
      try {
        dataToWrite = Buffer.from(content);
      } catch (e) {
        console.error('Failed to convert content to Buffer:', e);
        throw new Error('Invalid content type for writeFile');
      }
    }

    fs.writeFileSync(fullPath, dataToWrite);
    return { success: true };
  } catch (err) {
    console.error("Failed to write file:", err);
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('file:readDirectory', async (event, dirPath) => {
  try {
    const baseDir = getDocumentsFolder();
    const fullPath = path.join(baseDir, dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    const files = fs.readdirSync(fullPath);
    return files;
  } catch (err) {
    console.error("Failed to read directory:", err);
    return [];
  }
});

ipcMain.handle('file:readFile', async (event, filePath) => {
  try {
    const baseDir = getDocumentsFolder();
    const fullPath = path.join(baseDir, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return content;
  } catch (err) {
    console.error("Failed to read file:", err);
    throw err;
  }
});

/* OCR STUFF NA NASA DOCUMENT MANAGEMENT TAB*/
ipcMain.handle("ocr:startBatch", async (event, { files = [] } = {}) => {
  try {
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, error: "No files provided" };
    }

    // run in background
    (async () => {
      try {
        // compute documents / ocr_results path (same logic as files.js)
        const isDev = !app.isPackaged;
        const baseDir = isDev
          ? path.resolve(process.cwd(), "documents")
          : path.join(path.dirname(app.getPath("exe")), "documents");
        const ocrDir = path.join(baseDir, "ocr_results");
        fs.mkdirSync(ocrDir, { recursive: true });

        // dynamic imports so top-level bundle doesn't fail if modules change
        const axios = (await import("axios")).default;
        const FormData = (await import("form-data")).default;

  // Use the module-level BACKEND_URL (reads process.env.BACKEND_URL) so it can be
  // configured when launching the Electron app in production.

        // helper: sleep
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

        // helper: retry wrapper for axios POST/requests (available to entire handler)
        const requestWithRetries = async (axiosInstance, config, opts = {}) => {
          const maxRetries = opts.maxRetries ?? 3;
          let attempt = 0;
          let backoff = opts.initialBackoff ?? 1000;
          while (true) {
            try {
              return await axiosInstance(config);
            } catch (err) {
              attempt++;
              const status = err?.response?.status;
              // consider transient on network errors, 429, 5xx
              const isTransient = !err?.response || status === 429 || (status >= 500 && status < 600);
              if (!isTransient || attempt > maxRetries) throw err;

              // honor Retry-After header if present
              const retryAfter = err?.response?.headers?.["retry-after"];
              if (retryAfter) {
                const asNum = parseFloat(retryAfter);
                if (!isNaN(asNum)) {
                  await sleep(asNum * 1000);
                  continue;
                }
              }

              // exponential backoff + jitter
              const jitter = Math.round(Math.random() * 300);
              await sleep(backoff + jitter);
              backoff *= 2;
              continue;
            }
          }
        };

        for (const filePath of files) {
          const filename = path.basename(filePath);
          try {
            // notify started
            event.sender.send("ocr-progress", { filename, status: "started" });

            // read file
            const fileBuffer = fs.readFileSync(filePath);

            // Determine extension
            const fileExt = path.extname(filePath).toLowerCase();
            if (fileExt === ".pdf") {
              // Try backend pdf->images first (with retries). If 404 or not found, fallback to uploading PDF to OCR endpoint.
              const pdfForm = new FormData();
              pdfForm.append("file", fileBuffer, { filename, contentType: "application/pdf" });

              // Try multiple candidate endpoints (some backends mount routers under prefixes)
              const pdfEndpoints = [
                // try the most likely backend paths first (add the exact route you saw in backend logs)
                `${API_BASE_URL_RUNTIME}/ocr/process-pdf-to-images?save=false&include_b64=true&dpi=300`,
                `${API_BASE_URL_RUNTIME}/ocr/pdf-to-images?save=false&include_b64=true&dpi=300`,
                `${API_BASE_URL_RUNTIME}/parser/pdf-to-images?save=false&include_b64=true&dpi=300`,
                `${API_BASE_URL_RUNTIME}/pdf-to-images?save=false&include_b64=true&dpi=300`,
              ];

              let pdfRes = null;
              let lastErr = null;
              for (const url of pdfEndpoints) {
                try {
                  pdfRes = await requestWithRetries(axios, {
                    method: "post",
                    url,
                    data: pdfForm,
                    headers: { ...pdfForm.getHeaders() },
                    timeout: 0,
                  }, { maxRetries: 4, initialBackoff: 1000 });

                  // If we got a response that's not JSON (string/html), try to detect JSON payload safely
                  if (typeof pdfRes.data === "string") {
                    const s = pdfRes.data.trim();
                    if (s.startsWith("{") || s.startsWith("[")) {
                      try { pdfRes.data = JSON.parse(s); } catch (e) { /* leave as string */ }
                    } else {
                      // non-JSON body -> treat as failure for this endpoint and try next
                      throw new Error(`Non-JSON response from ${url}`);
                    }
                  }

                  // success: log then break out
                  console.log(`[ocr:startBatch] pdf->images succeeded using ${url}`);
                  break;
                } catch (err) {
                  lastErr = err;
                  const status = err?.response?.status;
                  // if 404 specifically, try next endpoint (route not mounted)
                  if (status === 404) {
                    console.warn(`[ocr:startBatch] ${url} returned 404, trying next candidate`);
                    continue;
                  }
                  // if transient, requestWithRetries already retried; try next endpoint only if this was a route mismatch
                  console.warn(`[ocr:startBatch] error calling ${url}:`, err?.message || err);
                }
              }

              if (!pdfRes) {
                // nothing worked — fallback to uploading PDF directly to OCR endpoint
                console.warn(`[ocr:startBatch] pdf-to-images endpoints all failed for ${filename}: ${lastErr?.message || lastErr}`);
                try {
                  const fallbackForm = new FormData();
                  fallbackForm.append("files", fileBuffer, { filename, contentType: "application/pdf" });
                  const fallbackRes = await requestWithRetries(axios, {
                    method: "post",
                    url: `${API_BASE_URL_RUNTIME}/ocr/process-folder`,
                    data: fallbackForm,
                    headers: { ...fallbackForm.getHeaders() },
                    timeout: 0,
                  }, { maxRetries: 3, initialBackoff: 800 });

                  const result = fallbackRes.data?.result ?? fallbackRes.data;
                  const outName = `${filename}.json`;
                  fs.writeFileSync(path.join(ocrDir, outName), JSON.stringify(result, null, 2), "utf8");
                  event.sender.send("ocr-progress", { filename, status: "done" });
                  continue;
                } catch (fbErr) {
                  throw fbErr;
                }
              }

              // If pdfRes available, process returned pages
              const pages = Array.isArray(pdfRes.data?.pages) ? pdfRes.data.pages : [];
              if (pages.length === 0) {
                throw new Error("No pages returned from pdf-to-images");
              }

              // process pages sequentially and post each page to OCR
              const totalPages = pages.length;
              let processedPages = 0;
              for (let idx = 0; idx < pages.length; idx++) {
                const p = pages[idx];
                const pageNum = idx + 1;
                const pageB64 = p?.b64 || p?.data || "";
                const pageName = `${path.basename(filename, ".pdf")}_page_${pageNum}.png`;

                // emit page started
                event.sender.send("ocr-progress", { filename: pageName, status: "started", page: pageNum, parent: filename });

                const pageBuf = Buffer.from(pageB64, "base64");
                const pageForm = new FormData();
                pageForm.append("files", pageBuf, { filename: pageName, contentType: "image/png" });

                const ocrRes = await requestWithRetries(axios, {
                  method: "post",
                  url: `${API_BASE_URL_RUNTIME}/ocr/process-folder`,
                  data: pageForm,
                  headers: { ...pageForm.getHeaders() },
                  timeout: 0,
                }, { maxRetries: 4, initialBackoff: 1000 });

                const pageResults = Array.isArray(ocrRes.data?.results)
                  ? ocrRes.data.results
                  : ocrRes.data?.result
                    ? [ocrRes.data.result]
                    : [];

                if (pageResults.length === 0 && ocrRes.data) {
                  const outName = `${pageName}.json`;
                  fs.writeFileSync(path.join(ocrDir, outName), JSON.stringify(ocrRes.data, null, 2), "utf8");
                } else {
                  pageResults.forEach((resObj) => {
                    const resFilename = resObj?.filename || pageName;
                    const outName = `${resFilename}.json`;
                    const content = resObj?.result ? JSON.stringify(resObj.result, null, 2) : JSON.stringify(resObj, null, 2);
                    fs.writeFileSync(path.join(ocrDir, outName), content, "utf8");
                  });
                }

                processedPages++;
                const frac = processedPages / totalPages;
                event.sender.send("ocr-progress", { filename: pageName, status: "done", page: pageNum, parent: filename });
                event.sender.send("ocr-progress", { filename, status: "progress", progress: frac, processedPages, totalPages });
              }

              // pdf overall done
              event.sender.send("ocr-progress", { filename, status: "done", processedPages, totalPages });
              continue;
            }

            // Non-PDF path: upload file buffer directly
            event.sender.send("ocr-progress", { filename, status: "started" });
            const form = new FormData();
            form.append("files", fileBuffer, filename);

            const res = await requestWithRetries(axios, {
              method: "post",
              url: `${API_BASE_URL_RUNTIME}/ocr/process-folder`,
              data: form,
              headers: { ...form.getHeaders() },
              timeout: 0,
            }, { maxRetries: 3, initialBackoff: 800 });

            // save result into ocr_results
            const result = res.data?.result ?? res.data;
            const outName = `${filename}.json`;
            fs.writeFileSync(path.join(ocrDir, outName), JSON.stringify(result, null, 2), "utf8");

            // notify done
            event.sender.send("ocr-progress", { filename, status: "done" });
          } catch (err) {
            console.error("[ocr:startBatch] file error:", filePath, err);
            event.sender.send("ocr-progress", {
              filename: path.basename(filePath),
              status: "error",
              error: err?.message || String(err),
            });
          }
        }

        // all done
        event.sender.send("ocr-progress", { status: "all_done" });
      } catch (bgErr) {
        console.error("[ocr:startBatch] background worker failed:", bgErr);
        event.sender.send("ocr-progress", { status: "all_done", error: bgErr?.message || String(bgErr) });
      }
    })();

    // return immediately so renderer can continue
    return { success: true };
  } catch (err) {
    console.error("ocr:startBatch handler failed:", err);
    return { success: false, error: err?.message || String(err) };
  }
});