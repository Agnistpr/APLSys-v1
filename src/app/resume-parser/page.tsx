"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
<<<<<<< HEAD
//import { readPdf } from "../lib/parse-resume-from-pdf/read-pdf";
=======
>>>>>>> 2ce2aa93ddeb2d0d1e680650945ec09210ed57ea
import type { TextItems } from "../lib/parse-resume-from-pdf/types";
import { ResumeDropzone } from "../components/ResumeDropzone";
import { ResumeTable } from "./ResumeTable";
import { analyzeResumeWithGemini } from "../../../conn/genAnalysis";
import { JOB_ROLES } from "../data/jobRoles";
import { BatchResumeAnalyzer } from "./BatchResumeAnalyzer";
import axios from "axios";

function exportJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function mapEntitiesToResume(entities: any[]): any {
  // Merge all NAME entities
  const nameEntities = entities.filter(e => e.entity?.toLowerCase() === "name");
  const fullName = nameEntities.map(e => e.word).join(" ").replace(/\s+/g, " ").trim();

  // Use only the first valid phone and email
  const phoneEntity = entities.find(e => e.entity?.toLowerCase() === "phone" && /\d{7,}/.test(e.word.replace(/\D/g, "")));
  const emailEntity = entities.find(e => e.entity?.toLowerCase() === "email" && e.word.includes("@"));

  // Split full name
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const resume = {
    profile: {
      name: fullName, firstName, middleName, lastName,
      email: emailEntity ? emailEntity.word.replace(/\s/g, "") : "",
      phone: phoneEntity ? phoneEntity.word.replace(/\s/g, "") : "",
      location: "",
      age: "",
      gender: "",
      url: "",
      summary: "",
    },
    educations: [],
    workExperiences: [],
    projects: [],
    skills: { featuredSkills: [], descriptions: [] },
    custom: { descriptions: [] },
  };

  for (const ent of entities) {
    const label = ent.entity?.toLowerCase();
    switch (label) {
      case "name":
        resume.profile.name = ent.word;
        break;
      case "email":
        resume.profile.email = ent.word;
        break;
      case "phone":
        resume.profile.phone = ent.word;
        break;
      case "location":
        resume.profile.location = ent.word;
        break;
      case "skills":
        resume.skills.descriptions.push(ent.word);
        break;
      // Add more cases as needed
      default:
        break;
    }
  }
  return resume;
}

function calculateCandidateScore(sections, weights) {
  let total = 0;
  for (const key in weights) {
    total += (sections[key] || 0) * weights[key];
  }
  return Math.round(total);
}


function getApplicantName(resume: any) {
  if (!resume || !resume.profile) return "applicant";
  // Try to build from first/middle/last if name is missing
  const { name, firstName, middleName, lastName } = resume.profile;
  if (name && typeof name === "string" && name.trim()) return name.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  return fullName ? fullName.replace(/[^a-zA-Z0-9-_]/g, "_") : "applicant";
}

const RESUME_EXAMPLES = [
  {
    fileUrl: "resume-example/laverne-resume.pdf",
    description: <span>Borrowed from University of La Verne Career Center</span>,
  },
  {
    fileUrl: "resume-example/openresume-resume.pdf",
    description: <span>Created with OpenResume resume builder</span>,
  },
];

const defaultFileUrl = RESUME_EXAMPLES[1]["fileUrl"];

