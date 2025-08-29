import { app, BrowserWindow, Menu, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import contextMenu from "electron-context-menu";
import { spawn, exec } from "child_process";

import { initDatabase, startDatabase, stopDatabase, closeDatabaseConnection, connectToDatabase } from "./db.js";
import "./files.js";
import "./queries.js";

// -------- Paths --------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logPath = app.isPackaged
  ? path.join(app.getPath("userData"), "log.txt")
  : path.join(process.cwd(), "log.txt");

function logMessage(message) {
  const time = new Date().toISOString();
  fs.appendFileSync(logPath, `[${time}] ${message}\n`);
}

process.on("uncaughtException", (err) => {
  logMessage(`ERROR: ${err.stack || err}`);
});
process.on("unhandledRejection", (reason, p) => {
  logMessage(`UNHANDLED REJECTION: ${reason}`);
});

contextMenu({
  showSelectAll: false,
  prepend: (defaultActions, parameters, browserWindow) => {
    const wc = browserWindow.webContents;
    const zoomPercent = Math.round((wc.getZoomFactor() || 1) * 100);

    return [
      {
        label: "Zoom In",
        click: () => wc.setZoomFactor((wc.getZoomFactor() || 1) + 0.1),
      },
      {
        label: "Zoom Out",
        click: () => wc.setZoomFactor((wc.getZoomFactor() || 1) - 0.1),
      },
      {
        label: `Reset Zoom (${zoomPercent}%)`,
        click: () => wc.setZoomFactor(1),
      },
      { type: "separator" },
      {
        label: "Reload",
        click: () => wc.reload(),
      },
    ];
  },
});

let backendProcess;

function startBackend() {
  const backendPython = "python"; // make sure Python is in PATH
  const nerScript = path.join(__dirname, "..", "..", "parser", "ner_api.py");

  if (!fs.existsSync(nerScript)) {
    logMessage("ERROR: ner_api.py not found!");
    return;
  }

  backendProcess = spawn(backendPython, [`"${nerScript}"`], { 
    cwd: path.dirname(nerScript),
    shell: true,
    windowsHide: true,
    // detached: true, // testing
  });

  backendProcess.unref(); 
  backendProcess.stdout.on("data", (data) => logMessage(`[NER_API] ${data.toString().trim()}`));
  backendProcess.stderr.on("data", (data) => logMessage(`[NER_API ERROR] ${data.toString().trim()}`));
  backendProcess.on("close", (code) => logMessage(`[NER_API] exited with code ${code}`));
}

function stopBackend() {
  return new Promise((resolve) => {
    if (backendProcess && !backendProcess.killed) {
      exec(`taskkill /PID ${backendProcess.pid} /T /F`, (err, stdout, stderr) => {
        if (err) logMessage(`taskkill error: ${err}`);
        else logMessage(`taskkill output: ${stdout || stderr}`);
        backendProcess = null; // mark it cleared
        resolve();
      });
    } else resolve();
  });
}

// App thingy
app.on("ready", async () => {
  try {
    initDatabase();
    startDatabase();
    connectToDatabase();
    startBackend();

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const mainWindow = new BrowserWindow({
      title: "APLSys",
      width,
      height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      },
    });

    mainWindow.loadFile(
      path.join(app.getAppPath(), "/dist-react/index.html")
    );

    // Remove Menu on top - Comment out if debugging
    Menu.setApplicationMenu(null);
    logMessage("App started");
  } catch (err) {
    logMessage(`ERROR: ${err.stack || err}`);
  }
});

app.on("before-quit", async (event) => {
  event.preventDefault();
  try {
    logMessage("Closing DB connection...");
    await closeDatabaseConnection();

    logMessage("Shutting down DB...");
    stopDatabase();

    logMessage("Stopping backend...");
    await stopBackend();
  } catch (err) {
    logMessage(`Shutdown error: ${err.stack || err}`);
  } finally {
    app.exit();
  }
});