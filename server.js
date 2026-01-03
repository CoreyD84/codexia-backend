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

const { buildSystemPrompt } = require('./prompt/buildSystemPrompt');
const { buildUserPrompt } = require('./prompt/buildUserPrompt');

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
  // If raw content exists → convert to base64
  if (f.content && !f.code_b64) {
    f.code_b64 = Buffer.from(f.content, "utf8").toString("base64");
  }

  // If only base64 exists → decode to content
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
// ROOT
// ---------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    status: 'running'
  });
});

// ---------------------------------------------------------
// HEALTH & VERSION
// ---------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    engineVersion: ENGINE_VERSION,
    uptimeMs: process.uptime() * 1000,
    timestamp: new Date().toISOString()
  });
});

app.get('/version', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    engineVersion: ENGINE_VERSION,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development'
  });
});

// ---------------------------------------------------------
// MAIN TRANSFORM ENDPOINT (ZIP, GitHub, JSON Multi-File)
// ---------------------------------------------------------
app.post('/transformCode', upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info('Received transformation request');

    // ZIP upload
    if (req.file) {
      const files = await handleZipUpload(req.file);
      const instructions = req.body.instructions || 'Convert to SwiftUI';

      const results = await transformMultipleFiles(files, instructions);

      return res.json({
        success: true,
        filesProcessed: files.length,
        results,
        duration: `${Date.now() - startTime}ms`
      });
    }

    // GitHub URL
    if (req.body.githubUrl) {
      const files = await handleGitHubUrl(req.body.githubUrl);
      const instructions = req.body.instructions || 'Convert to SwiftUI';

      const results = await transformMultipleFiles(files, instructions);

      return res.json({
        success: true,
        filesProcessed: files.length,
        results,
        duration: `${Date.now() - startTime}ms`
      });
    }

    // JSON Multi-File Mode
    const { files, instructions, options: clientOptions } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});

    // Normalize all files (auto Base64 conversion)
    const normalizedFiles = files.map(normalizeFile);

    const result = await transformMultipleFiles(
      normalizedFiles,
      instructions,
      mergedOptions
    );

    return res.json({
      success: result.success,
      filesTransformed: result.filesTransformed,
      sequentialCount: result.sequentialCount,
      parallelCount: result.parallelCount,
      projectContext: result.projectContext,
      results: result.results,
      parallelErrors: result.parallelErrors,
      optionsUsed: mergedOptions,
      duration: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    logger.error(`Transform error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------
// PROJECT ANALYSIS ENDPOINT
// ---------------------------------------------------------
app.post('/analyze', async (req, res) => {
  try {
    const { files, options: clientOptions } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "files" array is required'
      });
    }

    const options = getDefaultTransformOptions(clientOptions || {});

    const normalizedFiles = files.map(normalizeFile);

    const analysis = await analyzeProject(normalizedFiles, options);

    return res.json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error(`Analysis error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ---------------------------------------------------------
// DEBUG ONESHOT ENDPOINT
// ---------------------------------------------------------
app.post('/debugTransformOnce', async (req, res) => {
  try {
    console.log("DEBUG ONESHOT: Body:", JSON.stringify(req.body).slice(0, 800));

    const files = req.body.files || [];
    const instructions = req.body.instructions || "Convert this Kotlin to idiomatic SwiftUI.";

    if (!files.length || !files[0].content) {
      return res.status(400).json({ error: "No file content provided" });
    }

    const combinedSource = files.map(f => f.content).join('\n\n');

    // TODO: replace this with your real non-streaming engine call
    // For now, we just echo back a mocked transform so you can see the path is correct.
    const fakeSwiftUI = `// DEBUG SWIFTUI OUTPUT\n// Path: ${files[0].path || "Unknown"}\n\n// Kotlin length: ${combinedSource.length}\n`;

    console.log("DEBUG ONESHOT: Returning Swift length:", fakeSwiftUI.length);

    return res.json({
      success: true,
      swiftui: fakeSwiftUI,
    });
  } catch (err) {
    console.error("DEBUG ONESHOT ERROR:", err);
    return res.status(500).json({ error: "Internal debug error" });
  }
});

// ---------------------------------------------------------
// STREAMING TRANSFORM ENDPOINT (Single-File SSE)
// ---------------------------------------------------------
app.post('/transformCode/stream', async (req, res) => {
  console.log("DEBUG STREAM: Raw body received:", JSON.stringify(req.body).slice(0, 500));
  try {
    const { files, instructions, options: clientOptions } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "files" array is required'
      });
    }

    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "instructions" must be a string'
      });
    }

    const mergedOptions = getDefaultTransformOptions(clientOptions || {});

    // Normalize the primary file (auto Base64 conversion)
    const primary = normalizeFile(files[0]);

    const fileObjects = [
      {
        path: primary.path,
        language: primary.language,
        content: primary.content
      }
    ];

    const systemPrompt = buildSystemPrompt(mergedOptions);
    const userPrompt = buildUserPrompt(fileObjects, instructions, mergedOptions);
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
      return res.status(500).json({
        success: false,
        error: 'Streaming transformation failed',
        details: error.message
      });
    }
  }
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`Codexia backend is running on port ${PORT}`);
});