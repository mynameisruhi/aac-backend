export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { categoryName, stem, existingTiles } = req.body;

    const prompt = `You are helping create tiles for an AAC app for non-verbal children.

Category: "${categoryName}"
Sentence stem: "${stem}"
Existing tiles: ${existingTiles || 'none'}

Generate 5 NEW tile suggestions. Respond ONLY with a JSON array. Each item should have "name" and "emoji".

Example: [{"name": "example", "emoji": "😀"}]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    return res.status(200).json({ text });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to generate tiles' });
  }
}
