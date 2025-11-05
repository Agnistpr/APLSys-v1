"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { TextItems } from "../lib/parse-resume-from-pdf/types";
import { ResumeDropzone } from "../components/ResumeDropzone";
import { ResumeTable } from "./ResumeTable";
import { analyzeResumeWithDS } from "../../../conn/genAnalysis";
import { persistNERResult } from "./aiActions";
import { JOB_ROLES } from "../data/jobRoles";
import axios from "axios";
import { useAnalysisStore, defaultResume } from '../../electron/aiStore';
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

/* ------------------------------ Constants ------------------------------ */


type ResumeParserProps = {
  setActivePage?: any;
  setSelectedApplicantId?: any;
  setPreviousPage?: any;
  activePage?: any;
  selectedResumeFile?: any;
  setSelectedResumeFile?: any;
  goBack?: any;
};

export default function ResumeParser
({ setActivePage,
   setSelectedApplicantId,
   setPreviousPage,
   activePage,
   selectedResumeFile,
   setSelectedResumeFile, goBack }: ResumeParserProps = {}) {
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
  const handleFieldPathChange = useCallback((fieldPath: string, value: any) => {
    setEditableResume(prev => {
      const next = JSON.parse(JSON.stringify(prev || defaultResume));
      try {
        setByPath(next, fieldPath, value);
      } catch (e) {
        console.error("handleFieldPathChange failed for", fieldPath, e);
      }
      return next;
    });
  }, [setEditableResume]);

const handleFileChange = useCallback(async (fileUrl: string, fileName: string, fileObj?: File) => {
  setFileState(prev => ({
    ...prev,
    fileUrl,
    resumeName: fileName
  }));

  // Update UI state
  setFileUrl(fileUrl);
  setResumeName(fileName);

  let base64String = "";
  if (fileObj instanceof File) {
    base64String = await fileToBase64(fileObj);
  }

  setCurrentFile({
    url: fileUrl,
    name: fileName || "uploaded_file.pdf",
    type: 'application/pdf',
    data: base64String, //now actually filled
  });

  setEditableResume(prev => prev ?? { ...defaultResume });
}, [setCurrentFile, setEditableResume]);

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


    // Restore file preview if we have a currentFile
    if (currfile?.data) {
      try{
        const url = reconstructBlobUrl(currfile.data, currfile.type);
        setFileUrl(url);
        setResumeName(currfile.name || "resume.pdf");
        console.log("Hydrated file to base64 -> new blob url:", url);
      }
      catch (e)
      {
        console.error("Failed to reconstruct blob file:", e);
      }
    } else if (currfile?.url && !currfile?.url.startsWith("blob:")) {
      setFileUrl(currfile.url);
      setResumeName(currfile.name || "resume.pdf");
      console.log("Hydrated file to existing URL");
    }

    // Defensive hydrate of editableResume: only write if sanitized differs
    try {
      if (parseComplete && editableResume) {
        const sanitized = sanitizeEditableResume(editableResume);
        if (!sanitized || typeof sanitized !== "object" || !sanitized.profile) {
          throw new Error("sanitization produced invalid resume");
        }
        // Avoid write-if-equal to prevent infinite loop
        const curJson = JSON.stringify(editableResume);
        const sanJson = JSON.stringify(sanitized);
        if (curJson !== sanJson) {
          setEditableResume(sanitized);
        }
      }

    } catch (e) {
      console.error("Failed to hydrate editableResume — clearing persisted store:", e);
      try { localStorage.removeItem("resume-analysis-store"); } catch {}
      setEditableResume({ ...defaultResume });
      setParsed(false);
    }
  }, [isHydrated, currentFile, parseComplete]);

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
    if (fileUrl) {
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
      if (!hasProfile) {
        setEditableResume({ ...defaultResume });
        setAnalysisResult("");
      }
    }
  }, [activePage, selectedResumeFile]);

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
        "http://127.0.0.1:8000/parser/ner-extract-resume-profile",
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

    const response = await axios.post("http://127.0.0.1:8000/parser/extract-resume-text", formData);
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

  useEffect(() => {
    if (selectedResumeFile && selectedResumeFile.data && selectedResumeFile.type) {
      // Convert base64 to File and then to blob URL
      const byteString = atob(selectedResumeFile.data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: selectedResumeFile.type });
      const url = URL.createObjectURL(blob);

      setFileUrl(url);
      setResumeName(selectedResumeFile.name || "uploaded_resume.pdf");
      setFileState(prev => ({
      ...prev,
      fileUrl: url,
      resumeName: selectedResumeFile.name || "uploaded_resume.pdf"
      }));

      // Update the store
      setCurrentFile({
        url: url,
        name: selectedResumeFile.name || "uploaded_resume.pdf",
        type: selectedResumeFile.type,
        data: selectedResumeFile.data
      });

      // Initialize with default resume structure
      setEditableResume({...defaultResume});
    }
  // Only run when a new file is selected
  }, [selectedResumeFile, setCurrentFile, setEditableResume]);

  //Track dynamically created blob URLs and revoke only those on unmount
  useEffect(() => {
    const createdUrls = new Set<string>();

    // When you set a blob URL, remember it
    if (fileUrl && fileUrl.startsWith("blob:")) {
      createdUrls.add(fileUrl);
    }

    return () => {
      for (const url of createdUrls) {
        console.log("Revoking blob URL on unmount:", url);
        URL.revokeObjectURL(url);
      }
    };
  }, [fileUrl]);



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

      // Prefer the persisted base64 if available
      if (currentFile?.data) {
        try {
          console.log("DEBUG reconstructing File from persisted base64 data...");
          const byteString = atob(currentFile.data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: currentFile.type || "application/pdf" });
          file = new File([blob], currentFile.name || "resume.pdf", { type: currentFile.type });
        } catch (e) {
          console.error("Failed to reconstruct File from base64:", e);
        }
      }

      // Fallback to fetching blob URL if base64 not available
      if (!file) {
        const fetchUrl = currentFile?.url || fileUrl;
        if (!fetchUrl) throw new Error("No file URL available to parse");
        const response = await fetch(fetchUrl);
        const blob = await response.blob();
        file = new File([blob], resumeName || "resume.pdf", { type: "application/pdf" });
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
      
      // Immediately reflect parsed resume in local state
      setEditableResume(useAnalysisStore.getState().editableResume);
      setParsed(true);

      
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
    }
  };

  // Similarly update handleAnalyzeResume to use tasks
  const handleAnalyzeResume = async () => {
    setHasAnalyzed(true);

    const taskId = `analyze-${Date.now()}`;
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

        // Build a trimmed payload to reduce tokens (send only needed fields)
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
            // trim long descriptions to a reasonable length
            description: (w.description || "").split(/\s+/).slice(0, 200).join(" ")
          })),
          projects: (editableResume.projects || []).slice(0, 5),
          custom: { descriptions: (editableResume.custom?.descriptions || []).slice(0, 10) },
        };

      // Get job role description from JOB_ROLES
      const jobRoleObj = selectedCategory && selectedJobRole
        ? JOB_ROLES[selectedCategory][selectedJobRole]
        : undefined;

      // Prepare payload for backend
      const payload = {
        resume: JSON.stringify(minimalResume),
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

      // 🔄 Immediately sync local UI state with store
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
        setLoadingAnalysis(false);
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
    <div className="resume-parser-container">
      <div className="pdf-preview">
        {fileUrl ? (
          // Add error boundary and fallback for PDF preview
          <div className="pdf-container" style={{ 
            width: "100%", 
            height: "100%",
            overflow: "hidden", // Prevent scrolling
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "4px"
            }}>
            {(() => {
              try {
                // Add PDF viewer parameters for better quality
                const viewerUrl = new URL(fileUrl);
                viewerUrl.hash = "#view=FitH&scrollbar=0";

                return (
                  <iframe
                    src={viewerUrl.toString()}
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      border: "none",
                      imageRendering: "auto",
                      textRendering: "geometricPrecision",
                      WebkitFontSmoothing: "antialiased",
                    }}
                    title="PDF Preview"
                    onError={(e) => {
                      console.error("PDF preview error:", e);
                      return (
                        <div className="text-gray-400 text-center py-8">
                          Error loading PDF preview
                        </div>
                      );
                    }}
                  />
                );
              } catch (e) {
                console.error("PDF preview render error:", e);
                return (
                  <div className="text-gray-400 text-center py-8">
                    Error loading PDF preview
                  </div>
                );
              }
            })()}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            No Resume loaded. Please upload one in .pdf format
          </div>
        )}
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
              disabled={!fileUrl || isParsingResume}
              className="parse-res-btn"
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
                onClick={async () => {
                  if (!editableResume) {
                    alert("No resume data to add.");
                    return;
                  }

                  if (!selectedCategory || !selectedJobRole) {
                    alert("Please select both a Department (Category) and a Job Role before adding applicant.");
                    return;
                  }

                  const applicantData = {
                    ...editableResume,
                    departmentName: selectedCategory,
                    positionName: selectedJobRole,
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

                    alert(`Applicant added! ID: ${added.applicantid}`);
                    goBack();
                  } catch (err) {
                    console.error("Failed to add applicant:", err);
                    alert("Error adding applicant.");
                  }
                }}
                className="btn-secondary mt-2"
              >
                ➕ Add Applicant
              </button>
              <button
                onClick={() => editableResume && exportJSON(editableResume, `${getApplicantName(editableResume)}_resume.json`)}
                className="btn-primary mt-4"
              >
                Export Resume JSON
              </button>
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
                disabled={loadingAnalysis}
              >
                {loadingAnalysis ? "Analyzing..." : "Analyze Resume"}
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
    </>
  );
}
