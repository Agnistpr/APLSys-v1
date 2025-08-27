import { analyzeResumeWithGemini } from "./geminiConn";

async function testGeminiAPI() {
  const result = await analyzeResumeWithGemini("Say hello Gemini!");
  console.log("Gemini API test result:", result);
}

testGeminiAPI();