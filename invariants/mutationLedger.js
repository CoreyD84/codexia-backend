"use strict";

const fs = require("fs");
const path = require("path");

const LEDGER_PATH = path.join(process.cwd(), ".codexia-ledger.jsonl");

function record(entry) {
fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + "\n");
}

module.exports = { record };