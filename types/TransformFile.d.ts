export interface TransformFile {
  path: string;
  language?: string;
  content?: string;   // raw text (optional)
  code_b64?: string;  // base64 (optional)
}