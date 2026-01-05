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
  
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }
  
  try {
    const { categoryName, stem, existingTiles } = req.body;
    
    // Validate input
    if (!categoryName) {
      return res.status(400).json({ error: 'categoryName is required' });
    }
    
    const prompt = `You are helping create tiles for an AAC (Augmentative and Alternative Communication) app for non-verbal children.

Category: "${categoryName}"
Sentence stem: "${stem || 'none'}"
Existing tiles: ${existingTiles || 'none'}

Generate exactly 5 NEW tile suggestions that are different from the existing tiles. Each tile should be simple, clear, and appropriate for children.

IMPORTANT: Respond with ONLY a valid JSON array, no markdown, no explanation, no code blocks. Just the raw JSON array.

Format: [{"name": "tile name", "emoji": "emoji"}]

Example response:
[{"name": "happy", "emoji": "😀"}, {"name": "sad", "emoji": "😢"}, {"name": "tired", "emoji": "😴"}, {"name": "hungry", "emoji": "🍽️"}, {"name": "thirsty", "emoji": "💧"}]`;

    // Use gemini-2.5-flash-lite - lighter model with separate quota
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Gemini API request failed', 
        details: errorText 
      });
    }

    const data = await response.json();
    
    // Extract the text from Gemini's response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('No text in Gemini response:', JSON.stringify(data));
      return res.status(500).json({ error: 'No response from Gemini' });
    }
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    // Try to parse the JSON
    let tiles;
    try {
      tiles = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', cleanedText);
      // Try to extract JSON array from the text
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          tiles = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return res.status(500).json({ 
            error: 'Failed to parse AI response', 
            text: cleanedText 
          });
        }
      } else {
        return res.status(500).json({ 
          error: 'Invalid AI response format', 
          text: cleanedText 
        });
      }
    }
    
    // Validate the tiles array
    if (!Array.isArray(tiles)) {
      return res.status(500).json({ error: 'Response is not an array', text: cleanedText });
    }
    
    // Filter and validate each tile
    const validTiles = tiles
      .filter(tile => tile && typeof tile.name === 'string' && tile.name.trim())
      .map(tile => ({
        name: tile.name.trim(),
        emoji: tile.emoji || '📝'
      }));
    
    if (validTiles.length === 0) {
      return res.status(500).json({ error: 'No valid tiles generated' });
    }
    
    // Return the tiles directly as an array for easier frontend handling
    return res.status(200).json({ tiles: validTiles });
    
  } catch (error) {
    console.error('Error in generate-tiles:', error);
    return res.status(500).json({ 
      error: 'Failed to generate tiles', 
      message: error.message 
    });
  }
}
