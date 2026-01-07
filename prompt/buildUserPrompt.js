// prompt/buildUserPrompt.js

/**
 * User Prompt (Multi-File + Presets + Model Awareness)
 *
 * This version injects:
 * - File-by-file content
 * - Transformation direction
 * - Instructions
 * - Preset awareness
 * - Model behavior awareness
 * - Optional explanation mode
 */

function buildUserPrompt(files, instructions, options = {}, projectContext = null) {
  if (!files || files.length === 0) {
    throw new Error('buildUserPrompt: at least one file is required');
  }

  const direction = options.direction || 'kotlin_to_swiftui';
  const preset = options.preset || 'activity_entrypoint';
  const model = options.model || 'primary';
  const modelHint = options.modelHint || 'medium';
  const allowExplanations = options.allowExplanations === true;
  const libraryHints = options.libraryHints || '';

  const primary = files[0];

  // Build project context block (if provided)
  let contextBlock = '';
  if (projectContext) {
    contextBlock = `
# PROJECT CONTEXT (READ CAREFULLY)
You are transforming ONE file, but you must maintain consistency with the entire project.

## File List
${projectContext.files.map(f => `• ${f.path}`).join('\n')}

## Classes Across Project
${projectContext.classIndex.map(c => `• ${c}`).join('\n')}

## Navigation Calls
${projectContext.navigationGraph.map(n => `• ${n}`).join('\n')}

## ViewModel Usage
${projectContext.viewModelMap.map(v => `• ${v}`).join('\n')}

## Service Bindings
${projectContext.serviceMap.map(s => `• ${s}`).join('\n')}

## Deep Link Handlers
${projectContext.deepLinkMap.map(d => `• ${d}`).join('\n')}

## SharedPreferences Keys
${projectContext.sharedPreferencesKeys.map(k => `• ${k}`).join('\n')}

## Intent Extras
${projectContext.intentExtras.map(e => `• ${e}`).join('\n')}
`;
  }

  let libraryContextBlock = `
# EXTERNAL LIBRARY CONTEXT
${libraryHints || "No custom SDKs detected. Use standard SwiftUI."}
  `;

  // Build summaries of other files (if provided)
  let otherFilesBlock = '';
  if (projectContext) {
    otherFilesBlock = `
# SUMMARIES OF OTHER FILES (DO NOT IGNORE)
These summaries help you maintain cross-file consistency.

${projectContext.files
  .map(f => {
    return `
### FILE: ${f.path}
Classes: ${f.classes.join(', ') || 'None'}
Functions: ${f.functions.join(', ') || 'None'}
State Variables: ${f.stateVariables.join(', ') || 'None'}
Navigation Calls: ${f.navigationCalls.join(', ') || 'None'}
ViewModel Usage: ${f.viewModelUsage.join(', ') || 'None'}
Service Bindings: ${f.serviceBindings.join(', ') || 'None'}
Deep Link Handlers: ${f.deepLinkHandlers.join(', ') || 'None'}
SharedPreferences Keys: ${f.sharedPreferences.join(', ') || 'None'}
Intent Extras: ${f.intentExtras.join(', ') || 'None'}
`;
  })
  .join('\n')}
`;
  }

  // Build file blocks (multi-file safe)
  const fileBlocks = files
    .map(f => {
      return `
# FILE
Path: ${f.path}
Language: ${f.language}

${f.content}
`.trim();
    })
    .join('\n\n====================\n\n');

  return `
# TRANSFORMATION REQUEST
Transform the provided Android/Kotlin file(s) into SwiftUI/iOS code.

# DIRECTION
${direction}

# PRESET
${preset}

# MODEL BEHAVIOR PROFILE
Model key: ${model}
Model hint: ${modelHint}

# INSTRUCTIONS
${instructions}

# EXPLANATION MODE
${allowExplanations ? 'Explanations are allowed.' : 'Do NOT include explanations.'}

${libraryContextBlock}

${contextBlock}

${otherFilesBlock}

# FILES
${fileBlocks}

# FINAL TASK
Transform the file(s) above according to the direction, preset, and instructions.
`.trim();
}

module.exports = {
  buildUserPrompt
};