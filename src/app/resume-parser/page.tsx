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
import { API_BASE_URL } from '../../../config';
import { useAnalysisStore, defaultResume } from '../../electron/aiStore';
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import {
  exportJSON,
  mapEntitiesToResume,
  calculateCandidateScore,
  renderAnalysisSections,
  getApplicantName,
  reconstructBlobUrl,
  fileToBase64,
  persistGeminiAnalysis
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

type PdfPreviewProps = {
  fileUrl: string | null;
  scale?: number; // optional scale for rendering
  maxPages?: number; // optional limit for pages to render
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  setTotalPages: (pages: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

function PdfPreview({ 
  fileUrl, 
  scale = 1, 
  maxPages,
  currentPage,
  setCurrentPage,
  totalPages,
  setTotalPages,
  isLoading,
  setIsLoading
 }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
  if (!fileUrl || !canvasRef.current) return;

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
}, [fileUrl, currentPage, scale]);


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "6px",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          flex: 1,
        }}
      />

      {isLoading && (
        <div style={{ textAlign: "center", color: "#999", fontSize: "14px" }}>
          Loading...
        </div>
      )}
    </div>
  );
}

type ResumeParserProps = {
  setActivePage?: any;
  setSelectedApplicantId?: any;
  setPreviousPage?: any;
  activePage?: any;
  selectedResumeFile?: any;
  setSelectedResumeFile?: any;
  goBack?: any;
  onParsingStateChange?: (isParsingResume: boolean, fileName: string) => void;
};

