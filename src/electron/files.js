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
  fs.mkdirSync(baseDir, { recursive: true }); // ensure folder exists

  const files = fs.readdirSync(baseDir);

  return files.map((file) => {
    const stat = fs.statSync(path.join(baseDir, file));
    return {
      name: file,
      type: path.extname(file).substring(1),
      size: `${(stat.size / 1024).toFixed(1)} KB`,
      date: stat.mtime,
      path: path.join(baseDir, file),
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