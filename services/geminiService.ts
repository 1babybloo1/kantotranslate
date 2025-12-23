
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult, VibeMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateWithSlang = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  vibeMode: VibeMode
): Promise<TranslationResult> => {
  const model = "gemini-3-flash-preview";
  
  let stylisticContext = "";
  if (vibeMode === 'formal') {
    stylisticContext = `Translate using formal, grammatically perfect, and standard "textbook" ${targetLang}. Use full words, no contractions, and proper sentence structure. Avoid code-switching.`;
  } else if (vibeMode === 'casual') {
    stylisticContext = `Translate using "Real Talk" ${targetLang}. 
    - PRIORITY: Brevity and natural flow. 
    - STRUCTURE: Use Predicate-First structure (e.g., "Kamukha..." instead of "Ang... ay kamukha"). 
    - CONTRACTIONS: Use native shortcuts like "'yung" (not "ang iyong"), "'to" (not "ito"), "dun" (not "doon"), "n'yo" (not "ninyo"). 
    - VIBE: Sound like a native speaker talking to a close friend. Drop redundant pronouns.`;
  } else if (vibeMode === 'taglish') {
    stylisticContext = `Translate into modern "Urban Taglish" (Manila style). 
    - MIXING: Seamlessly blend English and Tagalog as urban Filipinos do. 
    - STYLE: Use "Conyo" or "Street" inflections where appropriate. 
    - SLANG: Include current social media terms (e.g., "vibes", "shookt", "char", "mars"). 
    - FLOW: It should sound like a casual chat message or a quick conversation.`;
  }

  const prompt = `
    Translate the following text from ${sourceLang} to ${targetLang}.
    
    STYLE REQUIREMENT: 
    ${stylisticContext}
    
    CRITICAL FOR TAGALOG: 
    If mode is NOT formal, NEVER use "ay" as a linker if it can be avoided by flipping the sentence. 
    Avoid archaic words like "binibini", "sapagkat", or "nagnanais". 
    Use "parang" instead of "tila".
    
    Text to translate: "${text}"
  `;

  try {
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
              description: "The punchy, natural translation.",
            },
            explanation: {
              type: Type.STRING,
              description: "Why this version sounds more native/natural.",
            },
            slangUsed: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  context: { type: Type.STRING }
                },
                required: ["term", "meaning", "context"]
              },
              description: "Shortcuts or slang used.",
            },
            vibe: {
              type: Type.STRING,
              description: "The specific sub-vibe (e.g., 'Street', 'Hataw', 'Tito-style').",
            },
          },
          required: ["translatedText", "explanation", "slangUsed", "vibe"],
        },
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("EMPTY_RESPONSE");
    }

    return JSON.parse(textResponse) as TranslationResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || "";
    if (errorMessage.includes("429")) throw new Error("QUOTA_EXCEEDED");
    if (errorMessage.includes("403") || errorMessage.includes("API_KEY_INVALID")) throw new Error("CONFIG_ERROR");
    if (errorMessage.includes("SAFETY") || errorMessage.includes("blocked")) throw new Error("SAFETY_BLOCK");
    if (error instanceof SyntaxError) throw new Error("PARSE_ERROR");
    if (!navigator.onLine) throw new Error("OFFLINE");
    throw new Error("UNKNOWN_ERROR");
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
