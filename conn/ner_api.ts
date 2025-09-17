import { pipeline } from '@xenova/transformers';
import axios from "axios";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const NER_API_URL = "http://localhost:8000/classify"; // Update if your NER API endpoint is different

const app = express();
app.use(cors());
app.use(express.json());

export interface Entity {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

let nerPipeline: any = null;

async function ensureModelLoaded()
{
  if (!nerPipeline) 
    {
      nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER')
    }
}

app.post("/classify", async(req, res) => {
  await ensureModelLoaded();
  const {text} = req.body;
  if(!text) return res.status(400).json({error: "No text provided"});
  const entities = await nerPipeline(text);
  res.json({entities});
});

app.listen(8000, () => console.log("NER server running on port 8000"));
app.get("/health", (_, res) => res.json({ ok: true }));

// Convert entities (if needed, e.g., for type normalization)
export function convertEntities(entities: any[]): Entity[] {
  // In JS/TS, this is usually not needed unless you want to ensure type
  return entities.map(ent => ({
    entity: ent.entity,
    score: typeof ent.score === "object" && "value" in ent.score ? ent.score.value : ent.score,
    word: ent.word,
    start: ent.start,
    end: ent.end,
  }));
}

// Find emails in text
export function findEmails(text: string): Entity[] {
  const emails: Entity[] = [];
  const regex = /\b[\w\.-]+@[\w\.-]+\.com\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    emails.push({
      entity: "EMAIL",
      score: 1.0,
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return emails;
}

// Postprocess entities (add phone, education, email if missing)
export function postprocessEntities(entities: Entity[], fullText: string): Entity[] {
  const lowerEntities = entities.map(e => e.entity.toLowerCase());

  // Add phone numbers if missing
  if (!lowerEntities.includes("phone")) {
    const phoneRegex = /(09\d{9}|\+63\d{10})/g;
    let match: RegExpExecArray | null;
    while ((match = phoneRegex.exec(fullText.replace(/[\s-]/g, ""))) !== null) {
      entities.push({
        entity: "PHONE",
        score: 1.0,
        word: match[0],
        start: fullText.indexOf(match[0]),
        end: fullText.indexOf(match[0]) + match[0].length,
      });
    }
  }

  // Add education keywords
  const educationKeywords = ["pamantasan", "university", "school", "college", "academy", "institute"];
  for (const keyword of educationKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(fullText)) !== null) {
      entities.push({
        entity: "EDUCATION",
        score: 1.0,
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Add emails if missing
  if (!lowerEntities.includes("email")) {
    entities.push(...findEmails(fullText));
  }

  return entities;
}


export async function classifyTextWithNER(text: string) {
  const response = await axios.post(NER_API_URL, { text });
  return response.data.entities;
}