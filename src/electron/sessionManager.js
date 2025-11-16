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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log("No active user — forcing logout.");

      await supabase.auth.signOut();
      await clearSession();

      return { logout: true };
    }

    const { data: employee, error: empError } = await supabase
      .from("employee")
      .select("employeeid, firstname, lastname, middlename, positionid, employeeimage")
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return {
        id: user.id,
        name: user.user_metadata?.full_name || "Unknown user",
        role: "N/A",
        image: null,
        email: user.email,
      };
    }

    const { data: position, error: posError } = await supabase
      .from("position")
      .select("positionname")
      .eq("positionid", employee.positionid)
      .single();

    const positionName = posError
      ? "Unknown Role"
      : position?.positionname || "Employee";

    let imageUrl = null;

    if (employee.employeeimage) {
      // Only call getPublicUrl if it's a relative path, not a full URL
      if (employee.employeeimage.startsWith("http")) {
        imageUrl = employee.employeeimage;
      } else {
        const { data: imgData } = supabase.storage
          .from("image")
          .getPublicUrl(employee.employeeimage);
        imageUrl = imgData?.publicUrl || null;
      }
    }

    return {
      id: user.id,
      name: user.user_metadata?.full_name || `${employee.firstname} ${employee.lastname}`,
      role: positionName,
      image: imageUrl,
      email: user.email,
    };
  } catch (err) {
    console.error("❌ Error in getCurrentUser IPC:", err);
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