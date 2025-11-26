export {};

// Utility file to export API functions from preload to here in /app
declare global {
  interface File{
    path?: string; // Added by Electron's file dialog
  }
  interface Window {
    fileAPI: {
      // === File Dialogs ===
      selectFile: (opts?: any) => Promise<any>;
      saveFileToFolder: (opts?: any) => Promise<any>;
      saveUploadedFile: (opts: { fileName: string; base64Data: string }) => Promise<{ success: boolean; path?: string; error?: string }>;

      // === File Operations ===
      readFileAsBase64: (filePath: string) => Promise<string>;
      hexToBase64: (hexString: string) => Promise<string>;
      listDocuments: () => Promise<any>;
      deleteFile: (filePath: string) => Promise<any>;
      openDocument: (filePath: string) => Promise<any>;
      openFolder: (filePath: string) => Promise<any>;
      moveFileToFolder: (sourcePath: string, targetDir: string) => Promise<any>;

      // === Directory Operations ===
      createDirectory: (path: string) => Promise<any>;
      readDirectory: (path: string) => Promise<any>;
      readFile: (path: string) => Promise<any>;
      writeFile: (path: string, content: any) => Promise<any>;

      // === OCR Batch Processing ===
      startBatchOcr: (opts?: any) => Promise<any>;
      onOcrProgress: (
        cb: (data: any) => void
      ) => () => void; // returns unsubscribe fn
    },
    applicantAPI: {
      getApplicant: (applicantId: any) => Promise<any>;
      updateApplicant: (applicantId: any, field: string, value: any) => Promise<any>;
      getApplicants: (status?: any) => Promise<any[]>;
      addApplicant: (resume: any) => Promise<any>;
      updateApplicantsStatus: (ids: any[], options?: any) => Promise<any>;
      getTrainees: (status?: any) => Promise<any[]>;
    },
    utilityAPI: {
      getDeptPos: () => Promise<Array<{ departmentid: number; departmentname: string; positionid: number; positionname: string }>>;
      getLogs: (date?: string) => Promise<any[]>;
      getDashboardCardData: () => Promise<any>;
      checkAttendanceDuplicates: (entries: any[]) => Promise<any>;
      importAttendance: (rows: any[]) => Promise<any>;
    },
    userAPI: {
      getUser: (username: string, password: string) => Promise<any>;
      logAction: (uid: any, useraction: string, description?: string) => Promise<any>;
    };
  }
}
