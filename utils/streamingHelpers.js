/**
 * Streaming Helpers Utility
 * 
 * Functions for implementing Server-Sent Events (SSE) streaming
 * to provide progressive code transformation output.
 */

/**
 * Setup SSE headers and connection for streaming
 * 
 * @param {Object} res - Express response object
 */
function setupSSEConnection(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable buffering in nginx
  });

  // Send initial connection message
  sendSSEMessage(res, { type: 'connected', message: 'Stream established' });
}

/**
 * Send an SSE message to the client
 * 
 * @param {Object} res - Express response object
 * @param {Object} data - Data to send
 */
function sendSSEMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Send a code chunk via SSE
 * 
 * @param {Object} res - Express response object
 * @param {string} chunk - Code chunk to send
 * @param {number} index - Chunk index
 * @param {number} total - Total number of chunks
 */
function sendCodeChunk(res, chunk, index, total) {
  sendSSEMessage(res, {
    type: 'chunk',
    data: chunk,
    index: index,
    total: total,
    progress: Math.round((index / total) * 100)
  });
}

/**
 * Send completion message via SSE
 * 
 * @param {Object} res - Express response object
 * @param {Object} metadata - Completion metadata
 */
function sendCompletion(res, metadata = {}) {
  sendSSEMessage(res, {
    type: 'complete',
    message: 'Transformation complete',
    ...metadata
  });
}

/**
 * Send error message via SSE
 * 
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 */
function sendError(res, error) {
  sendSSEMessage(res, {
    type: 'error',
    error: error
  });
}

/**
 * Close SSE connection
 * 
 * @param {Object} res - Express response object
 */
function closeSSEConnection(res) {
  res.end();
}

/**
 * Stream transformed code to client
 * 
 * @param {Object} res - Express response object
 * @param {string} transformedCode - The code to stream
 * @param {number} chunkSize - Size of each chunk (default: 100 characters)
 * @returns {Promise<void>}
 */
async function streamTransformedCode(res, transformedCode, chunkSize = 100) {
  try {
    setupSSEConnection(res);

    // Split code into chunks
    const chunks = [];
    for (let i = 0; i < transformedCode.length; i += chunkSize) {
      chunks.push(transformedCode.substring(i, i + chunkSize));
    }

    // Stream each chunk with a small delay to simulate progressive generation
    for (let i = 0; i < chunks.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between chunks
      sendCodeChunk(res, chunks[i], i + 1, chunks.length);
    }

    // Send completion message
    sendCompletion(res, {
      totalChunks: chunks.length,
      totalCharacters: transformedCode.length
    });

    closeSSEConnection(res);
  } catch (error) {
    sendError(res, error.message);
    closeSSEConnection(res);
  }
}

/**
 * Stream multiple file transformations
 * 
 * @param {Object} res - Express response object
 * @param {Array} transformResults - Array of transformation results
 * @returns {Promise<void>}
 */
async function streamMultipleTransformations(res, transformResults) {
  try {
    setupSSEConnection(res);

    for (let i = 0; i < transformResults.length; i++) {
      const result = transformResults[i];

      // Send file start marker
      sendSSEMessage(res, {
        type: 'file_start',
        fileName: result.fileName,
        fileIndex: i + 1,
        totalFiles: transformResults.length
      });

      if (result.success) {
        // Stream the transformed code for this file
        const chunks = [];
        const chunkSize = 100;
        const code = result.transformedCode;

        for (let j = 0; j < code.length; j += chunkSize) {
          chunks.push(code.substring(j, j + chunkSize));
        }

        for (let j = 0; j < chunks.length; j++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          sendCodeChunk(res, chunks[j], j + 1, chunks.length);
        }

        // Send file completion
        sendSSEMessage(res, {
          type: 'file_complete',
          fileName: result.fileName,
          fileIndex: i + 1
        });
      } else {
        // Send file error
        sendSSEMessage(res, {
          type: 'file_error',
          fileName: result.fileName,
          error: result.error
        });
      }
    }

    // Send overall completion
    sendCompletion(res, {
      totalFiles: transformResults.length,
      successCount: transformResults.filter(r => r.success).length
    });

    closeSSEConnection(res);
  } catch (error) {
    sendError(res, error.message);
    closeSSEConnection(res);
  }
}

/**
 * Create a simple progress stream for long-running operations
 * 
 * @param {Object} res - Express response object
 * @param {Function} operation - Async operation to perform
 * @param {Array} progressMessages - Array of progress messages
 * @returns {Promise<any>} Result of the operation
 */
async function streamProgress(res, operation, progressMessages = []) {
  setupSSEConnection(res);

  try {
    // Send progress updates
    for (let i = 0; i < progressMessages.length; i++) {
      sendSSEMessage(res, {
        type: 'progress',
        message: progressMessages[i],
        step: i + 1,
        totalSteps: progressMessages.length
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Perform the operation
    const result = await operation();

    return result;
  } catch (error) {
    sendError(res, error.message);
    closeSSEConnection(res);
    throw error;
  }
}

module.exports = {
  setupSSEConnection,
  sendSSEMessage,
  sendCodeChunk,
  sendCompletion,
  sendError,
  closeSSEConnection,
  streamTransformedCode,
  streamMultipleTransformations,
  streamProgress
};
