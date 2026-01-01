/**
 * File Handlers Utility
 * 
 * Functions for handling zip file uploads, GitHub repository downloads,
 * file extraction, and chunking for LLM processing.
 */

const AdmZip = require('adm-zip');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// Maximum file size for processing (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum chunk size for LLM context (5000 characters)
const MAX_CHUNK_SIZE = 5000;

// Supported file extensions for code transformation
const SUPPORTED_EXTENSIONS = ['.kt', '.java', '.swift', '.js', '.ts', '.py', '.go', '.xml'];

/**
 * Extract and process files from a zip upload
 * 
 * @param {Object} file - Multer file object
 * @returns {Promise<Array>} Array of file objects with { name, content, extension }
 * @throws {Error} If zip extraction fails or files are invalid
 */
async function handleZipUpload(file) {
  try {
    if (!file || !file.buffer) {
      throw new Error('No file provided or file is empty');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Extract zip contents
    const zip = new AdmZip(file.buffer);
    const zipEntries = zip.getEntries();

    const extractedFiles = [];

    for (const entry of zipEntries) {
      // Skip directories and hidden files
      if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('/.')) {
        continue;
      }

      const ext = path.extname(entry.entryName).toLowerCase();
      
      // Only process supported file types
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        continue;
      }

      const content = entry.getData().toString('utf8');
      
      // Skip empty files
      if (!content.trim()) {
        continue;
      }

      extractedFiles.push({
        name: entry.entryName,
        content: content,
        extension: ext,
        size: content.length
      });
    }

    if (extractedFiles.length === 0) {
      throw new Error('No supported code files found in zip archive');
    }

    return extractedFiles;
  } catch (error) {
    if (error.message.includes('Invalid or unsupported zip format')) {
      throw new Error('Invalid zip file format');
    }
    throw error;
  }
}

/**
 * Download and process files from a GitHub repository URL
 * 
 * @param {string} repoUrl - GitHub repository URL
 * @returns {Promise<Array>} Array of file objects with { name, content, extension }
 * @throws {Error} If download fails or URL is invalid
 */
async function handleGitHubUrl(repoUrl) {
  try {
    // Parse GitHub URL to extract owner and repo
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(urlPattern);

    if (!match) {
      throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repo');
    }

    const [, owner, repoName] = match;
    const cleanRepoName = repoName.replace(/\.git$/, '');

    // Use GitHub API to get repository contents
    const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepoName}/zipball`;

    // Download repository as zip
    const response = await axios({
      method: 'GET',
      url: apiUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Codexia-Backend',
        'Accept': 'application/vnd.github+json'
      },
      maxContentLength: MAX_FILE_SIZE,
      timeout: 30000 // 30 second timeout
    });

    // Process the downloaded zip
    const zip = new AdmZip(Buffer.from(response.data));
    const zipEntries = zip.getEntries();

    const extractedFiles = [];

    for (const entry of zipEntries) {
      // Skip directories and hidden files
      if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('/.')) {
        continue;
      }

      const ext = path.extname(entry.entryName).toLowerCase();
      
      // Only process supported file types
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        continue;
      }

      const content = entry.getData().toString('utf8');
      
      // Skip empty files
      if (!content.trim()) {
        continue;
      }

      extractedFiles.push({
        name: entry.entryName,
        content: content,
        extension: ext,
        size: content.length
      });
    }

    if (extractedFiles.length === 0) {
      throw new Error('No supported code files found in GitHub repository');
    }

    return extractedFiles;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error('GitHub repository not found or is private');
      }
      if (error.response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please try again later');
      }
      throw new Error(`Failed to download repository: ${error.response.statusText}`);
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout: GitHub repository took too long to download');
    }
    if (error.code === 'ENOTFOUND') {
      throw new Error('Network error: Could not connect to GitHub');
    }
    throw error;
  }
}

/**
 * Chunk large files for LLM processing
 * 
 * @param {Array} files - Array of file objects
 * @returns {Array} Array of chunked file objects
 */
function chunkFiles(files) {
  const chunkedFiles = [];

  for (const file of files) {
    if (file.content.length <= MAX_CHUNK_SIZE) {
      chunkedFiles.push(file);
    } else {
      // Split large files into chunks
      const numChunks = Math.ceil(file.content.length / MAX_CHUNK_SIZE);
      
      for (let i = 0; i < numChunks; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min((i + 1) * MAX_CHUNK_SIZE, file.content.length);
        const chunkContent = file.content.substring(start, end);

        chunkedFiles.push({
          name: `${file.name} (chunk ${i + 1}/${numChunks})`,
          content: chunkContent,
          extension: file.extension,
          size: chunkContent.length,
          isChunk: true,
          chunkIndex: i,
          totalChunks: numChunks,
          originalFile: file.name
        });
      }
    }
  }

  return chunkedFiles;
}

/**
 * Validate file type for code transformation
 * 
 * @param {string} filename - File name to validate
 * @returns {boolean} True if file type is supported
 */
function isSupportedFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Detect if code is Kotlin based on syntax patterns
 * 
 * @param {string} code - Source code to analyze
 * @returns {boolean} True if code appears to be Kotlin
 */
function isKotlinCode(code) {
  const kotlinPatterns = [
    /\bdata\s+class\b/,
    /\bfun\s+\w+/,
    /\bval\b|\bvar\b/,
    /\bwhen\s*\{/,
    /::class/,
    /@Composable/,
    /suspend\s+fun/,
    /companion\s+object/
  ];

  let matches = 0;
  for (const pattern of kotlinPatterns) {
    if (pattern.test(code)) {
      matches++;
    }
  }

  // If at least 2 Kotlin patterns are found, consider it Kotlin code
  return matches >= 2;
}

module.exports = {
  handleZipUpload,
  handleGitHubUrl,
  chunkFiles,
  isSupportedFileType,
  isKotlinCode,
  MAX_FILE_SIZE,
  MAX_CHUNK_SIZE,
  SUPPORTED_EXTENSIONS
};
