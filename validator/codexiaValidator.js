// validator/codexiaValidator.js
const { spawnSync } = require('child_process');

function validateSwiftCode(code) {
    // Attempt to parse using the Swift compiler's frontend
    const result = spawnSync('swiftc', ['-parse', '-'], { input: code });

    if (result.status !== 0) {
        const errorMessage = result.stderr.toString();
        return {
            isValid: false,
            errorContext: errorMessage, // This is what you feed back to Codexia
            suggestion: analyzeError(errorMessage)
        };
    }
    return { isValid: true };
}

function analyzeError(error) {
    if (error.includes("cannot find 'Modifier' in scope")) {
        return "CRITICAL: You left 'Modifier' syntax in the Swift output. Re-convert using .frame() or .padding().";
    }
    return error;
}
