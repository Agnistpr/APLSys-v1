import { create } from "zustand";
import { persist } from "zustand/middleware";


export const useOcrStore = create(persist((set, get) => ({
  docs: [],
  processingMap: {},
  batchId: null,
  ocrMatches: {},

  // persistence for tasks/files/results so they survive unmounts / reloads
  tasks: [], // { id, filename, status, meta }
  results: {}, // filename -> OCR result object
  files: [],   // persisted uploaded files metadata

  // Add new state for file persistence
  currentFile: null, // {file, url, type, name}
  currentExtractedData: [],
  isProcessing: false,

  setDocs: (docs) => set({ docs }),
  setProcessingMap: (map) => set({ processingMap: map }),
  setBatchId: (id) => set({ batchId: id }),
  setOcrMatches: (matches) => set({ ocrMatches: matches }),

  // New actions
  addTask: (task) => set(state => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) => set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t) })),
  removeTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) })),

  addResult: (filename, result) => set(state => ({ results: { ...state.results, [filename]: result } })),
  removeResult: (filename) => set(state => { const next = { ...get().results }; delete next[filename]; return { results: next }; }),

  addFile: (fileMeta) => set(state => ({ files: [...state.files.filter(f => f.name !== fileMeta.name), fileMeta] })),
  removeFile: (name) => set(state => ({ files: state.files.filter(f => f.name !== name) })),

  // Add new actions
  setCurrentFile: (file) => set({ currentFile: file }),
  setCurrentExtractedData: (data) => set({ currentExtractedData: data }),
  setProcessing: (isProcessing) => set({ isProcessing }),

  markFileProcessed: (name) => set(state => ({
    processingMap: { ...state.processingMap, [name]: false },
    docs: state.docs.map(d => (d.name === name ? { ...d, isProcessed: true } : d))
  })),

  clear: () => set({ 
    docs: [], 
    processingMap: {}, 
    batchId: null, 
    tasks: [], 
    results: {}, 
    files: [], 
    ocrMatches: {},
    currentFile: null,
    currentExtractedData: [],
    isProcessing: false
  }),
}), {
  name: "ocr-store", // localStorage key
  getStorage: () => localStorage
}));
