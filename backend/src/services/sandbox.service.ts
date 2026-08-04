import axios from "axios";
import { VerificationDocType } from "../types/auth.type.js";

const BASE_URL = process.env.SANDBOX_BASE_URL || "https://api.sandbox.co.in";

export const getSandboxAccessToken = async (): Promise<string> => {
  try {
    const response = await axios.post(
      `${BASE_URL}/authenticate`,
      {},
      {
        headers: {
          "x-api-key": process.env.SANDBOX_API_KEY!,
          "x-api-secret": process.env.SANDBOX_API_SECRET!,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
        },
      },
    );

    return response.data.data.access_token;
  } catch (error) {
    console.log("error occured while fetching sandbox access token", error);
    throw error;
  }
};

export const initiateDigiLockerSession = async (
  token: string,
  docType: VerificationDocType,
  queryParams?: Record<string, any>,
) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/kyc/digilocker/sessions/init`,
      {
        "@entity": "in.co.sandbox.kyc.digilocker.session.request",
        flow: "signin",
        doc_types: [docType],
        redirect_url:
          process.env.DIGILOCKER_REDIRECT_URI ||
          "http://localhost:5000/api/v1/verification/digilocker/callback",
      },
      {
        headers: {
          Authorization: token,
          "x-api-key": process.env.SANDBOX_API_KEY!,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
          "Content-Type": "application/json",
        },
        params: queryParams, 
      },
    );

    return response.data.data;
  } catch (error) {
    console.log("error while initializing session with digilocker", error);
    throw error;
  }
};

export const getSessionStatus = async (
  token: string, 
  sessionId: string,
  queryParams?: Record<string, any>
) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/kyc/digilocker/sessions/${sessionId}/status`,
      {
        headers: {
          Authorization: token,
          "x-api-key": process.env.SANDBOX_API_KEY!,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
        },
        params: queryParams,
      },
    );

    return response.data.data;
  } catch (error) {
    console.log("error while establishing session", error);
    throw error;
  }
};

export const fetchDigiLockerDocument = async (
  token: string,
  sessionId: string,
  docType: string,
  queryParams?: Record<string, any>
) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/kyc/digilocker/sessions/${sessionId}/documents/${docType}`,
      {
        headers: {
          Authorization: token,
          "x-api-key": process.env.SANDBOX_API_KEY!,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
        },
        params: queryParams,
      },
    );

    const files = response.data?.data?.files || [];

    if (!files.length) {
      throw new Error(`No files found in Sandbox response for docType: ${docType}`);
    }

    let selectedFile = files.find(
      (file: any) =>
        file.metadata?.ContentType === "application/pdf" ||
        file.url?.toLowerCase().includes(".pdf"),
    );

    if (!selectedFile) {
      selectedFile = files[0];
    }

    if (!selectedFile?.url) {
      throw new Error(`Document URL not found for docType: ${docType}`);
    }

    const fileResponse = await axios.get(selectedFile.url, {
      responseType: "arraybuffer",
    });

    const mimeType =
      selectedFile.metadata?.ContentType ||
      (selectedFile.url.includes(".pdf") ? "application/pdf" : "application/xml");

    return {
      buffer: Buffer.from(fileResponse.data),
      mimeType,
    };
  } catch (error: any) {
    if (error.response?.data) {
      const decoded = Buffer.isBuffer(error.response.data)
        ? Buffer.from(error.response.data).toString("utf-8")
        : JSON.stringify(error.response.data);
      console.error(
        "Sandbox fetch document error:",
        error.response.status,
        decoded,
      );
    } else {
      console.error("Error while fetching the document:", error.message);
    }
    throw error;
  }
};