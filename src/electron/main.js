import { app, BrowserWindow, Menu, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import contextMenu from "electron-context-menu";
import { spawn, exec } from "child_process";
import "dotenv/config";
import { getSession, restoreSession } from "./sessionManager.js";
import { cspDirectives } from "./security-config.js";
import "./files.js";
import "./queries.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logPath = app.isPackaged
  ? path.join(app.getPath("userData"), "log.txt")
  : path.join(process.cwd(), "log.txt");

function logMessage(message) {
  const time = new Date().toISOString();
  fs.appendFileSync(logPath, `[${time}] ${message}\n`);
}

process.on("uncaughtException", (err) => logMessage(`ERROR: ${err.stack || err}`));
process.on("unhandledRejection", (reason) => logMessage(`UNHANDLED REJECTION: ${reason}`));

contextMenu({
  showSelectAll: false,
  prepend: (_, __, browserWindow) => {
    const wc = browserWindow.webContents;
    const zoomPercent = Math.round((wc.getZoomFactor() || 1) * 100);
    return [
      { label: "Zoom In", click: () => wc.setZoomFactor((wc.getZoomFactor() || 1) + 0.1) },
      { label: "Zoom Out", click: () => wc.setZoomFactor((wc.getZoomFactor() || 1) - 0.1) },
      { label: `Reset Zoom (${zoomPercent}%)`, click: () => wc.setZoomFactor(1) },
      { type: "separator" },
      { label: "Reload", click: () => wc.reload() },
    ];
  },
});

let backendProcess;

function startBackend() {
  const backendPython = "python";
  const nerScript = path.join(__dirname, "..", "..", "parser", "ner_api.py");
  if (!fs.existsSync(nerScript)) {
    logMessage("ERROR: ner_api.py not found!");
    return;
  }
  backendProcess = spawn(backendPython, [`"${nerScript}"`], {
    cwd: path.dirname(nerScript),
    shell: true,
    windowsHide: true,
  });
  backendProcess.unref();
  backendProcess.stdout.on("data", (d) => logMessage(`[NER_API] ${d.toString().trim()}`));
  backendProcess.stderr.on("data", (d) => logMessage(`[NER_API ERROR] ${d.toString().trim()}`));
  backendProcess.on("close", (c) => logMessage(`[NER_API] exited with code ${c}`));
}

function stopBackend() {
  return new Promise((resolve) => {
    if (backendProcess && !backendProcess.killed) {
      exec(`taskkill /PID ${backendProcess.pid} /T /F`, () => {
        backendProcess = null;
        resolve();
      });
    } else resolve();
  });
}

app.on("ready", async () => {
  try {
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
        enableRemoteModule: false,
        sandbox: true,
         webSecurity: true,
         allowRunningInsecureContent: false
      },
      icon: path.join(__dirname, '../assets/appLogo.png')
    });

      // Build and apply CSP headers
      const csp = Object.entries(cspDirectives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');

      // Set CSP headers for all responses
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp]
          }
        });
      });

    mainWindow.loadFile(path.join(app.getAppPath(), "/dist-react/index.html"));
    Menu.setApplicationMenu(null);

    const session = await getSession();
    if (getSession) {
      const restoreResult = await restoreSession(null, getSession);
      if (restoreResult.success) logMessage("Session found and restored");
      else logMessage("Failed to auto-restore session: " + restoreResult.error);
    } else {
      logMessage("No remembered session found");
    }

    logMessage("App started");
  } catch (err) {
    logMessage(`ERROR: ${err.stack || err}`);
  }
});

app.on("before-quit", async (event) => {
  event.preventDefault();
  try {
    logMessage("Stopping backend...");
    await stopBackend();
  } catch (err) {
    logMessage(`Shutdown error: ${err.stack || err}`);
  } finally {
    app.exit();
  }
});
