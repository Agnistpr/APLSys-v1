import React, { useState } from "react";
import { parseDocumentText } from "../../api/ocr";

export const GeneralDocumentParser: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    setLoading(true);
    setEntities([]);
    try {
      const result = await parseDocumentText(inputText);
      setEntities(result);
    } catch (err) {
      setEntities([]);
      alert("Failed to parse document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-4 p-4 border rounded bg-white">
      <h2 className="font-bold mb-2">General Document Parser</h2>
      <textarea
        className="w-full border rounded p-2 mb-2"
        rows={6}
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder="Paste or type document text here..."
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleParse}
        disabled={loading || !inputText.trim()}
      >
        {loading ? "Parsing..." : "Parse Document"}
      </button>
      <div className="mt-4">
        {entities.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Extracted Entities</h3>
            <ul className="list-disc pl-5">
              {entities.map((ent, idx) => (
                <li key={idx}>
                  <b>{ent.entity}</b>: {ent.word} <span className="text-xs text-gray-500">(score: {ent.score})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};