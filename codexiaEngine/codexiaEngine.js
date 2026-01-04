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
async function runCodexiaTransformStream(messages, options, onToken) {
  const response = await fetch(`${process.env.LOCAL_LLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LOCAL_LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.LOCAL_LLM_MODEL || resolveModelFromOptions(options),
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });

    // Parse SSE chunks
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.replace("data: ", "").trim();
        if (payload === "[DONE]") return;

        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {}
      }
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