// utils/expertRewrite.js
const fs = require("fs");
const path = require("path");

/**
 * ⭐ Codexia Expert Rewrite Pass
 * Runs AFTER Titan. No model calls.
 * Cleans, harmonizes, and enforces iOS/SwiftUI architecture.
 */

/**
 * Entry point: rewrite an entire project result from Titan.
 * @param {Object} titanResult - { success, projectSummary, files: [{ path, transformedContent }] }
 * @returns {Object} - same shape, but with rewritten content
 */
function runExpertRewrite(titanResult) {
  if (!titanResult || !Array.isArray(titanResult.files)) return titanResult;

  const manifest = titanResult.projectSummary || { mappings: {}, definitions: [], fileExports: {} };

  const rewrittenFiles = titanResult.files.map(file => {
    let content = file.transformedContent || "";

    // 1. Normalize SwiftData + Models
    content = enforceSwiftDataPatterns(content);

    // 2. Enforce MVVM + ViewModel usage
    content = enforceMVVMPatterns(content);

    // 3. Enforce SwiftUI best practices
    content = enforceSwiftUIPatterns(content);

    // 4. Harmonize naming based on manifest
    content = harmonizeNames(content, manifest);

    // 5. Remove obvious anti-patterns / dead code
    content = stripAntiPatterns(content);

    // 6. Final formatting touch-ups
    content = normalizeWhitespace(content);

    return {
      ...file,
      transformedContent: content
    };
  });

  return {
    ...titanResult,
    files: rewrittenFiles
  };
}

/**
 * Enforce SwiftData patterns and modern model conventions.
 */
function enforceSwiftDataPatterns(content) {
  let updated = content;

  // Ensure @Model types are final classes
  updated = updated.replace(
    /@Model\s+class\s+(\w+)/g,
    '@Model\nfinal class $1'
  );

  // Ensure @Model is on its own line if jammed
  updated = updated.replace(/@Model\s+final/g, '@Model\nfinal');

  // Normalize common property patterns
  updated = updated.replace(/\bLong\b/g, "Int64");
  updated = updated.replace(/\bFloat\b/g, "CGFloat");

  return updated;
}

/**
 * Enforce MVVM: discourage logic in Views, encourage ViewModels.
 */
function enforceMVVMPatterns(content) {
  let updated = content;

  // If we see "class SomethingViewModel" without @Observable, add it.
  updated = updated.replace(
    /(^\s*)(final\s+)?class\s+(\w+ViewModel)\b/gm,
    (match, indent, finalKw, name) => {
      const finalPart = finalKw || "";
      return `${indent}@Observable\n${indent}${finalPart}class ${name}`;
    }
  );

  // If we see @Published in ViewModels, prefer plain vars under @Observable
  updated = updated.replace(/@Published\s+var\s+/g, "var ");

  // Discourage direct service usage in Views (soft enforcement via comments)
  if (/struct\s+\w+View\s*:\s*View/.test(updated) && /\.shared\b/.test(updated)) {
    updated = updated.replace(
      /\.shared\b/g,
      ".shared /* TODO: route via ViewModel, not directly from View */"
    );
  }

  return updated;
}

/**
 * Enforce SwiftUI best practices and modern patterns.
 */
function enforceSwiftUIPatterns(content) {
  let updated = content;

  // Prefer NavigationStack over NavigationView
  updated = updated.replace(/\bNavigationView\b/g, "NavigationStack");

  // Encourage Color assets instead of hard-coded colors
  updated = updated.replace(/\bColor\.(red|green|blue|yellow)\b/g, 'Color("Primary")');

  // Remove UIKit imports
  updated = updated.replace(/^import\s+UIKit\s*$/gm, "// import UIKit // Removed by Codexia Expert Rewrite");

  // Remove UIViewController subclasses in SwiftUI contexts
  if (/UIViewController/.test(updated) && /SwiftUI/.test(updated)) {
    updated = updated.replace(/class\s+\w+\s*:\s*UIViewController[\s\S]*?\n\}/g, match => {
      return `// UIKit controller removed by Codexia Expert Rewrite.\n// Consider replacing with a SwiftUI View.\n`;
    });
  }

  return updated;
}

/**
 * Harmonize names based on manifest mappings.
 */
function harmonizeNames(content, manifest) {
  let updated = content;
  const mappings = manifest.mappings || {};

  for (const [ktName, swiftName] of Object.entries(mappings)) {
    const rx = new RegExp(`\\b${ktName}\\b`, "g");
    updated = updated.replace(rx, swiftName);
  }

  return updated;
}

/**
 * Strip obvious anti-patterns and dead code.
 */
function stripAntiPatterns(content) {
  let updated = content;

  // Remove leftover debug prints
  updated = updated.replace(/print\("DEBUG:[^"]*"\)/g, "// debug print removed");

  // Remove TODOs that are clearly LLM chatter
  updated = updated.replace(/\/\/\s*TODO:\s*LLM:[^\n]*/g, "// TODO: refine implementation");

  // Remove commented-out entire files from LLM
  if (/\/\/ BEGIN LLM DUMP/.test(updated)) {
    updated = updated.replace(/\/\/ BEGIN LLM DUMP[\s\S]*?\/\/ END LLM DUMP/g, "");
  }

  return updated;
}

/**
 * Normalize whitespace and basic formatting.
 */
function normalizeWhitespace(content) {
  let updated = content;

  // Trim trailing spaces
  updated = updated.replace(/[ \t]+$/gm, "");

  // Ensure single blank line between top-level declarations
  updated = updated.replace(/\n{3,}/g, "\n\n");

  return updated.trim() + "\n";
}

module.exports = {
  runExpertRewrite
};
