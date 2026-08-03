export type DocVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type VerificationDocType =
  | "AADHAAR"
  | "PAN"
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
