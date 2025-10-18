import { ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import keytar from "keytar";
import crypto from "crypto";
import supabase from "./supabaseClient.js";

const SERVICE_NAME = "APLSys";
const ENCRYPTION_ACCOUNT = "electron-store-encryption-key";

let store;

async function initStore() {
  if (store) return store;

  let encryptionKey = await keytar.getPassword(SERVICE_NAME, ENCRYPTION_ACCOUNT);
  if (!encryptionKey) {
    encryptionKey = crypto.randomBytes(32).toString("base64");
    await keytar.setPassword(SERVICE_NAME, ENCRYPTION_ACCOUNT, encryptionKey);
  }

  store = new Store({ encryptionKey });
  return store;
}

async function setSession(session) {
  const s = await initStore();
  s.set("supabaseSession", session);
}

async function getSession() {
  const s = await initStore();
  return s.get("supabaseSession") || null;
}

async function clearSession() {
  const s = await initStore();
  s.delete("supabaseSession");
}

async function restoreSession(_event, session) {
  try {
    if (!supabase) throw new Error("Supabase client not initialized");
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("Invalid session object");
    }

    const { error } = await supabase.auth.setSession(session);
    if (error) throw error;

    await setSession(session);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

ipcMain.handle("getSession", getSession);
ipcMain.handle("setSession", (_e, session) => setSession(session));
ipcMain.handle("clearSession", clearSession);
ipcMain.handle("restoreSession", (_e, session) => restoreSession(null, session));

ipcMain.handle("getCurrentUser", async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  } catch (err) {
    console.error("[getCurrentUser]", err.message);
    return null;
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  console.log("[MAIN] auth-state-changed:", session?.user?.email || "no session");
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("auth-state-changed", session);
  });
});

export { initStore, getSession, restoreSession };