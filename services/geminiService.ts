
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const base64ToGenerativePart = (base64String: string): { data: string; mimeType: string } => {
  const [header, data] = base64String.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { data, mimeType };
};

export const editImageWithGemini = async (
  mainImage: File,
  prompt: string,
  options: {
    markedImageBase64?: string;
    referenceImages?: File[];
    isExpansion?: boolean;
    toolType?: string;
  }
): Promise<{ imageUrl: string | null; analysis: string }> => {
  try {
    const parts: any[] = [];
    
    const systemRules = `
    You are CHR EDIT_AI, a professional multimodal AI specialist.
    
    INPUTS:
    1. The first image is the ORIGINAL SOURCE.
    2. The second image (if provided) is the MARKED OVERLAY guide.
    3. Any subsequent images are STYLE REFERENCES.
    
    MARKER GUIDE (Apply strictly if Marked Overlay is present):
    - RED STROKES: Modify/Repair/Remove this area.
    - BLUE STROKES: Protect/Keep this area exactly as is.
    - GREEN STROKES: Enhance details/quality in this area.
    - YELLOW STROKES: Creative suggestion/Additions area.
    
    GENERAL INSTRUCTIONS:
    1. Output a single final processed image.
    2. Maintain high photorealism and consistency.
    3. Seamlessly blend edits into the original environment.
    4. If referencing style images, adopt their lighting/texture/vibe.
    `;

    // Part 1: Original Image
    const mainPart = await fileToGenerativePart(mainImage);
    parts.push({
      inlineData: {
        mimeType: mainPart.mimeType,
        data: mainPart.data
      }
    });

    // Part 2: Marked Image (if provided)
    if (options.markedImageBase64) {
      const markedPart = base64ToGenerativePart(options.markedImageBase64);
      parts.push({
        inlineData: {
          mimeType: markedPart.mimeType,
          data: markedPart.data
        }
      });
    }

    // Part 3: Reference Images
    if (options.referenceImages && options.referenceImages.length > 0) {
      for (const refFile of options.referenceImages) {
        const refPart = await fileToGenerativePart(refFile);
        parts.push({
          inlineData: {
            mimeType: refPart.mimeType,
            data: refPart.data
          }
        });
      }
    }

    let taskPrompt = systemRules;
    if (options.isExpansion) {
      taskPrompt += "\nTASK: PRO EXPANSION (OUTPAINTING). Logically expand the scene beyond boundaries.";
    } else {
      taskPrompt += `\nTASK: PROFESSIONAL EDITING (Mode: ${options.toolType || 'Standard'}).`;
    }
    
    if (options.referenceImages?.length) {
      taskPrompt += `\nREFERENCE: Use the provided reference image(s) to guide style, lighting, or content.`;
    }

    taskPrompt += `\nUSER INSTRUCTION: ${prompt}`;
    parts.push({ text: taskPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Using reliable model for image editing
      contents: { parts }
    });

    const outputParts = response.candidates?.[0]?.content?.parts;
    let imageUrl: string | null = null;
    let analysis = "Editing completed successfully.";

    if (outputParts) {
      for (const part of outputParts) {
        if (part.inlineData && part.inlineData.data) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
          analysis = part.text;
        }
      }
    }
    
    return { imageUrl, analysis };
  } catch (error) {
    console.error("CHR EDIT_AI Error:", error);
    throw error;
  }
};
