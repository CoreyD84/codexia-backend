// utils/analyzeProject.js

const { buildProjectContext } = require('./projectContext');
const { buildMessages, runCodexiaTransform } = require('../codexiaEngine/codexiaEngine');
const { buildAnalysisSystemPrompt } = require('../prompt/buildAnalysisSystemPrompt');
const { buildAnalysisUserPrompt } = require('../prompt/buildAnalysisUserPrompt');

async function analyzeProject(files, options) {
  const projectContext = buildProjectContext(files);

  const systemPrompt = buildAnalysisSystemPrompt(options, projectContext);
  const userPrompt = buildAnalysisUserPrompt(files, options, projectContext);

  const messages = buildMessages(systemPrompt, userPrompt);

  const raw = await runCodexiaTransform(messages, options);

  // STEP 1 — Strip Markdown fences
  let cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // STEP 2 — Remove JS-style comments inside JSON
  cleaned = cleaned.replace(/\/\/.*$/gm, '');

  // STEP 3 — Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // STEP 4 — Extract the first JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    const jsonCandidate = match[0];
    try {
      return JSON.parse(jsonCandidate);
    } catch (err) {
      // Continue to fallback
    }
  }

  // STEP 5 — Final fallback
  return {
    error: "Invalid JSON returned by model",
    raw
  };
}
module.exports = { analyzeProject };

