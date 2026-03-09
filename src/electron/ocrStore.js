import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useOcrStore = create(
  persist(
    (set, get) => ({
      // State fields (not setters)
      processingMap: {}, // <-- THIS should be the actual map object
      batchId: null,
      isProcessing: false,
      docs: [],
      currentFile: null,
      currentFileData: null, // ← PERSIST THIS
      rotation: 0, // <-- new global rotation state (degrees)
      currentExtractedData: [],
      ocrMatches: {},
      selectedFolder: null,
      linkedEmployeeId: null, // <-- new linked employee ID state

      // Action methods to update state
      setRotation: (r) => set({ rotation: r }), // <- new setter
      setProcessingMap: (mapOrFn) => {
        set(state => {
          const newMap = typeof mapOrFn === 'function' ? mapOrFn(state.processingMap) : mapOrFn;
          return { processingMap: newMap };
        });
      },
      
      setBatchId: (id) => set({ batchId: id }),
      setProcessing: (flag) => set({ isProcessing: flag }),
      setDocs: (docs) => set({ docs }),
      setCurrentFile: (file) => set({ currentFile: file }),
      setCurrentFileData: (data) => set({ currentFileData: data }), // ← ADD THIS
      setCurrentExtractedData: (data) => set({ currentExtractedData: data }),
      setOcrMatches: (matches) => set({ ocrMatches: matches }),
      setSelectedFolder: (folder) => set({ selectedFolder: folder }),
      setLinkedEmployeeId: (id) => set({ linkedEmployeeId: id }), // <- new setter for linked employee ID
      
      // Lightweight helpers used by DocumentScanner
      tasks: [],
      addFile: (fileMeta) => set(state => ({
        // keep docs as the primary list; append file meta so UI can show recent uploads
        docs: [...(state.docs || []), fileMeta]
      })),
      addTask: (task) => set(state => ({
        tasks: [...(state.tasks || []), task]
      })),
      setTasks: (tasks) => set({ tasks }),
      
      // Optional persistence helpers
      addResult: (result) => set(state => ({
        docs: [...(state.docs || []), result]
      })),
      
      markFileProcessed: (filename) => set(state => ({
        docs: (state.docs || []).map(doc => 
          doc.name === filename ? { ...doc, isProcessed: true } : doc
        )
      })),
    }),
    {
      name: "ocr-store",
      getStorage: () => localStorage,
      partialize: (state) => {
        const {
          processingMap,      // transient — do NOT persist
          batchId,            // transient — do NOT persist
          isProcessing,       // transient — do NOT persist
          docs,
          currentFile,
          currentFileData,
          rotation, // persist rotation so it survives navigation (cleared when file cleared)
          currentExtractedData,
          ocrMatches,
          linkedEmployeeId,  
        } = state;
        return {
          docs: docs || [],
          currentFile: currentFile || null,
          currentFileData: currentFileData || null, // ← PERSIST THIS
          rotation: typeof rotation === 'number' ? rotation : 0,
          currentExtractedData: currentExtractedData || [],
          ocrMatches: ocrMatches || {},
          linkedEmployeeId, 
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure no persisted image/preview survives a cold start.
          // Revoke any blob: URL to avoid leaked previews, then clear persisted file data.
          try {
            const cf = state.currentFile;
            if (cf && typeof cf === 'object' && cf.url && String(cf.url).startsWith('blob:')) {
              try { URL.revokeObjectURL(cf.url); } catch (_) {}
            }
          } catch (_) {}
  
          // Clear persisted file/preview data so scanner starts clean
          state.currentFile = null;
          state.currentFileData = null;
          state.currentExtractedData = [];
  
          // Reset transient flags as before
          state.processingMap = {};
          state.batchId = null;
          state.isProcessing = false;
        }
      }
    }
  )
);
