
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TranslationResult, VibeMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateWithSlangStream = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  vibeMode: VibeMode,
  onChunk: (textSoFar: string) => void
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
    
    SMART CORRECTION & CONTEXT PREDICTION:
    - The source text may contain spelling errors. Predict the intended word.
    - Finalize the translation based on the intended meaning.

    CRITICAL FOR TAGALOG: 
    - If mode is NOT formal, NEVER use "ay" as a linker if it can be avoided. 
    - Use "parang" instead of "tila".
    
    Text to translate: "${text}"
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // MAX SPEED: Disable thinking
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: {
              type: Type.STRING,
              description: "The punchy, natural translation corrected for typos.",
            },
            explanation: {
              type: Type.STRING,
              description: "Brief note on corrections or nuance.",
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
              description: "The specific sub-vibe.",
            },
          },
          required: ["translatedText", "explanation", "slangUsed", "vibe"],
        },
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const c = chunk as GenerateContentResponse;
      const part = c.text;
      if (part) {
        fullText += part;
        // Try to extract translatedText from the partial JSON for real-time UI updates
        const match = fullText.match(/"translatedText":\s*"((?:[^"\\]|\\.)*)"/);
        if (match && match[1]) {
          onChunk(match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
        }
      }
    }

    return JSON.parse(fullText) as TranslationResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || "";
    if (errorMessage.includes("429")) throw new Error("QUOTA_EXCEEDED");
    if (!navigator.onLine) throw new Error("OFFLINE");
    throw new Error("UNKNOWN_ERROR");
  }
};

// Keep original for backward compatibility if needed, but updated to use stream internally for speed
export const translateWithSlang = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  vibeMode: VibeMode
): Promise<TranslationResult> => {
  return translateWithSlangStream(text, sourceLang, targetLang, vibeMode, () => {});
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
