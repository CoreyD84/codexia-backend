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
const logger = require('./logger') || require('../utils/logger');

// IMPORT YOUR VALIDATOR
const { validateSwiftOnWindows } = require('./execsync');

/**
 * Aggressively cleans up LLM output.
 * Removes Markdown code fences, language tags, and weird trailing artifacts.
 */
function sanitizeSwiftCode(rawCode) {
    if (!rawCode) return "";
    return rawCode
        .replace(/```swift/gi, '')
        .replace(/```/g, '')
        .replace(/^[ \t]*\n/gm, '') // Remove empty leading lines
        .trim();
}

/**
 * Transform a single file with full project context + AUTO-FIX LOOP
 */
async function transformSingleFileWithContext(file, projectContext, instructions, options) {
  const systemPrompt = buildSystemPrompt(options, projectContext);
  const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
  
  let messages = buildMessages(systemPrompt, userPrompt);
  
  let currentContent = "";
  let attempts = 0;
  const maxAttempts = 3;
  let isVerified = false;

  while (attempts < maxAttempts && !isVerified) {
    logger.info(`Attempt ${attempts + 1} for ${file.path}`);
    
    // 1. Get raw code from LLM
    const rawOutput = await runCodexiaTransform(messages, options);
    
    // 2. STRIP BACKTICKS IMMEDIATELY (Before Validation)
    currentContent = sanitizeSwiftCode(rawOutput);

    // 3. KOTLIN LEAK DETECTION (Case-Insensitive)
    const leaks = [];
    const lowerContent = currentContent.toLowerCase();
    
    if (lowerContent.includes("@composable")) leaks.push("@Composable");
    if (currentContent.includes("fun ")) leaks.push("keyword 'fun'");
    if (currentContent.includes("val ")) leaks.push("keyword 'val'");
    if (lowerContent.includes("remember {")) leaks.push("Compose 'remember'");
    if (lowerContent.includes("mutableStateOf")) leaks.push("'mutableStateOf'");

    // 4. VALIDATE using Windows Swift Toolchain
    const validation = validateSwiftOnWindows(currentContent);

    // Only pass if BOTH the compiler is happy AND no Kotlin leaked through
    if (validation.isValid && leaks.length === 0) {
      logger.info(`✅ ${file.path} passed validation.`);
      isVerified = true;
    } else {
      const errorDetail = leaks.length > 0 
        ? `STILL CONTAINS KOTLIN ARTIFACTS: ${leaks.join(', ')}` 
        : validation.error;

      logger.warn(`❌ ${file.path} rejected. Error: ${errorDetail}`);
      
      // 5. RE-PROMPT: The "Mean" Repair Prompt
      const repairPrompt = `
ATTENTION: Your output FAILED validation.
- ERROR: ${errorDetail}

REQUIRED FIXES:
1. Change 'fun' to 'func'.
2. Change '@Composable fun Name()' to 'struct Name: View'.
3. Change 'val' to 'let' or '@State var'.
4. Do NOT use Markdown backticks (\`\`\`).
5. Output ONLY pure Swift code.
      `;

      // Feed back the bad code and the error
      messages.push({ role: 'assistant', content: rawOutput });
      messages.push({ role: 'user', content: repairPrompt });
      
      attempts++;
    }
  }

  // FINAL SAFETY PASS: One last sanitize to be absolutely sure
  const finalCleaned = sanitizeSwiftCode(currentContent);

  return {
    path: file.path,
    language: file.language,
    originalContent: file.content,
    transformedContent: finalCleaned,
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
    logger.info(`Transforming SEQUENTIAL file: ${file.path}`);
    const result = await transformSingleFileWithContext(file, projectContext, instructions, options);
    results.push(result);
  }
  return results;
}

/**
 * Parallel transforms (simple files).
 */
async function transformParallelFiles(files, projectContext, instructions, options) {
  if (!files || files.length === 0) return [];
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

  return {
    success: parallelErrors.length === 0,
    filesTransformed: sequentialResults.length + parallelResults.length,
    results: [...sequentialResults, ...parallelResults],
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

module.exports = { transformMultipleFiles, streamMultipleFiles };
