// utils/projectContext.js

/**
 * Builds a full project context for Codexia.
 * This is injected into every prompt so the model
 * understands the entire project structure.
 */

const { classifyFileRole } = require('./classifyFileRole');

function extractClassNames(content) {
  const regex = /class\s+([A-Za-z0-9_]+)/g;
  const classes = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

function extractFunctions(content) {
  const regex = /(fun|override fun)\s+([A-Za-z0-9_]+)\s*\(/g;
  const functions = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    functions.push(match[2]);
  }
  return functions;
}

function extractStateVariables(content) {
  const regex = /(val|var)\s+([A-Za-z0-9_]+)\s*[:=]/g;
  const vars = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    vars.push(match[2]);
  }
  return vars;
}

function extractNavigationCalls(content) {
  const signals = [
    'startactivity',
    'intent(',
    'navcontroller',
    'navigate(',
    'findnavcontroller'
  ];

  return signals.filter(sig => content.toLowerCase().includes(sig));
}

function extractViewModelUsage(content) {
  const signals = [
    'viewmodel',
    'stateflow',
    'livedata',
    'mutablelivedata',
    'mutablestateflow'
  ];

  return signals.filter(sig => content.toLowerCase().includes(sig));
}

function extractServiceBindings(content) {
  const signals = [
    'bindservice',
    'startservice',
    'stopservice',
    'onstartcommand'
  ];

  return signals.filter(sig => content.toLowerCase().includes(sig));
}

function extractDeepLinkHandlers(content) {
  const signals = [
    'intent?.data',
    'intent.data',
    'getqueryparameter',
    'deeplink'
  ];

  return signals.filter(sig => content.toLowerCase().includes(sig));
}

function extractSharedPreferences(content) {
  const regex = /getsharedpreferences\("([^"]+)"/gi;
  const prefs = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    prefs.push(match[1]);
  }
  return prefs;
}

function extractIntentExtras(content) {
  const regex = /putextra\("([^"]+)"/gi;
  const extras = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    extras.push(match[1]);
  }
  return extras;
}

function summarizeFile(file) {
  const content = file.content;

  return {
    path: file.path,
    language: file.language || 'kotlin',
    role: classifyFileRole(file.path, content),

    classes: extractClassNames(content),
    functions: extractFunctions(content),
    stateVariables: extractStateVariables(content),
    navigationCalls: extractNavigationCalls(content),
    viewModelUsage: extractViewModelUsage(content),
    serviceBindings: extractServiceBindings(content),
    deepLinkHandlers: extractDeepLinkHandlers(content),
    sharedPreferences: extractSharedPreferences(content),
    intentExtras: extractIntentExtras(content)
  };
}

function buildProjectContext(files) {
  const summaries = files.map(f => summarizeFile(f));

  return {
    fileCount: files.length,
    files: summaries,

    classIndex: summaries.flatMap(s => s.classes),
    navigationGraph: summaries.flatMap(s => s.navigationCalls),
    viewModelMap: summaries.flatMap(s => s.viewModelUsage),
    serviceMap: summaries.flatMap(s => s.serviceBindings),
    deepLinkMap: summaries.flatMap(s => s.deepLinkHandlers),
    sharedPreferencesKeys: summaries.flatMap(s => s.sharedPreferences),
    intentExtras: summaries.flatMap(s => s.intentExtras)
  };
}

module.exports = {
  buildProjectContext,
  summarizeFile
};