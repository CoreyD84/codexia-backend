// utils/fileClassifier.js

/**
 * Hybrid classification:
 * - Name-based signals
 * - Content-based signals
 * - Combined scoring
 */

function classifyFiles(files) {
  const sequential = [];
  const parallel = [];

  for (const file of files) {
    const name = file.path.toLowerCase();
    const content = file.content.toLowerCase();

    let score = 0;

    // ---------------------------------------------------------
    // NAME-BASED SIGNALS
    // ---------------------------------------------------------
    const nameSignals = [
      'activity',
      'viewmodel',
      'service',
      'controller',
      'navigation',
      'deeplink',
      'repository'
    ];

    for (const signal of nameSignals) {
      if (name.includes(signal)) score += 2;
    }

    // ---------------------------------------------------------
    // CONTENT-BASED SIGNALS
    // ---------------------------------------------------------
    const contentSignals = [
      'class ',
      'activity',
      'viewmodel',
      'service',
      'oncreate',
      'onstartcommand',
      'stateflow',
      'livedata',
      'intent',
      'navcontroller',
      'navigation',
      'coroutinescope',
      'suspend fun'
    ];

    for (const signal of contentSignals) {
      if (content.includes(signal)) score += 1;
    }

    // ---------------------------------------------------------
    // CLASSIFICATION THRESHOLD
    // ---------------------------------------------------------
    if (score >= 2) {
      sequential.push(file);
    } else {
      parallel.push(file);
    }
  }

  return { sequential, parallel };
}

module.exports = { classifyFiles };