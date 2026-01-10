#!/usr/bin/env node
/**
 * CODEXIA GEMINI-STYLE SHELL
 * - Default behavior: single prompt -> single response (NO repo-wide actions)
 * - Explicit commands for file transforms and patch-apply
 * - Optional context toggle (fast vs smart)
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const { runCodexiaTransform, buildMessages } = require("./codexiaEngine/codexiaEngine.js");
const { buildSystemPrompt, buildCodexiaSelfModificationPrompt } = require("./prompt/buildSystemPrompt.js");

// ---------------------------------------------------------
// ROOT + IGNORE
// ---------------------------------------------------------
const projectRoot = process.cwd();
const IGNORE_DIRS = new Set(["node_modules", "build", "bin", ".git"]);

// ---------------------------------------------------------
// PROJECT CONTEXT (OPTIONAL)
// ---------------------------------------------------------
function buildProjectContext() {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, fullPath);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else {
        files.push({ path: relPath });
      }
    }
  }
  walk(projectRoot);

  return {
    files,
    classIndex: [],
    navigationGraph: [],
    viewModelMap: [],
    serviceMap: []
  };
}

let contextEnabled = false; // Gemini-style: OFF by default (faster, no full scan)

// Build prompts on demand so toggling context works immediately
function getSystemPrompt({ selfModify = false } = {}) {
  if (selfModify) return buildCodexiaSelfModificationPrompt();
  if (!contextEnabled) return buildSystemPrompt({}, null);
  const projectContext = buildProjectContext();
  return buildSystemPrompt({}, projectContext);
}

// ---------------------------------------------------------
// MULTI-FILE PATCH PARSER/APPLIER
// ---------------------------------------------------------
function parseMultiFileOutput(output) {
  const lines = output.split(/\r?\n/);
  const files = {};
  let currentPath = null;
  let buffer = [];

  const flush = () => {
    if (currentPath !== null) {
      files[currentPath] = buffer.join("\n").replace(/\s+$/g, "") + "\n";
    }
    currentPath = null;
    buffer = [];
  };

  const fileHeaderRegex = /^=== FILE:\s*(.+?)\s*===\s*$/;

  for (const line of lines) {
    const match = line.match(fileHeaderRegex);
    if (match) {
      flush();
      currentPath = match[1].trim();
    } else if (currentPath !== null) {
      buffer.push(line);
    }
  }
  flush();

  return files;
}

function applyFileMap(fileMap) {
  const relPaths = Object.keys(fileMap);
  if (relPaths.length === 0) {
    console.log("// ❌ No patch blocks detected. Nothing applied.");
    return;
  }

  for (const relPath of relPaths) {
    const fullPath = path.join(projectRoot, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, fileMap[relPath], "utf8");
    console.log(`// ✅ WROTE: ${relPath}`);
  }
}

// ---------------------------------------------------------
// FILE HELPERS
// ---------------------------------------------------------
function listFiles() {
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, fullPath);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        console.log(`[DIR]  ${relPath}`);
        walk(fullPath);
      } else {
        console.log(`       ${relPath}`);
      }
    }
  }
  walk(projectRoot);
}

function readFile(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`// ❌ File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  console.log(`\n// FILE: ${relPath}\n`);
  console.log(content);
  console.log("\n// END OF FILE\n");
}

// ---------------------------------------------------------
// GEMINI-STYLE ACTIONS
// ---------------------------------------------------------
async function askLLM(prompt, { selfModify = false } = {}) {
  const systemPrompt = getSystemPrompt({ selfModify });
  const messages = buildMessages(systemPrompt, prompt);
  return await runCodexiaTransform(messages, { model: "primary" });
}

/**
 * Transform a single file (read -> prompt -> print). Optional write-back.
 */
async function xformFile(relPath, { writeBack = false } = {}) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`// ❌ File not found: ${relPath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const userPrompt = [
    "TRANSFORM THIS FILE ONLY.",
    `PATH: ${relPath}`,
    "",
    content
  ].join("\n");

  const out = await askLLM(userPrompt);

  console.log(`\n--- Codexia Output (xform: ${relPath}) ---\n`);
  console.log(out);
  console.log("\n-----------------------------------------\n");

  if (writeBack) {
    fs.writeFileSync(fullPath, out, "utf8");
    console.log(`// ✅ WROTE: ${relPath}`);
  }
}

/**
 * Apply a STRICT PATCH (multi-file) to disk.
 * This is the Gemini-style “here’s a patch, apply it” workflow.
 */
