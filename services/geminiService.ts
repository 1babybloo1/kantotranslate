
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateWithSlang = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  slangLevel: number // 0 to 100
): Promise<TranslationResult> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Translate the following text from ${sourceLang} to ${targetLang}.
    
    CRITICAL INSTRUCTION: 
    The translation MUST be in a "relaxed", "local", or "slang" variation. 
    It should sound like a native speaker talking to a friend. 
    Avoid formal, textbook, or archaic language. 
    
    If the target is Tagalog/Filipino, use "Taglish" (mixing Tagalog and English) where natural, and use current Manila street slang or "kanto" speak.
    
    Slang Intensity Level: ${slangLevel}/100 (where 0 is natural casual and 100 is very deep street slang).
    
    Text to translate: "${text}"
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: {
            type: Type.STRING,
            description: "The casual/slang translation of the text.",
          },
          explanation: {
            type: Type.STRING,
            description: "A brief overall explanation of why this phrasing was chosen.",
          },
          slangUsed: {
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                meaning: { type: Type.STRING, description: "Deep definition of the slang term." },
                context: { type: Type.STRING, description: "Cultural context or origin of the term." }
              },
              required: ["term", "meaning", "context"]
            },
            description: "List of specific slang terms or idioms used with details.",
          },
          vibe: {
            type: Type.STRING,
            description: "One or two words describing the overall vibe (e.g., 'Chill', 'Hype', 'Street').",
          },
        },
        required: ["translatedText", "explanation", "slangUsed", "vibe"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return data as TranslationResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to generate translation.");
  }
};

export const speakText = async (text: string, voiceName: string = 'Kore') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (err) {
    console.error("TTS failed:", err);
  }
};
