// utils/normalizeFile.js

export function normalizeFile(file) {
  // If the client sent raw content, convert it to Base64
  if (!file.code_b64 && file.content) {
    file.code_b64 = Buffer.from(file.content, "utf8").toString("base64");
  }

  // If neither content nor code_b64 exists, throw a clean error
  if (!file.code_b64) {
    throw new Error("File must include either 'content' or 'code_b64'");
  }

  return {
    path: file.path,
    language: file.language || "unknown",
    code_b64: file.code_b64
  };
}