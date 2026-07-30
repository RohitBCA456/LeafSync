export type verification_doc =
  | "GOVT_ID"
  | "DRIVING_LICENSE"
  | "BUSINESS_PAN"
  | "TAX_CERTIFICATE";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type role = "STG" | "DRIVER" | "MANAGER";

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
  verification_doc_type?: verification_doc;
  verification_doc_url?: string;
}

export interface RegisterDriverDTO extends BaseRegisterDTO {
  licenseNumber: string;
  vehicleType: string;
}

export interface RegisterStgDTO extends BaseRegisterDTO {
  towerCapacity?: number;
}
