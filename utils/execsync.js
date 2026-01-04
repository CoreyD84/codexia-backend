const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Validates Swift code using the local Windows Swift toolchain.
 * @param {string} generatedCode - The Swift code to validate (Sanitized).
 * @returns {object} { isValid: boolean, error: string | null }
 */
function validateSwiftOnWindows(generatedCode) {
    // 1. Create a unique temp file to avoid collisions during parallel runs
    const tempFileName = `temp_val_${Date.now()}_${Math.floor(Math.random() * 1000)}.swift`;
    const tempFilePath = path.join(__dirname, tempFileName);
    
    try {
        fs.writeFileSync(tempFilePath, generatedCode, 'utf8');

        // 2. Use -parse for a quick syntax check. 
        // We use "swiftc" directly because it is in your Windows PATH.
        execSync(`swiftc -parse "${tempFilePath}"`, { 
            stdio: 'pipe',
            encoding: 'utf8' 
        });
        
        return { isValid: true, error: null };
    } catch (err) {
        // 3. Capture the specific compiler error (Line number, reason, etc.)
        const errorOutput = err.stderr ? err.stderr.toString() : err.message;
        
        // Clean up the local Windows file path in the error message so the LLM 
        // stays focused on the code, not your C:\Users\... directory structure.
        const cleanedError = errorOutput.replace(
            new RegExp(tempFilePath.replace(/\\/g, '\\\\'), 'g'), 
            'GeneratedFile.swift'
        );
        
        return { isValid: false, error: cleanedError };
    } finally {
        // 4. Always cleanup the temp file. 
        // Wrapped in try/catch to handle Windows file-locking edge cases.
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        } catch (cleanupError) {
            // Log cleanup issues but don't crash the transformation process
            console.error(`Warning: Temp file cleanup failed for ${tempFileName}:`, cleanupError.message);
        }
    }
}

module.exports = { validateSwiftOnWindows };
