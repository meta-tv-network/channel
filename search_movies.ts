import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  console.log("Ricerca dei film di MoviedomeIT su YouTube tramite Gemini con Google Search...");
  
  const prompt = `Trova 12 film completi, gratis, legali e in italiano caricati sul canale ufficiale YouTube di Moviedome Italia (@MoviedomeIT).
Per ciascun film, trova l'URL effettivo del video su YouTube (formato https://www.youtube.com/watch?v=...) e raccogli:
1. title: Il titolo esatto del film.
2. description: Una sinossi del film in italiano.
3. sourceUrl: L'URL del video di YouTube (reale, non inventato).
4. durationMinutes: La durata approssimativa in minuti (es: 95).

IMPORTANTE: Restituisci i dati strettamente in formato JSON, con un array di oggetti conformi allo schema richiesto. I link devono essere reali e verificati sul web.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              sourceUrl: { type: Type.STRING },
              durationMinutes: { type: Type.INTEGER }
            },
            required: ["title", "description", "sourceUrl", "durationMinutes"]
          }
        }
      }
    });

    console.log("RISULTATO_JSON_START");
    console.log(response.text);
    console.log("RISULTATO_JSON_END");
  } catch (err) {
    console.error("Errore nella chiamata a Gemini:", err);
  }
}

main();
