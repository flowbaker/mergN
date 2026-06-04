export interface Wire {
  from: string;
  fromOutput: string;
  to: string;
  toInput: string;
}

export interface AuthoredFunc {
  id: string;
  title: string;
  summary: string;
  version: number;
  kind: string;
  pure: boolean;
  inputs: { name: string; role: string; type: string; required: boolean }[];
  outputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  bodySource: string;
  requires: { name: string; provider: string; scopes: string[] }[];
  dangerClass: string | null;
  idempotency: { key: string; mechanism: string } | null;
}
