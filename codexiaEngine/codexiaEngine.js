const axios = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------------------
// MODEL ROUTING (still supported, but no localhost dependency)
// ---------------------------------------------------------
function resolveModelFromOptions(options = {}) {
  const modelKey = options.model || 'primary';
  const hint = options.modelHint || 'medium';

  if (modelKey === 'primary') {
    if (hint === 'small') return 'qwen2.5-coder:1.5b';
    if (hint === 'large') return 'qwen2.5-coder:7b';
    return 'qwen2.5-coder:3b';
  }

  if (modelKey === 'qwen') {
    if (hint === 'small') return 'qwen2.5-coder:1.5b';
    if (hint === 'large') return 'qwen2.5-coder:7b';
    return 'qwen2.5-coder:3b';
  }

  if (modelKey === 'local') {
    if (hint === 'small') return 'codexia-local-small';
    if (hint === 'large') return 'codexia-local-large';
    return 'codexia-local-medium';
  }

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
// INTERNAL FALLBACK ENGINE (no localhost required)
// ---------------------------------------------------------
async function runInternalEngine(messages) {
  const combined = messages.map(m => m.content).join("\n\n");

  // Simple deterministic fallback engine
  return `Codexia Internal Engine:\n\n${combined}`;
}

// ---------------------------------------------------------
// NON‑STREAMING VERSION
// ---------------------------------------------------------
async function runCodexiaTransform(messages, options = {}) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL;

  const model = resolveModelFromOptions(options);
  const temperature = options?.temperature ?? 0.2;

  const payload = {
    model,
    messages,
    stream: false,
    options: { temperature }
  };

  // If no external LLM is configured → use internal engine
  if (!baseUrl) {
    logger.info("Using INTERNAL Codexia engine (no LOCAL_LLM_BASE_URL set)");
    return await runInternalEngine(messages);
  }

  logger.info(`Calling LOCAL LLM at ${baseUrl} using model ${model}`);

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
    logger.error(`LOCAL LLM ERROR: ${error.message}`);
    logger.info("Falling back to INTERNAL Codexia engine");
    return await runInternalEngine(messages);
  }
}

// ---------------------------------------------------------
// STREAMING VERSION
// ---------------------------------------------------------
async function runCodexiaTransformStream(messages, options = {}, onToken) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL;

  const model = resolveModelFromOptions(options);
  const temperature = options?.temperature ?? 0.2;

  const payload = {
    model,
    messages,
    stream: true,
    options: { temperature }
  };

  // INTERNAL STREAMING FALLBACK
  if (!baseUrl) {
    logger.info("Streaming using INTERNAL Codexia engine");

    const combined = messages.map(m => m.content).join("\n\n");
    const fakeTokens = (`Codexia Internal Engine:\n\n${combined}`).split(" ");

    for (const t of fakeTokens) {
      await new Promise(r => setTimeout(r, 10));
      onToken(t + " ");
    }

    return;
  }

  logger.info(`Streaming from LOCAL LLM at ${baseUrl} using model ${model}`);

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
    console.log("Falling back to INTERNAL streaming engine");

    const combined = messages.map(m => m.content).join("\n\n");
    const fakeTokens = (`Codexia Internal Engine:\n\n${combined}`).split(" ");

    for (const t of fakeTokens) {
      await new Promise(r => setTimeout(r, 10));
      onToken(t + " ");
    }
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