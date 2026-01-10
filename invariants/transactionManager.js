"use strict";

const fs = require("fs");
const path = require("path");

function stageFiles(stagingRoot, fileMap) {
for (const rel in fileMap) {
const full = path.join(stagingRoot, rel);
const dir = path.dirname(full);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(full, fileMap[rel], "utf8");
}
}

function commitStaged(stagingRoot, projectRoot) {
const walk = (dir) => {
for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
const full = path.join(dir, entry.name);
const rel = path.relative(stagingRoot, full);
if (entry.isDirectory()) walk(full);
else {
const dest = path.join(projectRoot, rel);
const ddir = path.dirname(dest);
if (!fs.existsSync(ddir)) fs.mkdirSync(ddir, { recursive: true });
fs.renameSync(full, dest);
}
}
};
walk(stagingRoot);
}

module.exports = {
stageFiles,
commitStaged
};