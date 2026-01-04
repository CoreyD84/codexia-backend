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
 * Transform a single file with full project context + AUTO-FIX LOOP
 */
async function transformSingleFileWithContext(file, projectContext, instructions, options) {
  const systemPrompt = buildSystemPrompt(options, projectContext);
  const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
  
  // Initial messages
  let messages = buildMessages(systemPrompt, userPrompt);
  
  let transformedContent = "";
  let attempts = 0;
  const maxAttempts = 3;
  let isVerified = false;

  while (attempts < maxAttempts && !isVerified) {
    logger.info(`Attempt ${attempts + 1} for ${file.path}`);
    
    // 1. Get code from LLM
    transformedContent = await runCodexiaTransform(messages, options);

    // 2. Validate using Windows Swift Toolchain
    const validation = validateSwiftOnWindows(transformedContent);

    if (validation.isValid) {
      logger.info(`✅ ${file.path} passed validation.`);
      isVerified = true;
    } else {
      logger.warn(`❌ ${file.path} failed validation. Error: ${validation.error}`);
      
      // 3. RE-PROMPT: Feed the error back to the LLM for a "Fix Pass"
      const repairPrompt = `
THE CODE YOU JUST GENERATED HAS COMPILER ERRORS. 
YOU MUST FIX THEM WHILE PRESERVING THE LOGIC.

ERROR LOG:
${validation.error}

INSTRUCTION: 
Fix the syntax errors above. 
- If you used 'LazyRow', replace it with 'ScrollView(.horizontal) { LazyHStack { ... } }'.
- Ensure all enum cases are lowerCamelCase.
- Return ONLY the full corrected Swift code.
      `;

      // Append the error and instruction to the conversation history
      messages.push({ role: 'assistant', content: transformedContent });
      messages.push({ role: 'user', content: repairPrompt });
      
      attempts++;
    }
  }

  return {
    path: file.path,
    language: file.language,
    originalContent: file.content,
    transformedContent: transformedContent,
    verified: isVerified,
    attempts: attempts + 1
  };
}

// ... rest of the file (transformSequentialFiles, transformParallelFiles, etc.) remains the same ...
// They will automatically use the new logic since they call transformSingleFileWithContext.

module.exports = {
  transformMultipleFiles,
  streamMultipleFiles
};
