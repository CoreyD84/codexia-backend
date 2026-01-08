#!/usr/bin/env node

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const {
  runCodexiaTransform,
  buildMessages
} = require("./codexiaEngine/codexiaEngine.js");

const { buildSystemPrompt } = require("./prompt/buildSystemPrompt.js");

// ---------------------------------------------------------
// PROJECT CONTEXT
// ---------------------------------------------------------
const projectRoot = __dirname;

function buildProjectContext() {
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, fullPath);
      if (entry.isDirectory()) {
        if (["node_modules", "build", "bin"].includes(entry.name)) continue;
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

const projectContext = buildProjectContext();
const systemPrompt = buildSystemPrompt({}, projectContext);

// ---------------------------------------------------------
// SHELL STATE
// ---------------------------------------------------------
let mode = "normal"; // "normal" | "multiline"
let multilineBuffer = [];
let lastMultilinePrompt = null;
let lastMultiFileOutput = null;

// ---------------------------------------------------------
// HELP TEXT
// ---------------------------------------------------------
function printHelp() {
  console.log(`
Codexia Shell Commands:
  :help           Show this help
  :files          List project files (relative to codexia-backend)
  :read <path>    Print a file's contents
  :ml             Enter multiline mode (paste, then type :end)
  :end            Exit multiline mode and send buffer to Codexia
  :xform <path>   Transform a single file via Codexia engine (prints only)
  :xform-all      Transform all SwiftUI-relevant files and write back
  :contract       Apply last multiline contract to Codexia prompt/rule files
  :apply          Re-apply last multi-file Codexia output to disk
  :quit           Exit Codexia Shell
`);
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
        if (["node_modules", "build", "bin"].includes(entry.name)) continue;
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
    console.log(`// ERROR: File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  console.log(`\n// FILE: ${relPath}\n`);
  console.log(content);
  console.log("\n// END OF FILE\n");
}

// ---------------------------------------------------------
// TRANSFORM HELPERS
// ---------------------------------------------------------
async function transformFile(relPath, options = { writeBack: false }) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`// ERROR: File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf8");

  const userPrompt = [
    "TRANSFORM FILE",
    `PATH: ${relPath}`,
    "",
    content
  ].join("\n");

  const messages = buildMessages(systemPrompt, userPrompt);

  console.log(`\n--- Codexia Output (Transform: ${relPath}) ---\n`);
  const output = await runCodexiaTransform(messages, { model: "primary" });
  console.log(output);
  console.log("\n---------------------------------------------\n");

  if (options.writeBack) {
    fs.writeFileSync(fullPath, output, "utf8");
    console.log(`// WROTE: ${relPath}`);
  }
}

// Transform all Swift-relevant files (you can refine this later)
async function transformAll() {
  const targets = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(projectRoot, fullPath);
      if (entry.isDirectory()) {
        if (["node_modules", "build", "bin"].includes(entry.name)) continue;
        walk(fullPath);
      } else {
        if (relPath.endsWith(".swift")) {
          targets.push(relPath);
        }
      }
    }
  }

  walk(projectRoot);

  if (targets.length === 0) {
    console.log("// No .swift files found to transform.");
    return;
  }

  console.log(`// Transforming ${targets.length} Swift files...`);
  for (const relPath of targets) {
    await transformFile(relPath, { writeBack: true });
  }
  console.log("// Completed :xform-all");
}

// ---------------------------------------------------------
// MULTI-FILE OUTPUT PARSING & APPLY
// ---------------------------------------------------------
function parseMultiFileOutput(output) {
  const lines = output.split(/\r?\n/);
  const files = {};
  let currentPath = null;
  let buffer = [];

  const flush = () => {
    if (currentPath !== null) {
      files[currentPath] = buffer.join("\n").trimEnd() + "\n";
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
    } else {
      if (currentPath !== null) {
        buffer.push(line);
      }
    }
  }
  flush();

  return files;
}

function applyFileMap(fileMap) {
  const paths = Object.keys(fileMap);
  if (paths.length === 0) {
    console.log("// No files detected in Codexia output.");
    return;
  }

  for (const relPath of paths) {
    const fullPath = path.join(projectRoot, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, fileMap[relPath], "utf8");
    console.log(`// WROTE: ${relPath}`);
  }
}

