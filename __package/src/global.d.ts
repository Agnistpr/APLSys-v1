export {};

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
    };
  }
}
