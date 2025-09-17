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

async function waitForBackend(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log("✅ Backend is up!");
        return true;
      }
    } catch (err) {
      console.log("Waiting for backend...");
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error("Backend did not start in time");
}

function startBackend() {
  const backendProcess = spawn('npm', ['run', 'start-ner'], {// Start NER server on app startup
    cwd: path.resolve(__dirname, "../../"),
    shell: true,
    stdio: "inherit"
  });

  console.log("Backend cwd:", path.resolve(__dirname, "../../"));

  if (!fs.existsSync(backendProcess)) {
    logMessage("ERROR: ner_api.ts not found!");
    return;
  }

  backendProcess.on("error", (err) => {
    console.error("[Backend] Failed to start:", err);
  });

  backendProcess.on("exit", (code) => {
    console.error(`[Backend] exited with code ${code}`);
  });

  backendProcess.on("close", (code) => {
    console.log(`[NER_API] exited with code ${code}`);
  });
  
  waitForBackend("http://localhost:8000/health")
  .then(() => console.log("[Backend] Ready to accept requests"))
  .catch((err) => console.error(err.message));

  const logFile = path.resolve(__dirname, "../../backend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);


  return backendProcess
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
    startBackend();
    await waitForBackend("http://localhost:8000/health");
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
