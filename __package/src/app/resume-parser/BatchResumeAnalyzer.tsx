import React, { useState } from "react";
import { generateResumeAnalysisPrompt, analyzeResumeWithGemini } from "../../../conn/genAnalysis";
import { readPdf } from "../lib/parse-resume-from-pdf/read-pdf"; // adjust path if needed
import { JOB_ROLES } from "../data/jobRoles";

export const BatchResumeAnalyzer = ({ jobRole,jobDescription, jobCategory }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
    setResults([]);
    setProgress(0);
  };

  const handleBatchAnalyze = async () => {
    setLoading(true);
    setResults([]);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileUrl = URL.createObjectURL(file);
      const textItems = await readPdf(fileUrl);
      // If the correct property is 'text', use this:
            const rawText = textItems.map(item => item.text).join("\n");
      
      // If 'str' is correct and missing from the type, update the type definition for TextItem to include 'str: string;'

      // Get the JobRole object from JOB_ROLES
      const jobRoleObj =
        jobCategory && jobRole
          ? JOB_ROLES[jobCategory][jobRole]
          : undefined;

      // Prepare payload for backend
      const payload = {
        resume: rawText,
        job_role: jobRole || "",
        job_description: jobRoleObj?.description || jobDescription || "",
      };

      const result = await analyzeResumeWithGemini(payload);
      setResults(prev => [...prev, { name: file.name, result }]);
      setProgress(i + 1);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="font-bold text-xl mb-2">Batch Resume Analysis</h2>
      <input type="file" accept=".pdf" multiple onChange={handleFileChange} />
      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleBatchAnalyze}
        disabled={files.length === 0 || loading}
      >
        Analyze All
      </button>
      {loading && (
        <div className="mt-2">Analyzing {progress} of {files.length} resumes...</div>
      )}
      <div className="grid gap-4 mt-4">
        {results.map(({ name, result }, idx) => (
          <div key={idx} className="bg-white shadow rounded p-4 border">
            <h3 className="font-semibold mb-2">{name}</h3>
            {renderAnalysisSections(result)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper to render analysis sections as cards
function renderAnalysisSections(analysis: string) {
  if (!analysis) return null;
  const sections = analysis.split(/^##\s+/gm).filter(Boolean);
  return (
    <div className="grid gap-2">
      {sections.map((section, idx) => {
        const lines = section.split("\n");
        const header = lines[0].trim();
        const content = lines.slice(1).join("\n").trim();
        return (
          <div key={idx} className="border rounded p-2 bg-gray-50">
            <h4 className="font-bold mb-1">{header}</h4>
            <div className="whitespace-pre-wrap">{content}</div>
          </div>
        );
      })}
    </div>
  );
}