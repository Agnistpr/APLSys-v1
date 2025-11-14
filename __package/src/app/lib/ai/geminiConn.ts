import axios from "axios";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
// or for Gemini 1.5 Pro (if available): "gemini-1.5-pro:generateContent"const 
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;


export async function analyzeResumeWithGemini(prompt: string) {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error: any)
  {
    console.error("Gemini API error:", error.response?.data || error.message);
    return "Error: Unable to analyze resume. Please check your API key and request format.";
  }
}