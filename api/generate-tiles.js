export default async function handler(req, res) {
  // Enable CORS - must be first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { categoryName, stem, existingTiles } = req.body;

    const prompt = `You are helping create tiles for an AAC (Augmentative and Alternative Communication) app for non-verbal children.

Category: "${categoryName}"
Sentence stem: "${stem}"
Existing tiles: ${existingTiles || 'none'}

Generate 5 NEW tile suggestions that would be useful for this category. These should be simple words or short phrases that a child might want to communicate.

IMPORTANT: Respond ONLY with a JSON array, no other text. Each item should have "name" (the word/phrase) and "emoji" (a single relevant emoji).

Example format:
[{"name": "example", "emoji": "😀"}, {"name": "another", "emoji": "🎉"}]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    
    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    res.status(200).json({ text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate tiles' });
  }
}
