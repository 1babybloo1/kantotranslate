
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TranslationResult, VibeMode } from "../types";

export const translateWithSlangStream = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  vibeMode: VibeMode,
  onChunk: (textSoFar: string) => void
): Promise<TranslationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const modelName = "gemini-3-flash-preview";
  
  let stylisticContext = "";
  if (vibeMode === 'formal') {
    stylisticContext = `Formal, standard "textbook" style. Proper grammar, no contractions, no code-switching.`;
  } else if (vibeMode === 'casual') {
    stylisticContext = `Casual "Real Talk" style. Natural flow, brevity, predicate-first structure. Use native shortcuts (e.g., 'yung, 'to, dun). Drop redundant pronouns.`;
  } else if (vibeMode === 'taglish') {
    stylisticContext = `Urban Taglish style. Seamlessly blend English and Tagalog. Use modern urban inflections and social media slang.`;
  }

  const systemInstruction = `You are a high-speed linguistic engine specializing in cultural nuances and local vibes.
    
    RULES:
    - Target Vibe: ${stylisticContext}
    - Safety: Do not sexualize content unless explicitly in source. Treat slang expletives as intensifiers.
    - Script: If the target language is non-Latin (CJK), provide a phonetic 'transliteration'.
    - Tagalog Nuance: For non-formal modes, avoid "ay" linkers; use "parang" instead of "tila".
    - Correction: Predict intended words if source has typos.
    - Speed: Be concise. Response must be valid JSON.`;

  const sourceContext = sourceLang === 'auto' ? "Detect language automatically" : `Source language: ${sourceLang}`;
  const prompt = `Translate this from ${sourceContext} to ${targetLang}: "${text}"`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: {
              type: Type.STRING,
              description: "The primary translation.",
            },
            transliteration: {
              type: Type.STRING,
              description: "Phonetic guide for non-Latin scripts.",
            },
            explanation: {
              type: Type.STRING,
              description: "Brief nuance note.",
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
            },
            vibe: { type: Type.STRING },
            detectedLanguage: { type: Type.STRING },
          },
          required: ["translatedText", "explanation", "slangUsed", "vibe"],
        },
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const part = chunk.text;
      if (part) {
        fullText += part;
        // Faster extraction of the first property which is always translatedText
        const match = fullText.match(/"translatedText":\s*"((?:[^"\\]|\\.)*)"/);
        if (match && match[1]) {
          onChunk(match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
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

export const translateWithSlang = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  vibeMode: VibeMode
): Promise<TranslationResult> => {
  return translateWithSlangStream(text, sourceLang, targetLang, vibeMode, () => {});
};

export const speakText = async (text: string, voiceName: string = 'Kore') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
