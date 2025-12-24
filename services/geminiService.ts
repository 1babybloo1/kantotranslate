
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
    - STRUCTURE: Use Predicate-First structure. 
    - CONTRACTIONS: Use native shortcuts like "'yung", "'to", "dun", "n'yo". 
    - VIBE: Sound like a native speaker. Drop redundant pronouns.`;
  } else if (vibeMode === 'taglish') {
    stylisticContext = `Translate into modern "Urban Taglish" (Manila style). 
    - MIXING: Seamlessly blend English and Tagalog as urban Filipinos do. 
    - STYLE: Use modern inflections. 
    - SLANG: Include current social media terms. 
    - FLOW: It should sound like a casual chat message.`;
  }

  const sourceContext = sourceLang === 'auto' 
    ? "the source language is unknown, please DETECT IT automatically" 
    : `the source language is ${sourceLang}`;

  const prompt = `
    Translate the following text from ${sourceContext} to ${targetLang}.
    
    STYLE REQUIREMENT: 
    ${stylisticContext}
    
    SMART CORRECTION & SANITY GUARD:
    - The source text may contain spelling errors. Predict the intended word.
    - CRITICAL: DO NOT sexualize the translation unless the source text is explicitly and unmistakably sexual. 
    - If the user uses "shit" or other common expletives as intensifiers (e.g., "intense shit"), treat them as exclamations of intensity or the literal act. 
    - NEVER map "shit" to anatomical references unless specified.
    
    TRANSLITERATION REQUIREMENT:
    - If ${targetLang} uses non-Latin characters (like Chinese Hanzi, Japanese Kanji/Kana, or Korean Hangul), you MUST provide a phonetic pronunciation in the 'transliteration' field (e.g., Pinyin for Chinese, Romaji for Japanese). 
    - If the target language uses Latin script, leave 'transliteration' empty or null.

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
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: {
              type: Type.STRING,
              description: "The main script translation.",
            },
            transliteration: {
              type: Type.STRING,
              description: "Phonetic guide (e.g., Pinyin, Romaji) if symbols are used.",
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
            detectedLanguage: {
              type: Type.STRING,
              description: "The name of the language detected from the input text (e.g., 'English', 'Tagalog'). Only needed if sourceLang was 'auto'.",
            }
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
