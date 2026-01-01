/**
 * OpenAI Client Helper
 * 
 * This module provides a clean, reusable wrapper around OpenAI API calls
 * for Codexia code transformations. It handles both streaming and non-streaming
 * requests with proper error handling.
 */

const OpenAI = require('openai');
const { CODEXIA_SYSTEM_PROMPT } = require('./codexiaPrompt');
const logger = require('./utils/logger');

// Initialize OpenAI client
// API key should be provided via OPENAI_API_KEY environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * Run a Codexia code transformation using OpenAI
 * 
 * This function orchestrates the OpenAI API call with the Codexia system prompt
 * and user-provided code/instructions. It supports both streaming and non-streaming modes.
 * 
 * @param {string} userPrompt - The user's instructions and code to transform
 * @param {Object} options - Configuration options
 * @param {boolean} options.stream - Whether to stream the response (default: false)
 * @param {string} options.model - OpenAI model to use (default: gpt-4-turbo-preview)
 * @param {number} options.temperature - Temperature for generation (default: 0.3)
 * @param {number} options.maxTokens - Maximum tokens to generate (default: 4096)
 * @returns {Promise<string|ReadableStream>} The transformed code or a stream
 * @throws {Error} If OpenAI API call fails
 */
async function runCodexiaTransform(userPrompt, options = {}) {
  const {
    stream = false,
    model = 'gpt-4-turbo-preview',
    temperature = 0.3,
    maxTokens = 4096
  } = options;

  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured, returning mock response');
      return generateMockResponse(userPrompt);
    }

    logger.info(`Calling OpenAI API (model: ${model}, stream: ${stream})`);

    const requestParams = {
      model: model,
      messages: [
        {
          role: 'system',
          content: CODEXIA_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
      stream: stream
    };

    if (stream) {
      // Return the stream directly for streaming responses
      const streamResponse = await openai.chat.completions.create(requestParams);
      return streamResponse;
    } else {
      // For non-streaming, collect the full response
      const completion = await openai.chat.completions.create(requestParams);
      
      const transformedCode = completion.choices[0]?.message?.content || '';
      
      logger.info(`OpenAI response received (${transformedCode.length} characters)`);
      
      return transformedCode;
    }
  } catch (error) {
    logger.error(`OpenAI API error: ${error.message}`, { stack: error.stack });
    
    // Provide specific error messages based on error type
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    } else if (error.status === 500) {
      throw new Error('OpenAI API server error. Please try again later.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to OpenAI API. Please check your internet connection.');
    }
    
    throw new Error(`OpenAI transformation failed: ${error.message}`);
  }
}

/**
 * Process an OpenAI stream and collect chunks
 * 
 * @param {ReadableStream} stream - OpenAI stream response
 * @returns {Promise<string>} The complete response text
 */
async function collectStreamResponse(stream) {
  let fullResponse = '';
  
  try {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }
    
    return fullResponse;
  } catch (error) {
    logger.error(`Error collecting stream response: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a mock response for testing without OpenAI API key
 * 
 * @param {string} userPrompt - The user's prompt
 * @returns {string} Mock SwiftUI code
 */
function generateMockResponse(userPrompt) {
  // Check if prompt contains Kotlin patterns
  const hasDataClass = /data\s+class/.test(userPrompt);
  const hasActivity = /AppCompatActivity|Activity/.test(userPrompt);
  const hasComposable = /@Composable/.test(userPrompt);

  let mockCode = 'import SwiftUI\n\n';

  if (hasDataClass) {
    mockCode += `// Transformed from Kotlin data class\nstruct User: Codable, Identifiable {\n`;
    mockCode += `    let id: UUID = UUID()\n`;
    mockCode += `    let name: String\n`;
    mockCode += `    let age: Int\n`;
    mockCode += `}\n\n`;
  }

  if (hasActivity || hasComposable) {
    mockCode += `// Transformed from Kotlin Activity/Composable\nstruct ContentView: View {\n`;
    mockCode += `    @State private var text = "Hello, SwiftUI!"\n`;
    mockCode += `    \n`;
    mockCode += `    var body: some View {\n`;
    mockCode += `        VStack(spacing: 20) {\n`;
    mockCode += `            Text(text)\n`;
    mockCode += `                .font(.title)\n`;
    mockCode += `                .padding()\n`;
    mockCode += `            \n`;
    mockCode += `            Button("Tap Me") {\n`;
    mockCode += `                text = "Button Tapped!"\n`;
    mockCode += `            }\n`;
    mockCode += `            .buttonStyle(.borderedProminent)\n`;
    mockCode += `        }\n`;
    mockCode += `        .padding()\n`;
    mockCode += `    }\n`;
    mockCode += `}\n\n`;
    mockCode += `#Preview {\n`;
    mockCode += `    ContentView()\n`;
    mockCode += `}\n`;
  } else {
    mockCode += `// Mock transformation\n`;
    mockCode += `// Note: OpenAI API key not configured\n`;
    mockCode += `// This is a placeholder response\n\n`;
    mockCode += `struct TransformedView: View {\n`;
    mockCode += `    var body: some View {\n`;
    mockCode += `        Text("Configure OPENAI_API_KEY for actual transformations")\n`;
    mockCode += `            .padding()\n`;
    mockCode += `    }\n`;
    mockCode += `}\n`;
  }

  return mockCode;
}

/**
 * Build a user prompt from code and instructions
 * 
 * @param {string} code - The source code to transform
 * @param {string} instructions - User's transformation instructions
 * @param {Object} metadata - Optional metadata (language, filename, etc.)
 * @returns {string} The formatted user prompt
 */
function buildUserPrompt(code, instructions, metadata = {}) {
  const { language = 'Kotlin', filename = '', fileCount = 1 } = metadata;
  
  let prompt = '';
  
  if (fileCount > 1) {
    prompt += `This is part of a multi-file project (${fileCount} files total).\n\n`;
  }
  
  if (filename) {
    prompt += `File: ${filename}\n\n`;
  }
  
  prompt += `Instructions: ${instructions}\n\n`;
  prompt += `Source Code (${language}):\n\`\`\`\n${code}\n\`\`\`\n\n`;
  prompt += `Please transform the above code to SwiftUI.`;
  
  return prompt;
}

module.exports = {
  runCodexiaTransform,
  collectStreamResponse,
  buildUserPrompt,
  generateMockResponse
};
