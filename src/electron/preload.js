const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileAPI', {
  selectFile: (opts) => ipcRenderer.invoke("dialog:openFile", opts),
  saveFileToFolder: (opts) => ipcRenderer.invoke("file:saveToFolder", opts),
  readFileAsBase64: (filePath) => ipcRenderer.invoke("file:readAsBase64", filePath),
  hexToBase64: (hexString) => ipcRenderer.invoke('file:hexToBase64', hexString),
  listDocuments: () => ipcRenderer.invoke("file:listDocuments"),
  deleteFile: (filePath) => ipcRenderer.invoke("file:delete", filePath),
  openDocument: (filePath) => ipcRenderer.invoke("file:openDocument", filePath),
  openFolder: (filePath) => ipcRenderer.invoke("open-folder", filePath),
  createDirectory: (path) => ipcRenderer.invoke('file:createDirectory', path),
  readDirectory: (path) => ipcRenderer.invoke('file:readDirectory', path),
  readFile: (path) => ipcRenderer.invoke('file:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:writeFile', path, content),
  startBatchOcr: (opts) => ipcRenderer.invoke('ocr:startBatch', opts),
  onOcrProgress: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('ocr-progress', listener);
    return () => ipcRenderer.removeListener('ocr-progress', listener);
  },
    createDirectory: (path) => ipcRenderer.invoke('file:createDirectory', path),
  readDirectory: (path) => ipcRenderer.invoke('file:readDirectory', path),
  readFile: (path) => ipcRenderer.invoke('file:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:writeFile', path, content),
  startBatchOcr: (opts) => ipcRenderer.invoke('ocr:startBatch', opts),
  onOcrProgress: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('ocr-progress', listener);
    return () => ipcRenderer.removeListener('ocr-progress', listener);
  },
});

contextBridge.exposeInMainWorld('userAPI', {
  getUser: (username, password) => ipcRenderer.invoke("getUser", { username, password }),
  logAction: (uid, useraction, description) =>
    ipcRenderer.invoke('logAction', { uid, useraction, description }),
});

contextBridge.exposeInMainWorld('exportAPI', {
  exportAbsence: (date) => ipcRenderer.invoke('exportAbsence', date),
  exportAllApplicants: () => ipcRenderer.invoke('exportAllApplicants'),
  exportAllTrainees: () => ipcRenderer.invoke('exportAllTrainees'),
  exportApplicants: (status) => ipcRenderer.invoke('exportApplicants', status),
  exportAttendance: () => ipcRenderer.invoke('exportAttendance'),
  exportEmployees: () => ipcRenderer.invoke('exportEmployees'),
  exportInventory: () => ipcRenderer.invoke('exportInventory'),
  exportInventoryLogs: (date) => ipcRenderer.invoke('exportInventoryLogs', date),
  exportLogs: (date) => ipcRenderer.invoke('exportLogs', date),
  // exportTodayAttendance: () => ipcRenderer.invoke('exportTodayAttendance'),
  exportTrainees: (status) => ipcRenderer.invoke('exportTrainees', status),
});

contextBridge.exposeInMainWorld('employeeAPI', {
  getEmployees: () => ipcRenderer.invoke('getEmployees'),
  getEmployee: (id) => ipcRenderer.invoke('getEmployee', id),
  getEmployeeTableColumns: () => ipcRenderer.invoke('getEmployeeTableColumns'),
  searchEmployees: (term) => ipcRenderer.invoke('searchEmployees', term),
  updateEmployee: (employeeId, field, value) =>
    ipcRenderer.invoke("updateEmployee", employeeId, field, value),
  getFilteredEmployees: (filters, mode) => ipcRenderer.invoke('getFilteredEmployees', { filters, mode }),
  getFilterOptions: () => ipcRenderer.invoke('getFilterOptions'),
});

contextBridge.exposeInMainWorld('attendanceAPI', {
  getAttendanceColumns: () => ipcRenderer.invoke("getAttendanceColumns"),
  getEmployeeAttendance: (id, date) => ipcRenderer.invoke('getEmployeeAttendance', id, date),
  getApplicantAttendance: (applicantId, selectedDate = null) =>
    ipcRenderer.invoke("getApplicantAttendance", applicantId, selectedDate),
  getAttendance: (date) => ipcRenderer.invoke('getAttendance', date),
  getAbsent: (date) => ipcRenderer.invoke('getAbsent', date),
  getLeave: (date) => ipcRenderer.invoke('getLeave', date),
  addLeave: (employeeIds, date, reason, duration, type, isPaid, status) =>
    ipcRenderer.invoke('addLeave', employeeIds, date, reason, duration, type, isPaid, status),
  updateLeaveStatus: (ids, status) =>
    ipcRenderer.invoke("updateLeaveStatus", { ids, status }),
});

contextBridge.exposeInMainWorld('inventoryAPI', {
  getInventoryLogs: (date) => ipcRenderer.invoke('getInventoryLogs', date),
  getInventoryCard: () => ipcRenderer.invoke('getInventoryCard'),
  addInventoryLog: async (data) => ipcRenderer.invoke("addInventoryLog", data),
  updateItem: (data) => ipcRenderer.invoke('updateItem', data),
  addItem: (data) => ipcRenderer.invoke("addItem", data),
  deleteItem: (itemid) => ipcRenderer.invoke("deleteItem", itemid),
});

contextBridge.exposeInMainWorld('applicantAPI', {
  getApplicant: (applicantId) => ipcRenderer.invoke("getApplicant", applicantId),
  updateApplicant: (applicantId, field, value) =>
    ipcRenderer.invoke("updateApplicant", applicantId, field, value),
  getApplicants: (status) => ipcRenderer.invoke('getApplicants', status),
  addApplicant: (resume) => ipcRenderer.invoke("addApplicant", resume),
  updateApplicantsStatus: (ids, options) =>
    ipcRenderer.invoke("updateApplicantsStatus", ids, options),
  getTrainees: (status) => ipcRenderer.invoke('getTrainees', status),
});

contextBridge.exposeInMainWorld('utilityAPI', {
  getDeptPos: () => ipcRenderer.invoke("getDeptPos"),
  getLogs: (date) => ipcRenderer.invoke('getLogs', date),
  getDashboardCardData: () => ipcRenderer.invoke('getDashboardCardData'),
  importAttendance: (rows) => ipcRenderer.invoke("importAttendance", { rows }),
});

// contextBridge.exposeInMainWorld('importAPI', {
//   checkDuplicates: (data) => ipcRenderer.invoke("checkDuplicates", data),
//   resolveConflicts: (data, action) => ipcRenderer.invoke("resolveConflicts", data, action),
//   importAttendance: (data) => ipcRenderer.invoke("importAttendance", data),
// });

contextBridge.exposeInMainWorld('authAPI', {
  signup: (email, password) => ipcRenderer.invoke("signUp", { email, password }),
  login: (email, password) => ipcRenderer.invoke("logIn", { email, password }),
  logout: () => ipcRenderer.invoke("logOut"),

  getSession: () => ipcRenderer.invoke("getSession"),
  setSession: (session) => ipcRenderer.invoke("setSession", session),
  clearSession: () => ipcRenderer.invoke("clearSession"),
  restoreSession: (session) => ipcRenderer.invoke("restoreSession", session),

  onAuthStateChange: (callback) => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on("auth-state-changed", listener);
    return () => ipcRenderer.removeListener("auth-state-changed", listener);
  },
  getCurrentUser: () => ipcRenderer.invoke("getCurrentUser"),
});

// console.log("Test load", Object.keys(window));