// ---------------------------------------------------------
// CONTRACT COMMAND
// ---------------------------------------------------------
async function runContract() {
  if (!lastMultilinePrompt) {
    console.log("// ERROR: No contract found. Use :ml to paste your contract first.");
    return;
  }

  const filesToInclude = [
    "prompt/buildSystemPrompt.js",
    "prompt/buildUserPrompt.js",
    "codexia-rules.json"
  ];

  let bundle = [];
  bundle.push("APPLY CONTRACT TO CODEXIA PROMPT AND RULE FILES.");
  bundle.push("");
  bundle.push("CONTRACT:");
  bundle.push(lastMultilinePrompt);
  bundle.push("");
  bundle.push("CURRENT FILES:");

  for (const relPath of filesToInclude) {
    const fullPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      bundle.push(`// MISSING FILE: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    bundle.push(`=== FILE: ${relPath} ===`);
    bundle.push(content);
    bundle.push("");
  }

  const userPrompt = bundle.join("\n");
  const messages = buildMessages(systemPrompt, userPrompt);

  console.log("\n--- Codexia Output (Contract Rewrite) ---\n");
  const output = await runCodexiaTransform(messages, { model: "primary" });
  console.log(output);
  console.log("\n----------------------------------------\n");

  const fileMap = parseMultiFileOutput(output);
  lastMultiFileOutput = fileMap;

  applyFileMap(fileMap);
}

// ---------------------------------------------------------
// APPLY LAST MULTI-FILE OUTPUT
// ---------------------------------------------------------
function applyLastOutput() {
  if (!lastMultiFileOutput) {
    console.log("// ERROR: No previous multi-file output to apply.");
    return;
  }
  applyFileMap(lastMultiFileOutput);
}

// ---------------------------------------------------------
// SHELL LOOP
// ---------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Codexia> "
});

console.log("Codexia Shell Loaded");
printHelp();
rl.prompt();

rl.on("line", async (line) => {
  const trimmed = line.trim();

  // Multiline mode handling
  if (mode === "multiline") {
    if (trimmed === ":end") {
      const userPrompt = multilineBuffer.join("\n");
      multilineBuffer = [];
      mode = "normal";
      lastMultilinePrompt = userPrompt;

      const messages = buildMessages(systemPrompt, userPrompt);
      console.log("\n--- Codexia Output ---\n");
      const output = await runCodexiaTransform(messages, { model: "primary" });
      console.log(output);
      console.log("\n----------------------\n");
      rl.prompt();
      return;
    } else {
      multilineBuffer.push(line);
      return;
    }
  }

  // Normal mode: commands start with ":"
  if (trimmed.startsWith(":")) {
    const [cmd, ...args] = trimmed.slice(1).split(/\s+/);

    switch (cmd) {
      case "help":
        printHelp();
        break;
      case "files":
        listFiles();
        break;
      case "read":
        if (args.length === 0) {
          console.log("// Usage: :read <relative/path>");
        } else {
          readFile(args.join(" "));
        }
        break;
      case "ml":
        mode = "multiline";
        multilineBuffer = [];
        console.log("// Multiline mode: paste your text, then type :end on its own line.");
        break;
      case "xform":
        if (args.length === 0) {
          console.log("// Usage: :xform <relative/path>");
        } else {
          await transformFile(args.join(" "), { writeBack: false });
        }
        break;
      case "xform-all":
        await transformAll();
        break;
      case "contract":
        await runContract();
        break;
      case "apply":
        applyLastOutput();
        break;
      case "quit":
      case "exit":
        rl.close();
        return;
      default:
        console.log(`// Unknown command: :${cmd}`);
        printHelp();
        break;
    }

    rl.prompt();
    return;
  }

  // Normal single-line prompt → direct Codexia call
  if (trimmed.length === 0) {
    rl.prompt();
    return;
  }

  const userPrompt = trimmed;
  const messages = buildMessages(systemPrompt, userPrompt);

  console.log("\n--- Codexia Output ---\n");
  const output = await runCodexiaTransform(messages, { model: "primary" });
  console.log(output);
  console.log("\n----------------------\n");
  rl.prompt();
});

rl.on("close", () => {
  console.log("Exiting Codexia Shell.");
  process.exit(0);
});