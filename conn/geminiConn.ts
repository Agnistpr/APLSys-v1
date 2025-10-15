import dotenv from "dotenv";
dotenv.config();
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import cors from "cors";


const app = express();
app.use(cors());
app.use(bodyParser.json());

const GEMINI_MODEL = "gemini-2.5-pro"
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const GEMINI_API_URL = `${BASE_URL}/models/${GEMINI_MODEL}:generateText`;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("loaded key:", GEMINI_API_KEY);
app.post("/analyze-resume", async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    res.json({
      text: response.data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    });
  } catch (err) {
    console.error("Gemini server error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Gemini server running on http://localhost:${PORT}`);
});
