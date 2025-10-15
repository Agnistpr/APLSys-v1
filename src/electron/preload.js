const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileAPI', {
  selectFile: (opts) => ipcRenderer.invoke("dialog:openFile", opts),
  saveFileToFolder: (opts) => ipcRenderer.invoke("file:saveToFolder", opts),
  readFileAsBase64: (filePath) => ipcRenderer.invoke("file:readAsBase64", filePath),
  listDocuments: () => ipcRenderer.invoke("file:listDocuments"),
  deleteFile: (filePath) => ipcRenderer.invoke("file:delete", filePath),
  openDocument: (filePath) => ipcRenderer.invoke("file:openDocument", filePath),
  openFolder: (filePath) => ipcRenderer.invoke("open-folder", filePath), // ✅ new

  getUser: (username, password) => ipcRenderer.invoke("getUser", { username, password }),

  logAction: (userid, useraction, description) => ipcRenderer.invoke('logAction', { userid, useraction, description }),

  exportEmployees: () => ipcRenderer.invoke('exportEmployees'),
  exportAttendance: () => ipcRenderer.invoke('exportAttendance'),
  exportTodayAttendance: () => ipcRenderer.invoke('exportTodayAttendance'),
  exportAbsence: (date) => ipcRenderer.invoke('exportAbsence', date),
  exportInventory: () => ipcRenderer.invoke('exportInventory'),
  exportInventoryLogs: (date) => ipcRenderer.invoke('exportInventoryLogs', date),
  exportApplicants: (status) => ipcRenderer.invoke('exportApplicants', status),
  exportAllApplicants: () => ipcRenderer.invoke('exportAllApplicants'),
  exportTrainees: (status) => ipcRenderer.invoke('exportTrainees', status),
  exportAllTrainees: () => ipcRenderer.invoke('exportAllTrainees'),
  exportLogs: (date) => ipcRenderer.invoke('exportLogs', date),

  getEmployee: (id) => ipcRenderer.invoke('getEmployee', id),
  getEmployeeTableColumns: () => ipcRenderer.invoke('getEmployeeTableColumns'),
  searchEmployees: (term) => ipcRenderer.invoke('searchEmployees', term),
  updateEmployee: (employeeId, field, value) => {
    return ipcRenderer.invoke("updateEmployee", {
      employeeId: String(employeeId),
      field: String(field),
      value: value
    });
  },

  getFilteredEmployees: (filters, mode) => ipcRenderer.invoke('getFilteredEmployees', { filters, mode }),
  getFilterOptions: () => ipcRenderer.invoke('getFilterOptions'),

  getEmployeeAttendance: (id, date) => ipcRenderer.invoke('getEmployeeAttendance', id, date),
  getAttendance: () => ipcRenderer.invoke('getAttendance'),
  getAttendanceByDate: (date) => ipcRenderer.invoke('getAttendanceByDate', date),
  getAbsent: (date) => ipcRenderer.invoke('getAbsent', date),
  getLeave: (date) => ipcRenderer.invoke('getLeave', date),
  addLeave: (employeeIds, date, reason, duration, type) => ipcRenderer.invoke('addLeave', employeeIds, date, reason, duration, type),
  getDashboardCardData: () => ipcRenderer.invoke('getDashboardCardData'),
  getInventoryLogs: (date) => ipcRenderer.invoke('getInventoryLogs', date),
  getInventoryCard: () => ipcRenderer.invoke('getInventoryCard'),
  updateItem: (data) => ipcRenderer.invoke('updateItem', data),
  getTrainees: (status) => ipcRenderer.invoke('getTrainees', status),
  getApplicants: (status) => ipcRenderer.invoke('getApplicants', status),
  getLogs: (date) => ipcRenderer.invoke('getLogs', date),
  updateApplicantsStatus: (ids, options) => ipcRenderer.invoke("updateApplicantsStatus", ids, options),

  addApplicant: (resume) => ipcRenderer.invoke("addApplicant", resume),
  getDeptPos: () => ipcRenderer.invoke("getDeptPos"),

  updateLeaveStatus: (ids, status) => ipcRenderer.invoke("updateLeaveStatus", { ids, status }),

});

contextBridge.exposeInMainWorld('employeeAPI', {
  getEmployees: () => ipcRenderer.invoke('getEmployees'),
});

contextBridge.exposeInMainWorld('importAPI', {
  checkDuplicates: (data) => ipcRenderer.invoke("checkDuplicates", data),
  resolveConflicts: (data, action) => ipcRenderer.invoke("resolveConflicts", data, action),
  importAttendance: (data) => ipcRenderer.invoke("importAttendance", data),
});

contextBridge.exposeInMainWorld('columnAPI', {
  getAttendanceColumns: () => ipcRenderer.invoke("getAttendanceColumns"),
});