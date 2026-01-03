// types/presets.js

const PRESETS = {
  // Your existing default
  activity_entrypoint: {
    direction: 'kotlin_to_swiftui',
    temperature: 0.2,
    modelHint: 'medium'
  },

  compose_to_swiftui: {
    direction: 'compose_to_swiftui',
    temperature: 0.25,
    modelHint: 'medium'
  },

  android_to_swiftui: {
    direction: 'android_to_swiftui',
    temperature: 0.3,
    modelHint: 'medium'
  },

  refactor_kotlin: {
    direction: 'refactor_kotlin',
    temperature: 0.15,
    modelHint: 'small',
    allowExplanations: true
  },

  explain_code: {
    direction: 'explain_code',
    temperature: 0.1,
    modelHint: 'small',
    allowExplanations: true
  }
};

/**
 * Returns preset overrides for a given preset key.
 * If the preset doesn't exist, returns an empty object.
 */
function getPresetOptions(presetKey) {
  if (!presetKey) return {};
  return PRESETS[presetKey] || {};
}

module.exports = {
  PRESETS,
  getPresetOptions
};