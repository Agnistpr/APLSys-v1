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

//Fallback URL
const RAILWAY_URL = "https://aplsys-backend-production.up.railway.app";

// Backend URL used by Electron handlers. Set BACKEND_URL in the environment for production.
const BACKEND_URL = API_BASE_URL_RUNTIME || RAILWAY_URL; // ✅ Always use Railway as fallback
console.log("[files.js init] BACKEND_URL resolved to:", BACKEND_URL); // ✅ Log which URL is being used


const fileFilters = {
  pdf: [{ name: "PDF Files", extensions: ["pdf"] }],
  images: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
  documents: [
    { name: "Documents", extensions: ["pdf", "docx", "csv"] },
    { name: "Images", extensions: ["png", "jpg", "jpeg"] },
  ],
  all: [{ name: "All Files", extensions: ["*"] }],
};

let selectedFolderPath = null;

function getDocumentsFolder() {
  if (selectedFolderPath && fs.existsSync(selectedFolderPath)) {
    return selectedFolderPath; // user-chosen folder
  }
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


//Move to Folder

ipcMain.handle("file:moveToFolder", async (event, { sourcePath, targetDir }) => {
  try {
    const fileName = path.basename(sourcePath);
    const destination = path.join(targetDir, fileName);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourcePath, destination); // Use copy for safety; use fs.renameSync for move
    return { success: true, path: destination };
  } catch (err) {
    console.error("Failed to move file:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:saveUploadedFile', async (event, { fileName, base64Data }) => {
  try {
    const baseDir = getDocumentsFolder();
    const fullPath = path.join(baseDir, fileName);
    const dir = path.dirname(fullPath);
    
    fs.mkdirSync(dir, { recursive: true });

    // Convert base64 to Buffer and write
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(fullPath, buffer);
    
    return { success: true, path: fullPath };
  } catch (err) {
    console.error("Failed to save uploaded file:", err);
    return { success: false, error: err.message };
  }
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

ipcMain.handle("open-folder", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select a Folder",
      message: "Choose a folder path",
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true, error: "No folder selected" };
    }

    selectedFolderPath = result.filePaths[0]; // save user selection
    return { success: true, path: selectedFolderPath };
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
ipcMain.handle("ocr:startBatch", async (event, { files = [], batch_task_id = null } = {}) => {
  try {
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, error: "No files provided" };
    }

    // run in background
    (async () => {
      try {
        const baseDir = getDocumentsFolder();
        const ocrDir = path.join(baseDir, "ocr_results");
        fs.mkdirSync(ocrDir, { recursive: true });

        const axios = (await import("axios")).default;
        const FormData = (await import("form-data")).default;

  // Use the module-level BACKEND_URL (reads process.env.BACKEND_URL) so it can be
  // configured when launching the Electron app in production.

        // helper: sleep
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

        // helper: retry wrapper for axios POST/requests (available to entire handler)
        // const requestWithRetries = async (axiosInstance, config, opts = {}) => {
        //   const maxRetries = opts.maxRetries ?? 3;
        //   let attempt = 0;
        //   let backoff = opts.initialBackoff ?? 1000;
        //   while (true) {
        //     try {
        //       return await axiosInstance(config);
        //     } catch (err) {
        //       attempt++;
        //       const status = err?.response?.status;
        //       // consider transient on network errors, 429, 5xx
        //       const isTransient = !err?.response || status === 429 || (status >= 500 && status < 600);
        //       if (!isTransient || attempt > maxRetries) throw err;

        //       // honor Retry-After header if present
        //       const retryAfter = err?.response?.headers?.["retry-after"];
        //       if (retryAfter) {
        //         const asNum = parseFloat(retryAfter);
        //         if (!isNaN(asNum)) {
        //           await sleep(asNum * 1000);
        //           continue;
        //         }
        //       }

        //       // exponential backoff + jitter
        //       const jitter = Math.round(Math.random() * 300);
        //       await sleep(backoff + jitter);
        //       backoff *= 2;
        //       continue;
        //     }
        //   }
        // };

        for (const filePath of files) {
          const filename = path.basename(filePath);
          
          try {
            // ✅ CRITICAL: Notify started
            event.sender.send("ocr-progress", { filename, status: "started", batch_id: batch_task_id });

            // Read file
            const fileBuffer = fs.readFileSync(filePath);
            const formData = new FormData();
            formData.append("files", fileBuffer, filename );

            console.log(`[ocr:startBatch] Posting to ${BACKEND_URL}/ocr/process-folder with file: ${filename}`);
            
            try {
              const response = await axios.post(
                `${BACKEND_URL}/ocr/process-folder`,
                formData,
                {
                  headers: { ...formData.getHeaders() },
                  timeout: 300000
                }
              );

              console.log(`[ocr:startBatch] Success for ${filename}:`, response.data);

              const result = response.data?.result ?? response.data;
              const outName = `${filename}.json`;
              fs.writeFileSync(
                path.join(ocrDir, outName),
                JSON.stringify(result, null, 2),
                "utf8"
              );

              event.sender.send("ocr-progress", { filename, status: "done", batch_id: batch_task_id });

            } catch (postErr) {
             console.error(`[ocr:startBatch] POST failed for ${filename}:`, postErr.message);
             console.error(`[ocr:startBatch] Full error:`, postErr?.response?.data || postErr);
              event.sender.send("ocr-progress", {
                filename,
                status: "error",
                error: postErr?.message || String(postErr),
                batch_id: batch_task_id
              });
            }

          } catch (err) {
            console.error(`[ocr:startBatch] Error processing ${filename}:`, err.message);
            event.sender.send("ocr-progress", {
              filename,
              status: "error",
              error: err?.message || String(err),
              batch_id: batch_task_id
            });
          }
        }

        event.sender.send("ocr-progress", { status: "all_done", batch_id: batch_task_id });
        console.log("[ocr:startBatch] Background worker completed");

      } catch (bgErr) {
        console.error("[ocr:startBatch] Background worker failed:", bgErr);
        event.sender.send("ocr-progress", {
          status: "all_done",
          error: bgErr?.message || String(bgErr)
        });
      }
    })(); // Start async, don't await

    // Return immediately so renderer continues
    return { success: true, processing_files: files.map(f => path.basename(f)) };

  } catch (err) {
    console.error("ocr:startBatch handler failed:", err);
    return { success: false, error: err?.message || String(err) };
  }
});