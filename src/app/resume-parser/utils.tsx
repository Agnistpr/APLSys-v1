import { defaultResume, useAnalysisStore } from '../../electron/aiStore';
import { normalizeGeminiResume } from "../../../conn/genAnalysis";
export function exportJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function persistGeminiAnalysis(data) {
  const { setEditableResume, setAnalysisResult } = useAnalysisStore.getState();

  setEditableResume(data.resume || data);
  if (data.analysis) {
    setAnalysisResult(data.analysis);
  }
}


/**
 * Persist Gemini parsing result into the global persisted store (renderer).
 * Normalizes raw backend output and writes into zustand persist store so results
 * survive unmount/hydration.
 */
export async function persistGeminiResult(rawResult: any, analysisText?: string) {
  // If caller already passed an already-normalized / merged resume, allow it
  const normalized = (rawResult && rawResult.profile) ? rawResult : normalizeGeminiResume(rawResult);

  const merged = {
    ...defaultResume,
    ...normalized,
    profile: { ...defaultResume.profile, ...(normalized?.profile || {}) },
    educations: normalized?.educations?.length ? normalized.educations : defaultResume.educations,
    workExperiences: normalized?.workExperiences?.length ? normalized.workExperiences : defaultResume.workExperiences,
    projects: normalized?.projects?.length ? normalized.projects : defaultResume.projects,
    skills: normalized?.skills ?? defaultResume.skills,
    custom: normalized?.custom ?? defaultResume.custom,
  };

  const store = useAnalysisStore.getState();
  if (store?.setEditableResume) store.setEditableResume(merged);
  if (store?.setParsed) store.setParsed(true);
  if (analysisText && store?.setAnalysisResult) store.setAnalysisResult(analysisText);

  console.log("persistGeminiResult -> persisted to aiStore", merged);
  return merged;
}

export function mapEntitiesToResume(entities: any[]): any {
  const resume = { ...defaultResume };
  entities.forEach(entity => {
    switch (entity.type) {
      case 'PERSON':
        resume.profile.name = entity.text;
        break;
      case 'EMAIL':
        resume.profile.email = entity.text;
        break;
      case 'PHONE':
        resume.profile.phone = entity.text;
        break;
      // Add more entity mappings as needed
    }
  });
  return resume;
}

export function calculateCandidateScore(
  sections: Record<string, number>,
  weights: Record<string, number>
): number {
  let total = 0;
  for (const key in weights) {
    total += (sections[key] || 0) * weights[key];
  }
  return Math.round(total);
}

export function renderAnalysisSections(analysisText: string) {
  if (!analysisText) return null;
  
  const sections = analysisText
    .split(/(?=##\s|Strengths:|Weaknesses:|Recommendations:|Analysis:|Score:)/)
    .filter(Boolean)
    .map(section => section.trim());

  return sections.map((section, idx) => {
    const [title, ...contentArr] = section.split('\n');
    const content = contentArr.join('\n').trim();

    let sectionClass = 'analysis-section';
    if (title.toLowerCase().includes('strength')) sectionClass += ' strengths';
    if (title.toLowerCase().includes('weakness')) sectionClass += ' weaknesses';
    if (title.toLowerCase().includes('recommend')) sectionClass += ' recommendations';
    if (title.toLowerCase().includes('score')) sectionClass += ' score';

    return (
      <div key={idx} className={`analysis-card ${sectionClass}`}>
        <h3 className="section-title">{title.replace(/^##\s*/, '')}</h3>
        <div className="section-content">
          {content.split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>
      </div>
    );
  });
}

// Helper to convert file to Base64 string
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function reconstructBlobUrl(
  fileData: string,
  mimeType = "application/pdf"
): string {
  if (!fileData) {
    console.warn("reconstructBlobUrl called with empty data");
    return "";
  }

  try {
    // 1️⃣ Remove any base64 prefix (safety across variations)
    const cleaned = fileData.replace(/^data:.*;base64,/, "");

    // 2️⃣ Convert base64 → binary
    const byteString = atob(cleaned);

    // 3️⃣ Allocate typed array buffer
    const len = byteString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    // 4️⃣ Create Blob in the *renderer process* context
    const blob = new Blob([bytes], { type: mimeType });

    // 5️⃣ Create object URL (safe inside renderer)
    const url = URL.createObjectURL(blob);
    return url;
  } catch (err) {
    console.error("Failed to reconstruct blob:", err);
    return "";
  }
}



export function getApplicantName(resume: any): string {
  if (!resume?.profile) return 'applicant';
  const { firstName, middleName, lastName } = resume.profile;
  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'applicant';
}