export default function ResumeParser({ setActivePage, setSelectedApplicantId, setPreviousPage, activePage, selectedResumeFile, setSelectedResumeFile }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItems>([]);
  const [editableResume, setEditableResume] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Production");
  const [selectedJobRole, setSelectedJobRole] = useState<string>("");
  const [customJobDescription, setCustomJobDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"parsing" | "analysis">("parsing");
  const [resumeName, setResumeName] = useState("");

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

<<<<<<< HEAD
//   useEffect(() => {
//   if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.startsWith("blob:")) {
//     console.log("No file was uploaded, or an error has occured.");
//     return;
//   }
//   console.log("fileUrl changed:", fileUrl);
//   const name = fileUrl.split(/[\\/]/).pop() || "";
//   setResumeName(name)
//   async function loadResume() {
//     try {
//       // Fetch the blob from the fileUrl and convert to File
//       const response = await fetch(fileUrl);
//       const blob = await response.blob();
//       const fileName = resumeName || "uploaded_resume.pdf";
//       const file = new File([blob], fileName, { type: blob.type });

//       // Use your backend parsing pipeline
//       await handleFileGeminiPipeline(file);
//     } catch (err) {
//       console.error("Failed to parse PDF with backend:", err);
//       setEditableResume(null);
//     }
//   }
//   loadResume();
// }, [fileUrl]);

=======
>>>>>>> 2ce2aa93ddeb2d0d1e680650945ec09210ed57ea
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
      setEditableResume(null);
      setAnalysisResult("");
    }
  }, [activePage, selectedResumeFile]);

  
  function handleNERExtraction(nerResult: any) {
    const { profile, entities } = nerResult;
    setEditableResume({
      profile: {
        firstName: profile.first_name || "",
        middleName: profile.middle_name || "",
        lastName: profile.last_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
        age: profile.age || "",
        gender: profile.gender || "",
        name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" "),
      },
      educations: [],
      workExperiences: [],
      projects: [],
      skills: { featuredSkills: [], descriptions: [] },
      custom: { descriptions: [] },
    });
  }

  // AI FALLBACKS
  async function geminiExtractResumeProfile(text: string): Promise<any> {
    const response = await axios.post("http://127.0.0.1:8000/ai/gemini-extract-resume-profile", { text });
    return response.data;
  }

  async function handleFileGeminiPipeline(file: File) {
    try {
      toast.loading("Resume uploaded, waiting for extraction...", { id: "ai-process"});
      const extractedText = await extractResumeText(file); 
      const resumeJson = await geminiExtractResumeProfile(extractedText);
      toast.success("Extraction successful", {id: "ai-process"});
      setEditableResume(resumeJson); // Directly set the Gemini result
    } catch (err) {
      console.error("Gemini pipeline failed:", err);
      alert("Failed to parse resume with Gemini.");
    }
  }

  // --- NER Integration ---
  // 1. Extract text from file using parsing endpoint
  async function extractResumeText(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    console.log("Uploading file:", file);
    const response = await axios.post("http://127.0.0.1:8000/parser/extract-resume-text", formData);
    console.log("Response:", response)
    return response.data; // plain text
  }

  // 2. Label tokens using NER endpoint
  async function labelResumeText(text: string): Promise<any[]> {
    console.log("Awaiting labeling...")
    const response = await axios.post("http://127.0.0.1:8000/parser/label-tokens-resume", { text });
    console.log("Labeling completed")
    return response.data;
  }

  // 3. Full pipeline: file -> text -> NER -> update resume
  async function handleFileNERPipeline(file: File) {
    try {
      // Step 1: Extract text from file
      const extractedText = await extractResumeText(file);

      // Step 2: Label tokens with NER
      const nerResult = await labelResumeText(extractedText);

      // Step 3: Map entities to resume and update state
      handleNERExtraction(nerResult);
    } catch (err) {
      console.error("NER pipeline failed:", err);
      alert("Failed to parse resume with NER.");
    }
  }

  // --- END NER Integration ---

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

      //trigger parsing pipeline
      const file = new File([ab], selectedResumeFile.name || "uploaded_resume.pdf", { type: selectedResumeFile.type });
      handleFileGeminiPipeline(file);
    }
  // Only run when a new file is selected
  }, [selectedResumeFile]);

  function setValueByPath(obj: any, path: string, value: string) {
    const keys = path.split(".");
    let curr = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].includes("[")) {
        const [arrKey, idx] = keys[i].split(/[\[\]]/).filter(Boolean);
        curr = curr[arrKey][parseInt(idx)];
      } else if (keys[i].includes(":")) {
        const [arrKey, idx] = keys[i].split(":");
        curr = curr[arrKey][parseInt(idx)];
      } else if (!isNaN(Number(keys[i]))) {
        curr = curr[parseInt(keys[i])];
      } else {
        curr = curr[keys[i]];
      }
    }
    if (Array.isArray(curr[keys[keys.length - 1]])) {
      curr[keys[keys.length - 1]] = value.split("\n");
    } else {
      curr[keys[keys.length - 1]] = value;
    }
  }

  //Dito namamap yung changes
  const handleFieldChange = (field: string, value: string) => {
    setEditableResume(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      setValueByPath(updated, field, value);
      return updated;
    });
  };

  useEffect(() => {
    if (selectedCategory && selectedJobRole) {
      const desc = JOB_ROLES[selectedCategory][selectedJobRole]?.description || "";
      setCustomJobDescription(desc);
    } else {
      setCustomJobDescription("");
    }
  }, [selectedCategory, selectedJobRole]);

  function stripMarkdown(text: string) {
  // Remove bold, italics, and subheaders
  return text
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italics
    .replace(/^###\s+/gm, "") // subheaders
    .replace(/^-\s+/gm, "• ") // bullets
    .replace(/`/g, "") // inline code
    .trim();
  }

  const renderAnalysisSections = (analysis: string) => {
    if (!analysis) return null;
    const sections = analysis.split(/^##\s+/gm).filter(Boolean);
    return (
      <div className="grid gap-4">
        {sections.map((section, idx) => {
          const lines = section.split("\n");
          const header = lines[0].trim();
          const content = lines.slice(1).join("\n").trim();
          const scoreMatch = content.match(/Resume Score:\s*(\d{1,3})\/100/i);
          const score = scoreMatch ? scoreMatch[1] : null;

          return (
            <div key={idx} className="analysis-card">
              <h3>{header}</h3>
              <div className="whitespace-pre-wrap mb-2">{content}</div>
              {score && (
                <div className="mt-2 text-right">
                  <span className="inline-block px-3 py-1 rounded bg-blue-100 text-blue-800 font-bold text-xl">
                    Score: {score}/100
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  //CALLS ONLY, NO TASK PROCESSING
  const handleAnalyzeResume = async () => {
  setLoadingAnalysis(true);

  try {
    // Combine text items into raw text
    //const rawText = textItems.map(item => item.text).join("\n");
    if (!editableResume) {
      setAnalysisResult("No resume data to analyze.");
      setLoadingAnalysis(false);
      return;
    }

    // Prepare payload for backend
    // const payload = {
    //   resume: rawText,
    //   job_role: selectedJobRole,
    //   job_description: customJobDescription,
    // };

    // Get job role description from JOB_ROLES
    const jobRoleObj = selectedCategory && selectedJobRole
      ? JOB_ROLES[selectedCategory][selectedJobRole]
      : undefined;

    // Prepare payload for backend
    const payload = {
      resume: JSON.stringify(editableResume),
      job_role: selectedJobRole || "",
      job_description: jobRoleObj?.description || customJobDescription || "",
    };

    // Call FastAPI backend
    const result = await analyzeResumeWithGemini(payload);
    setAnalysisResult(result)

    // Extract AI score from result (adjust this if your backend returns the score differently)
    const aiScoreMatch = typeof result === "string"
      ? result.match(/Resume Score:\s*(\d{1,3})\/100/i)
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

  function CandidateScoreCard({ sectionScores, scoringWeights }) {
  const finalScore = calculateCandidateScore(sectionScores, scoringWeights);

  return (
    <div className="candidate-score-card" style={{ marginBottom: "1.5em" }}>
      <h3>Automated Candidate Score</h3>
      <table style={{ width: "100%", marginBottom: "0.5em" }}>
        <thead>
          <tr>
            <th>Section</th>
            <th>Score</th>
            <th>Weight</th>
            <th>Weighted</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(scoringWeights).map((section) => (
            <tr key={section}>
              <td>{section.charAt(0).toUpperCase() + section.slice(1)}</td>
              <td>{sectionScores[section]}</td>
              <td>{scoringWeights[section]}</td>
              <td>{Math.round(sectionScores[section] * scoringWeights[section])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontWeight: "bold", fontSize: "1.2em" }}>
        Final Candidate Score: <span style={{ color: "#1976d2" }}>{finalScore} / 100</span>
      </div>
    </div>
    );
  }


  return (
    <div className="resume-parser-container">
      <div className="pdf-preview">
        <div className="pdf-preview">
          {fileUrl ? (
            <iframe
              src={`${fileUrl}#navpanes=0`}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="PDF Preview"
            />
          ) : (
            <div className="text-gray-400 text-center py-8">No PDF loaded</div>
          )}
        </div>
      </div>

      <div className="right-panel">
        <div className="toolbar">
          <ResumeDropzone
            initialFileUrl={fileUrl || undefined}
            initialFileName={resumeName}
            fallbackFileUrl={defaultFileUrl}
            onFileUrlChange={async (fileUrl, fileName) => {
              setFileUrl(fileUrl);
              setResumeName(fileName);
              // Fetch the file as blob and convert to base64
              const response = await fetch(fileUrl);
              const blob = await response.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = (reader.result as string).split(",")[1];
                setSelectedResumeFile({
                  name: fileName,
                  data: base64data,
                  type: blob.type,
                });
              };
              reader.readAsDataURL(blob);
              
            }}
          />
          <button
            onClick={() => {
              // setSelectedResumeFile(null);
              setSelectedApplicantId(false);
              setPreviousPage(activePage);
              setActivePage("Screening");
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
              {editableResume && <ResumeTable resume={editableResume} onFieldChange={handleFieldChange} />}
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

                    // ✅ Build applicant full name
                    const fullName = [
                      applicantData.profile?.firstName || "",
                      applicantData.profile?.middleName || "",
                      applicantData.profile?.lastName || ""
                    ].filter(Boolean).join(" ");

                    // ✅ Log action
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
                    setSelectedApplicantId(false);
                    setPreviousPage(activePage);
                    setActivePage("Screening");
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
                onChange={e => setSelectedJobRole(e.target.value)}
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
                onChange={e => setCustomJobDescription(e.target.value)}
                rows={5}
                className="input"
              />

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

              {analysisResult && (
                <>
                  <CandidateScoreCard sectionScores={sectionScores} scoringWeights={scoringWeights} />
                  <div className="analysis-cards mt-4">
                    {renderAnalysisSections(analysisResult)}
                  </div>
                </>
              )}

              {!analysisResult && (
                <div className="analysis-card mt-4">No analysis yet.</div>
              )}

              <BatchResumeAnalyzer 
              jobRole={selectedJobRole}
              jobDescription={customJobDescription}
              jobCategory={selectedCategory}  />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
