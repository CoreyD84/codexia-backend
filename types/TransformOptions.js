// types/TransformOptions.js

const { getPresetOptions } = require('./presets');

const DEFAULT_TRANSFORM_OPTIONS = {
  // conceptual direction, used by prompts
  direction: 'kotlin_to_swiftui',

  // preset key (see presets.js)
  preset: 'activity_entrypoint',

  // sampling / output behavior
  temperature: 0.2,
  maxTokens: 2048,

  // high-level size / capability hint (your internal use)
  modelHint: 'medium', // 'small' | 'medium' | 'large'

  // new: logical model selector (you can map this in codexiaEngine)
  // e.g. 'primary', 'qwen', 'gpt', 'local'
  model: 'primary',

  // whether the engine should add explanations alongside code
  allowExplanations: false
};

/**
 * Returns default transform options, merged with:
 * - preset overrides (if preset is provided)
 * - caller overrides (clientOptions)
 */
function getDefaultTransformOptions(clientOptions = {}) {
  // Start from base defaults
  const base = { ...DEFAULT_TRANSFORM_OPTIONS, ...(clientOptions || {}) };

  // Apply preset overrides (if any)
  const presetKey = base.preset || DEFAULT_TRANSFORM_OPTIONS.preset;
  const presetOverrides = getPresetOptions(presetKey);

  return {
    ...DEFAULT_TRANSFORM_OPTIONS,
    ...presetOverrides, // preset influences direction, temperature, etc.
    ...clientOptions     // caller has final say
  };
}

module.exports = {
  DEFAULT_TRANSFORM_OPTIONS,
  getDefaultTransformOptions
};