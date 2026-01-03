// prompt/buildAnalysisUserPrompt.js

function buildAnalysisUserPrompt(files, options, projectContext) {
  const fileList = files
    .map(f => `- ${f.path} (${f.language})`)
    .join('\n');

  return `
Analyze the following Android/Kotlin project.

FILES:
${fileList}

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

Return ONLY the JSON object defined in the system prompt.
`.trim();
}

module.exports = { buildAnalysisUserPrompt };