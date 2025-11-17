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

export async function persistAnalysisResult(data) {
  const { setEditableResume, setAnalysisResult, setParsed } = useAnalysisStore.getState();

  setEditableResume(data.resume || data);
  if (data.analysis) {
    setAnalysisResult(data.analysis);
  }
  if (typeof setParsed === "function") setParsed(true);

  // allow zustand persist middleware to settle then force-write snapshot so hydration sees it
  await new Promise((r) => setTimeout(r, 80));
  try {
    const key = "resume-analysis-store";
    const snapshot = useAnalysisStore.getState();
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (e) {
      try { localStorage.setItem(key, JSON.stringify({ state: snapshot })); } catch (_) {}
    }
  } catch (e) {
    console.warn("Failed to flush persist snapshot:", e);
  }
}

/**
 * Persist Gemini/AI parsing result into the global persisted store (renderer).
 * Handles the Gemini response shape (profile, educations, workExperiences, skills).
 * Writes into zustand persist store so results survive unmount/hydration.
 */
export async function persistGeminiAnalysisResult(geminiResult: any, analysisText?: string) {
  try {
    if (!geminiResult) throw new Error("Empty Gemini result");
    if (geminiResult?.error) throw new Error(geminiResult.error);

    const mappedResume = {
      ...defaultResume,
      profile: geminiResult.profile || {},
      educations: geminiResult.educations || [],
      workExperiences: geminiResult.workExperiences || [],
      skills: geminiResult.skills || { featuredSkills: [], descriptions: [] },
      custom: geminiResult.custom || { descriptions: [] },
    };

    const store = useAnalysisStore.getState();
    store.setEditableResume(mappedResume); // Update state
    store.setParsed(true); // Mark parsing as complete

    // Force persistence to localStorage
    await new Promise((resolve) => setTimeout(resolve, 100));
    localStorage.setItem("resume-analysis-store", JSON.stringify(useAnalysisStore.getState()));
  } catch (err) {
    console.error("Failed to persist Gemini result:", err);
    useAnalysisStore.getState().setEditableResume({ ...defaultResume });
    useAnalysisStore.getState().setParsed(false);
    throw err;
  }
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
  
  // Split by section headers (##) and filter out empty sections
  const sections = analysisText
    .split(/(?=##\s)/)
    .filter(Boolean)
    .map(section => section.trim());

  // Deduplicate by title: keep only the first occurrence of each section
  const seenTitles = new Set<string>();
  const uniqueSections = sections.filter(section => {
    const titleMatch = section.match(/^##\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim().toLowerCase() : '';
    
    if (seenTitles.has(title)) {
      return false; // Skip duplicate
    }
    if (title) seenTitles.add(title);
    return true;
  });

  return (
    <div className="analysis-sections-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {uniqueSections.map((section, idx) => {
        const lines = section.split('\n');
        const titleLine = lines[0].trim();
        const title = titleLine.replace(/^##\s*/, '');
        const content = lines.slice(1).join('\n').trim();

        return (
          <div
            key={idx}
            className="analysis-card"
            style={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderLeft: '4px solid #981b1b',
              borderRadius: '6px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: 0, marginBottom: '12px', color: '#333' }}>
              {title}
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#555', whiteSpace: 'pre-wrap' }}>
              {content.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '8px 0' }}>
                  {line || ' '}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
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