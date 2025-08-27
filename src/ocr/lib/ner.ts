// lib/ner.ts
export async function classifyText(text: string) {
  const response = await fetch('http://localhost:8000/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error('NER API error');
  return response.json();
}