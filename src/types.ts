export type Severity = "high" | "medium" | "low";

export type PIICategory =
  | "private_person"
  | "private_email"
  | "private_phone"
  | "private_address"
  | "private_date"
  | "private_url"
  | "account_number"
  | "secret"
  | "employee_id"
  | "ssn"
  | "credit_card";

export interface PIIEntity {
  category: PIICategory;
  text: string;
  start: number;
  end: number;
  confidence: number;
  source: "regex" | "model";
}

export interface DetectionResult {
  entities: PIIEntity[];
  blocked: boolean;
  severityCounts: Record<Severity, number>;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string;
  piiEntities?: PIIEntity[];
  redacted?: boolean;
  timestamp: number;
}

export interface ModelStatus {
  state: "idle" | "downloading" | "loading" | "ready" | "failed";
  progress?: number;
  error?: string;
}

export const SEVERITY_MAP: Record<PIICategory, Severity> = {
  account_number: "high",
  secret: "high",
  employee_id: "high",
  ssn: "high",
  credit_card: "high",
  private_person: "medium",
  private_address: "medium",
  private_email: "low",
  private_phone: "low",
  private_date: "low",
  private_url: "low",
};

export const REDACTION_LABELS: Record<PIICategory, string> = {
  private_person: "[NAME]",
  private_email: "[EMAIL]",
  private_phone: "[PHONE]",
  private_address: "[ADDRESS]",
  private_date: "[DATE]",
  private_url: "[URL]",
  account_number: "[ACCOUNT]",
  secret: "[SECRET]",
  employee_id: "[EMPLOYEE ID]",
  ssn: "[SSN]",
  credit_card: "[CREDIT CARD]",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  high: "var(--color-severity-high)",
  medium: "var(--color-severity-medium)",
  low: "var(--color-severity-low)",
};
