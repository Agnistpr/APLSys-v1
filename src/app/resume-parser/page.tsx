"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { TextItems } from "../lib/parse-resume-from-pdf/types";
import { ResumeDropzone } from "../components/ResumeDropzone";
import { ResumeTable } from "./ResumeTable";
import { analyzeResumeWithDS } from "../../../conn/genAnalysis";
import { persistNERResult } from "./aiActions";
import { JOB_ROLES } from "../data/jobRoles";
import axios from "axios";
import { API_BASE_URL, DEV_TEST_URL} from '../../../config';
import { useAnalysisStore, defaultResume } from '../../electron/aiStore';
import * as pdfjsLib from "pdfjs-dist";
import {
  exportJSON,
  mapEntitiesToResume,
  calculateCandidateScore,
  renderAnalysisSections,
  getApplicantName,
  reconstructBlobUrl,
  fileToBase64,
  persistAnalysisResult,
  persistGeminiAnalysisResult
} from './utils';
import { CandidateScoreCard } from '../components/CandidateScoreCard';

//Create a local worker (no CDN, no CSP violation)
(pdfjsLib as any).GlobalWorkerOptions.workerPort = new Worker(
  new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url),
  { type: "module" }
);

 const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
 const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
 // supabaseclient creator for vite
 const rendererSupabase = SUPABASE_URL && SUPABASE_ANON_KEY
   ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
    {
      auth: 
      {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
   )
   : null;

const sanitizeEditableResume = (r: any) => {
    if (!r || typeof r !== "object") return { ...defaultResume };
    return {
      profile: r.profile || defaultResume.profile,
      educations: Array.isArray(r.educations) ? r.educations : defaultResume.educations,
      workExperiences: Array.isArray(r.workExperiences) ? r.workExperiences : defaultResume.workExperiences,
      projects: Array.isArray(r.projects) ? r.projects : defaultResume.projects,
      skills: r.skills || defaultResume.skills,
      custom: r.custom || defaultResume.custom,
    };
  };

  // Helper: set nested value by dot-path (supports numeric indices)
  const setByPath = (obj: any, path: string, value: any) => {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (/^\d+$/.test(p)) {
        const idx = Number(p);
        if (!Array.isArray(cur)) cur = cur[parts[i - 1]] = [];
        while (cur.length <= idx) cur.push({});
        cur = cur[idx];
      } else {
        if (cur[p] === undefined || cur[p] === null) cur[p] = {};
        cur = cur[p];
      }
    }
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      const idx = Number(last);
      if (!Array.isArray(cur)) cur = cur[parts[parts.length - 2]] = [];
      cur[idx] = value;
    } else {
      cur[last] = value;
    }
  };

