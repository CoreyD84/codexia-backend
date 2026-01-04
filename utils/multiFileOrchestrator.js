// utils/multiFileOrchestrator.js

const { classifyFiles } = require('./fileClassifier');
const { buildProjectContext } = require('./projectContext');
const { buildSystemPrompt } = require('../prompt/buildSystemPrompt');
const { buildUserPrompt } = require('../prompt/buildUserPrompt');
const {
  buildMessages,
  runCodexiaTransform
} = require('../codexiaEngine/codexiaEngine');
const { getDefaultTransformOptions } = require('../types/TransformOptions');
const logger = require('./logger') || { info: console.log, warn: console.warn, error: console.error };

// IMPORT YOUR VALIDATOR
const { validateSwiftOnWindows } = require('./execsync');

/**
 * Aggressively cleans up LLM output.
 * Removes Markdown code fences and whitespace.
 */
function sanitizeSwiftCode(rawCode) {
    if (!rawCode) return "";
    // Remove triple backticks and any text immediately following them (like 'swift')
    return rawCode
        .replace(/```[a-z]*/gi, '')
        .replace(/```/g, '')
        .trim();
}

/**
 * Transform a single file with full project context + AUTO-FIX LOOP
 */
async function transformSingleFileWithContext(file, projectContext, instructions, options) {
  const systemPrompt = buildSystemPrompt(options, projectContext);
  const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
  
  let messages = buildMessages(systemPrompt, userPrompt);
  
  let currentRawOutput = "";
  let sanitizedContent = "";
  let attempts = 0;
  const maxAttempts = 3;
  let isVerified = false;

  while (attempts < maxAttempts && !isVerified) {
    logger.info(`Attempt ${attempts + 1} for ${file.path}`);
    
    // 1. Get raw code from LLM
    currentRawOutput = await runCodexiaTransform(messages, options);
    
    // 2. IMMEDIATELY SANITIZE
    sanitizedContent = sanitizeSwiftCode(currentRawOutput);

    // 3. KOTLIN LEAK DETECTION
    const leaks = [];
    const lowerContent = sanitizedContent.toLowerCase();
    
    if (lowerContent.includes("@composable")) leaks.push("@Composable");
    if (sanitizedContent.includes("fun ")) leaks.push("keyword 'fun'");
    if (sanitizedContent.includes("val ")) leaks.push("keyword 'val'");
    if (lowerContent.includes("remember {")) leaks.push("Compose 'remember'");

    // 4. VALIDATE using Windows Swift Toolchain
    const validation = validateSwiftOnWindows(sanitizedContent);

    if (validation.isValid && leaks.length === 0) {
      logger.info(`✅ ${file.path} passed validation.`);
      isVerified = true;
    } else {
      const errorDetail = leaks.length > 0 
        ? `STILL CONTAINS KOTLIN ARTIFACTS: ${leaks.join(', ')}` 
        : validation.error;

      logger.warn(`❌ ${file.path} rejected. Error: ${errorDetail}`);
      
      // 5. RE-PROMPT
      const repairPrompt = `
ERROR: Your output is NOT valid Swift. 
Details: ${errorDetail}

FIX:
- Replace '@Composable fun' with 'struct Name: View' and 'var body: some View'.
- Replace 'fun' with 'func'.
- ABSOLUTELY NO MARKDOWN OR BACKTICKS.
      `;

      messages.push({ role: 'assistant', content: currentRawOutput });
      messages.push({ role: 'user', content: repairPrompt });
      
      attempts++;
    }
  }

  // We return the sanitizedContent to ensure backticks never reach the user
  return {
    path: file.path,
    language: file.language,
    originalContent: file.content,
    transformedContent: sanitizedContent,
    verified: isVerified,
    attempts: attempts
  };
}

/**
 * Sequential transforms (deep reasoning files).
 */
async function transformSequentialFiles(files, projectContext, instructions, options) {
  const results = [];
  for (const file of files) {
    const result = await transformSingleFileWithContext(file, projectContext, instructions, options);
    results.push(result);
  }
  return results;
}

/**
 * Parallel transforms (simple files).
 */
async function transformParallelFiles(files, projectContext, instructions, options) {
  if (!files || files.length === 0) return { results: [], errors: [] };
  
  const tasks = files.map(file =>
    transformSingleFileWithContext(file, projectContext, instructions, options)
      .then(result => ({ status: 'fulfilled', value: result }))
      .catch(error => ({ status: 'rejected', reason: error, path: file.path }))
  );

  const settled = await Promise.all(tasks);
  const results = [];
  const errors = [];

  for (const item of settled) {
    if (item.status === 'fulfilled') results.push(item.value);
    else errors.push({ path: item.path, error: String(item.reason) });
  }
  return { results, errors };
}

/**
 * Main multi-file orchestrator (Hybrid Mode).
 */
async function transformMultipleFiles(rawFiles, instructions, clientOptions = {}) {
  const options = getDefaultTransformOptions(clientOptions || {});
  const files = rawFiles.map(f => ({
    path: f.path || 'UnknownFile.kt',
    language: f.language || 'kotlin',
    content: f.content
  }));

  const projectContext = buildProjectContext(files);
  const { sequential, parallel } = classifyFiles(files);

  const sequentialResults = await transformSequentialFiles(sequential, projectContext, instructions, options);
  const { results: parallelResults, errors: parallelErrors } = await transformParallelFiles(parallel, projectContext, instructions, options);

  const allResults = [...sequentialResults, ...parallelResults];

  return {
    success: parallelErrors.length === 0,
    filesTransformed: allResults.length,
    results: allResults,
    parallelErrors
  };
}

/**
 * Multi-file streaming orchestrator.
 */
async function streamMultipleFiles(normalizedFiles, instructions, clientOptions, onToken) {
  const options = getDefaultTransformOptions(clientOptions || {});
  const projectContext = buildProjectContext(normalizedFiles);
  const { sequential, parallel } = classifyFiles(normalizedFiles);

  for (const file of [...sequential, ...parallel]) {
    const systemPrompt = buildSystemPrompt(options, projectContext);
    const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
    const messages = buildMessages(systemPrompt, userPrompt);

    await runCodexiaTransformStream(messages, options, token => {
      onToken(`FILE:${file.path}::${token}`);
    });
    onToken(`FILE:${file.path}::[END_FILE]`);
  }
  onToken('[END]');
}

module.exports = {
  transformMultipleFiles,
  streamMultipleFiles
};
