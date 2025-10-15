const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileAPI', {
  selectFile: (opts) => ipcRenderer.invoke("dialog:openFile", opts),
  saveFileToFolder: (opts) => ipcRenderer.invoke("file:saveToFolder", opts),
  readFileAsBase64: (filePath) => ipcRenderer.invoke("file:readAsBase64", filePath),
  listDocuments: () => ipcRenderer.invoke("file:listDocuments"),
  deleteFile: (filePath) => ipcRenderer.invoke("file:delete", filePath),
  openDocument: (filePath) => ipcRenderer.invoke("file:openDocument", filePath),
  openFolder: (filePath) => ipcRenderer.invoke("open-folder", filePath),
});

contextBridge.exposeInMainWorld('userAPI', {
  getUser: (username, password) => ipcRenderer.invoke("getUser", { username, password }),
  logAction: (userid, useraction, description) =>
    ipcRenderer.invoke('logAction', { userid, useraction, description }),
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
  exportTodayAttendance: () => ipcRenderer.invoke('exportTodayAttendance'),
  exportTrainees: (status) => ipcRenderer.invoke('exportTrainees', status),
});

contextBridge.exposeInMainWorld('employeeAPI', {
  getEmployees: () => ipcRenderer.invoke('getEmployees'),
  getEmployee: (id) => ipcRenderer.invoke('getEmployee', id),
  getEmployeeTableColumns: () => ipcRenderer.invoke('getEmployeeTableColumns'),
  searchEmployees: (term) => ipcRenderer.invoke('searchEmployees', term),
  updateEmployee: (employeeId, field, value) =>
    ipcRenderer.invoke("updateEmployee", {
      employeeId: String(employeeId),
      field: String(field),
      value: value
    }),
  getFilteredEmployees: (filters, mode) => ipcRenderer.invoke('getFilteredEmployees', { filters, mode }),
  getFilterOptions: () => ipcRenderer.invoke('getFilterOptions'),
});

contextBridge.exposeInMainWorld('attendanceAPI', {
  getAttendanceColumns: () => ipcRenderer.invoke("getAttendanceColumns"),
  getEmployeeAttendance: (id, date) => ipcRenderer.invoke('getEmployeeAttendance', id, date),
  getAttendance: () => ipcRenderer.invoke('getAttendance'),
  getAttendanceByDate: (date) => ipcRenderer.invoke('getAttendanceByDate', date),
  getAbsent: (date) => ipcRenderer.invoke('getAbsent', date),
  getLeave: (date) => ipcRenderer.invoke('getLeave', date),
  addLeave: (employeeIds, date, reason, duration, type) =>
    ipcRenderer.invoke('addLeave', employeeIds, date, reason, duration, type),
  updateLeaveStatus: (ids, status) =>
    ipcRenderer.invoke("updateLeaveStatus", { ids, status }),
});

contextBridge.exposeInMainWorld('inventoryAPI', {
  getInventoryLogs: (date) => ipcRenderer.invoke('getInventoryLogs', date),
  getInventoryCard: () => ipcRenderer.invoke('getInventoryCard'),
  updateItem: (data) => ipcRenderer.invoke('updateItem', data),
});

contextBridge.exposeInMainWorld('applicantAPI', {
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
});

contextBridge.exposeInMainWorld('importAPI', {
  checkDuplicates: (data) => ipcRenderer.invoke("checkDuplicates", data),
  resolveConflicts: (data, action) => ipcRenderer.invoke("resolveConflicts", data, action),
  importAttendance: (data) => ipcRenderer.invoke("importAttendance", data),
});

contextBridge.exposeInMainWorld('authAPI', {
  signup: (email, password) => ipcRenderer.invoke('signUp', { email, password }), // 🆕
  login: (email, password) => ipcRenderer.invoke('logIn', { email, password }),
  logout: () => ipcRenderer.invoke('logOut'),
  getSession: () => ipcRenderer.invoke('getSession'),
});

// console.log("Test load", Object.keys(window));