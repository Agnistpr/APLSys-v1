import { app, ipcMain, dialog, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { shell } from "electron";
import { spawn, execSync } from "child_process";
import { debugLog } from "./logger.js";
import os from "os";
import FormData from "form-data";
import axios from "axios";

// CRITICAL: Clean corrupted store BEFORE importing Store class
function cleanupCorruptedStore() {
  const storePath = path.join(app.getPath("userData"), "config.json");
  try {
    if (fs.existsSync(storePath)) {
      const content = fs.readFileSync(storePath, 'utf-8').trim();
      // Try to parse - if it fails, it's corrupted
      try {
        JSON.parse(content);
        debugLog('[Store] Config file is valid JSON');
      } catch (parseErr) {
        debugLog('[Store] ❌ Corrupted config detected, deleting:', storePath);
        fs.unlinkSync(storePath);
        debugLog('[Store] ✅ Corrupted file deleted');
      }
    }
  } catch (err) {
    debugLog('[Store] Error during cleanup:', err.message);
  }
}

// Clean BEFORE creating Store instance
cleanupCorruptedStore();

import Store from 'electron-store';
const store = new Store();

let API_BASE_URL_RUNTIME = process.env.API_BASE_URL

const BACKEND_URL = API_BASE_URL_RUNTIME
console.log("[files.js init] BACKEND_URL resolved to:", BACKEND_URL)

const fileFilters =
{
  pdf: [{name: "PDF Files", extensions: ["pdf"]}],
  images: [{name: "Images", extensions: ["png","jpg","jpeg"]}],
  documents:[
    {name: "Documents", extensions: ["pdf", "docx", "csv"]},
    {name: "Images", extensions: ["png", "jpg","jpeg"] }, 
  ],
  all: [{name: "All Files", extensions: ["*"]}],
}

//CRITICAL: Store the registry path in memory immediately, don't rely on store
let registryScandataDir = null;

// Setter function to be called from main.js
export function setRegistryScanDataDir(dir) {
  registryScandataDir = dir;
  debugLog('[files.js] Registry scan dir cached in memory:', registryScandataDir);
  try {
    // CRITICAL: Clean corrupted store before writing
    try {
      const testValue = store.get('scanDataDir');
      // If we can read it, it's okay to write
    } catch (readErr) {
      debugLog('[files.js] Store is corrupted, clearing it:', readErr.message);
      // Delete the corrupted store file
      try {
        const storePath = store.path;
        if (fs.existsSync(storePath)) {
          fs.unlinkSync(storePath);
          debugLog('[files.js] Deleted corrupted store file');
        }
      } catch (delErr) {
        debugLog('[files.js] Could not delete store file:', delErr.message);
      }
    }
    
    store.set('scanDataDir', dir);
    debugLog('[files.js] Also saved to store for backup');
  } catch (err) {
    debugLog('[files.js] Warning: Could not save to store, but in-memory value is safe:', err.message);
  }
}

let selectedFolderPath = null;

function getDocumentsFolder() {
  try {
    debugLog('[getDocumentsFolder] Checking for documents folder...');
    
    // FIRST: Check if user selected a folder (from app UI)
    if (selectedFolderPath && fs.existsSync(selectedFolderPath)) {
      debugLog('[getDocumentsFolder] Using selectedFolderPath:', selectedFolderPath);
      return selectedFolderPath;
    }

    // SECOND: Check persisted selection in store
    try {
      const persisted = store.get('selectedFolderPath');
      if (persisted && fs.existsSync(persisted)) {
        selectedFolderPath = persisted;
        debugLog('[getDocumentsFolder] ✅ Using persisted selection from store:', persisted);
        return persisted;
      }
    } catch (storeErr) {
      debugLog('[getDocumentsFolder] Warning: Could not read from store:', storeErr.message);
    }

    // THIRD: Use the IN-MEMORY registry path (most reliable)
    if (registryScandataDir && fs.existsSync(registryScandataDir)) {
      debugLog('[getDocumentsFolder] Using IN-MEMORY registry path:', registryScandataDir);
      return registryScandataDir;
    }
    debugLog('[getDocumentsFolder] Registry path not available or does not exist:', registryScandataDir);

    // FOURTH: Try to read from store as fallback
    try {
      const storeRegistry = store.get('scanDataDir');
      if (storeRegistry && fs.existsSync(storeRegistry)) {
        debugLog('[getDocumentsFolder] Using scanDataDir from store:', storeRegistry);
        return storeRegistry;
      }
    } catch (storeErr) {
      debugLog('[getDocumentsFolder] Could not read scanDataDir from store:', storeErr.message);
    }

    // FIFTH: Try to read from Windows registry directly
    debugLog('[getDocumentsFolder] Attempting direct registry query...');
    try {
      const result = execSync(
        'reg query "HKCU\\Software\\APLSys" /v ScanDataDir',
        { encoding: 'utf-8' }
      );
      const match = result.match(/ScanDataDir\s+REG_SZ\s+(.+)/);
      if (match) {
        const regPath = match[1].trim();
        debugLog('[getDocumentsFolder] Found in registry:', regPath);
        if (fs.existsSync(regPath)) {
          registryScandataDir = regPath; // Cache it
          try {
            store.set('scanDataDir', regPath);
          } catch (e) {
            // noop
          }
          return regPath;
        }
      }
    } catch (regErr) {
      debugLog('[getDocumentsFolder] Registry query failed (this is OK if on non-Windows):', regErr.message);
    }

    // FALLBACK: Use app userData directory
    const fallback = path.join(app.getPath("userData"), "documents");
    debugLog('[getDocumentsFolder] Using fallback directory:', fallback);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  } catch (err) {
    debugLog('[getDocumentsFolder] Critical error:', err.message);
    const fallback = path.join(app.getPath("userData"), "documents");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
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

//get selected directory from installation
ipcMain.handle('file:getScanDataDir', async () => {
  try {
    debugLog('[file:getScanDataDir] Handler called');
    
    // FIRST: Use in-memory registry value (most reliable)
    if (registryScandataDir) {
      debugLog('[file:getScanDataDir] ✅ Using in-memory registry path:', registryScandataDir);
      return registryScandataDir;
    }
    
    // SECOND: Try store (may be corrupted)
    try {
      const scanDir = store.get('scanDataDir');
      if (scanDir) {
        debugLog('[file:getScanDataDir] ✅ Using store value:', scanDir);
        registryScandataDir = scanDir; // Cache it for next time
        return scanDir;
      }
    } catch (storeErr) {
      debugLog('[file:getScanDataDir] Store read failed (expected if corrupted):', storeErr.message);
    }
    
    // THIRD: Fallback to direct registry query
    try {
      const result = execSync(
        'reg query "HKCU\\Software\\APLSys" /v ScanDataDir',
        { encoding: 'utf-8' }
      );
      const match = result.match(/ScanDataDir\s+REG_SZ\s+(.+)/);
      const regPath = match ? match[1].trim() : null;
      if (regPath) {
        debugLog('[file:getScanDataDir] ✅ Found in registry:', regPath);
        registryScandataDir = regPath; // Cache it
        return regPath;
      }
    } catch (regErr) {
      debugLog('[file:getScanDataDir] Registry query failed:', regErr.message);
    }
    
    // FALLBACK: Return null and let frontend handle it
    debugLog('[file:getScanDataDir] No scan dir found');
    return null;
  } catch (err) {
    debugLog('[file:getScanDataDir] Unexpected error:', err.message);
    return null;
  }
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
  try {
    debugLog('[file:listDocuments] Handler called');
    const baseDir = getDocumentsFolder();
    debugLog('[file:listDocuments] getDocumentsFolder() returned:', baseDir);
    
    // Ensure base directory exists
    if (!fs.existsSync(baseDir)) {
      debugLog('[file:listDocuments] Creating base directory:', baseDir);
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const ocrDir = path.join(baseDir, "ocr_results");
    debugLog('[file:listDocuments] OCR results dir:', ocrDir);
    
    // Create ocr_results directory if missing
    try {
      fs.mkdirSync(ocrDir, { recursive: true });
    } catch (err) {
      debugLog('[file:listDocuments] Non-critical: Failed to create ocr_results:', err.message);
    }

    // Get processed files
    let processedFiles = new Set();
    try {
      const ocrFiles = fs.readdirSync(ocrDir);
      processedFiles = new Set(
        ocrFiles
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace(/\.json$/i, '').trim())
      );
      debugLog('[file:listDocuments] Found', processedFiles.size, 'processed files');
    } catch (err) {
      debugLog('[file:listDocuments] Warning: Could not read ocr_results:', err.message);
    }

    // Read files from base directory
    let files = [];
    try {
      files = fs.readdirSync(baseDir).filter(f => f !== 'ocr_results');
      debugLog('[file:listDocuments] Found', files.length, 'files in baseDir');
    } catch (err) {
      debugLog('[file:listDocuments] Error reading baseDir:', err.message);
      throw new Error(`Cannot read documents folder: ${err.message}`);
    }

    // Map files with metadata
    const documents = files.map(filename => {
      const filePath = path.join(baseDir, filename);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (err) {
        debugLog(`[file:listDocuments] Failed to stat ${filename}:`, err.message);
        return null;
      }

      if (stats.isDirectory()) return null;

      const ext = path.extname(filename).substring(1).toLowerCase();
      const baseName = filename.replace(/\.[^/.]+$/, '').trim();
      const isProcessed = processedFiles.has(baseName);

      return {
        name: filename,
        path: filePath,
        size: `${(stats.size / 1024).toFixed(2)} KB`,
        date: stats.mtime,
        type: ext || 'unknown',
        isProcessed: isProcessed
      };
    }).filter(f => f !== null);

    debugLog(`[file:listDocuments] Returning ${documents.length} documents from ${baseDir}`);
    return documents;
  } catch (err) {
    debugLog('[file:listDocuments] Error:', err.message);
    throw err;
  }
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

// Update open-folder handler to persist selection
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

    selectedFolderPath = result.filePaths[0];
    
    // ✅ Try to persist, but don't fail if store is corrupted
    try {
      store.set('selectedFolderPath', selectedFolderPath);
    } catch (storeErr) {
      debugLog('[open-folder] Warning: Could not persist to store:', storeErr.message);
      // Continue anyway - selectedFolderPath is cached in memory
    }
    
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

// NEW: Handle folder selection from renderer and update registry
ipcMain.handle('file:setSelectedFolder', async (event, folderPath) => {
  try {
    debugLog('[file:setSelectedFolder] Handler called with path:', folderPath);
    
    if (!folderPath || !fs.existsSync(folderPath)) {
      debugLog('[file:setSelectedFolder] Invalid path:', folderPath);
      return { success: false, error: 'Invalid folder path' };
    }
    
    // Update in-memory cache
    selectedFolderPath = folderPath;
    registryScandataDir = folderPath;
    debugLog('[file:setSelectedFolder] Updated in-memory values');
    
    // Persist to store
    try {
      store.set('selectedFolderPath', folderPath);
      store.set('scanDataDir', folderPath);
      debugLog('[file:setSelectedFolder] Saved to store');
    } catch (storeErr) {
      debugLog('[file:setSelectedFolder] Warning: store save failed:', storeErr.message);
    }
    
    // Update Windows Registry
    try {
      execSync(
        `reg add "HKCU\\Software\\APLSys" /v ScanDataDir /t REG_SZ /d "${folderPath}" /f`,
        { encoding: 'utf-8' }
      );
      debugLog('[file:setSelectedFolder] Updated Windows Registry');
    } catch (regErr) {
      debugLog('[file:setSelectedFolder] Warning: registry update failed:', regErr.message);
    }
    
    //CRITICAL: Broadcast to renderer
    const windows = BrowserWindow.getAllWindows();
    debugLog('[file:setSelectedFolder] Broadcasting to', windows.length, 'window(s)');
    
    windows.forEach((window, idx) => {
      if (window && !window.isDestroyed()) {
        debugLog('[file:setSelectedFolder] Sending registry-scan-dir to window', idx);
        window.webContents.send('registry-scan-dir', folderPath);
      }
    });
    
    return { success: true, path: folderPath };
  } catch (err) {
    debugLog('[file:setSelectedFolder] Error:', err.message);
    return { success: false, error: err.message };
  }
});