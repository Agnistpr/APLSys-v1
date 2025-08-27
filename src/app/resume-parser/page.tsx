"use client";
import { useState, useEffect } from "react";
import { readPdf } from "lib/parse-resume-from-pdf/read-pdf";
import type { TextItems } from "lib/parse-resume-from-pdf/types";
import { groupTextItemsIntoLines } from "lib/parse-resume-from-pdf/group-text-items-into-lines";
import { groupLinesIntoSections } from "lib/parse-resume-from-pdf/group-lines-into-sections";
import { extractResumeFromSections } from "lib/parse-resume-from-pdf/extract-resume-from-sections";
import { ResumeDropzone } from "components/ResumeDropzone";
import { ResumeTable } from "resume-parser/ResumeTable";
import { analyzeResumeWithGemini } from "lib/ai/geminiConn";
import { generateResumeAnalysisPrompt } from "lib/ai/genAnalysis";
import { JOB_ROLES } from "data/jobRoles";

function exportJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getApplicantName(resume: any) {
  const name = resume?.profile?.name || "applicant";
  return name.replace(/[^a-zA-Z0-9-_]/g, "_");
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

export default function ResumeParser({ setActivePage, setSelectedApplicantId, setPreviousPage, activePage, selectedResumeFile }) {
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

  const jobDescription = selectedCategory && selectedJobRole ? JOB_ROLES[selectedCategory][selectedJobRole]?.description : "";
  const requiredSkills = selectedCategory && selectedJobRole ? JOB_ROLES[selectedCategory][selectedJobRole]?.required_skills : [];

  useEffect(() => {
    if (selectedResumeFile) {
      const blob = new Blob(
        [Uint8Array.from(atob(selectedResumeFile.data), c => c.charCodeAt(0))],
        { type: selectedResumeFile.type }
      );
      const url = URL.createObjectURL(blob);
      setFileUrl(url);
      setResumeName(selectedResumeFile.name || "uploaded_resume.pdf");
    } else {
      setFileUrl(defaultFileUrl);
      setResumeName(defaultFileUrl.split(/[\\/]/).pop() || "template.pdf");
    }
  }, [selectedResumeFile]);

  useEffect(() => {
    if (!fileUrl) return;
    async function loadResume() {
      const textItems = await readPdf(fileUrl);
      setTextItems(textItems);
      const lines = groupTextItemsIntoLines(textItems || []);
      const sections = groupLinesIntoSections(lines);
      const parsedResume = extractResumeFromSections(sections);
      setEditableResume(parsedResume);
    }
    loadResume();
  }, [fileUrl]);

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
            <div key={idx} className="bg-white shadow-sm rounded p-4 border">
              <h3 className="font-semibold text-lg mb-2">{header}</h3>
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

  const handleAnalyzeResume = async () => {
    setLoadingAnalysis(true);
    const prompt = generateResumeAnalysisPrompt(editableResume, selectedJobRole, customJobDescription);
    const result = await analyzeResumeWithGemini(prompt);
    setAnalysisResult(result);
    setLoadingAnalysis(false);
  };

  return (
    <div className="resume-parser-container">
      <div className="pdf-preview">
        <div className="pdf-preview">
          <iframe
            src={`${fileUrl}#navpanes=0`}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="PDF Preview"
          />
        </div>
      </div>

      <div className="right-panel">
        <div className="toolbar">
          <ResumeDropzone
            initialFileUrl={fileUrl || undefined}
            initialFileName={resumeName}
            fallbackFileUrl={defaultFileUrl}
            onFileUrlChange={(fileUrl, fileName) => {
              setFileUrl(fileUrl);
              setResumeName(fileName);
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

              <button
                onClick={handleAnalyzeResume}
                className="btn-primary mt-4"
                disabled={loadingAnalysis}
              >
                {loadingAnalysis ? "Analyzing..." : "Analyze Resume"}
              </button>

              <div className="analysis-cards mt-4">
                {analysisResult ? renderAnalysisSections(analysisResult) : <div className="analysis-card">No analysis yet.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}