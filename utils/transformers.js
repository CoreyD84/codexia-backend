/**
 * Code Transformers Utility
 * 
 * Functions for transforming code between languages,
 * with specialized logic for Kotlin to SwiftUI conversion.
 */

const { 
  generateKotlinToSwiftUIPrompt, 
  generateGeneralTransformPrompt 
} = require('./promptTemplates');
const { isKotlinCode } = require('./fileHandlers');

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

    // Generate appropriate prompt
    const prompt = isKotlin 
      ? generateKotlinToSwiftUIPrompt(code, instructions)
      : generateGeneralTransformPrompt(code, instructions);

    // For now, return mock SwiftUI code demonstrating the transformation
    // In production, this would call the LLM API with the generated prompt
    const transformedCode = isKotlin 
      ? generateMockSwiftUICode(code)
      : generateMockTransformedCode(code);

    return {
      success: true,
      originalCode: code,
      transformedCode: transformedCode,
      language: isKotlin ? 'Kotlin' : 'Unknown',
      targetLanguage: isKotlin ? 'SwiftUI' : 'Transformed',
      prompt: prompt,
      note: 'This is a mock transformation. LLM integration will provide actual transformations.'
    };
  } catch (error) {
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
    const prompt = generateKotlinToSwiftUIPrompt(kotlinCode, instructions);
    
    // Mock SwiftUI transformation
    const transformedCode = generateMockSwiftUICode(kotlinCode);

    return {
      success: true,
      originalCode: kotlinCode,
      transformedCode: transformedCode,
      language: 'Kotlin',
      targetLanguage: 'SwiftUI',
      prompt: prompt,
      transformations: extractKotlinTransformations(kotlinCode),
      note: 'This is a mock transformation. LLM integration will provide actual transformations.'
    };
  } catch (error) {
    throw new Error(`Kotlin to SwiftUI transformation failed: ${error.message}`);
  }
}

/**
 * Generate mock SwiftUI code based on Kotlin patterns
 * 
 * @param {string} kotlinCode - Original Kotlin code
 * @returns {string} Mock SwiftUI code
 */
function generateMockSwiftUICode(kotlinCode) {
  // Detect common Kotlin patterns and generate corresponding SwiftUI
  const hasDataClass = /data\s+class\s+(\w+)/.test(kotlinCode);
  const hasActivity = /class\s+(\w+)\s*:\s*AppCompatActivity/.test(kotlinCode);
  const hasComposable = /@Composable/.test(kotlinCode);

  let swiftCode = `import SwiftUI\n\n`;

  if (hasDataClass) {
    const dataClassMatch = kotlinCode.match(/data\s+class\s+(\w+)\s*\((.*?)\)/);
    if (dataClassMatch) {
      const className = dataClassMatch[1];
      swiftCode += `// Transformed from Kotlin data class\nstruct ${className}: Codable {\n`;
      swiftCode += `    // Properties converted from Kotlin\n`;
      swiftCode += `    // Original Kotlin properties will be mapped here\n`;
      swiftCode += `}\n\n`;
    }
  }

  if (hasActivity || hasComposable) {
    swiftCode += `// Transformed from Kotlin Activity/Composable\nstruct ContentView: View {\n`;
    swiftCode += `    var body: some View {\n`;
    swiftCode += `        VStack {\n`;
    swiftCode += `            Text("Transformed from Kotlin")\n`;
    swiftCode += `                .font(.title)\n`;
    swiftCode += `                .padding()\n`;
    swiftCode += `            \n`;
    swiftCode += `            // UI components will be transformed here\n`;
    swiftCode += `            // Kotlin layouts → SwiftUI declarative views\n`;
    swiftCode += `        }\n`;
    swiftCode += `    }\n`;
    swiftCode += `}\n\n`;
    swiftCode += `#Preview {\n`;
    swiftCode += `    ContentView()\n`;
    swiftCode += `}\n`;
  } else {
    // Generic transformation
    swiftCode += `// Transformed Kotlin code\n`;
    swiftCode += `// Original structure preserved with Swift idioms\n\n`;
    swiftCode += `// Functions, classes, and logic converted to Swift\n`;
    swiftCode += `// Following SwiftUI best practices\n`;
  }

  return swiftCode;
}

/**
 * Generate mock transformed code for non-Kotlin languages
 * 
 * @param {string} code - Original code
 * @returns {string} Mock transformed code
 */
function generateMockTransformedCode(code) {
  return `// Transformed Code\n// Original code structure:\n${code.split('\n').map(line => `// ${line}`).join('\n')}\n\n// Transformed code will appear here after LLM integration\n`;
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

  for (const file of files) {
    try {
      const result = await handleSingleFile(file.content, instructions);
      results.push({
        fileName: file.name,
        ...result
      });
    } catch (error) {
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
  generateMockSwiftUICode,
  extractKotlinTransformations
};