export default function ResumeParser
({ setActivePage,
   setSelectedApplicantId,
   setPreviousPage,
   activePage,
   selectedResumeFile,
   setSelectedResumeFile, 
   goBack,
   onParsingStateChange }: ResumeParserProps = {}) {
  console.log("DEBUG ResumeTable:", typeof ResumeTable, ResumeTable);
  console.log("DEBUG CandidateScoreCard:", typeof CandidateScoreCard, CandidateScoreCard);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItems>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  // Visual indicator shown when persisted file state is cleared on this session
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);
  //const { addTask, updateTask } = useAnalysisStore();
  const [hydrationAttempted, setHydrationAttempted] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // for applicant adding:

  const [showAddApplicantModal, setShowAddApplicantModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalJobRole, setModalJobRole] = useState("");
  const [isAddingApplicant, setIsAddingApplicant] = useState(false);

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
      // read current resume from store (fallback to default)
      const prev = useAnalysisStore.getState().editableResume || defaultResume;
      const next = JSON.parse(JSON.stringify(prev || defaultResume));
      setByPath(next, fieldPath, value);
      setEditableResume(next);
    } catch (e) {
      console.error("handleFieldPathChange failed for", fieldPath, e);
    }
  }, [setEditableResume]);

  const handleAddApplicantClick = () => {
    setShowAddApplicantModal(true);
    setModalCategory("");
    setModalJobRole("");
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

    const applicantData = {
      ...editableResume,
      departmentName: modalCategory,
      positionName: modalJobRole,
    };

    console.log("Adding applicant:", applicantData);

    try {
      const added = await window.fileAPI.addApplicant(applicantData);

      // Build applicant full name
      const fullName = [
        applicantData.profile?.firstName || "",
        applicantData.profile?.middleName || "",
        applicantData.profile?.lastName || ""
      ].filter(Boolean).join(" ");

      // Log action
      const description = `
        Applicant ID: ${added.applicantid}
        Name: ${fullName}
        Email: ${applicantData.profile?.email || ""}
        Department: ${applicantData.departmentName}
        Position: ${applicantData.positionName}
      `.trim();

      await window.fileAPI.logAction(
        1, // replace with actual userid later
        `added applicant "${fullName}"`,
        description
      );

      toast.success(`Applicant added! ID: ${added.applicantid}`, {
        duration: 3000,
      });
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

const handleFileChange = useCallback(async (fileUrl: string, fileName: string, fileObj?: File) => {
  // Always preview the local blob immediately
  setFileUrl(fileUrl);
  setResumeName(fileName);

  if (!fileObj) return;

  try {
    // Upload to Supabase for persistence
    const publicUrl = rendererSupabase ? await uploadFileToSupabase(fileObj) : null;

    if (publicUrl) {
      console.log("Uploaded to Supabase ->", publicUrl);
      // Persist a stable HTTP(S) URL and no base64 blob
      setCurrentFile({
        url: publicUrl,
        name: fileObj.name,
        type: fileObj.type,
        data: undefined,
      });
      setFileUrl(publicUrl); // Switch preview to Supabase URL once ready
      setResumeName(fileObj.name);
      setEditableResume({ ...defaultResume });
    } else {
      console.warn("Supabase upload failed or disabled, persisting base64 (not blob:) and using blob preview only.");
      // Persist base64 data instead of storing the transient blob: URL
      try {
        const base64 = await fileToBase64(fileObj); // returns data:<mime>;base64,...
        setCurrentFile({
          url: undefined,
          name: fileObj.name,
          type: fileObj.type || "application/pdf",
          data: base64,
        });
      } catch (e) {
        // Fallback: persist metadata only, do NOT persist blob URL
        console.warn("Failed to convert file to base64 for persistence:", e);
        setCurrentFile({
          url: undefined,
          name: fileObj.name,
          type: fileObj.type || "application/pdf",
          data: undefined,
        });
      }
    }

    // Note: we intentionally DO NOT persist or set a blob: URL in currentFile.url.
    // Keep the immediate preview as a blob URL in component state (fileUrl) only.
  } catch (err) {
    console.error("Upload to Supabase failed:", err);
    // Persist metadata only; do not persist blob: url
    setCurrentFile({
      url: undefined,
      name: fileName,
      type: fileObj.type || "application/pdf",
      data: undefined,
    });
  }

  // Only reset parse state when a NEW file is actually being processed
  // (i.e., a File object was provided). This preserves previously parsed results
  // when just previewing an already-uploaded file.
  if (fileObj) {
    setParsed(false);
    setEditableResume({ ...defaultResume });
  }
}, [setCurrentFile, setEditableResume, setParsed]);


  // On first mount (app startup) clear only the persisted uploaded file (currentFile) once per
  // app session. We use sessionStorage as a guard so this runs only once per full app boot —
  // not on subsequent navigations while the app is running.
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('resume-currentfile-cleared');
      if (!flag) {
        // 1) Clear the persisted `currentFile` key inside the zustand storage object
        try {
          const key = 'resume-analysis-store';
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              // Zustand persist may store the state directly or under a `state` wrapper — handle both
              if (parsed && typeof parsed === 'object') {
                if (parsed.currentFile !== undefined) {
                  delete parsed.currentFile;
                }
                if (parsed.state && parsed.state.currentFile !== undefined) {
                  delete parsed.state.currentFile;
                }
                localStorage.setItem(key, JSON.stringify(parsed));
              }
            } catch (e) {
              // If parsing failed, as a fallback remove the whole key
              console.warn('Could not parse persisted store; removing whole key as fallback');
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          console.error('Failed to clear persisted currentFile:', e);
        }

        // 2) Update in-memory store so UI reflects cleared file immediately
        try {
          if (typeof setCurrentFile === 'function') setCurrentFile(null);
        } catch (e) {
          console.error('Failed to setCurrentFile(null):', e);
        }

        // 3) Mark flag so we don't clear again this session
        try { sessionStorage.setItem('resume-currentfile-cleared', '1'); } catch {}

        // 4) Show a short visual indicator to help debugging / inform the user
        setClearedMessage('Previous uploaded resume cleared for this session');
        setTimeout(() => setClearedMessage(null), 4000);
      }
    } catch (e) {
      console.error('Session-only clear effect failed:', e);
    }

    // Ensure editableResume exists as a defensive fallback
    if (!editableResume) {
      setEditableResume({ ...defaultResume });
    }
  }, []);

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
          return;
        }

        // 2) If we have an original filename, try to find it in Supabase storage
        if (currfile?.name && rendererSupabase) {
          try {
          console.log("Searching Supabase for:", currfile.name);
          const publicUrl = await findSupabasePublicUrl(currfile.name, "PDFs");
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
  }, [isHydrated, hydrationAttempted]);

  useEffect(() => {
    if (!fileUrl && currentFile?.url) {
      console.log("Syncing fileUrl from currentFile:", currentFile.url);
      setFileUrl(currentFile.url);
      setResumeName(currentFile.name || "resume.pdf");
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
    if (isHydrated && useAnalysisStore.getState().analysisResult) {
      setHasAnalyzed(true);
    }
  }, [isHydrated]);

  const [scoringWeights, setScoringWeights] = useState({
    skills: 0.3,
    experience: 0.4,
    education: 0.15,
    achievements: 0.1,
    formatting: 0.05,
  });

  const [sectionScores, setSectionScores] = useState({
    skills: 85,
    experience: 90,
    education: 75,
    achievements: 60,
    formatting: 80,
  });

const [aiScore, setAiScore] = useState<number | null>(null);
const [userScore, setUserScore] = useState<number | null>(null);

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
        `${API_BASE_URL}/parser/ner-extract-resume-profile`,
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
        "http://127.0.0.1:8000/ai/gemini-extract-resume-profile",
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

  //Extract text from file using extract endpoint
  async function extractResumeText(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    console.log("Uploading file:", file);

    const response = await axios.post(`${API_BASE_URL}/parser/extract-resume-text`, formData);
    console.log("Response:", response);

    // Normalize response -> always return a string
    const data = response.data;
    if (typeof data === "string") {
      return data;
    }

    // Common server shapes: { text: "..." } or { result: "..." }
    if (data && typeof data.text === "string") return data.text;
    if (data && typeof data.result === "string") return data.result;
    if (data && typeof data.data === "string") return data.data;

    // fallback: try to build a readable string (avoid passing objects to gemini endpoint)
    try {
      return JSON.stringify(data);
    } catch (e) {
      return "";
    }
  }

  async function findSupabasePublicUrl(originalName: string, bucket = "PDFs") {
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
  async function uploadFileToSupabase(file: File | File, bucket = "PDFs") {
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

      // ✅ PUBLIC bucket
      const { data: urlData } = rendererSupabase.storage.from(bucket).getPublicUrl(fileName);
      if (urlData?.publicUrl) return urlData.publicUrl;

      // 🔒 PRIVATE bucket — fallback to signed URL
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
        // Prefer Supabase public URL if client configured
        let previewUrl: string | null = null;
        if (rendererSupabase && selectedResumeFile.name) {
          try {
            const uploaded = await findSupabasePublicUrl(selectedResumeFile.name, "PDFs");
            if (uploaded) {
              previewUrl = uploaded;
              console.log("Found existing Supabase file for selectedResumeFile ->", previewUrl);
            }
            else {
              console.log('Supabase upload returned null, falling back to blob URL');
            }
            } catch (e) {
            console.warn('Supabase upload attempt failed, falling back to blob URL', e);
          }
        }

        // 2) If not found on Supabase, attempt to upload only if a File object was passed from UI
        if (!previewUrl && selectedResumeFile.file instanceof File && rendererSupabase) {
          try {
            previewUrl = await uploadFileToSupabase(selectedResumeFile.file, "PDFs");
            if (previewUrl) console.log("Uploaded File object to Supabase ->", previewUrl);
          } catch (e) {
            console.warn("Uploading File object to Supabase failed, will fallback to blob:", e);
            previewUrl = null;
          }
        }

        // fallback to blob URL
        // let createdBlobUrl: string | null = null;
        // if (!previewUrl) {
        //   createdBlobUrl = URL.createObjectURL(blob);
        //   previewUrl = createdBlobUrl;
        //   console.log('Hydrated file to base64 -> new blob url:', previewUrl);
        // }

        // if (didCancel) {
        //   if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
        //   return;
        // }

        if (previewUrl) {
        setFileUrl(previewUrl);
        setResumeName(selectedResumeFile.name || 'uploaded_resume.pdf');
        setFileState(prev => ({ ...prev, fileUrl: previewUrl, resumeName: selectedResumeFile.name || 'uploaded_resume.pdf' }));

        setCurrentFile({ 
          url: previewUrl, 
          name: selectedResumeFile.name || 'uploaded_resume.pdf', 
          type: selectedResumeFile.type, 
          data: selectedResumeFile.data });

        // Ensure editable resume exists
        setEditableResume({ ...defaultResume });
        }
      } catch (e) {
        console.error('Failed to process selectedResumeFile:', e);
      }
    })();

    return () => { didCancel = true; };
  }, [selectedResumeFile, setCurrentFile, setEditableResume]);

  // New function to handle manual parsing
  const handleParseResume = async () => {
    if (!fileUrl) {
      toast.error("Please upload a resume first");
      return;
    }
    
    // Get the actual filename instead of blob URL
    const displayName = currentFile?.name || resumeName || "resume.pdf";

    const taskId = `parse-${Date.now()}`;
    setProcessing(true);
    setIsParsingResume(true);

    // Notify parent App (sidebar spinner) that parsing started
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
      duration: Infinity,
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
      const extractedText = await extractResumeText(file);
      
      // Then process with NER
      const nerResult = await NERResumeProfile(extractedText);
      console.log("DEBUG NER result:", nerResult);
      
      // Check for Gemini error response
      if (nerResult?.error) {
        throw new Error(nerResult.error);
      }

      //Persist to store
      await persistNERResult(nerResult);

      // Wait for zustand persistence to reflect in memory/localStorage.
      // Poll store until parseComplete is true and editableResume has profile data.
      const waitForPersist = async (timeoutMs = 3000, intervalMs = 50) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const st = useAnalysisStore.getState();
          if (st.parseComplete && st.editableResume && st.editableResume.profile && Object.keys(st.editableResume.profile).length > 0) {
            return st;
          }
          // allow browser work to flush writes
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Timed out waiting for persisted parsed resume");
      };

      try {
        const persistedState = await waitForPersist(3000, 50);
        // Sync UI with persisted store
        setEditableResume(persistedState.editableResume);
        setParsed(true);

        // Notify parent App that parsing finished successfully -> spinner can despawn
        try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange success failed", e); }
      } catch (waitErr) {
        // If waiting failed, still attempt to use what's in the store and notify parent
        console.warn("Waiting for persisted state timed out, falling back to immediate sync:", waitErr);
        const st = useAnalysisStore.getState();
        setEditableResume(st.editableResume || { ...defaultResume });
        setParsed(Boolean(st.parseComplete));
        try { onParsingStateChange?.(false, displayName); } catch (e) { console.warn("onParsingStateChange fallback failed", e); }
      }
      
      // Update task and UI state
      updateTask(taskId, { 
        status: "completed",
        result: useAnalysisStore.getState().editableResume,
        completedAt: Date.now()
      });
      console.log("DEBUG store after persist:", useAnalysisStore.getState());
      console.log("DEBUG parsed resume immediately reflected:", useAnalysisStore.getState().editableResume);
      toast(`${displayName} parsed successfully.`, {
        id: taskId,
        description: "You may now return to the analyzer tab to see the results",
        icon: "✅",
        dismissible: true,
        duration: Infinity,
      });

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
        duration: Infinity,
      });
    } finally {
      setProcessing(false);
      setIsParsingResume(false);
    }
  };

  // REMOVE the old effect that synced onParsingStateChange to local isParsingResume.
  // Replace this:
  // useEffect(() => {
  //   try {
  //     onParsingStateChange?.(Boolean(isParsingResume), resumeName || "");
  //   } catch (e) {
  //     console.warn("onParsingStateChange callback failed:", e);
  //   }
  // }, [isParsingResume, resumeName, onParsingStateChange]);
  //
  // With: (no-op) — parent is updated explicitly above.

  // Similarly update handleAnalyzeResume to use tasks
  const handleAnalyzeResume = async () => {
    setHasAnalyzed(true);

    const displayName = currentFile?.name || resumeName || "resume.pdf";
    const taskId = `analyze-${Date.now()}`;
    // Signal global processing (DeepSeek) and notify parent UI
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
      duration: Infinity,
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
          const text = await extractResumeText(file); // <--- uses existing helper
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

      await persistGeminiAnalysis({
        resume: resumeData,
        analysis: analysisText,
      });

      // Handle error response from backend
      if (rawResult.error) {
        throw new Error(rawResult.error);
      }

      // Immediately sync local UI state with store
      setAnalysisResult(useAnalysisStore.getState().analysisResult);

      toast.success("Resume analyzed successfully", { id: taskId });

      // If result is already a string with sections, use it directly
      if (typeof rawResult === "string" && rawResult.includes("##")) {
        setAnalysisResult(rawResult);
        // Extract score if present
        const scoreMatch = rawResult.match(/Resume Score:\s*(\d{1,3})\/100/i);
        if (scoreMatch) {
          setAiScore(parseInt(scoreMatch[1], 10));
        }
        return;
      }

      // If result has a text/analysis/result field, use that
      if (analysisText) {
        setAnalysisResult(analysisText);
        const scoreMatch = analysisText.match(/Resume Score:\s*(\d{1,3})\/100/i);
        if (scoreMatch) {
          setAiScore(parseInt(scoreMatch[1], 10));
        }
        return;
      }

      // Extract AI score from result (adjust this if your backend returns the score differently)
      const aiScoreMatch = typeof rawResult === "string"
        ? rawResult.match(/Resume Score:\s*(\d{1,3})\/100/i)
        : null;
      const aiScoreValue = aiScoreMatch ? parseInt(aiScoreMatch[1], 10) : calculateCandidateScore(sectionScores, scoringWeights);
      setAiScore(aiScoreValue);
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

      {/* PDF LOADING OVERLAY */}
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
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Loading PDF...</p>
          </div>
        </div>
      )}
    <div className="resume-parser-container">
      <div className="pdf-preview">
        <section className="w-1/2 p-2" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {fileUrl ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
              {/* Scrollable PDF area */}
              <div style={{ flex: 1, overflow: "auto", border: "1px solid #ddd", borderRadius: "6px" }}>
                <PdfPreview 
                fileUrl={fileUrl}
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
              No Resume loaded. Please upload one in .pdf format
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
        <div className="toolbar">
          <ResumeDropzone
            initialFileUrl={fileUrl}
            initialFileName={resumeName}
            fallbackFileUrl={null}
            onFileUrlChange={handleFileChange}
            currentFile={currentFile}
          />
          <button
              onClick={handleParseResume}
              disabled={!fileUrl || isParsingResume || isProcessing}
              className="parse-res-btn"
              title={isParsingResume ? `Parsing ${resumeName || 'resume'}...` : "Click to parse the uploaded resume"}
              style={{
                opacity: (!fileUrl || isParsingResume || isProcessing) ? 0.6 : 1,
                cursor: (!fileUrl || isParsingResume || isProcessing) ? 'not-allowed' : 'pointer',
              }}
            >
              {isParsingResume ? "Parsing..." : "Parse Resume"}
            </button>
          <button
            onClick={() => {
              goBack()
            }}
            className="btn-secondary"
          >
            ✕ Close
          </button>
        </div>

        <div className="tab-header">
          <button
            className={`tab-btn ${activeTab === "parsing" ? "active" : ""}`}
            onClick={() => setActiveTab("parsing")}
          >
            Parsing Table
          </button>
          <button
            className={`tab-btn ${activeTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            Resume Analysis
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "parsing" ? (
            <div className="resume-table-section">
              <h2 className="section-title">Resume Parsing Results</h2>
              {( (fileUrl || currentFile?.data) && parseComplete && editableResume && editableResume.profile ) ? (
                <ResumeTable
                  resume={editableResume || defaultResume}
                  onFieldChange={handleFieldPathChange}
                />
              ) : (
                <div className="empty-resume-note">No parsed resume available. Try parsing a file again.</div>
              )}
              <button
                onClick={handleAddApplicantClick}
                className="btn-secondary mt-2"
                disabled={!editableResume}
              >
                ➕ Add Applicant
              </button>
              {/* <button
                onClick={() => editableResume && exportJSON(editableResume, `${getApplicantName(editableResume)}_resume.json`)}
                className="btn-primary mt-4"
              >
                Export Resume JSON
              </button> */}
            </div>
          ) : (
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
              <div className="score-configurator">
                <h3>Configure Scoring Weights</h3>
                {Object.keys(scoringWeights).map((key) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <label style={{ width: 120, display: "inline-block" }}>{key.charAt(0).toUpperCase() + key.slice(1)}:</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={scoringWeights[key]}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setScoringWeights(w => ({ ...w, [key]: isNaN(val) ? 0 : val }));
                      }}
                      style={{ width: 60 }}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#888" }}>
                  (Sum should be 1.0 for proper weighting)
                </div>
                <h3 className="mt-4">Section Scores</h3>
                {Object.keys(sectionScores).map((key) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <label style={{ width: 120, display: "inline-block" }}>{key.charAt(0).toUpperCase() + key.slice(1)}:</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={sectionScores[key]}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setSectionScores(s => ({ ...s, [key]: isNaN(val) ? 0 : val }));
                      }}
                      style={{ width: 60 }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label style={{ fontWeight: "bold" }}>Your Score (0-100): </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={userScore ?? ""}
                  onChange={e => setUserScore(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  style={{ width: 80, marginLeft: 8 }}
                />
              </div>
              {aiScore !== null && userScore !== null && (
                <div className="mt-2" style={{ fontWeight: "bold", fontSize: "1.2em" }}>
                  Final Applicant Score: <span style={{ color: "#1976d2" }}>
                    {Math.round((aiScore + userScore) / 2)} / 100
                  </span>
                </div>
              )}

              <button
                onClick={handleAnalyzeResume}
                className="btn-primary mt-4"
                disabled={loadingAnalysis || isProcessing}
              >
                {loadingAnalysis || isProcessing ? "Analyzing..." : "Analyze Resume"}
              </button>

              {analysisResult && analysisResult.trim() !== "Failed to analyze resume" ? (
                <>
                  <CandidateScoreCard sectionScores={sectionScores} scoringWeights={scoringWeights} />
                  <div className="analysis-cards mt-4">
                    {renderAnalysisSections(analysisResult)}
                  </div>
                </>
              ) : (
                <div className="analysis-card mt-4">
                  {analysisResult === "Failed to analyze resume"
                    ? "Failed to analyze resume."
                    : "No analysis yet. Click 'Analyze Resume' to start."}
                </div>
              )}

              {!analysisResult && (
                <div className="analysis-card mt-4">No analysis yet.</div>
              )}

              {/* <BatchResumeAnalyzer 
              jobRole={selectedJobRole}
              jobDescription={customJobDescription}
              jobCategory={selectedCategory}  /> */}
            </div>
          )}
        </div>
      </div>
    </div>
          {/* ADD APPLICANT MODAL */}
      {showAddApplicantModal && (
    <div
      className="modalOverlay"
      onClick={(e) => {
        if (e.target.classList.contains("modalOverlay")) {
          setShowAddApplicantModal(false);
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          width: "90%",
          maxWidth: "400px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
          Add Applicant
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Job Category <span style={{ color: "red" }}>*</span>
          </label>
          <select
            value={modalCategory}
            onChange={(e) => {
              setModalCategory(e.target.value);
              setModalJobRole(""); // Reset job role when category changes
            }}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px",
            }}
          >
            <option value="">Select a category</option>
            {Object.keys(JOB_ROLES).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
            Job Role <span style={{ color: "red" }}>*</span>
          </label>
          <select
            value={modalJobRole}
            onChange={(e) => setModalJobRole(e.target.value)}
            disabled={!modalCategory}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px",
              opacity: !modalCategory ? 0.5 : 1,
              cursor: !modalCategory ? "not-allowed" : "pointer",
            }}
          >
            <option value="">Select a role</option>
            {modalCategory &&
              Object.keys(JOB_ROLES[modalCategory] || {}).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={() => setShowAddApplicantModal(false)}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
            disabled={isAddingApplicant}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAddApplicant}
            disabled={!modalCategory || !modalJobRole || isAddingApplicant}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              background: !modalCategory || !modalJobRole ? "#ccc" : "#1976d2",
              color: "white",
              cursor: !modalCategory || !modalJobRole || isAddingApplicant ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
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