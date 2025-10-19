import { app, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { shell } from "electron";

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