import axios from "axios";

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
  docTypes: string[],
) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/kyc/digilocker/sessions/init`,
      {
        "@entity": "in.co.sandbox.kyc.digilocker.session.request",
        flow: "signin",
        doc_types: docTypes,
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
      },
    );

    return response.data.data;
  } catch (error) {
    console.log("error while initializing session with digilocker", error);
    throw error;
  }
};

export const getSessionStatus = async (token: string, sessionId: string) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/kyc/digilocker/sessions/${sessionId}/status`,
      {
        headers: {
          Authorization: token, 
          "x-api-key": process.env.SANDBOX_API_KEY!,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
        },
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
        responseType: "arraybuffer",
      },
    );

    const mimeType = response.headers["content-type"] || "application/pdf";
    return { buffer: Buffer.from(response.data), mimeType };
  } catch (error: any) {
    if (error.response?.data) {
      const decoded = Buffer.from(error.response.data).toString("utf-8");
      console.log(
        "Sandbox fetch document error:",
        error.response.status,
        decoded,
      );
    } else {
      console.log("error while fetching the document", error.message);
    }
    throw error;
  }
};
