const { runCodexiaTransform, buildMessages } = require('../codexiaEngine/codexiaEngine');
const { buildSystemPrompt } = require('../prompt/buildSystemPrompt');
const { buildUserPrompt } = require('../prompt/buildUserPrompt');
const { isKotlinCode } = require('./fileHandlers');
const logger = require('./logger');
const { getDefaultTransformOptions } = require('../types/TransformOptions');

function getTransformationNote() {
  return 'Transformed using Codexia Local Model';
}

async function handleSingleFile(code, instructions, options) {
  try {
    const mergedOptions = {
      ...getDefaultTransformOptions(),
      ...(options || {})
    };

    const isKotlin = isKotlinCode(code);
    const language = isKotlin ? 'Kotlin' : 'Unknown';

    const files = [
      {
        path: 'MainActivity.kt',
        language,
        content: code
      }
    ];

    const systemPrompt = buildSystemPrompt(mergedOptions);
    const userPrompt = buildUserPrompt(files, instructions, mergedOptions);
    const messages = buildMessages(systemPrompt, userPrompt);

    const transformedCode = await runCodexiaTransform(messages, mergedOptions);

    return {
      success: true,
      originalCode: code,
      transformedCode,
      language,
      targetLanguage: 'SwiftUI',
      note: getTransformationNote()
    };
  } catch (error) {
    logger.error(`Single file transformation error: ${error.message}`);
    throw new Error(`Transformation failed: ${error.message}`);
  }
}

module.exports = {
  handleSingleFile
};