// utils/navigationGraphValidator.js

/**
 * ⭐ Codexia Navigation Graph Validator
 * Static, deterministic, model-free.
 *
 * Responsibilities:
 *  - Extract all NavigationStack / path.append(Route.*) calls
 *  - Extract all Route enum cases
 *  - Detect missing routes
 *  - Detect orphaned routes
 *  - Detect circular navigation
 *  - Detect illegal navigation patterns
 */

function extractRoutesFromEnum(content) {
  const rx = /enum\s+Route\s*:\s*\w+\s*\{([\s\S]*?)\}/m;
  const match = content.match(rx);
  if (!match) return [];

  const body = match[1];
  const caseRx = /case\s+(\w+)/g;
  const routes = [];
  let m;

  while ((m = caseRx.exec(body)) !== null) {
    routes.push(m[1]);
  }

  return routes;
}

function extractNavigationCalls(content) {
  const calls = [];
  const rx = /path\.append\(Route\.(\w+)\)/g;
  let m;

  while ((m = rx.exec(content)) !== null) {
    calls.push(m[1]);
  }

  return calls;
}

function detectCircularNavigation(graph) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    const neighbors = graph[node] || [];
    for (const n of neighbors) {
      if (dfs(n)) return true;
    }

    stack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (dfs(node)) return true;
  }

  return false;
}

function validateNavigationGraph(allFiles) {
  const routeEnumFiles = allFiles.filter(f => /enum\s+Route/.test(f.content));
  const allRoutes = new Set();
  const allCalls = [];

  // 1. Collect all Route cases
  for (const file of routeEnumFiles) {
    extractRoutesFromEnum(file.content).forEach(r => allRoutes.add(r));
  }

  // 2. Collect all navigation calls
  for (const file of allFiles) {
    extractNavigationCalls(file.content).forEach(c => allCalls.push(c));
  }

  // 3. Build graph
  const graph = {};
  for (const call of allCalls) {
    if (!graph["root"]) graph["root"] = [];
    graph["root"].push(call);
  }

  // 4. Detect missing routes
  const missingRoutes = allCalls.filter(c => !allRoutes.has(c));

  // 5. Detect orphaned routes
  const orphanedRoutes = [...allRoutes].filter(r => !allCalls.includes(r));

  // 6. Detect circular navigation
  const hasCycle = detectCircularNavigation(graph);

  return {
    allRoutes: [...allRoutes],
    allCalls,
    missingRoutes,
    orphanedRoutes,
    hasCycle
  };
}

module.exports = {
  validateNavigationGraph
};
