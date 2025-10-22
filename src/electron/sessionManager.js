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
  // console.log("[getCurrentUser] called");
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const user = authData?.user;
    if (!user) {
      // console.warn("[getCurrentUser] no authenticated user");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("userid, uid, username, userrole, userimage, employeeid, createddate")
      .eq("uid", user.id)
      .single();

    if (profileError) {
      // console.warn("[getCurrentUser] no profile found:", profileError.message);
    }

    const merged = {
      id: user.id,
      email: user.email,
      username: profile?.username || user.email,
      userrole: profile?.userrole || "Unknown Role",
      userimage: profile?.userimage || null,
      employeeid: profile?.employeeid || null,
      createddate: profile?.createddate || null,
    };

    // console.log("[getCurrentUser] merged user:", merged);
    return merged;
  } catch (err) {
    // console.error("[getCurrentUser]", err.message);
    return null;
  }
});


supabase.auth.onAuthStateChange((_event, session) => {
  // if (session) {
  //   setSession(session);
  // } else {
  //   clearSession();
  // } this is broken rn
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("auth-state-changed", session);
  });
});

export { initStore, getSession, restoreSession };