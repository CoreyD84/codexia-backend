require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const logger = require('./utils/logger');
const { handleZipUpload, handleGitHubUrl, MAX_FILE_SIZE } = require('./utils/fileHandlers');
const { transformMultipleFiles } = require('./utils/multiFileOrchestrator');
const { getDefaultTransformOptions } = require('./types/TransformOptions');

const {
  runCodexiaTransformStream,
  buildMessages
} = require('./codexiaEngine/codexiaEngine');

// Removed imports for buildSystemPrompt/buildUserPrompt to use inlined versions below

// NEW: Analyzer
const { analyzeProject } = require('./utils/analyzeProject');

const app = express();
const PORT = process.env.PORT || 3000;

const SERVICE_NAME = 'Codexia Backend';
const SERVICE_VERSION = '2.1.0';
const ENGINE_VERSION = 'codexiaEngine-v1';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------
// AUTO‑BASE64 NORMALIZER
// ---------------------------------------------------------
function normalizeFile(f) {
  if (f.content && !f.code_b64) {
    f.code_b64 = Buffer.from(f.content, "utf8").toString("base64");
  }

  if (!f.content && f.code_b64) {
    f.content = Buffer.from(f.code_b64, "base64").toString("utf8");
  }

  if (!f.content) {
    throw new Error(`File "${f.path}" is missing both "content" and "code_b64"`);
  }

  return {
    path: f.path || "UnknownFile.kt",
    language: f.language || "kotlin",
    content: f.content,
    code_b64: f.code_b64
  };
}

// ---------------------------------------------------------
// ROOT, HEALTH & VERSION
// ---------------------------------------------------------
app.get('/', (req, res) => res.json({ service: SERVICE_NAME, version: SERVICE_VERSION, status: 'running' }));
app.get('/health', (req, res) => res.json({ status: 'ok', uptimeMs: process.uptime() * 1000 }));
app.get('/version', (req, res) => res.json({ service: SERVICE_NAME, version: SERVICE_VERSION, nodeVersion: process.version }));

// ---------------------------------------------------------
// MAIN TRANSFORM ENDPOINT
// ---------------------------------------------------------
app.post('/transformCode', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('Received transformation request');

    if (req.file) {
      const files = await handleZipUpload(req.file);
      const results = await transformMultipleFiles(files, req.body.instructions || 'Convert to SwiftUI');
      return res.json({ success: true, filesProcessed: files.length, results, duration: `${Date.now() - startTime}ms` });
    }

    if (req.body.githubUrl) {
      const files = await handleGitHubUrl(req.body.githubUrl);
      const results = await transformMultipleFiles(files, req.body.instructions || 'Convert to SwiftUI');
      return res.json({ success: true, filesProcessed: files.length, results, duration: `${Date.now() - startTime}ms` });
    }

    const { files, instructions, options: clientOptions } = req.body;
    try {
      console.log("DEBUG: Received file length:", files?.[0]?.content?.length);
    } catch (e) {
      console.log("DEBUG: Could not read file length:", e.message);
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});
    const normalizedFiles = files.map(normalizeFile);
    const result = await transformMultipleFiles(normalizedFiles, instructions, mergedOptions);

    return res.json({
      success: result.success,
      filesTransformed: result.filesTransformed,
      results: result.results,
      duration: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    logger.error(`Transform error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------
// PROJECT ANALYSIS
// ---------------------------------------------------------
app.post('/analyze', async (req, res) => {
  try {
    const { files, options: clientOptions } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid request: "files" array is required' });
    }
    const options = getDefaultTransformOptions(clientOptions || {});
    const normalizedFiles = files.map(normalizeFile);
    const analysis = await analyzeProject(normalizedFiles, options);
    return res.json({ success: true, analysis });
  } catch (error) {
    logger.error(`Analysis error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------
// DEBUG ONESHOT ENDPOINT
// ---------------------------------------------------------
app.post('/debugTransformOnce', async (req, res) => {
  try {
    console.log("DEBUG ONESHOT: Body:", JSON.stringify(req.body).slice(0, 800));
    const files = req.body.files || [];
    if (!files.length || !files[0].content) return res.status(400).json({ error: "No file content provided" });
    const combinedSource = files.map(f => f.content).join('\n\n');
    const fakeSwiftUI = `// DEBUG SWIFTUI OUTPUT\n// Path: ${files[0].path || "Unknown"}\n\n// Kotlin length: ${combinedSource.length}\n`;
    console.log("DEBUG ONESHOT: Returning Swift length:", fakeSwiftUI.length);
    return res.json({ success: true, swiftui: fakeSwiftUI });
  } catch (err) {
    console.error("DEBUG ONESHOT ERROR:", err);
    return res.status(500).json({ error: "Internal debug error" });
  }
});

// ---------------------------------------------------------
// STREAMING TRANSFORM ENDPOINT (SSE)
// ---------------------------------------------------------
app.post('/transformCode/stream', async (req, res) => {
  console.log("DEBUG STREAM: Raw body received:", JSON.stringify(req.body).slice(0, 500));
  try {
    const { files, instructions, options: clientOptions } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid request: "files" array is required' });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});
    const primary = normalizeFile(files[0]);

    // --- CODEXIA PROMPT LOGIC ---
    const systemPrompt = `You are Codexia, an expert code transformation engine.
Your job is to convert Android Jetpack Compose Kotlin UI code into idiomatic SwiftUI code.
Return ONLY Swift code. No explanations. No markdown. No commentary.
If the input is empty or unclear, ask for clarification.`;

    const userPrompt = `Convert the following Kotlin Jetpack Compose code into SwiftUI.
Return ONLY Swift code.

Kotlin:
${primary.content}`;

    const messages = buildMessages(systemPrompt, userPrompt);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await runCodexiaTransformStream(messages, mergedOptions, token => {
      res.write(`data: ${token}\n\n`);
    });

    res.write('data: [END]\n\n');
    res.end();

  } catch (error) {
    console.error('Streaming error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Streaming transformation failed', details: error.message });
    }
  }
});

app.listen(PORT, () => {
  logger.info(`Codexia backend is running on port ${PORT}`);
});