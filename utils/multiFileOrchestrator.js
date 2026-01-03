// utils/multiFileOrchestrator.js

const { classifyFiles } = require('./fileClassifier');
const { buildProjectContext } = require('./projectContext');
const { buildSystemPrompt } = require('../prompt/buildSystemPrompt');
const { buildUserPrompt } = require('../prompt/buildUserPrompt');
const {
  buildMessages,
  runCodexiaTransform,
  runCodexiaTransformStream
} = require('../codexiaEngine/codexiaEngine');
const { getDefaultTransformOptions } = require('../types/TransformOptions');
const logger = require('./logger') || require('../utils/logger');

/**
 * Transform a single file with full project context.
 */
async function transformSingleFileWithContext(file, projectContext, instructions, options) {
  const systemPrompt = buildSystemPrompt(options, projectContext);
  const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
  const messages = buildMessages(systemPrompt, userPrompt);

  const transformed = await runCodexiaTransform(messages, options);

  return {
    path: file.path,
    language: file.language,
    originalContent: file.content,
    transformedContent: transformed
  };
}

/**
 * Sequential transforms (deep reasoning files).
 */
async function transformSequentialFiles(files, projectContext, instructions, options) {
  const results = [];

  for (const file of files) {
    logger.info(`Transforming SEQUENTIAL file: ${file.path}`);

    const result = await transformSingleFileWithContext(
      file,
      projectContext,
      instructions,
      options
    );

    results.push(result);
  }

  return results;
}

/**
 * Parallel transforms (simple files).
 */
async function transformParallelFiles(files, projectContext, instructions, options) {
  if (!files || files.length === 0) return [];

  logger.info(`Transforming ${files.length} PARALLEL files`);

  const tasks = files.map(file =>
    transformSingleFileWithContext(file, projectContext, instructions, options)
      .then(result => ({ status: 'fulfilled', value: result }))
      .catch(error => ({
        status: 'rejected',
        reason: error,
        path: file.path
      }))
  );

  const settled = await Promise.all(tasks);

  const results = [];
  const errors = [];

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results.push(item.value);
    } else {
      logger.error(
        `Parallel transform failed for ${item.path}: ${item.reason?.message || item.reason}`
      );
      errors.push({
        path: item.path,
        error: item.reason?.message || String(item.reason)
      });
    }
  }

  return { results, errors };
}

/**
 * Main multi-file orchestrator (Hybrid Mode).
 */
async function transformMultipleFiles(rawFiles, instructions, clientOptions = {}) {
  if (!rawFiles || !Array.isArray(rawFiles) || rawFiles.length === 0) {
    throw new Error('transformMultipleFiles: "files" array is required');
  }

  // NEW: use the upgraded options helper (presets + model selection)
  const options = getDefaultTransformOptions(clientOptions || {});

  const files = rawFiles.map(f => ({
    path: f.path || 'UnknownFile.kt',
    language: f.language || 'kotlin',
    content: f.content
  }));

  logger.info(`Multi-file transform requested for ${files.length} files`);

  // Build full project context
  const projectContext = buildProjectContext(files);

  // Hybrid classification
  const { sequential, parallel } = classifyFiles(files);

  logger.info(
    `Hybrid classification: ${sequential.length} sequential, ${parallel.length} parallel`
  );

  // Sequential transforms
  const sequentialResults = await transformSequentialFiles(
    sequential,
    projectContext,
    instructions,
    options
  );

  // Parallel transforms
  const { results: parallelResults, errors: parallelErrors } =
    await transformParallelFiles(
      parallel,
      projectContext,
      instructions,
      options
    );

  const allResults = [...sequentialResults, ...parallelResults];

  return {
    success: parallelErrors.length === 0,
    filesTransformed: allResults.length,
    sequentialCount: sequentialResults.length,
    parallelCount: parallelResults.length,
    projectContext,
    results: allResults,
    parallelErrors
  };
}

/**
 * Multi-file streaming orchestrator.
 */
async function streamMultipleFiles(normalizedFiles, instructions, clientOptions, onToken) {
  if (!normalizedFiles || !Array.isArray(normalizedFiles) || normalizedFiles.length === 0) {
    throw new Error('streamMultipleFiles: "normalizedFiles" array is required');
  }

  // Ensure streaming also benefits from presets + model selection
  const options = getDefaultTransformOptions(clientOptions || {});

  const projectContext = buildProjectContext(normalizedFiles);
  const { sequential, parallel } = classifyFiles(normalizedFiles);

  // STREAM SEQUENTIAL FILES
  for (const file of sequential) {
    const systemPrompt = buildSystemPrompt(options, projectContext);
    const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
    const messages = buildMessages(systemPrompt, userPrompt);

    await runCodexiaTransformStream(messages, options, token => {
      onToken(`FILE:${file.path}::${token}`);
    });

    onToken(`FILE:${file.path}::[END_FILE]`);
  }

  // STREAM PARALLEL FILES
  const parallelTasks = parallel.map(file => {
    return (async () => {
      const systemPrompt = buildSystemPrompt(options, projectContext);
      const userPrompt = buildUserPrompt([file], instructions, options, projectContext);
      const messages = buildMessages(systemPrompt, userPrompt);

      await runCodexiaTransformStream(messages, options, token => {
        onToken(`FILE:${file.path}::${token}`);
      });

      onToken(`FILE:${file.path}::[END_FILE]`);
    })();
  });

  await Promise.all(parallelTasks);

  onToken('[END]');
}

module.exports = {
  transformMultipleFiles,
  streamMultipleFiles
};