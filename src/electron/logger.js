// src/electron/logger.js
import fs from "fs";
import path from "path";

let logPath = null;

export function initLogger(app) {
  logPath = app.isPackaged
    ? path.join(app.getPath("userData"), "aplsys-debug.log")
    : path.join(process.cwd(), "aplsys-debug.log");
}

export function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;

  if (!logPath) {
    console.log("[LOGGER NOT INITIALIZED]", message, data);
    return;
  }

  fs.appendFileSync(logPath, logEntry);
  console.log(message, data);
}