type ResumePreviewProps = {
  fileUrl: string | null;
  fileType?: string;
  scale?: number;
  maxPages?: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  setTotalPages: (pages: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

function ResumePreview({ 
  fileUrl, 
  fileType,
  scale = 1, 
  maxPages,
  currentPage,
  setCurrentPage,
  totalPages,
  setTotalPages,
  isLoading,
  setIsLoading
 }: ResumePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Detect file type from URL, prop, or blob type
  const getFileType = () => {
    // Use passed fileType first (most reliable)
    if (fileType) {
      const typeLower = fileType.toLowerCase();
      if (typeLower.includes('image')) return 'image';
      if (typeLower.includes('pdf')) return 'pdf';
      // Check for all DOCX variants
      if (typeLower.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
          typeLower.includes('application/msword') ||
          typeLower.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.template') ||
          typeLower.includes('wordprocessingml') || 
          typeLower.includes('officedocument') || 
          typeLower.includes('docx') ||
          typeLower.includes('word'))
        return 'docx';
    }
    
    // Fallback to URL extension
    if (!fileUrl) return null;
    // Skip blob URLs
    if (fileUrl.startsWith("blob:")) return null;

    const ext = fileUrl.split("?")[0].split(".").pop()?.toLowerCase();
    console.log("DEBUG: detected file extension:", ext); // Add debug log
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext ?? "")) return 'image';
    if (ext === "pdf") return "pdf";
    if (ext === "docx") return "docx";
    return null;
  };

  const detectedFileType = getFileType();
  console.log("DEBUG: detectedFileType:", detectedFileType, "fileType prop:", fileType); // Add debug log

  // PDF rendering logic
  useEffect(() => {
    if (detectedFileType !== 'pdf' || !fileUrl || !canvasRef.current) return;

    let cancelled = false;

    const loadAndRender = async () => {
      try {
        setIsLoading(true);
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        const pages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;
        setTotalPages(pages);

        const page = await pdf.getPage(currentPage || 1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const renderTask = page.render({ canvasContext: ctx, canvas, viewport });
        await renderTask.promise;
      } catch (err) {
        console.error("PDF load/render error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAndRender();
    return () => {
      cancelled = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [fileUrl, currentPage, scale, detectedFileType, setIsLoading, setTotalPages]);

  // Image rendering logic
  useEffect(() => {
    if (detectedFileType !== 'image' || !fileUrl) return;

    setIsLoading(true);
    const img = new Image();
    
    img.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = fileUrl;
      }
      setTotalPages(1);
      setCurrentPage(1);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      console.error("Failed to load image");
      setIsLoading(false);
    };
    
    img.src = fileUrl;
  }, [fileUrl, detectedFileType, setIsLoading, setTotalPages, setCurrentPage]);

  // DOCX preview message (no native browser support)
  useEffect(() => {
    if (detectedFileType === 'docx') {
      console.log("DEBUG: Setting DOCX preview - totalPages to 1, currentPage to 1");
      setIsLoading(false);
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [detectedFileType, setTotalPages, setCurrentPage, setIsLoading]);

  // Render DOCX via Microsoft Office embed for public HTTP(S) URLs
  if (detectedFileType === 'docx' && fileUrl && /^https?:\/\//i.test(fileUrl)) {
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    return (
      <div style={{ height: "100%", width: "100%", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", }}>
        <iframe
          title="DOCX preview"
          src={viewerUrl}
          style={{ 
            width: "100%", 
            height: "100%",
            border: "none", 
            transform: "scale(1.5)", // Adjust scale as needed
            transformOrigin: "center",
            // minHeight: 1000,
            // display: "block"
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", width: "100%" }}>
      {detectedFileType === 'pdf' && (
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            borderRadius: "6px",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(74, 68, 68, 0.1)",
            flex: 1,
            maxHeight: "600px",
          }}
        />
      )}

      {detectedFileType === 'image' && fileUrl && (
        <img
          ref={imgRef}
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            borderRadius: "6px",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(74, 68, 68, 0.1)",
            flex: 1,
            maxHeight: "600px",
            objectFit: "contain",
          }}
          alt="Resume preview"
        />
      )}

      {detectedFileType === 'docx' && (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            color: "#999",
            fontSize: "14px",
            flex: 1,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📄</div>
            <div>DOCX preview not supported.</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>Text will be extracted for processing.</div>
          </div>
        </div>
      )}

      {isLoading && detectedFileType !== 'pdf' && (
        <div style={{ textAlign: "center", color: "#999", fontSize: "14px", padding: "16px" }}>
          Loading...
        </div>
      )}

      {!detectedFileType && fileUrl && (
        <div style={{ textAlign: "center", color: "#d9534f", fontSize: "14px", padding: "16px" }}>
          Unsupported file type: {fileType || "unknown"}
          <br />
          Please upload PDF, image (PNG/JPG), or DOCX.
        </div>
      )}
    </div>
  );
}

type ResumeParserProps = {
  uid?: any;
  setActivePage?: any;
  setSelectedApplicantId?: any;
  setPreviousPage?: any;
  activePage?: any;
  selectedResumeFile?: any;
  setSelectedResumeFile?: any;
  goBack?: any;
  onParsingStateChange?: (isParsingResume: boolean, fileName: string) => void;
  setShowAnalyzer?: (visible: boolean) => void;
};

const getRateLimitRestTime = () => {
  // Conservative approach: space requests 6-8 seconds apart
  // This gives buffer to avoid hitting the limit
  const MIN_REST_MS = 6000;  // 6 seconds minimum
  const RECOMMENDED_REST_MS = 10000;  // 8 seconds recommended
  
  return {
    min: Math.ceil(MIN_REST_MS / 1000),
    recommended: Math.ceil(RECOMMENDED_REST_MS / 1000),
  };
};

export default function ResumeParser
({ uid, setActivePage,
   setSelectedApplicantId,
   setPreviousPage,
   activePage,
   selectedResumeFile,
   setSelectedResumeFile,
   goBack,
   onParsingStateChange,
  setShowAnalyzer }: ResumeParserProps = {}) {
  // console.log("DEBUG ResumeTable:", typeof ResumeTable, ResumeTable);
  // console.log("DEBUG CandidateScoreCard:", typeof CandidateScoreCard, CandidateScoreCard);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItems>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false); // Track whether the final score is displayed
  // Visual indicator shown when persisted file state is cleared on this session
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);
  //const { addTask, updateTask } = useAnalysisStore();
  const [hydrationAttempted, setHydrationAttempted] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  console.log("Uid: ", uid);

  // for applicant adding:

  const [showAddApplicantModal, setShowAddApplicantModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalJobRole, setModalJobRole] = useState("");
  const [isAddingApplicant, setIsAddingApplicant] = useState(false);
  // department/position list loaded from DB
  const [deptPosList, setDeptPosList] = useState<any[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const loadDeptPos = useCallback(async () => {
    try {
      setDeptLoading(true);
      const rows = await (window.utilityAPI?.getDeptPos?.() ?? []);
      setDeptPosList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Failed to load departments/positions:", e);
      setDeptPosList([]);
    } finally {
      setDeptLoading(false);
    }
  }, []);

  const currentFile = useAnalysisStore(state => state.currentFile);
  const editableResume = useAnalysisStore(state => state.editableResume);
  const parseComplete = useAnalysisStore(state => state.parseComplete);
  const isHydrated = useAnalysisStore(state => state.isHydrated);
  const analysisResult = useAnalysisStore(state => state.analysisResult);
  const selectedCategory = useAnalysisStore(state => state.selectedCategory);
  const selectedJobRole = useAnalysisStore(state => state.selectedJobRole);
  const customJobDescription = useAnalysisStore(state => state.customJobDescription);
  const activeTab = useAnalysisStore(state => state.activeTab);
  const isProcessing = useAnalysisStore(state => state.isProcessing);

  // actions
  const setCurrentFile = useAnalysisStore(state => state.setCurrentFile);
  const setEditableResume = useAnalysisStore(state => state.setEditableResume);
  const setHydrated = useAnalysisStore(state => state.setHydrated);
  const setAnalysisResult = useAnalysisStore(state => state.setAnalysisResult);
  const setSelectedCategory = useAnalysisStore(state => state.setSelectedCategory);
  const setSelectedJobRole = useAnalysisStore(state => state.setSelectedJobRole);
  const setCustomJobDescription = useAnalysisStore(state => state.setCustomJobDescription);
  const setActiveTab = useAnalysisStore(state => state.setActiveTab);
  const setProcessing = useAnalysisStore(state => state.setProcessing);
  const setParsed = useAnalysisStore(state => state.setParsed);
  const addTask = useAnalysisStore(state => state.addTask);
  const updateTask = useAnalysisStore(state => state.updateTask);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const lastBlobUrlRef = useRef<string | null>(null);
  // signal to reset the embedded dropzone's internal state
  const [dropzoneResetSignal, setDropzoneResetSignal] = useState<number>(0);

  // Place handleFileChange BEFORE handleClosePreview to avoid TDZ / circular init
  const handleFileChange = useCallback(async (fileUrl: string, fileName: string, fileObj?: File) => {
     // Always preview the local blob immediately
     setFileUrl(fileUrl);
     setResumeName(fileName);
 
     if (fileObj) setFileType(fileObj.type);
 
     // If fileUrl is empty, user clicked the x button to remove the file
     if (!fileUrl) {
       setCurrentFile(null);
       return;
     }
 
     if (!fileObj) return;
 
    // show preview/upload spinner while we persist the file (Supabase or conversion)
    try { setPdfLoading(true); } catch (_) {}
     try {
       const publicUrl = rendererSupabase ? await uploadFileToSupabase(fileObj) : null;
 
       if (publicUrl) {
         setCurrentFile({ url: publicUrl, name: fileObj.name, type: fileObj.type, data: undefined });
         setFileUrl(publicUrl);
         setResumeName(fileObj.name);
         setEditableResume({ ...defaultResume });
       } else {
         try {
           const base64 = await fileToBase64(fileObj);
           setCurrentFile({
             url: undefined,
             name: fileObj.name,
             type: fileObj.type || "application/pdf",
             data: base64,
           });
         } catch (e) {
           setCurrentFile({ url: undefined, name: fileObj.name, type: fileObj.type || "application/pdf", data: undefined });
         }
       }
     } catch (err) {
       setCurrentFile({ url: undefined, name: fileName, type: fileObj?.type || "application/pdf", data: undefined });
     } finally {
      try { setPdfLoading(false); } catch (_) {}
     }
 
     if (fileObj) {
       setParsed(false);
       setEditableResume({ ...defaultResume });
     }
   }, [setCurrentFile, setEditableResume, setParsed]);

  const handleClosePreview = useCallback(() => {
    try {
      if (lastBlobUrlRef.current && lastBlobUrlRef.current.startsWith("blob:")) {
        try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {}
        lastBlobUrlRef.current = null;
      }

      setFileUrl(null);
      setResumeName("");
      setFileType(null);
      setCurrentFile(null);
      setParsed(false);
      setEditableResume({ ...defaultResume });

      try { setSelectedResumeFile?.(null); } catch (_) {}

      // safe reset of dropzone UI: call handleFileChange and bump reset signal so ResumeDropzone clears
      try { handleFileChange("", ""); } catch (_) {}
      try { setDropzoneResetSignal(Date.now()); } catch (_) {}
    } catch (err) {
      console.warn("handleClosePreview failed:", err);
    }
  }, [setCurrentFile, setEditableResume, setParsed, setSelectedResumeFile, handleFileChange]);

  // Group related state
  const [fileState, setFileState] = useState({
    fileUrl: null as string | null,
    resumeName: "",
    textItems: [] as TextItems[],
  });

  const [analysisState, setAnalysisState] = useState({
    loadingAnalysis: false,
    isParsingResume: false,
  });

  // Ensure editableResume always has a valid shape for the ResumeTable
  const safeResume = editableResume || defaultResume;

  // Add handleFieldPathChange function before the return statement
  // IMPORTANT: call setEditableResume(next) with the fully built resume object.
  // Previously we passed an updater function to the store setter which stored a function instead of the object.
  const handleFieldPathChange = useCallback((fieldPath: string, value: any) => {
    try {
      // 1. Get the current state from the store
      const currentState = useAnalysisStore.getState();
      const prev = currentState.editableResume || defaultResume;
      
      // 2. Create a deep copy to avoid mutations
      const next = JSON.parse(JSON.stringify(prev));
      
      // 3. Set the new value at the path
      setByPath(next, fieldPath, value);
      
      // 4. Immediately update the store (this triggers re-render)
      setEditableResume(next);
      
      // 5. Force a store state update to ensure persistence
      // This ensures the store's internal state is updated
      useAnalysisStore.setState({ editableResume: next });
      
      console.log("Field updated:", fieldPath, "New value:", value, "Full resume:", next);
    } catch (e) {
      console.error("handleFieldPathChange failed for", fieldPath, e);
    }
  }, [setEditableResume]);

  // Utility function to format names in camel-case style
  const formatName = (name: string): string => {
    return name
      .toLowerCase()
      .split(/\s+/) // Split by spaces
      .map((word) => {
        if (word.includes(",")) {
          const [lastName, firstName] = word.split(",");
          return `${lastName.charAt(0).toUpperCase() + lastName.slice(1)}, ${
            firstName.charAt(0).toUpperCase() + firstName.slice(1)
          }`;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  };


  const handleAddApplicantClick = () => {
    setShowAddApplicantModal(true);
    setModalCategory("");
    setModalJobRole("");
    // load departments & positions from main process so the modal shows DB values
    loadDeptPos();
  };

  const handleConfirmAddApplicant = async () => {
    if (!editableResume) {
      alert("No resume data to add.");
      return;
    }

    if (!modalCategory || !modalJobRole) {
      alert("Please select both a Department (Category) and a Job Role.");
      return;
    }

    setIsAddingApplicant(true);

    // Format each name part and the full name
    const rawFirst = editableResume.profile?.firstName || "";
    const rawMiddle = editableResume.profile?.middleName || "";
    const rawLast = editableResume.profile?.lastName || "";

    const formattedFirst = rawFirst ? formatName(rawFirst) : "";
    const formattedMiddle = rawMiddle ? formatName(rawMiddle) : "";
    const formattedLast = rawLast ? formatName(rawLast) : "";

    const fullName = [formattedFirst, formattedMiddle, formattedLast].filter(Boolean).join(" ");

    // Update the editableResume with formatted name parts AND the combined name
    const updatedResume = {
      ...editableResume,
      profile: {
        ...editableResume.profile,
        firstName: formattedFirst,
        middleName: formattedMiddle,
        lastName: formattedLast,
        name: fullName,
      },
    };

    // persist into store so UI and downstream code use formatted parts
    setEditableResume(updatedResume);

    // Create applicantData after updating editableResume
    const applicantData = {
      ...updatedResume,
      departmentName: modalCategory,
      positionName: modalJobRole,
    };

    console.log("Adding applicant:", applicantData);

    try {
      const added = await window.applicantAPI.addApplicant(applicantData);
      console.log("Formatted full name:", fullName); // Debug log

      // Log action
      const description = `
        Applicant ID: ${added.applicantid}
        Name: ${fullName}
        Email: ${applicantData.profile?.email || ""}
        Department: ${applicantData.departmentName}
        Position: ${applicantData.positionName}
      `.trim();

      await window.userAPI.logAction(
        uid,
        `added applicant "${fullName}"`,
        description
      );

      toast.success(`Applicant added! ID: ${added.applicantid}`, {
        duration: 3000,
      });

      // Reset the editableResume to default after adding the applicant
      setEditableResume({ ...defaultResume });

      setShowAddApplicantModal(false);
      goBack();
    } catch (err) {
      console.error("Failed to add applicant:", err);
      toast.error("Error adding applicant.", {
        description: err instanceof Error ? err.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setIsAddingApplicant(false);
    }
  };


  useEffect(() => {
    if (fileUrl && fileUrl.startsWith("http")) {
      console.log("PDF preview should be visible:", fileUrl);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!parseComplete) {
      try { setActiveTab("parsing"); } catch (e) { /* noop */ }
    }
  }, [parseComplete, setActiveTab]);

  const handleNextPage = () => {
      if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
      }
    };

  const handlePrevPage = () => {
      if (currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
  };

  // Initialize from persisted state
  useEffect(() => {
    if (!isHydrated) return;
    const currfile = useAnalysisStore.getState().currentFile;

      // Only run once per hydration
    if (hydrationAttempted) return;
    setHydrationAttempted(true);


    // Restore file preview if we have a currentFile
    (async () => {
    try {
        if (!currfile) return;

        // 1) If we already have a non-blob URL (likely Supabase), use it
        if (currfile?.url && !String(currfile.url).startsWith("blob:")) {
          console.log("Hydrated file to existing URL:", currfile.url);
          setFileUrl(currfile.url);
          setResumeName(currfile.name || "resume.pdf");
          if (currfile.type) setFileType(currfile.type);
          return;
        }

        // 2) If we have an original filename, try to find it in Supabase storage
        if (currfile?.name && rendererSupabase) {
          try {
          console.log("Searching Supabase for:", currfile.name);
          const publicUrl = await findSupabasePublicUrl(currfile.name, "Resumes");
          if (publicUrl) 
            {
            console.log("Found in Supabase:", publicUrl);
            setCurrentFile({ ...currfile, url: publicUrl });
            setFileUrl(publicUrl);
            setResumeName(currfile.name || "resume.pdf");
            return;
            }
          } catch (err) {
            console.warn("Supabase lookup failed:", err);
          }
        }

        // 3) If we persisted base64 `data`, reconstruct a blob URL for preview (do not persist the blob URL)
        if (currfile?.data) {
          try {
            console.log("Reconstructing from persisted base64 data...");
            const blobUrl = reconstructBlobUrl(currfile.data, currfile.type || "application/pdf");
            if (blobUrl) {
              lastBlobUrlRef.current = blobUrl;
              setFileUrl(blobUrl);
              setResumeName(currfile.name || "resume.pdf");
              // keep currentFile.url undefined so we don't persist blob: URLs
              console.log("Hydrated file to reconstructed blob URL from base64");
            }
          } catch (e) {
            console.warn("Failed to reconstruct blob URL from persisted data:", e);
          }
        }
      } catch (e) {
        console.error("Hydration (Supabase-first) failed:", e);
      }
    })();
  }, [isHydrated]); //currentFile,

  useEffect(() => {
    if (!isHydrated) return;
    
    // Only run once per hydration
    if (hydrationAttempted) return;
    
    // Explicitly restore editableResume from persisted store
    const persistedResume = useAnalysisStore.getState().editableResume;
    const persistedParseComplete = useAnalysisStore.getState().parseComplete;
    
    if (persistedResume && persistedParseComplete) {
      console.log("Hydrating editableResume from persisted store:", persistedResume);
      setEditableResume(persistedResume);
    }
  }, [isHydrated]);

  useEffect(() => {
    if (!fileUrl && currentFile?.url) {
      console.log("Syncing fileUrl from currentFile:", currentFile.url);
      setFileUrl(currentFile.url);
      setResumeName(currentFile.name || "resume.pdf");
      if (currentFile.type) setFileType(currentFile.type);
    }
  }, [activePage]);

  useEffect(() => {
    if (!fileUrl && currentFile?.url) {
      console.log("Hydrating PDF from currentFile.url:", currentFile.url);
      setFileUrl(currentFile.url);
      setResumeName(currentFile.name || "resume.pdf");

      // Kickstart first render immediately
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [fileUrl, currentFile]);

  useEffect(() => {
    if (!isHydrated) return;
      // Only mark "hasAnalyzed" when the persisted store reports a completed analysis
      // (avoid showing ghost analysis cards from stray/partial persisted text)
      const st = useAnalysisStore.getState();
      const persistedAnalysis = String(st.analysisResult || "").trim();
      const persistedComplete = Boolean(st.parseComplete);
      if (persistedComplete && persistedAnalysis.length > 20) {
        setHasAnalyzed(true);
      } else {
        setHasAnalyzed(false);
      }
  }, [isHydrated]);

  const [scoringWeights, setScoringWeights] = useState({
    skills: 0.3,
    experience: 0.4,
    education: 0.2,
    achievements: 0.1,
  });

  const [sectionScores, setSectionScores] = useState({
    skills: 85,
    experience: 90,
    education: 75,
    achievements: 60,
  });

  const [userScore, setUserScore] = useState<number | null>(null);

  // Clear the final score whenever weights or section scores change
  const handleWeightChange = (key: string, value: number) => {
    setScoringWeights((prev) => ({ ...prev, [key]: value }));
    setShowFinalScore(false); // Clear the final score
  };

  const handleScoreChange = (key: string, value: number) => {
    setSectionScores((prev) => ({ ...prev, [key]: value }));
    setShowFinalScore(false); // Clear the final score
  };

  const handleUserScoreChange = (value: number | null) => {
    setUserScore(value);
    setShowFinalScore(false); // Clear the final score
  };

  const finalScore = calculateCandidateScore(sectionScores, scoringWeights);

  const jobDescription = selectedCategory && selectedJobRole ? JOB_ROLES[selectedCategory][selectedJobRole]?.description : "";
  const requiredSkills = selectedCategory && selectedJobRole ? JOB_ROLES[selectedCategory][selectedJobRole]?.required_skills : [];

  useEffect(() => {
    if (typeof fileUrl === "string" && fileUrl.length > 0) {
      const name = fileUrl.split(/[\\/]/).pop() || "";
      setResumeName(name);
    } else {
      setResumeName("");
    }
  }, [fileUrl]);

  useEffect(() => {
    if (activePage === "Analyzer" && !selectedResumeFile) {
      const storeResume = useAnalysisStore.getState().editableResume;
      const hasProfile = !!(storeResume && storeResume.profile && Object.keys(storeResume.profile).length > 0);
      
      // Only reset if we truly have no data
      if (!hasProfile) {
        console.log("No profile found, resetting to default");
        setEditableResume({ ...defaultResume });
        setAnalysisResult("");
      } else {
        // Keep the persisted resume data
        console.log("Keeping persisted resume data");
        setEditableResume(storeResume);
      }
    }
  }, [activePage, selectedResumeFile, setEditableResume]);

  // Add effect to update description when role changes
  useEffect(() => {
    if (selectedCategory && selectedJobRole) {
      const defaultDesc = JOB_ROLES[selectedCategory][selectedJobRole]?.description || "";
      setCustomJobDescription(defaultDesc);
    }
  }, [selectedCategory, selectedJobRole]);

  function mapNERToResumeFormat(nerResult: any) {
    const { parsed_entities } = nerResult;
    
    // Default empty resume structure
    const mappedResume = {
      profile: {
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phone: "",
        location: "",
        name: "",
      },
      educations: [],
      workExperiences: [],
      projects: [],
      skills: { featuredSkills: [], descriptions: [] },
      custom: { descriptions: [] }
    };

    if (!parsed_entities) return mappedResume;

    // Map NER fields to resume structure
    if (parsed_entities.PERSON_NAME) {
      const names = parsed_entities.PERSON_NAME[0].split(" ");
      mappedResume.profile.firstName = names[0] || "";
      mappedResume.profile.lastName = names[names.length - 1] || "";
      mappedResume.profile.middleName = names.slice(1, -1).join(" ");
      mappedResume.profile.name = parsed_entities.PERSON_NAME[0];
    }
    
    if (parsed_entities.EMAIL) {
      mappedResume.profile.email = parsed_entities.EMAIL[0];
    }
    
    if (parsed_entities.PHONE) {
      mappedResume.profile.phone = parsed_entities.PHONE[0];
    }
    
    if (parsed_entities.LOCATION) {
      mappedResume.profile.location = parsed_entities.LOCATION[0];
    }

    // Map skills
    if (parsed_entities.SKILL) {
      mappedResume.skills.featuredSkills = parsed_entities.SKILL;
    }

    // Map education
    if (parsed_entities.EDUCATION) {
      mappedResume.educations = parsed_entities.EDUCATION.map((edu: string) => ({
        school: edu,
        degree: "",
        field: "",
        date: ""
      }));
    }

    return mappedResume;
  }
  
  function handleNERExtraction(nerResult: any) {
    const mappedResume = mapNERToResumeFormat(nerResult);
    setEditableResume(mappedResume);
  }

  async function NERResumeProfile(text: string): Promise<any> {
    if (!text || typeof text !== "string") {
      throw new Error("NERResumeProfile requires a text string");
    }

    // Trim and guard against accidental large non-string payloads
    const safeText = text.trim();
    if (safeText.length < 20) {
      throw new Error("Extracted text is too short for resume extraction");
    }

    try {
      const response = await axios.post(
        `${DEV_TEST_URL}/parser/ner-extract-resume-profile`,
        { text: safeText },
        { headers: { "Content-Type": "application/json" } }
      );
      return response.data;
    } catch (err: any) {
      console.error("Resume Parsing failed:", {
        error: err,
        request: err?.request,
        response: err?.response?.data,
      });
      // bubble a useful message to caller
      throw new Error(err?.response?.data?.error || err?.message || "Resume Parsing failed");
    }
  }
  
  // AI PARSING FALLBACK
  async function geminiExtractResumeProfile(text: string): Promise<any> {
    if (!text || typeof text !== "string") {
      throw new Error("geminiExtractResumeProfile requires a text string");
    }

    // Trim and guard against accidental large non-string payloads
    const safeText = text.trim();
    if (safeText.length < 20) {
      throw new Error("Extracted text is too short for resume extraction");
    }

    try {
      const response = await axios.post(
        `${DEV_TEST_URL}/ai/gemini-extract-resume-profile`,
        { text: safeText },
        { headers: { "Content-Type": "application/json" } }
      );
      return response.data;
    } catch (err: any) {
      console.error("Gemini extraction failed:", {
        error: err,
        request: err?.request,
        response: err?.response?.data,
      });
      // bubble a useful message to caller
      throw new Error(err?.response?.data?.error || err?.message || "Gemini extraction failed");
    }
  }

  //Extract text from file using extract endpoint (supports PDF, images, and DOCX)
  async function extractResumeText(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    console.log("Uploading file for text extraction:", file.name, file.type);

    try {
      // Use the unified endpoint that supports PDF, images, and DOCX
      const response = await axios.post(`${DEV_TEST_URL}/parser/extract-resume-text`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      console.log("Text extraction response:", response);

      // Normalize response -> always return a string
      const data = response.data;
      if (typeof data === "string") {
        return data;
      }

      // Common server shapes: { text: "..." } or { result: "..." }
      if (data && typeof data.text === "string") return data.text;
      if (data && typeof data.result === "string") return data.result;
      if (data && typeof data.data === "string") return data.data;

      // fallback: try to build a readable string
      try {
        return JSON.stringify(data);
      } catch (e) {
        return "";
      }
    } catch (err: any) {
      console.error("Text extraction failed:", err);
      throw new Error(err?.response?.data?.error || err?.message || "Text extraction failed");
    }
  }

  async function findSupabasePublicUrl(originalName: string, bucket = "Resumes") {
    if (!rendererSupabase || !originalName) return null;
    try {
      const user = (await rendererSupabase.auth.getUser()).data.user;
      const userId = user?.id || "anonymous";
      const prefixes = [
        `users/${userId}/previews`,
        `users/anonymous/previews`,
        `previews`,
      ];

      for (const prefix of prefixes) {
        try {
          const { data: list, error } = await rendererSupabase.storage.from(bucket).list(prefix, { limit: 1000 });
          if (error) {
            // ignore this prefix and try the next
            console.warn("Supabase list error for", prefix, error);
            continue;
          }
          if (!Array.isArray(list)) continue;
          // find file entry whose name contains the original filename (sanitized)
          const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
          const match = list.find((f: any) => {
            const n = String(f.name || "");
            return n.includes(originalName) || n.includes(sanitized) || n.endsWith(originalName);
          });
          if (match) {
            const path = `${prefix}/${match.name}`;
            const { data: urlData } = rendererSupabase.storage.from(bucket).getPublicUrl(path);
            if (urlData?.publicUrl) return urlData.publicUrl;
          }
        } catch (err) {
          console.warn("findSupabasePublicUrl prefix scan failed:", prefix, err);
          continue;
        }
      }

      return null;
    } catch (err) {
      console.warn("findSupabasePublicUrl failed:", err);
      return null;
    }
  }

  function base64ToBlob(base64: string, mimeType: string): Blob {
    const sanitized = base64.replace(/\s/g, '');
    const byteCharacters = atob(sanitized);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
  // Upload helper: upload a File/Blob to Supabase storage and return a public URL (bucket must allow public access)
  async function uploadFileToSupabase(file: File | File, bucket = "Resumes") {
    if (!rendererSupabase) return null;

    try {
      // Get current user ID for ownership tagging
      const user = (await rendererSupabase.auth.getUser()).data.user;
      const userId = user?.id || "anonymous";
      
    // Get original filename from File object or generate timestamp-based name
    const originalName = file instanceof File ? file.name : `resume_${Date.now()}.pdf`;
    // Sanitize filename to remove special chars
    const safeFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Construct path with timestamp to prevent collisions but keep original name
    const fileName = `users/${userId}/previews/${Date.now()}_${safeFileName}`;

      const { error } = await rendererSupabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: false });

      if (error) {
        console.warn("Supabase upload error:", error);
        return null;
      }

      //PUBLIC bucket
      const { data: urlData } = rendererSupabase.storage.from(bucket).getPublicUrl(fileName);
      if (urlData?.publicUrl) return urlData.publicUrl;

      //PRIVATE bucket — fallback to signed URL
      const { data: signed } = await rendererSupabase.storage.from(bucket).createSignedUrl(fileName, 3600);
      return signed?.signedUrl || null;
    } catch (err) {
      console.error("uploadFileToSupabase failed:", err);
      return null;
    }
  }

  useEffect(() => {
    if (selectedResumeFile && selectedResumeFile.data) {
      console.log('selectedResumeFile preview:', selectedResumeFile.data.slice(0, 50));
    }
 
    if (!(selectedResumeFile && selectedResumeFile.data && selectedResumeFile.type)) return;
 
    let didCancel = false;
 
    (async () => {
     try {
      // indicate we are preparing/uploading the preview
      try { setPdfLoading(true); } catch (_) {}
 
       // Convert base64 to blob immediately
       const base64String = selectedResumeFile.data;
        
        // Remove data URL prefix if present
        let cleanBase64 = base64String;
        if (base64String.includes(',')) {
          cleanBase64 = base64String.split(',')[1];
        }

        // Decode and create blob
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: selectedResumeFile.type || 'application/pdf' });
        
        // ✅ Try to upload to Supabase first
        let publicUrl: string | null = null;
        try {
          const file = new File([blob], selectedResumeFile.name || 'uploaded_resume.pdf', { 
            type: selectedResumeFile.type || 'application/pdf' 
          });
          publicUrl = await uploadFileToSupabase(file);
        } catch (uploadErr) {
          console.warn("Failed to upload to Supabase, will use blob URL:", uploadErr);
        }

        // Use public URL if available, otherwise create blob URL
        const previewUrl = publicUrl || URL.createObjectURL(blob);

        if (didCancel) {
          if (!publicUrl) URL.revokeObjectURL(previewUrl);
          return;
        }

        // Set preview immediately
        setFileUrl(previewUrl);
        setResumeName(selectedResumeFile.name || 'uploaded_resume.pdf');
        setFileType(selectedResumeFile.type || 'application/pdf');

        console.log('File preview loaded from selectedResumeFile:', {
          name: selectedResumeFile.name,
          type: selectedResumeFile.type,
          fileUrl: previewUrl,
          isPublicUrl: !!publicUrl
        });

        // Persist to store for consistency
        setCurrentFile({
          url: publicUrl,  //Store public URL if available
          name: selectedResumeFile.name || 'uploaded_resume.pdf',
          type: selectedResumeFile.type || 'application/pdf',
          data: publicUrl ? undefined : selectedResumeFile.data,  // Only persist base64 if no public URL
      });

      // Reset parse state to allow fresh parsing
      setEditableResume({ ...defaultResume });
      setParsed(false);

    } catch (e) {
      console.error('Failed to process selectedResumeFile:', e);
      toast.error('Failed to load uploaded file', {
        description: 'Please try uploading again',
        duration: 3000
      });
    } finally {
      try { setPdfLoading(false); } catch (_) {}
     }
   })();
 
   return () => { 
     didCancel = true;
   };
 }, [selectedResumeFile, setCurrentFile, setEditableResume, setParsed]);

  // New function to handle manual parsing
  const handleParseResume = async () => {
    if (!fileUrl) {
      toast.error("Please upload a resume first");
      return;
    }
    
    const displayName = currentFile?.name || resumeName || "resume.pdf";
    const taskId = `parse-${Date.now()}`;
    const { recommended } = getRateLimitRestTime();
    
    setProcessing(true);
    setIsParsingResume(true);

    try { onParsingStateChange?.(true, displayName); } catch (e) { console.warn("onParsingStateChange start failed", e); }

    addTask({
      id: taskId,
      type: "parse",
      status: "started",
      fileName: displayName,
      startedAt: Date.now()
    });

    toast(`Parsing ${displayName}...`, {
      id: taskId,
      description: "Processing resume, you can close this while it runs.",
      icon: "⏳",
      dismissible: true,
      duration: 10000,
    });

    try {
      // Initialize with default structure before parsing
      setEditableResume({...defaultResume});

      let file: File | null = null;

      // 1) Prefer a persisted HTTP(S) URL (e.g. Supabase public URL)
      const persistedUrl = currentFile?.url || fileUrl;
      if (persistedUrl && /^https?:\/\//i.test(String(persistedUrl))) {
        try {
          const resp = await fetch(String(persistedUrl));
          if (!resp.ok) throw new Error(`Failed to fetch file from ${persistedUrl}`);
          const fetchedBlob = await resp.blob();
          file = new File([fetchedBlob], currentFile?.name || resumeName || "resume.pdf", {
            type: fetchedBlob.type || "application/pdf",
          });
          console.log("Using HTTP(S) URL to build File for parsing:", persistedUrl);
        } catch (e) {
          console.warn("Fetching persisted URL failed, will fallback to other methods:", e);
          file = null;
        }
      }

      // Fallback to fetching blob URL if base64 not available
      if (!file && currentFile?.data) {
        try {
          console.log("DEBUG reconstructing File from persisted base64 data...");
          const cleaned = currentFile.data.replace(/^data:.*;base64,/, "");
          const byteString = atob(cleaned);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: currentFile.type || "application/pdf" });
          file = new File([blob], currentFile.name || "resume.pdf", { type: currentFile.type || "application/pdf" });
          console.log("Reconstructed File from base64 fallback");
        } catch (e) {
          console.error("Failed to reconstruct File from base64:", e);
          file = null;
        }
      }

      // 3) Fallback: if file still not set, attempt to fetch blob from fileUrl (could be a blob: url created this session)
      if (!file) {
        const fetchUrl = currentFile?.url || fileUrl;
        if (!fetchUrl) throw new Error("No file URL available to parse");
        const response = await fetch(fetchUrl);
        const blob = await response.blob();
        file = new File([blob], currentFile?.name || resumeName || "resume.pdf", {
          type: blob.type || "application/pdf",
        });
      }

      if (!file) throw new Error("Could not prepare file for parsing");

      
      // Extract text first
      // Decide parsing path: images -> existing flow; pdf/docx -> new parsing service
      let nerResult: any = null;
      let usedStructuredService = false;

      if (file.type && file.type.toLowerCase().startsWith("image")) {
        // Image: keep existing flow (extract -> Gemini NER)
        const extractedText = await extractResumeText(file);
        const gResult = await geminiExtractResumeProfile(extractedText);
        if (gResult?.error) throw new Error(gResult.error);
        nerResult = gResult;
      } else {
          // PDF/DOCX: extract text first, then call the NER endpoint (NER expects text, not files)
          try {
            // 1) Extract plain text from the file (server endpoint that accepts file uploads)
            const extractedText = await extractResumeText(file);

            if (extractedText && typeof extractedText === "string" && extractedText.trim().length > 20) {
              // 2) First try server-side NER which accepts text
              let nerResp = null;
              try {
                nerResp = await NERResumeProfile(extractedText);
              } catch (err) {
                console.warn("Server NER failed, will fallback to Gemini:", err);
                nerResp = null;
              }

              if (nerResp && nerResp.parsed_entities && Object.keys(nerResp.parsed_entities).length > 0) {
                // use server NER result
                nerResult = nerResp;
              } else {
                // fallback to Gemini NER on the extracted text
                const gResult = await geminiExtractResumeProfile(extractedText);
                if (gResult?.error) throw new Error(gResult.error);
                nerResult = gResult;
              }
            } else {
              // extracted text too short -> try Gemini extraction as last resort
              const textForGemini = extractedText || (await extractResumeText(file));
              const gResult = await geminiExtractResumeProfile(textForGemini);
              if (gResult?.error) throw new Error(gResult.error);
              nerResult = gResult;
            }
          } catch (svcErr) {
            console.warn("Parsing/extraction failed, falling back to extraction+Gemini path:", svcErr);
            const fallbackText = await extractResumeText(file);
            const gResult = await geminiExtractResumeProfile(fallbackText);
            if (gResult?.error) throw new Error(gResult.error);
            nerResult = gResult;
          }
        }
 
       console.log("DEBUG NER result:", nerResult);
       
       // Check for Gemini error response
       if (nerResult?.error) {
         throw new Error(nerResult.error);
       }

      // If we already persisted the structured service result above, skip re-mapping/persisting.
      if (!usedStructuredService) {
        // First, manually update the local state BEFORE persisting (Gemini flow)
        const mappedResume = mapNERToResumeFormat(nerResult);
        setEditableResume(mappedResume);  // Update UI immediately
        setParsed(true);  // Mark as parsed

        // Persist appropriately depending on result shape
        try {
          // Server NER returns { parsed_entities: { ... } } — use NER persister
          if (nerResult && (nerResult.parsed_entities || nerResult.parsedEntities)) {
            await persistNERResult(nerResult);
          } else {
            // Gemini / AI shaped result -> use Gemini persister
            await persistGeminiAnalysisResult(nerResult);
          }
        } catch (persistErr) {
          console.warn("Failed to persist parsed result:", persistErr);
        }
      }
 
      // Reduce timeout since we already synced UI
      const waitForPersist = async (timeoutMs = 3000, intervalMs = 50) => {
         const start = Date.now();
         while (Date.now() - start < timeoutMs) {
           const st = useAnalysisStore.getState();
           if (st.parseComplete && st.editableResume?.profile && Object.keys(st.editableResume.profile).length > 0) {
             return st;
           }
           await new Promise((r) => setTimeout(r, intervalMs));
         }
         // If we already updated the UI, don't fail on timeout
         const st = useAnalysisStore.getState();
         return st;
       };
 
       try {
         const persistedState = await waitForPersist(3000, 50);
         // Sync UI with persisted store
         setEditableResume(persistedState.editableResume);
         setParsed(true);
 
        // Notify parent App that parsing finished successfully -> spinner can despawn
        try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange success failed", e); }
          // Only show success toast after we confirmed persisted state
          toast.success(`${displayName} parsed successfully.`, {
            id: taskId,
            description: "You may now return to the analyzer tab to see the results",
            icon: "✅",
            dismissible: true,
            duration: 3000,
          });

          // Show the rate-limit advisory only for image parsing (image parsing uses Gemini and needs spacing)
          if (file && file.type && file.type.toLowerCase().startsWith("image")) {
            setTimeout(() => {
              //Show rate limit advisory
              toast.info("Rate limit advisory", {
                id: "rate-limit-parse",
                description: `After parsing completes, wait at least ${recommended}s before analyzing to avoid rate limits.`,
                icon: "⏱️",
                dismissible: true,
                duration: 3000,
              });
            }, 4000);
          }

        } catch (waitErr) {
          // If waiting failed, still attempt to use what's in the store and notify parent
          console.warn("Waiting for persisted state timed out, falling back to immediate sync:", waitErr);
          const st = useAnalysisStore.getState();
          setEditableResume(st.editableResume || { ...defaultResume });
          setParsed(Boolean(st.parseComplete));
          try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange fallback failed", e); }
          // indicate parse may not have persisted
        toast.error(`${displayName} parsed but UI persistence timed out. Please refresh or try again.`, { duration: 5000 });
       }
       
      // Update task and UI state
      updateTask(taskId, { 
        status: "completed",
        result: useAnalysisStore.getState().editableResume,
        completedAt: Date.now()
      });
      console.log("DEBUG store after persist:", useAnalysisStore.getState());
      console.log("DEBUG parsed resume immediately reflected:", useAnalysisStore.getState().editableResume);
    } catch (err) {
      console.error("Failed to parse resume:", err);
      setEditableResume({...defaultResume});
      setParsed(false);

      // Notify parent App that parsing stopped (error) to avoid permanent spinner;
      // UI still indicates parse failure via toast / analysis state.
      try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange error failed", e); }

      updateTask(taskId, {
        status: "error", 
        error: err.message,
        completedAt: Date.now()
      });
      toast(`${displayName} was not parsed`, {
        id: taskId,
        description: "Something went wrong. Please try again.",
        icon: "❌",
        dismissible: true,
        duration: 10000,
      });
    } finally {
      setProcessing(false);
      setIsParsingResume(false);
    }
  };

  // Similarly update handleAnalyzeResume to use tasks
  const handleAnalyzeResume = async () => {
    setHasAnalyzed(true);

    const displayName = currentFile?.name || resumeName || "resume.pdf";
    const taskId = `analyze-${Date.now()}`;
    const { recommended } = getRateLimitRestTime();
    
    setProcessing(true);
    try { onParsingStateChange?.(true, displayName); } catch (e) { console.warn("onParsingStateChange start failed", e); }

    addTask({
      id: taskId,
      type: "analyze",
      status: "started",
      startedAt: Date.now()
    });

    toast("Analyzing resume...", {
      id: taskId,
      description: "Analyzing resume, you can close this while it runs.",
      dismissible: true,
      duration: 10000,
    });

    try {
      if (!editableResume) {
        setAnalysisResult("No resume data to analyze.");
        setLoadingAnalysis(false);
        return;
      }

      // Attempt to extract raw text from the file (preferred) using extractResumeText.
      // If extraction fails or returns too little, fall back to the minimal JSON payload.
      let extractedText: string | null = null;
      try {
        let file: File | null = null;

        // 1) Try using an HTTP(S) persisted URL
        const persistedUrl = currentFile?.url || fileUrl;
        if (persistedUrl && /^https?:\/\//i.test(String(persistedUrl))) {
          try {
            const resp = await fetch(String(persistedUrl));
            if (resp.ok) {
              const fetchedBlob = await resp.blob();
              file = new File([fetchedBlob], currentFile?.name || resumeName || "resume.pdf", {
                type: fetchedBlob.type || "application/pdf",
              });
              console.log("Using HTTP(S) URL to build File for analysis:", persistedUrl);
            }
          } catch (e) {
            console.warn("Fetching persisted URL for analysis failed, will fallback:", e);
            file = null;
          }
        }

        // 2) Reconstruct from persisted base64 if present
        if (!file && currentFile?.data) {
          try {
            const cleaned = currentFile.data.replace(/^data:.*;base64,/, "");
            const byteString = atob(cleaned);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: currentFile.type || "application/pdf" });
            file = new File([blob], currentFile.name || "resume.pdf", { type: currentFile.type || "application/pdf" });
            console.log("Reconstructed File from base64 for analysis");
          } catch (e) {
            console.warn("Reconstruct from base64 failed for analysis:", e);
            file = null;
          }
        }

        // 3) Fallback: fetch from blob: URL or fileUrl
        if (!file) {
          const fetchUrl = currentFile?.url || fileUrl;
          if (fetchUrl) {
            const response = await fetch(fetchUrl);
            const blob = await response.blob();
            file = new File([blob], currentFile?.name || resumeName || "resume.pdf", {
              type: blob.type || "application/pdf",
            });
          }
        }

        if (file) {
          const text = await extractResumeText(file);
          if (text && typeof text === "string" && text.trim().length > 20) {
            extractedText = text;
            console.log("Extracted raw text length:", extractedText.length);
          } else {
            console.warn("extractResumeText returned empty or too-short text; will fall back to JSON payload");
            extractedText = null;
          }
        } else {
          console.warn("Could not prepare File for extractResumeText; falling back to JSON payload");
        }
      } catch (e) {
        console.warn("Raw text extraction failed, falling back to JSON payload:", e);
        extractedText = null;
      }

      // Build a trimmed JSON payload as fallback
      const minimalResume = {
        profile: editableResume.profile || {},
        skills: {
          featuredSkills: (editableResume.skills?.featuredSkills || []).slice(0, 20),
          descriptions: (editableResume.skills?.descriptions || []).slice(0, 40),
        },
        educations: (editableResume.educations || []).slice(0, 5).map((e: any) => ({
          school: e.school || "",
          degree: e.degree || "",
          field: e.field || "",
          date: e.date || ""
        })),
        workExperiences: (editableResume.workExperiences || []).slice(0, 5).map((w: any) => ({
          company: w.company || "",
          position: w.position || "",
          date: w.date || "",
          description: (w.description || "").split(/\s+/).slice(0, 200).join(" ")
        })),
        projects: (editableResume.projects || []).slice(0, 5),
        custom: { descriptions: (editableResume.custom?.descriptions || []).slice(0, 10) },
      };

      const jobRoleObj = selectedCategory && selectedJobRole
        ? JOB_ROLES[selectedCategory][selectedJobRole]
        : undefined;

      // If we have extracted raw text, send that as the `resume` payload to DeepSeek.
      // Otherwise send the JSON stringified minimalResume as before.
      const payload = {
        resume: extractedText ? extractedText : JSON.stringify(minimalResume),
        job_role: selectedJobRole || "",
        job_description: jobRoleObj?.description || customJobDescription || "",
      };

      // Call FastAPI backend
      const rawResult = await analyzeResumeWithDS(payload);
      console.log("analyzeResumeWithDS raw result:", rawResult);

      // Normalize the backend’s response shape
      const analysisText = rawResult.analysis || rawResult.text || rawResult.result || "";
      const resumeData = rawResult.data || rawResult.resume || editableResume;

      await persistAnalysisResult({
        resume: resumeData,
        analysis: analysisText,
      });

      // Handle error response from backend
      if (rawResult.error) {
        throw new Error(rawResult.error);
      }

      // Wait for the persisted store to reflect the analysis (guard against hydration/read races)
      const waitForAnalysisPersist = async (timeoutMs = 10000, intervalMs = 100) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const st = useAnalysisStore.getState();
          if (st.analysisResult && st.analysisResult.length > 0) return st;
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Timed out waiting for persisted analysisResult");
      };

      try {
        const persisted = await waitForAnalysisPersist(5000, 100);
        setAnalysisResult(persisted.analysisResult);
        toast("Resume analyzed successfully", {
          id: taskId,
          description: "Results will be reflected in a few seconds. You may now return to the analyzer tab.",
          dismissible: true,
          duration: 3000,
        });

        setTimeout(() => {
          //Show rate limit advisory
          toast.info("Rate limit advisory", {
            id: "rate-limit-analyze",
            description: `If you parse another resume next, wait at least ${recommended}s after this analysis completes.`,
            icon: "⏱️",
            dismissible: true,
            duration: 3000,
          });
        }, 4000)
      } catch (waitErr) {
        // fallback: use immediate store snapshot and warn
        console.warn("Timed out waiting for analysis persistence:", waitErr);
        setAnalysisResult(useAnalysisStore.getState().analysisResult);
        toast("Resume analyzed successfully", {
          id: taskId,
          description: "Results will be reflected in a few seconds. You may now return to the analyzer tab.",
          dismissible: true,
          duration: 10000,
        });
      }
    } catch (err) {
      console.error("Error analyzing resume:", err);
      setAnalysisResult("Failed to analyze resume");
    } finally {
      // Clear global processing and notify parent
      setLoadingAnalysis(false);
      setProcessing(false);
      try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange end failed", e); }
      // update task status if needed
      updateTask(taskId, { status: "completed", completedAt: Date.now() });
    }
  };

  useEffect(() => {
    if (isHydrated && analysisResult) {
      console.log("Restored analysis result after hydration:", analysisResult.slice(0, 100));
    }
  }, [isHydrated, analysisResult]);


  useEffect(() => {
    console.log("analysisResult updated:", analysisResult);
  }, [analysisResult]);


  return (
    <>
      {loadingAnalysis && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(255,255,255,0.85)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "all"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="loader" style={{
              marginBottom: 16,
              width: 48,
              height: 48,
              border: "6px solid #1976d2",
              borderTop: "6px solid #eee",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <h3 style={{ margin: 0 }}>Analyzing Resume...</h3>
            <p style={{ marginTop: 8 }}>This may take a few seconds. Please wait.</p>
          </div>
        </div>
      )}

      {/* RESUME LOADING OVERLAY */}
      {pdfLoading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 9997,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
          }}
        >
          <div style={{
            background: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            textAlign: "center"
          }}>
            <div style={{
              width: 32,
              height: 32,
              border: "4px solid #1976d2",
              borderTop: "4px solid #eee",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 8px"
            }} />
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Loading Resume...</p>
          </div>
        </div>
      )}
    <div className="resume-parser-container">
      <div className="pdf-preview">
        <section className="w-1/2 p-2" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {fileUrl ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
              {/* Scrollable PDF/Image/DOCX area */}
              <div style={{ position: "relative", flex: 1, overflow: "auto", border: "1px solid #ddd", borderRadius: "6px" }}>
                {/* Close (clear) button positioned top-right of preview box */}
                  <button
                    onClick={handleClosePreview}
                    aria-label="Close preview"
                    title="Clear uploaded file"
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 20,
                      background: "#ffffff",
                      color: "#981b1b",
                      border: "1px solid #981b1b",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
                    }}
                  >
                    ×
                  </button>

                  {/* Loading overlay shown while preview is rendering */}
                  {(isLoading || pdfLoading) && (
                    <div
                      aria-hidden={!isLoading && !pdfLoading}
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(255,255,255,0.9)",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 10,
                        padding: 12,
                        pointerEvents: "none"
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          border: "6px solid #eee",
                          borderTop: "6px solid #981b1b",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                        }}
                      />
                      <div style={{ color: "#333", fontWeight: 600 }}>Loading preview…</div>
                      <div style={{ color: "#666", fontSize: 12 }}>This may take a few seconds</div>
                    </div>
                  )}

                  <ResumePreview 
                    fileUrl={fileUrl}
                    fileType={fileType}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    totalPages={totalPages}
                    setTotalPages={setTotalPages}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
              </div>
              
              <div style={{
                display: totalPages > 0 ? "flex" : "none",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "#f5f5f5",
                borderRadius: "6px",
                gap: "12px",
                borderTop: "1px solid #ddd",
                flexShrink: 0,
                position: "sticky",
                bottom: 0,
                zIndex: 10
              }}>
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || isLoading}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: currentPage === 1 ? "#ccc" : "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  ← Previous
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value, 10);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    style={{
                      width: "50px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      textAlign: "center"
                    }}
                    disabled={isLoading}
                  />
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || isLoading}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: currentPage === totalPages ? "#ccc" : "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">
              No Resume loaded. Please upload one in .pdf, .docx or image format
            </div>
          )}
        </section>
      </div>

      <div className="right-panel">
        {clearedMessage && (
          <div style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            color: '#0c5460',
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 8,
            fontSize: 13
          }}>
            {clearedMessage}
          </div>
        )}
        <div className="toolbar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ResumeDropzone
            initialFileUrl={fileUrl}
            initialFileName={resumeName}
            fallbackFileUrl={null}
            onFileUrlChange={handleFileChange}
            currentFile={currentFile}
            showRemoveButton={false}
            resetSignal={dropzoneResetSignal}
          />
          
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flex: 1 }}>
            <button
              onClick={handleParseResume}
              className="btn-primary"
              disabled={isParsingResume || isProcessing}
              title="Parse Uploaded Resume"
            >
              {isParsingResume || isProcessing ? "Parsing..." : "Parse Resume"}
            </button>
                   </div>

          <button
            onClick={() => {
              try { goBack?.(); } catch (e) { console.warn("goBack failed:", e); }
              try { setShowAnalyzer?.(false); } catch (e) { console.warn("setShowAnalyzer failed:", e); }
            }}
            className="btn-primary"
            style={{
              background: "#6c757d",
              borderColor: "#6c757d",
              marginLeft: "auto"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#5a6268";
              e.currentTarget.style.borderColor = "#5a6268";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#6c757d";
              e.currentTarget.style.borderColor = "#6c757d";
            }}
            title="Go back to Screening"
          >
            Close
          </button>
        </div>

        <div className="tab-header">
            <button
              className={`tab-btn ${activeTab === "parsing" ? "active" : ""}`}
              onClick={() => setActiveTab("parsing")}
            >
              Parsing Table
            </button>
              <>
                <button
                  className={`tab-btn ${activeTab === "analysis" ? "active" : ""}`}
                  onClick={() => setActiveTab("analysis")}
                >
                  Resume Analysis
                </button>

                {/* New tab for isolated candidate scoring */}
                <button
                  className={`tab-btn ${activeTab === "scoring" ? "active" : ""}`}
                  onClick={() => setActiveTab("scoring")}
                >
                  Candidate Scoring
                </button>
              </>
           </div>
  
        <div className="tab-content">
          {activeTab === "parsing" ? (
             <div className="resume-table-section">
               <h2 className="section-title">Applicant Information Sheet</h2>
               {/* Always render the editable table (use persisted editableResume or default) */}
               <ResumeTable
                 resume={editableResume || defaultResume}
                 onFieldChange={handleFieldPathChange}
               />
               <button
                 onClick={handleAddApplicantClick}
                 className="btn-secondary mt-2"
                 disabled={isAddingApplicant}
                 title={!editableResume ? "Preparing resume editor..." : "Add applicant from this resume data"}
               >
                 ➕ Add Applicant
               </button>
             </div>
          ) : activeTab === "analysis" ? (
            <div className="resume-analysis-section">
              <h2 className="section-title">Resume Analysis</h2>

              <label className="block font-semibold mb-1">Job Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="input"
              >
                {Object.keys(JOB_ROLES).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <label className="block font-semibold mb-1 mt-2">Job Role</label>
              <select
                value={selectedJobRole}
                onChange={(e) => {
                  setSelectedJobRole(e.target.value);
                  // Description will be updated by the effect above               
                }}
                className="input"
              >
                <option value="">Select a role</option>
                {selectedCategory &&
                  Object.keys(JOB_ROLES[selectedCategory] || {}).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
              </select>

              <label className="block font-semibold mb-1 mt-2">Job Description</label>
              <textarea
                value={customJobDescription}
                onChange={(e) => setCustomJobDescription(e.target.value)}
                placeholder="Enter custom job description here..."
                rows={5}
                className="input"
              />
                {selectedCategory && selectedJobRole && JOB_ROLES[selectedCategory][selectedJobRole]?.description && (
                  <button
                    onClick={() => setCustomJobDescription(JOB_ROLES[selectedCategory][selectedJobRole].description)}
                    className="text-sm text-blue-600 mt-1"
                  >
                    Use default description for {selectedJobRole}
                  </button>
                )}

              <button
                onClick={handleAnalyzeResume}
                className="btn-primary mt-4"
                disabled={loadingAnalysis || isProcessing}
              >
                {loadingAnalysis || isProcessing ? "Analyzing..." : "Analyze Resume"}
              </button>

              {analysisResult && analysisResult.trim() !== "Failed to analyze resume" ? (
                <div className="analysis-cards mt-4">
                  {renderAnalysisSections(analysisResult)}
                </div>
              ) : (
                <div className="analysis-card mt-4">
                  {analysisResult === "Failed to analyze resume"
                    ? "Failed to analyze resume."
                    : "No analysis yet. Click 'Analyze Resume' to start."}
                </div>
              )}
            </div>
          ) : (
            /* activeTab === "scoring" branch */
            <div className="candidate-scoring-section">
              <h2 className="section-title">Candidate Scoring</h2>
              <div style={{
                display: "flex",
                gap: "32px",
                alignItems: "flex-start",
                marginBottom: "24px"
              }}>
                {/* Configure Scoring Weights */}
                <div style={{ flex: 1 }}>
                  <h3>Configure Scoring Weights</h3>
                  {Object.keys(scoringWeights).map((key) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <label style={{ width: 120, display: "inline-block" }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={scoringWeights[key]}
                        onChange={(e) => handleWeightChange(key, parseFloat(e.target.value) || 0)}
                        style={{ width: 60 }}
                      />
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: "#888" }}>
                    (Sum should be 1.0 for proper weighting)
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h3 className="mt-0">Section Scores</h3>
                  {Object.keys(sectionScores).map((key) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <label style={{ width: 120, display: "inline-block" }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={sectionScores[key]}
                        onChange={(e) => handleScoreChange(key, parseInt(e.target.value, 10) || 0)}
                        style={{ width: 60 }}
                      />
                    </div>
                  ))}
                  <div className="mt-4">
                    <label style={{ fontWeight: "bold" }}>Your Score (0-100): </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={userScore ?? ""}
                      onChange={(e) => handleUserScoreChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      style={{ width: 80, marginLeft: 8 }}
                    />
                  </div>
                </div>
              </div>

            {/* Calculate Score Button */}
            <button
              className="btn-primary"
              style={{ marginBottom: 16 }}
              onClick={() => setShowFinalScore(true)}
            >
              Calculate Score
            </button>

            {/* Show score only after button click */}
            {showFinalScore && (
              <div style={{ marginTop: 12 }}>
                <CandidateScoreCard sectionScores={sectionScores} scoringWeights={scoringWeights} userScore={userScore} />
              </div>
            )}
          </div>
          )}
         </div>
      </div>
    </div>
          {/* ADD APPLICANT MODAL */}
      {showAddApplicantModal && (
        <div
          className="modalOverlay"
          onClick={(e) =>
            e.target instanceof Element && e.target.classList.contains("modalOverlay") && setShowAddApplicantModal(false)
          }
        >
          <div className="modalContent" role="dialog" aria-modal="true">
            <div className="modalHeader">
              <h3>Add Applicant</h3>
              <button className="closeBtn" onClick={() => setShowAddApplicantModal(false)}>
                ×
              </button>
            </div>

            <hr className="modalDivider" />

            <div className="modalBody" style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Job Category</label>
                <select
                  value={modalCategory}
                  onChange={(e) => { setModalCategory(e.target.value); setModalJobRole(""); }}
                  className="input"
                >
                  <option value="">Select a category</option>
                  {deptLoading && <option value="">Loading...</option>}
                  {!deptLoading && deptPosList && Array.from(new Set(deptPosList.map(d => d.departmentname))).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Job Role <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={modalJobRole}
                  onChange={(e) => setModalJobRole(e.target.value)}
                  disabled={!modalCategory}
                  className="input"
                >
                  <option value="">Select a role</option>
                  {modalCategory && deptPosList && Array.from(new Set(deptPosList.filter(d => d.departmentname === modalCategory).map(d => d.positionname))).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modalFooter" style={{ marginTop: 14 }}>
              <button
                className="actionBtn"
                onClick={() => setShowAddApplicantModal(false)}
                disabled={isAddingApplicant}
                style={{ marginRight: 8 }}
              >
                Cancel
              </button>
              <button
                className="actionBtn"
                onClick={handleConfirmAddApplicant}
                disabled={!modalCategory || !modalJobRole || isAddingApplicant}
              >
                {isAddingApplicant ? "Adding..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
