// codexiaEngine.js

const axios = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------------------
// MODEL ROUTING (Option A: model family + size hint)
// ---------------------------------------------------------
function resolveModelFromOptions(options = {}) {
  const modelKey = options.model || 'primary';
  const hint = options.modelHint || 'medium';

  // PRIMARY FAMILY → map to your actual installed Qwen models
  if (modelKey === 'primary') {
    if (hint === 'small') return 'qwen2.5-coder:1.5b';
    if (hint === 'large') return 'qwen2.5-coder:7b';
    return 'qwen2.5-coder:3b'; // your actual installed model
  }

  // QWEN FAMILY (explicit)
  if (modelKey === 'qwen') {
    if (hint === 'small') return 'qwen2.5-coder:1.5b';
    if (hint === 'large') return 'qwen2.5-coder:7b';
    return 'qwen2.5-coder:3b';
  }

  // LOCAL FAMILY (if you add local models later)
  if (modelKey === 'local') {
    if (hint === 'small') return 'codexia-local-small';
    if (hint === 'large') return 'codexia-local-large';
    return 'codexia-local-medium';
  }

  // FALLBACK (never break)
  return process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder:3b';
}

// ---------------------------------------------------------
// Build messages
// ---------------------------------------------------------
function buildMessages(systemPrompt, userPrompt) {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// ---------------------------------------------------------
// NON‑STREAMING VERSION
// ---------------------------------------------------------
async function runCodexiaTransform(messages, options = {}) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434';

  // NEW: model routing
  const model = resolveModelFromOptions(options);

  const temperature = options?.temperature ?? 0.2;

  const payload = {
    model,
    messages,
    stream: false,
    options: { temperature }
  };

  logger.info(`Calling LOCAL LLM: ${model}`);

  try {
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, payload, {
      timeout: 300000
    });

    const text =
      response?.data?.choices?.[0]?.message?.content ||
      response?.data?.choices?.[0]?.text ||
      '';

    return text;
  } catch (error) {
    logger.error(`LOCAL LLM ERROR (RAW): ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------
// STREAMING VERSION
// ---------------------------------------------------------
async function runCodexiaTransformStream(messages, options = {}, onToken) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434';

  // NEW: model routing
  const model = resolveModelFromOptions(options);

  const temperature = options?.temperature ?? 0.2;

  const payload = {
    model,
    messages,
    stream: true,
    options: { temperature }
  };

  logger.info(`Streaming from LOCAL LLM: ${model}`);

  try {
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/v1/chat/completions`,
      data: payload,
      responseType: 'stream',
      timeout: 300000
    });

    response.data.on('data', chunk => {
      try {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const json = JSON.parse(line);
          const token =
            json?.choices?.[0]?.delta?.content ||
            json?.choices?.[0]?.text ||
            '';

          if (token) onToken(token);
        }
      } catch (err) {
        console.error('Streaming parse error:', err.message);
      }
    });

    return new Promise(resolve => {
      response.data.on('end', () => resolve());
    });
  } catch (error) {
    console.error('Streaming LLM error:', error.message);
    throw error;
  }
}

// ---------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------
module.exports = {
  runCodexiaTransform,
  runCodexiaTransformStream,
  buildMessages,
  resolveModelFromOptions
};