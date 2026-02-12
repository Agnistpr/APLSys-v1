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
      getScanDataDir: () => Promise<string>;
      setSelectedFolder: (folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      createDirectory: (path: string) => Promise<any>;
      readDirectory: (path: string) => Promise<any>;
      readFile: (path: string) => Promise<any>;
      writeFile: (path: string, content: any) => Promise<any>;

      // === OCR Batch Processing ===
      startBatchOcr: (opts?: any) => Promise<any>;
      onOcrProgress: (
        cb: (data: any) => void
      ) => () => void; // returns unsubscribe fn

      // == Event Listeners ==
      onRegistryScanDir: (callback: (dir: string) => void) => () => void;
    },
    applicantAPI: {
      getApplicant: (applicantId: any) => Promise<any>;
      updateApplicant: (applicantId: any, field: string, value: any) => Promise<any>;
      getApplicants: (status?: any) => Promise<any[]>;
      addApplicant: (resume: any) => Promise<any>;
      updateApplicantsStatus: (ids: any[], options?: any) => Promise<any>;
      getTrainees: (status?: any) => Promise<any[]>;
    },
    employeeAPI:
    {
      getEmployees: () => Promise<Array<{
        employeeid: number;
        name: string;
        department: string;
        position: string;
        shift: string;
        leavecredit: number;
      }>>;
      getEmployee: (id: number) => Promise<{
        employeeid: number;
        firstname: string;
        middlename: string;
        lastname: string;
        department: string;
        position: string;
        contact: string;
        email: string;
        address: string;
        gender: string;
        age: number;
        birthdate: string;
        hiredate: string;
        sss_number: string;
        pagibig_number: string;
        philhealth_number: string;
        bir_number: string;
        leavecredit: number;
        shiftstart: string;
        shiftend: string;
        employeeimage: string | null;
        type: string;
        maritalstatus: string;
      } | null>;
      getEmployeeTableColumns: () => Promise<any[]>;
      searchEmployees: (term: string) => Promise<any[]>;
      updateEmployee: (employeeId: number, field: string, value: any) => Promise<{ success: boolean; error?: string }>;
      getFilteredEmployees: (filters: any, mode: string) => Promise<any[]>;
      getFilterOptions: () => Promise<any>;
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
