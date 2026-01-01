/**
 * Codexia Backend Server
 * 
 * Main Express server for code transformation service.
 * Orchestrates multi-format inputs (JSON, zip, GitHub URLs) and
 * integrates with OpenAI for Kotlin→SwiftUI transformations.
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Import utilities
const logger = require('./utils/logger');
const { handleZipUpload, handleGitHubUrl, chunkFiles, MAX_FILE_SIZE } = require('./utils/fileHandlers');
const { handleSingleFile, transformMultipleFiles } = require('./utils/transformers');
const { streamTransformedCode, streamMultipleTransformations } = require('./utils/streamingHelpers');
const { runCodexiaTransform, buildUserPrompt } = require('./openaiClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE // Use constant from fileHandlers.js
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/octet-stream'
    ];
    
    // Also check file extension
    const hasZipExtension = file.originalname && file.originalname.toLowerCase().endsWith('.zip');
    
    if (allowedMimeTypes.includes(file.mimetype) || hasZipExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Codexia Backend',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      'POST /transformCode': 'Transform code (JSON, GitHub URL, or multipart zip)',
      'POST /transformCode/stream': 'Transform code with SSE streaming',
      'GET /health': 'Health check endpoint'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Transform code endpoint - main endpoint with multi-format support
app.post('/transformCode', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Received transformation request');

    // Case 1: Multipart file upload (zip)
    if (req.file) {
      logger.info(`Processing zip file: ${req.file.originalname}`);
      
      try {
        const files = await handleZipUpload(req.file);
        const instructions = req.body.instructions || 'Convert to SwiftUI';
        
        logger.info(`Extracted ${files.length} files from zip`);
        
        const results = await transformMultipleFiles(files, instructions);
        
        const duration = Date.now() - startTime;
        logger.info(`Transformation completed in ${duration}ms`);
        
        return res.json({
          success: true,
          message: 'Zip file processed successfully',
          filesProcessed: files.length,
          results: results,
          duration: `${duration}ms`
        });
      } catch (error) {
        logger.error(`Zip processing error: ${error.message}`);
        return res.status(400).json({
          success: false,
          error: error.message,
          details: 'Failed to process zip file upload'
        });
      }
    }

    // Case 2: GitHub URL
    if (req.body.githubUrl) {
      logger.info(`Processing GitHub URL: ${req.body.githubUrl}`);
      
      try {
        const files = await handleGitHubUrl(req.body.githubUrl);
        const instructions = req.body.instructions || 'Convert to SwiftUI';
        
        logger.info(`Downloaded ${files.length} files from GitHub`);
        
        const results = await transformMultipleFiles(files, instructions);
        
        const duration = Date.now() - startTime;
        logger.info(`Transformation completed in ${duration}ms`);
        
        return res.json({
          success: true,
          message: 'GitHub repository processed successfully',
          filesProcessed: files.length,
          results: results,
          duration: `${duration}ms`
        });
      } catch (error) {
        logger.error(`GitHub processing error: ${error.message}`);
        return res.status(400).json({
          success: false,
          error: error.message,
          details: 'Failed to process GitHub repository'
        });
      }
    }

    // Case 3: Single file JSON (backward compatible)
    const { code, instructions } = req.body;

    // Validation
    if (!code || typeof code !== 'string') {
      logger.warn('Invalid request: missing or invalid code field');
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "code" field is required and must be a string',
        details: 'Please provide code to transform'
      });
    }

    if (!instructions || typeof instructions !== 'string') {
      logger.warn('Invalid request: missing or invalid instructions field');
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "instructions" field is required and must be a string',
        details: 'Please provide transformation instructions'
      });
    }

    logger.info('Processing single file transformation');
    
    try {
      const result = await handleSingleFile(code, instructions);
      
      const duration = Date.now() - startTime;
      logger.info(`Transformation completed in ${duration}ms`);
      
      return res.json({
        success: true,
        message: 'Code transformation completed',
        ...result,
        duration: `${duration}ms`
      });
    } catch (error) {
      logger.error(`Transformation error: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Transformation failed',
        details: error.message
      });
    }
  } catch (error) {
    logger.error(`Unexpected error in /transformCode: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
});

// Transform code with streaming (SSE)
app.post('/transformCode/stream', async (req, res) => {
  try {
    logger.info('Received streaming transformation request');

    const { code, instructions } = req.body;

    // Validation
    if (!code || typeof code !== 'string') {
      logger.warn('Invalid streaming request: missing or invalid code field');
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "code" field is required and must be a string'
      });
    }

    if (!instructions || typeof instructions !== 'string') {
      logger.warn('Invalid streaming request: missing or invalid instructions field');
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "instructions" field is required and must be a string'
      });
    }

    logger.info('Starting streaming transformation');

    // Transform the code
    const result = await handleSingleFile(code, instructions);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Transformation failed',
        details: result.error || 'Unknown error'
      });
    }

    // Stream the transformed code
    await streamTransformedCode(res, result.transformedCode);
    
    logger.info('Streaming transformation completed');
  } catch (error) {
    logger.error(`Streaming error: ${error.message}`, { stack: error.stack });
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Streaming transformation failed',
        details: error.message
      });
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Express error handler: ${error.message}`, { stack: error.stack });
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds maximum allowed size of 10MB',
        details: 'Please upload a smaller file'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      details: error.message
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Codexia backend is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
