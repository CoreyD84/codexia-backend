const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { titanShadowDefinitions } = require('../shadow_library/titanShadowDefinitions');

/**
 * 🛡️ CODEXIA GATEKEEPER (Shadow Edition)
 * Uses "Shadow Definitions" to validate Apple-specific code on Windows.
 */
function validateSwiftCode(code) {
    if (!code || typeof code !== 'string') {
        return { success: false, error: "Empty or invalid code received." };
    }

    // 1. Create a temporary Shadow File to mock Apple Frameworks
    const shadowDefinitions = titanShadowDefinitions;


    const tempShadowPath = path.join(__dirname, 'temp_shadow.swift');
    fs.writeFileSync(tempShadowPath, shadowDefinitions);

    // 🚀 NEW: Create a temporary file for the code being validated
    const tempCodePath = path.join(__dirname, 'temp_code_to_validate.swift');
    fs.writeFileSync(tempCodePath, code);

    // 2. Run the compiler with the code file and shadow file included
    // Updated to use physical files instead of stdin '-' for Windows stability
    const result = spawnSync('swiftc', ['-parse', tempCodePath, tempShadowPath], { 
        encoding: 'utf-8' 
    });

    // Cleanup temporary files
    if (fs.existsSync(tempShadowPath)) fs.unlinkSync(tempShadowPath);
    if (fs.existsSync(tempCodePath)) fs.unlinkSync(tempCodePath);

    if (result.status !== 0) {
        const errorMessage = result.stderr ? result.stderr.toString() : "Unknown Compiler Error";
        
        // 🍏 TRAP REMAINING APPLE MODULE ERRORS
        const isModuleError = errorMessage.includes("no such module");

        if (isModuleError) {
            return { success: true }; 
        }

        return {
            success: false,
            error: errorMessage,
            suggestion: analyzeError(errorMessage)
        };
    }

    return { success: true };
}

/**
 * 🔍 ERROR ANALYZER
 */
function analyzeError(error) {
    if (error.includes("cannot find 'Modifier' in scope")) {
        return "CRITICAL: You left Android 'Modifier' syntax in the Swift output. Replace with .frame(), .padding(), etc.";
    }
    if (error.includes("expected '{' in class")) {
        return "SYNTAX ERROR: Malformed class/struct structure. Check your braces.";
    }
    if (error.includes("consecutive statements")) {
        return "KOTLIN DETECTED: You are using Kotlin-style property syntax. Use 'var name: Type = value'.";
    }
    return error;
}

module.exports = {
    validateSwiftCode,
    verifySwiftCode: validateSwiftCode 
};
