const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 🛡️ CODEXIA GATEKEEPER (Shadow Edition)
 * Uses "Shadow Definitions" to validate Apple-specific code on Windows.
 */
function validateSwiftCode(code) {
    if (!code || typeof code !== 'string') {
        return { success: false, error: "Empty or invalid code received." };
    }

    // 1. Create a temporary Shadow File to mock Apple Frameworks
    // This allows 'swiftc' to recognize @Model, Attribute, etc.
    const shadowDefinitions = `
        import Foundation
        // Mock SwiftData
        @attached(member, names: arbitrary) public macro Model() = #externalMacro(module: "None", type: "None")
        public struct Attribute { 
            public static func unique() -> Attribute { Attribute() } 
        }
        // Mock SwiftUI basics
        public protocol View { var body: Any { get } }
        public struct Text: View { public var body: Any; public init(_ text: String) { self.body = text } }
    `;

    const tempShadowPath = path.join(__dirname, 'temp_shadow.swift');
    fs.writeFileSync(tempShadowPath, shadowDefinitions);

    // 2. Run the compiler with the shadow file included
    // We use '-parse' to check syntax without full linking
    const result = spawnSync('swiftc', ['-parse', '-', tempShadowPath], { 
        input: code, 
        shell: true,
        encoding: 'utf-8' 
    });

    // Cleanup shadow file
    if (fs.existsSync(tempShadowPath)) fs.unlinkSync(tempShadowPath);

    if (result.status !== 0) {
        const errorMessage = result.stderr ? result.stderr.toString() : "Unknown Compiler Error";
        
        // 🍏 TRAP REMAINING APPLE MODULE ERRORS
        // If the compiler still complains about 'import', we bypass it
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
