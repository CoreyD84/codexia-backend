const axios = require('axios');
const logger = require('../utils/logger');

// ---------------------------------------------------------
// MODEL ROUTING
// ---------------------------------------------------------
function resolveModelFromOptions(options = {}) {
  const modelKey = options.model || 'primary';
  const hint = options.modelHint || 'medium';

  if (modelKey === 'primary' || modelKey === 'qwen') {
    return 'deepseek-coder:6.7b';
  }
  return process.env.LOCAL_LLM_MODEL || 'deepseek-coder:6.7b';
}

// ---------------------------------------------------------
// Build messages (Supports Repair History)
// ---------------------------------------------------------
function buildMessages(systemPrompt, userPrompt, previousHistory = []) {
  return [
    { role: 'system', content: systemPrompt },
    ...previousHistory,
    { role: 'user', content: userPrompt }
  ];
}

// ---------------------------------------------------------
// INTERNAL FALLBACK ENGINE
// ---------------------------------------------------------
async function runInternalEngine(messages) {
  const combined = messages.map(m => m.content).join("\n\n");
  return `// Codexia Internal Fallback Engine:\n\n${combined}`;
}

// ---------------------------------------------------------
// NON‑STREAMING VERSION (With Auto-Fix Support)
// ---------------------------------------------------------
async function runCodexiaTransform(messages, options = {}) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL;
  const model = resolveModelFromOptions(options);
  const temperature = options?.temperature ?? 0.1;

  if (!baseUrl) {
    logger.info("Using INTERNAL engine (no LOCAL_LLM_BASE_URL)");
    return await runInternalEngine(messages);
  }

  try {
    console.log('--- Sending request to Local LLM ---');
    console.log('Base URL:', baseUrl);
    console.log('Model:', model);
    console.log('Messages:', JSON.stringify(messages, null, 2));

    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model,
      messages,
      stream: false,
      temperature
    }, { timeout: 300000 });

    console.log('--- Received response from Local LLM ---');
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    if (response && response.data && response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    } else {
      logger.error('Unexpected response format from local LLM:', response.data);
      return '// ERROR: Unexpected response format from local LLM';
    }
  } catch (error) {
    logger.error(`LOCAL LLM ERROR: ${error.message}`);
    return await runInternalEngine(messages);
  }
}

// ---------------------------------------------------------
// STREAMING VERSION (SSE Support)
// ---------------------------------------------------------
async function runCodexiaTransformStream(messages, options, onToken) {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL;
  if (!baseUrl) throw new Error("Streaming requires LOCAL_LLM_BASE_URL");

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LOCAL_LLM_API_KEY || ''}`
    },
    body: JSON.stringify({
      model: resolveModelFromOptions(options),
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.1
    })
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.replace("data: ", "").trim();
        if (payload === "[DONE]") return;

        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch (e) { /* ignore parse errors for partial chunks */ }
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
