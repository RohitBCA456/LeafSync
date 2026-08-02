import Tesseract from "tesseract.js";
import { VerificationDocType } from "../types/auth.type.js";

const REGEX_PATTERNS = {
  DRIVING_LICENSE: /[A-Z]{2}[0-9]{2}\s?[0-9]{11}/i,
  AADHAAR: /[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}/,
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]{1}/i,
  VOTER_ID: /[A-Z]{3}[0-9]{7}/i,
};

export interface OCRResult {
  isVerified: boolean;
  extractedId: string | null;
  detectedDocType: string;
  rawText: string;
}

export const verifyDriverLicense = async (
  imageBuffer: Buffer,
  license_number: string,
): Promise<OCRResult> => {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng");

  const cleanedText = text.replace(/[\r\n]+/g, " ").toUpperCase();

  const match = cleanedText.match(REGEX_PATTERNS.DRIVING_LICENSE);
  const hasKeywords =
    cleanedText.includes("DRIVING") ||
    cleanedText.includes("LICENCE") ||
    cleanedText.includes("TRANSPORT");

  const extractedId = match ? match[0].replace(/\s/g, "") : null;

  const sanitizedUserInput = license_number
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  const sanitizedExtractedId = extractedId
    ? extractedId.replace(/[^A-Z0-9]/gi, "").toUpperCase()
    : null;

  if (sanitizedExtractedId && sanitizedUserInput === sanitizedExtractedId) {
    return {
      isVerified: true,
      extractedId,
      detectedDocType: "DRIVING_LICENSE",
      rawText: text,
    };
  }

  const isNumberInText = cleanedText
    .replace(/[^A-Z0-9]/gi, "")
    .includes(sanitizedUserInput);

  const isVerified = Boolean(
    (sanitizedExtractedId || isNumberInText) && hasKeywords,
  );

  return {
    isVerified,
    extractedId: extractedId || (isNumberInText ? license_number : null),
    detectedDocType: "DRIVING_LICENSE",
    rawText: text,
  };
};

export const verifyStgDocument = async (
  imageBuffer: Buffer,
  requestedDocType: VerificationDocType,
): Promise<OCRResult> => {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng");
  const cleanedText = text.replace(/[\r\n]+/g, " ").toUpperCase();

  let isVerified = false;
  let extractedId: string | null = null;

  switch (requestedDocType) {
    case "AADHAAR": {
      const match = cleanedText.match(REGEX_PATTERNS.AADHAAR);
      const hasKeywords =
        cleanedText.includes("GOVERNMENT OF INDIA") ||
        cleanedText.includes("UNIQUE IDENTIFICATION") ||
        cleanedText.includes("AADHAAR");
      extractedId = match ? match[0].replace(/\s/g, "") : null;
      isVerified = Boolean(extractedId || hasKeywords);
      break;
    }
    case "PAN": {
      const match = cleanedText.match(REGEX_PATTERNS.PAN);
      const hasKeywords =
        cleanedText.includes("INCOME TAX") ||
        cleanedText.includes("DEPARTMENT") ||
        cleanedText.includes("PERMANENT ACCOUNT");
      extractedId = match ? match[0] : null;
      isVerified = Boolean(extractedId && hasKeywords);
      break;
    }
    case "VOTER_ID": {
      const match = cleanedText.match(REGEX_PATTERNS.VOTER_ID);
      const hasKeywords =
        cleanedText.includes("ELECTION COMMISSION") ||
        cleanedText.includes("ELECTOR") ||
        cleanedText.includes("IDENTITY CARD");
      extractedId = match ? match[0] : null;
      isVerified = Boolean(extractedId && hasKeywords);
      break;
    }
  }

  return {
    isVerified,
    extractedId,
    detectedDocType: requestedDocType,
    rawText: text,
  };
};
