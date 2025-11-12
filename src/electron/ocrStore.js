import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useOcrStore = create(
  persist(
    (set, get) => ({
      // ✅ State fields (not setters)
      processingMap: {}, // <-- THIS should be the actual map object
      batchId: null,
      isProcessing: false,
      docs: [],
      currentFile: null,
      currentExtractedData: [],
      ocrMatches: {},

      // ✅ Action methods to update state
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
      setCurrentExtractedData: (data) => set({ currentExtractedData: data }),
      setOcrMatches: (matches) => set({ ocrMatches: matches }),
      
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
          ...persistable      // keep docs, currentExtractedData, etc.
        } = state;
        return {
          docs: persistable.docs || [],
          currentFile: persistable.currentFile || null,
          currentExtractedData: persistable.currentExtractedData || [],
          ocrMatches: persistable.ocrMatches || {},
          // do NOT include processingMap, batchId, isProcessing
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reset transient flags on rehydrate
          state.processingMap = {};
          state.batchId = null;
          state.isProcessing = false;
        }
      }
    }
  )
);
