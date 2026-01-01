/**
 * Code Transformers Utility
 * 
 * Functions for transforming code between languages,
 * with specialized logic for Kotlin to SwiftUI conversion.
 * 
 * This module now integrates with OpenAI via the openaiClient
 * for actual code transformations.
 */

const { runCodexiaTransform, buildUserPrompt } = require('../openaiClient');
const { isKotlinCode } = require('./fileHandlers');
const logger = require('./logger');

/**
 * Transform a single file's code
 * 
 * @param {string} code - Source code to transform
 * @param {string} instructions - Transformation instructions
 * @returns {Promise<Object>} Transformed code result
 */
async function handleSingleFile(code, instructions) {
  try {
    // Detect if code is Kotlin
    const isKotlin = isKotlinCode(code);
    const language = isKotlin ? 'Kotlin' : 'Unknown';

    logger.info(`Transforming single file (detected language: ${language})`);

    // Build the user prompt
    const userPrompt = buildUserPrompt(code, instructions, { language });

    // Call OpenAI for transformation
    const transformedCode = await runCodexiaTransform(userPrompt, {
      stream: false,
      temperature: 0.3
    });

    return {
      success: true,
      originalCode: code,
      transformedCode: transformedCode,
      language: language,
      targetLanguage: 'SwiftUI',
      note: process.env.OPENAI_API_KEY 
        ? 'Transformed using OpenAI API' 
        : 'Mock transformation (configure OPENAI_API_KEY for actual transformations)'
    };
  } catch (error) {
    logger.error(`Single file transformation error: ${error.message}`);
    throw new Error(`Transformation failed: ${error.message}`);
  }
}

/**
 * Transform Kotlin code to SwiftUI
 * 
 * @param {string} kotlinCode - Kotlin source code
 * @param {string} instructions - Transformation instructions
 * @returns {Promise<Object>} Transformed SwiftUI code
 */
async function transformKotlinToSwiftUI(kotlinCode, instructions) {
  try {
    logger.info('Transforming Kotlin to SwiftUI');

    // Build the user prompt specifically for Kotlin
    const userPrompt = buildUserPrompt(kotlinCode, instructions, { 
      language: 'Kotlin' 
    });

    // Call OpenAI for transformation
    const transformedCode = await runCodexiaTransform(userPrompt, {
      stream: false,
      temperature: 0.3
    });

    return {
      success: true,
      originalCode: kotlinCode,
      transformedCode: transformedCode,
      language: 'Kotlin',
      targetLanguage: 'SwiftUI',
      transformations: extractKotlinTransformations(kotlinCode),
      note: process.env.OPENAI_API_KEY 
        ? 'Transformed using OpenAI API' 
        : 'Mock transformation (configure OPENAI_API_KEY for actual transformations)'
    };
  } catch (error) {
    logger.error(`Kotlin to SwiftUI transformation error: ${error.message}`);
    throw new Error(`Kotlin to SwiftUI transformation failed: ${error.message}`);
  }
}

/**
 * Extract Kotlin-specific patterns and transformations needed
 * 
 * @param {string} kotlinCode - Kotlin source code
 * @returns {Array} List of detected patterns and their SwiftUI equivalents
 */
function extractKotlinTransformations(kotlinCode) {
  const transformations = [];

  // Data classes
  if (/data\s+class/.test(kotlinCode)) {
    transformations.push({
      pattern: 'Data Class',
      kotlinSyntax: 'data class User(val name: String)',
      swiftEquivalent: 'struct User: Codable { let name: String }'
    });
  }

  // Coroutines
  if (/suspend\s+fun/.test(kotlinCode)) {
    transformations.push({
      pattern: 'Suspend Function',
      kotlinSyntax: 'suspend fun fetchData()',
      swiftEquivalent: 'async func fetchData()'
    });
  }

  // Composables
  if (/@Composable/.test(kotlinCode)) {
    transformations.push({
      pattern: 'Composable',
      kotlinSyntax: '@Composable fun MyScreen()',
      swiftEquivalent: 'struct MyScreen: View { var body: some View { ... } }'
    });
  }

  // Activities
  if (/AppCompatActivity|Activity/.test(kotlinCode)) {
    transformations.push({
      pattern: 'Activity',
      kotlinSyntax: 'class MainActivity : AppCompatActivity()',
      swiftEquivalent: 'struct MainView: View'
    });
  }

  // When expressions
  if (/when\s*\{/.test(kotlinCode)) {
    transformations.push({
      pattern: 'When Expression',
      kotlinSyntax: 'when (value) { ... }',
      swiftEquivalent: 'switch value { ... }'
    });
  }

  return transformations;
}

/**
 * Transform multiple files
 * 
 * @param {Array} files - Array of file objects to transform
 * @param {string} instructions - Transformation instructions
 * @returns {Promise<Array>} Array of transformation results
 */
async function transformMultipleFiles(files, instructions) {
  const results = [];

  logger.info(`Transforming ${files.length} files`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // Detect language
      const isKotlin = isKotlinCode(file.content);
      const language = isKotlin ? 'Kotlin' : 'Unknown';

      // Build user prompt with file metadata
      const userPrompt = buildUserPrompt(file.content, instructions, {
        language: language,
        filename: file.name,
        fileCount: files.length
      });

      // Transform the file
      const transformedCode = await runCodexiaTransform(userPrompt, {
        stream: false,
        temperature: 0.3
      });

      results.push({
        fileName: file.name,
        success: true,
        originalCode: file.content,
        transformedCode: transformedCode,
        language: language,
        targetLanguage: 'SwiftUI'
      });

      logger.info(`File ${i + 1}/${files.length} transformed: ${file.name}`);
    } catch (error) {
      logger.error(`Error transforming file ${file.name}: ${error.message}`);
      results.push({
        fileName: file.name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

module.exports = {
  handleSingleFile,
  transformKotlinToSwiftUI,
  transformMultipleFiles,
  extractKotlinTransformations
};
