"use strict";

const crypto = require("crypto");

const IMMUTABLE_RULES = Object.freeze({
PATCH_FORMAT_HEADER: /^=== FILE:\s+.+?\s+===/m,
NO_FALLBACK: true,
FULL_REWRITE_ONLY: true,
PRECOMMIT_VALIDATION_REQUIRED: true
});

function assertPatchFormat(output) {
if (!IMMUTABLE_RULES.PATCH_FORMAT_HEADER.test(output)) {
throw new Error("Invariant violation: invalid patch format");
}
}

function hashContent(content) {
return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

module.exports = {
IMMUTABLE_RULES,
assertPatchFormat,
hashContent
}