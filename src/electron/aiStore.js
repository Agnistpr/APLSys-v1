import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";


export const defaultResume = {
  profile: {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    age: "",
    gender: "",
    name: "",
  },
  educations: [
    { school: "", degree: "", field: "", date: "" }
  ],
  workExperiences: [
    { company: "", position: "", date: "", description: "" }
  ],
  projects: [
    { name: "", description: "", date: "" }
  ],
  skills: { featuredSkills: [], descriptions: [] },
  custom: { descriptions: [] }
};

export const useAnalysisStore = create(persist((set, get) => ({

  // Add resume state persistence
  currentFile: null, // {url, name, type}
  editableResume: {...defaultResume},
  analysisResult: "",
  selectedCategory: "Production",
  selectedJobRole: "",
  customJobDescription: "",
  activeTab: "parsing",
  isProcessing: false,
  tasks: [], // {id, type, status, result, error}

  // Add parsed results tracking
  parseComplete: false,
  setParsed: (isParsed) => set({ parseComplete: isParsed }),

 // Add hydration flags
  isHydrated: false,
  setHydrated: () => set({ isHydrated: true }),

  // Add actions
  setCurrentFile: (file) => set({ currentFile: file }),
  setEditableResume: (resume) => set({ 
    editableResume: resume ? {...resume} : {...defaultResume}
  }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSelectedJobRole: (role) => set({ selectedJobRole: role }),
  setCustomJobDescription: (desc) => set({ customJobDescription: desc }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setProcessing: (isProcessing) => set({ isProcessing }),


  addTask: (task) => set(state => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) => set(state => ({ 
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  // Add reset action
  reset: () => set({
    currentFile: null,
    editableResume: {...defaultResume},
    analysisResult: "",
    selectedCategory: "Production", 
    selectedJobRole: "",
    customJobDescription: "",
    activeTab: "parsing",
    isProcessing: false,
    parseComplete: false,
    tasks: []
  }),

  getTaskById: (id) => get().tasks.find(t => t.id === id),
  clearTasks: () => set({ tasks: [] })
}), {
  name: "resume-analysis-store",
    onRehydrateStorage: () => () => {
        setTimeout(() => useAnalysisStore.getState().setHydrated(true), 50);
      },
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      currentFile: state.currentFile,
      editableResume: state.editableResume,
      // {
      //   profile: state.editableResume?.profile ?? defaultResume.profile,
      //   educations: state.editableResume?.educations ?? defaultResume.educations,
      //   workExperiences: state.editableResume?.workExperiences ?? defaultResume.workExperiences,
      //   projects: state.editableResume?.projects ?? defaultResume.projects,
      //   skills: state.editableResume?.skills ?? defaultResume.skills,
      //   custom: state.editableResume?.custom ?? defaultResume.custom,
      // },
      analysisResult: state.analysisResult,
      parseComplete: state.parseComplete,
      tasks: state.tasks,
      selectedCategory: state.selectedCategory,
      selectedJobRole: state.selectedJobRole,
      customJobDescription: state.customJobDescription
    }),
    // Add merge strategy to handle hydration better
      merge: (persisted, current) => {
        // Start with shallow merge
        const merged = {
          ...current,
          ...persisted
        };

        // SESSION-ONLY CLEAR: avoid rehydrating a previously uploaded file (blob URL / preview)
        // Clear persisted.currentFile once per app session to prevent stale previews appearing
        try {
          const clearedFlag = sessionStorage.getItem('resume-currentfile-cleared');
          if (!clearedFlag) {
            if (merged.currentFile) {
              // remove it so rehydration does not mount previous uploaded preview
              delete merged.currentFile;
            }
            try { sessionStorage.setItem('resume-currentfile-cleared', '1'); } catch (_) {}
          }
        } catch (e) {
          // ignore sessionStorage errors
        }

        // Merge editableResume carefully to keep defaults & new fields
        if (persisted && persisted.editableResume && typeof persisted.editableResume === "object") {
          merged.editableResume = {
            ...current.editableResume,
            ...persisted.editableResume
          };
        } else {
          merged.editableResume = current.editableResume;
        }

        // ensure parseComplete is boolean
        merged.parseComplete = !!persisted?.parseComplete || !!current?.parseComplete;
        return merged;
      }
  }
));