export type DocVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type VerificationDocType =
  | "AADHAAR"
  | "PAN"
  | "VOTER_ID"
  | "DRIVING_LICENSE"
  | "FACTORY_LICENSE";

export type role = "stg" | "driver" | "manager";

export interface BaseRegisterDTO {
  name: string;
  email: string;
  password: string;
  ph_number: string;
  avatar_url: string;
  latitude: number;
  longitude: number;
  otp: string;
  role: role;
}

export interface verifyStgDTO {
  verification_doc_type: VerificationDocType;
  verification_doc: Buffer;
}

export interface verifyDriverDTO {
  licenseNumber: string;
  vehicleType: string;
  verification_doc_type: VerificationDocType;
  verification_doc: Buffer;
}
