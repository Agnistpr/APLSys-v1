import { app, BrowserWindow, Menu, screen } from "electron";
import { initLogger, debugLog } from "./logger.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { execSync } from "child_process";
import contextMenu from "electron-context-menu";
import "dotenv/config";
import { getSession, restoreSession } from "./sessionManager.js";
import { cspDirectives } from "./security-config.js";
import Store from "electron-store";
import { logMessage } from "./queries.js";
import "./files.js";
import { setRegistryScanDataDir } from "./files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initializeStore() {
  try {
    const store = new Store();
    // Try to read a value to validate the store
    store.get("test");
    return store;
  } catch (err) {
    debugLog('[Store] Corrupted store detected, clearing it:', err.message);
    
    // Store is corrupted, clear it
    const storePath = path.join(app.getPath("userData"), "config.json");
    try {
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        debugLog('[Store] Deleted corrupted config file:', storePath);
      }
    } catch (delErr) {
      debugLog('[Store] Failed to delete corrupted config:', delErr.message);
    }
    
    // Create fresh store
    return new Store();
  }
}

// Clear corrupted store on startup
function cleanupCorruptedStore() {
  try {
    const storePath = path.join(app.getPath('userData'), 'aplsys-store.json');
    if (fs.existsSync(storePath)) {
      const content = fs.readFileSync(storePath, 'utf8');
      // Try to parse it
      JSON.parse(content);
      console.log('[cleanupCorruptedStore] Store is valid');
    }
  } catch (err) {
    debugLog('[cleanupCorruptedStore] Store is corrupted, removing:', err.message);
    try {
      const storePath = path.join(app.getPath('userData'), 'aplsys-store.json');
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        console.log('[cleanupCorruptedStore] Deleted corrupted store');
      }
    } catch (delErr) {
      debugLog('[cleanupCorruptedStore] Could not delete store:', delErr.message);
    }
  }
}

// Call this FIRST, before creating the Store
cleanupCorruptedStore();
//create a new store
const store = initializeStore();

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

let mainWindow;

// Function to read scan directory from Windows registry
function readScanDirFromRegistry() {
  try {
    console.log('[readScanDirFromRegistry] Attempting to read registry...');
    const result = execSync(
      'reg query "HKCU\\Software\\APLSys" /v ScanDataDir',
      { encoding: 'utf-8' }
    );
    console.log('[readScanDirFromRegistry] Raw registry output:', result);
    
    const match = result.match(/ScanDataDir\s+REG_SZ\s+(.+)/);
    console.log('[readScanDirFromRegistry] Match result:', match);
    
    const scanDir = match ? match[1].trim() : null;
    console.log('[readScanDirFromRegistry] Parsed scanDir:', scanDir);
    return scanDir;
  } catch (err) {
    console.log("[readScanDirFromRegistry] Registry read failed:", err.message);
    return null;
  }
}

// ✅ NEW: Initialize registry with default directory on first run
function initializeRegistryIfNeeded() {
  try {
    const existing = readScanDirFromRegistry();
    if (existing) {
      debugLog('[initializeRegistryIfNeeded] Registry already set:', existing);
      return existing;
    }

    // First run: set default directory
    const defaultDir = path.join(app.getPath('documents'), 'APLSys-Documents');
    debugLog('[initializeRegistryIfNeeded] First run detected, setting default:', defaultDir);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
      debugLog('[initializeRegistryIfNeeded] Created default directory');
    }

    // Write to registry
    try {
      execSync(
        `reg add "HKCU\\Software\\APLSys" /v ScanDataDir /t REG_SZ /d "${defaultDir}" /f`,
        { encoding: 'utf-8' }
      );
      debugLog('[initializeRegistryIfNeeded] ✅ Registry initialized:', defaultDir);
      return defaultDir;
    } catch (regErr) {
      debugLog('[initializeRegistryIfNeeded] Failed to write to registry:', regErr.message);
      return defaultDir; // Return the default even if registry write fails
    }
  } catch (err) {
    debugLog('[initializeRegistryIfNeeded] Error:', err.message);
    return null;
  }
}

async function createWindow() {
  debugLog('[main.js] App starting', { isPackaged: app.isPackaged });
  logMessage("App started");
  
  // ✅ Initialize registry on app startup
  const scanDirFromRegistry = initializeRegistryIfNeeded();
  debugLog('[main.js] Registry scanDataDir found:', scanDirFromRegistry);
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
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

  mainWindow.on("close", async (e) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.executeJavaScript(`
          window.utilityAPI.clearAllDates();
        `);
        logMessage("Date filters cleared before window closed.");
      }
    } catch (err) {
      logMessage("Clear cache error: " + (err.stack || err));
    }
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

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

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

  // Read from registry and save to store on app startup
  debugLog('[main.js] Registry scanDataDir found:', scanDirFromRegistry);
  
  if (scanDirFromRegistry) {
    debugLog('[main.js] Registry scanDataDir found:', scanDirFromRegistry);
    
    // Pass it to files.js to cache in memory
    setRegistryScanDataDir(scanDirFromRegistry);
    
    // Send to renderer when page loads
    mainWindow.webContents.on('did-finish-load', () => {
      debugLog('[main.js] Sending registry-scan-dir to renderer:', scanDirFromRegistry);
      if (mainWindow && !mainWindow.isDestroyed()) {
        debugLog('[main.js] Sending registry-scan-dir to renderer:', scanDirFromRegistry);
        mainWindow.webContents.send('registry-scan-dir', scanDirFromRegistry);
      }
    });
  }
}



app.on("ready", () => {
  createWindow();
});