async function patchApply(intent, allowedFiles) {
  const bundle = [];
  bundle.push("YOU ARE A DETERMINISTIC CODE PATCH ENGINE.");
  bundle.push("ABSOLUTE RULES:");
  bundle.push("- OUTPUT MUST CONTAIN ONLY FILE PATCH BLOCKS.");
  bundle.push("- NO EXPLANATIONS. NO MARKDOWN. NO CHAT.");
  bundle.push("- FULL FILE REWRITES ONLY.");
  bundle.push("- ONLY MODIFY FILES PROVIDED BELOW.");
  bundle.push("- FORMAT:");
  bundle.push("=== FILE: relative/path ===");
  bundle.push("<full file content>");
  bundle.push("");
  bundle.push("INTENT:");
  bundle.push(intent);
  bundle.push("");
  bundle.push("=== FILES YOU ARE ALLOWED TO MODIFY ===");
  bundle.push("");

  for (const relPath of allowedFiles) {
    const fullPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      bundle.push(`=== FILE: ${relPath} ===`);
      bundle.push(`// MISSING: ${relPath}`);
      bundle.push("");
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    bundle.push(`=== FILE: ${relPath} ===`);
    bundle.push(content);
    bundle.push("");
  }

  bundle.push("=== END OF FILE SET ===");

  const out = await askLLM(bundle.join("\n"), { selfModify: true });

  if (!out || !out.includes("=== FILE:")) {
    console.log("// ❌ Invalid patch output (no file blocks). Nothing applied.");
    console.log("\n--- Raw Output ---\n");
    console.log(out || "");
    console.log("\n------------------\n");
    return;
  }

  const fileMap = parseMultiFileOutput(out);
  applyFileMap(fileMap);
}

// ---------------------------------------------------------
// HELP
// ---------------------------------------------------------
function printHelp() {
  console.log(`
Codexia (Gemini-style) Commands:

  :help                 Show help
  :context on|off        Toggle project context scan (default: off)

  :files                List files
  :read <path>           Print a file

  :xform <path>          Transform ONE file (prints output)
  :xformw <path>         Transform ONE file and write back

  :patch <intent> --files a,b,c
                        Run self-modifying STRICT PATCH mode on only those files
                        Example:
                        :patch "fix parse bug" --files utils/multiFileOrchestrator.js,validator/codexiaValidator.js

  :quit / :exit          Exit

Gemini-style behavior:
- Any line that does NOT start with ":" is sent as a single prompt to the model.
- Nothing is written to disk unless you use :xformw or :patch.
`);
}

// ---------------------------------------------------------
// SHELL LOOP
// ---------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Codexia> "
});

console.log("Codexia Gemini-style Shell Loaded");
printHelp();
rl.prompt();

rl.on("line", async (line) => {
  const trimmed = line.trim();

  try {
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.startsWith(":")) {
      const rest = trimmed.slice(1);
      const [cmd, ...parts] = rest.split(" ");
      const args = parts.join(" ").trim();

      if (cmd === "help") {
        printHelp();
        rl.prompt();
        return;
      }

      if (cmd === "context") {
        const v = (args || "").toLowerCase();
        if (v === "on") contextEnabled = true;
        else if (v === "off") contextEnabled = false;
        else console.log("// Usage: :context on|off");
        console.log(`// context = ${contextEnabled ? "ON" : "OFF"}`);
        rl.prompt();
        return;
      }

      if (cmd === "files") {
        listFiles();
        rl.prompt();
        return;
      }

      if (cmd === "read") {
        if (!args) console.log("// Usage: :read <relative/path>");
        else readFile(args);
        rl.prompt();
        return;
      }

      if (cmd === "xform" || cmd === "xformw") {
        if (!args) console.log(`// Usage: :${cmd} <relative/path>`);
        else await xformFile(args, { writeBack: cmd === "xformw" });
        rl.prompt();
        return;
      }

      if (cmd === "patch") {
        // Parse: :patch "<intent>" --files a,b,c
        const filesFlag = args.match(/--files\s+(.+)$/);
        if (!filesFlag) {
          console.log("// Usage: :patch \"<intent>\" --files a,b,c");
          rl.prompt();
          return;
        }
        const filesCsv = filesFlag[1].trim();
        const intent = args.replace(filesFlag[0], "").trim().replace(/^"(.*)"$/, "$1");
        const allowedFiles = filesCsv.split(",").map(s => s.trim()).filter(Boolean);

        if (!intent) {
          console.log("// Missing intent. Example: :patch \"fix bug\" --files utils/multiFileOrchestrator.js");
          rl.prompt();
          return;
        }
        if (allowedFiles.length === 0) {
          console.log("// Missing files list. Example: --files utils/multiFileOrchestrator.js");
          rl.prompt();
          return;
        }

        await patchApply(intent, allowedFiles);
        rl.prompt();
        return;
      }

      if (cmd === "quit" || cmd === "exit") {
        rl.close();
        return;
      }

      console.log(`// Unknown command: :${cmd}`);
      printHelp();
      rl.prompt();
      return;
    }

    // Gemini-style: send the single prompt, do not write to disk
    const out = await askLLM(trimmed);
    console.log("\n--- Codexia Output ---\n");
    console.log(out);
    console.log("\n----------------------\n");
  } catch (err) {
    console.error("❌ Error:", err && err.stack ? err.stack : err);
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("Exiting Codexia Shell.");
  process.exit(0);
});
