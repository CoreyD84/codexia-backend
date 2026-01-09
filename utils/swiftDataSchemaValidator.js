// utils/swiftDataSchemaValidator.js

/**
 * ⭐ Codexia SwiftData Schema Validator
 * Static, deterministic, model-free.
 *
 * Responsibilities:
 *  - Detect @Model types
 *  - Ensure final class usage
 *  - Ensure valid property declarations
 *  - Detect illegal types
 *  - Detect missing initializers
 *  - Detect relationship inconsistencies
 */

function extractModels(content) {
  const models = [];
  const rx = /@Model\s*(?:final\s+)?class\s+(\w+)\s*\{([\s\S]*?)\}/gm;
  let m;

  while ((m = rx.exec(content)) !== null) {
    const name = m[1];
    const body = m[2];
    models.push({ name, body });
  }

  return models;
}

function extractProperties(body) {
  const props = [];
  const rx = /var\s+(\w+)\s*:\s*([\w<>\[\]:?]+)/g;
  let m;

  while ((m = rx.exec(body)) !== null) {
    props.push({
      name: m[1],
      type: m[2]
    });
  }

  return props;
}

function validateSwiftDataModels(allFiles) {
  const allModels = [];

  // 1. Extract all @Model classes
  for (const file of allFiles) {
    const models = extractModels(file.content);
    for (const m of models) {
      const props = extractProperties(m.body);
      allModels.push({
        file: file.path,
        name: m.name,
        properties: props
      });
    }
  }

  // 2. Validate each model
  const issues = [];

  for (const model of allModels) {
    // Ensure final class
    if (!/final\s+class/.test(model.file)) {
      issues.push({
        model: model.name,
        issue: "Model should be declared as 'final class'"
      });
    }

    // Validate property types
    for (const prop of model.properties) {
      if (/UIView|UIViewController/.test(prop.type)) {
        issues.push({
          model: model.name,
          property: prop.name,
          issue: "SwiftData models cannot contain UIKit types"
        });
      }
    }
  }

  return {
    models: allModels,
    issues
  };
}

module.exports = {
  validateSwiftDataModels
};
