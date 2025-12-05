import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGameSummary = async (hearts: number, obstaclesHit: string[]) => {
  try {
    const obstacleText = obstaclesHit.length > 0 ? obstaclesHit.join(", ") : "none";
    
    const prompt = `
      You are a wise and funny relationship narrator for a game called "Ammu Chase Soul".
      The character Ammu (girl) was chasing Abhi/Soul (boy).
      
      Game Stats:
      - Hearts Collected (Love): ${hearts}
      - Problems Hit: ${obstacleText}
      
      Based on these stats, write a short, witty, or poetic 2-sentence "Relationship Status" or advice for Ammu. 
      If she hit "Family Problems", mention that. If she collected many hearts, say love is strong.
      Keep it fun and casual.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("AI Error", error);
    return "Love is a journey, not a destination. Try again!";
  }
};
