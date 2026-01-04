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

// NEW: Analyzer
const { analyzeProject } = require('./utils/analyzeProject');

const app = express();
const PORT = process.env.PORT || 3000;

const SERVICE_NAME = 'Codexia Backend';
const SERVICE_VERSION = '2.1.1'; // Bumped for validation
const ENGINE_VERSION = 'codexiaEngine-v1-verified';

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
// MAIN TRANSFORM ENDPOINT (The Multi-File Verified Pipeline)
// ---------------------------------------------------------
app.post('/transformCode', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('--- NEW TRANSFORMATION REQUEST RECEIVED ---');

    // 1. Handle Zip File Uploads
    if (req.file) {
      const files = await handleZipUpload(req.file);
      const result = await transformMultipleFiles(files, req.body.instructions || 'Convert to SwiftUI');
      return res.json({ ...result, duration: `${Date.now() - startTime}ms` });
    }

    // 2. Handle GitHub Repo URLs
    if (req.body.githubUrl) {
      const files = await handleGitHubUrl(req.body.githubUrl);
      const result = await transformMultipleFiles(files, req.body.instructions || 'Convert to SwiftUI');
      return res.json({ ...result, duration: `${Date.now() - startTime}ms` });
    }

    // 3. Handle JSON Raw File Array (Your curl command)
    const { files, instructions, options: clientOptions } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});
    const normalizedFiles = files.map(normalizeFile);

    // CALL THE ORCHESTRATOR (This triggers the Fix-Loop and Sanitizer)
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
// STREAMING TRANSFORM ENDPOINT (SSE)
// ---------------------------------------------------------
app.post('/transformCode/stream', async (req, res) => {
  try {
    const { files, instructions, options: clientOptions } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid request: "files" array is required' });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});
    const primary = normalizeFile(files[0]);

    // System prompt for streaming (fast, no validation loop possible here)
    const systemPrompt = `You are Codexia. Convert Kotlin Jetpack Compose to SwiftUI. 
Return ONLY pure Swift code. No markdown fences. No @Composable keywords.`;

    const userPrompt = `Transform this Kotlin code to SwiftUI:\n\n${primary.content}`;
    const messages = buildMessages(systemPrompt, userPrompt);

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
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// ---------------------------------------------------------
// SERVER STARTUP
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 ${SERVICE_NAME} v${SERVICE_VERSION} STARTED`);
  console.log(`🛠️ ENGINE: ${ENGINE_VERSION}`);
  console.log(`📍 PORT: ${PORT}`);
  console.log(`✅ VERIFIED: Sanitizer & Swift Validator Active`);
  console.log('==============================================');
});
