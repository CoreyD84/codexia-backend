const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Validates Swift code using the local Windows Swift toolchain.
 * @param {string} generatedCode - The Swift code to validate.
 * @returns {object} { isValid: boolean, error: string | null }
 */
function validateSwiftOnWindows(generatedCode) {
    // 1. Create a unique temp file to avoid collisions during parallel runs
    const tempFileName = `temp_val_${Date.now()}.swift`;
    const tempFilePath = path.join(__dirname, tempFileName);
    
    fs.writeFileSync(tempFilePath, generatedCode, 'utf8');

    try {
        // 2. Use -parse for a quick syntax check. 
        // We use "swiftc" directly because you've added it to your PATH.
        execSync(`swiftc -parse "${tempFilePath}"`, { 
            stdio: 'pipe',
            encoding: 'utf8' // Ensures we get a string back, not a Buffer
        });
        
        return { isValid: true, error: null };
    } catch (err) {
        // 3. Capture the specific compiler error (Line number, reason, etc.)
        const errorOutput = err.stderr ? err.stderr.toString() : err.message;
        
        // Optional: Clean up the file path in the error message so the LLM 
        // doesn't get confused by your local C:\Users\... paths.
        const cleanedError = errorOutput.replace(new RegExp(tempFilePath.replace(/\\/g, '\\\\'), 'g'), 'GeneratedFile.swift');
        
        return { isValid: false, error: cleanedError };
    } finally {
        // 4. Always cleanup the temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

module.exports = { validateSwiftOnWindows };
