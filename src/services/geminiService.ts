import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SolutionStep {
  stepNumber: number;
  instruction: string;
}

export interface ProblemSolution {
  title: string;
  steps: SolutionStep[];
  additionalTips: string[];
}

export async function getMobileSolution(
  problem: string,
  language: "English" | "Tamil" | "Hindi",
  platform: string,
  mobileModel: string,
  imageData?: string
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert mobile software technician. 
  Provide a step-by-step solution for the user's mobile software problem.
  Device Info: Platform: ${platform}, Model: ${mobileModel}.
  The response MUST be in ${language}.
  Format the output as a clear, numbered list of steps.
  Keep instructions simple and user-friendly.
  If an image is provided, analyze it to understand the error or issue better.`;

  const fullProblem = `Device: ${platform} ${mobileModel}\nProblem: ${problem || "Analyze the issue and provide a solution."}`;
  const parts: any[] = [{ text: fullProblem }];
  
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageData.split(",")[1],
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
      },
    });

    return response.text || "Sorry, I couldn't generate a solution at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while fetching the solution. Please try again.";
  }
}

export async function transcribeAudio(base64Audio: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: "Transcribe this audio accurately. If it's in Tamil or Hindi, transcribe it in that language." },
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio,
            },
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    return "";
  }
}

export async function translateText(
  text: string,
  targetLanguage: "English" | "Tamil" | "Hindi"
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Translate the following mobile troubleshooting instructions into ${targetLanguage}. Keep the markdown formatting intact:\n\n${text}`,
    });

    return response.text || text;
  } catch (error) {
    console.error("Translation Error:", error);
    return text;
  }
}
