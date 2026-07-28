export type verification_doc =
  | "GOVT_ID"
  | "DRIVING_LICENSE"
  | "BUSINESS_PAN"
  | "TAX_CERTIFICATE";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface BaseRegisterDTO {
  name: string;
  email: string;
  password: string;
  ph_number: string;
  avatar_url: string;
  latitude: number;
  longitude: number;
  otp: string;
  verification_doc_type?: string;
  verification_doc_url?: string;
}

export interface RegisterDriverDTO extends BaseRegisterDTO {
  licenseNumber: string;
  vehicleType: string;
}

export interface RegisterStgDTO extends BaseRegisterDTO {
  towerCapacity?: number;
}
