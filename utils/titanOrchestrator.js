const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { validateSwiftCode } = require('../validator/codexiaValidator');

const ANDROID_SRC = './android_input';
const IOS_OUTPUT = './ios_output';

function getAllFiles(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles)
    } else {
      arrayOfFiles.push(path.resolve(dirPath, file))
    }
  })

  return arrayOfFiles
}

async function runTitanTransformation() {
    console.log("🐘 TITAN ENGINE: Scanning Android Source...");
    
    // 1. Map all files
    const files = getAllFiles(ANDROID_SRC).filter(f => f.endsWith('.kt'));
    
    for (const file of files) {
        console.log(`\nTransforming: ${path.basename(file)}...`);
        
        // 2. Read Kotlin
        const kotlinCode = fs.readFileSync(file, 'utf8');
        
        let swiftCode;
        let validation = { success: false, error: ""};
        let attempts = 0;

        while(!validation.success && attempts < 3) {
            attempts++;
            // 3. AI Conversion
            let prompt = `Transform the following Kotlin code to Swift.`;
            if (attempts > 1) {
                prompt = `You failed validation with this error; fix the code and try again.\n${validation.error}\n\nTransform the following Kotlin code to Swift.`
            }
            const result = await transformCode(kotlinCode, prompt);
            const swiftCode = result.transformedCode;
            
            // 4. Sanitize and Validate
            const sanitizedCode = sanitizeOutput(swiftCode, file);
            validation = validateSwiftCode(sanitizedCode);
            
            if (validation.success) {
                saveToIosProject(file, sanitizedCode);
                console.log(`✅ ${path.basename(file)} Verified & Saved.`);
            } else {
                console.error(`❌ Validation Failed for ${file} (Attempt ${attempts}/3):`, validation.error);
            }
        }
    }
}

function sanitizeOutput(text, filePath) {
    if (!text) return "";

    // 1. Remove ALL markdown blocks immediately
    let clean = text.replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```(swift|kotlin|json|text)?/gi, '').replace(/```/g, '');
    });

    // 2. Locate the "Code Horizon" 
    const swiftKeywords = [
        /\bimport\s+SwiftData\b/,
        /\bimport\s+SwiftUI\b/,
        /\bimport\s+Foundation\b/,
        /\bimport\s+Combine\b/,
        /\b@Model\b/,
        /\bstruct\b/,
        /\bclass\b/,
        /\bprotocol\b/,
        /\bfinal\s+class\b/
    ];

    let firstMatchIndex = -1;
    for (const regex of swiftKeywords) {
        const match = clean.search(regex);
        if (match !== -1 && (firstMatchIndex === -1 || match < firstMatchIndex)) {
            firstMatchIndex = match;
        }
    }

    if (firstMatchIndex !== -1) {
        clean = clean.substring(firstMatchIndex);
    }

    // 3. Final Cleanup: Remove trailing conversational garbage
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1) {
        const tail = clean.substring(lastBrace + 1).trim();
        if (tail.length > 15 && !tail.includes('import') && !tail.includes('func')) {
            clean = clean.substring(0, lastBrace + 1);
        }
    }

    // 4. Hard-strip Kotlin leftovers
    clean = clean.replace(/^package\s+.*;/gm, '');
    clean = clean.replace(/data class/g, 'struct'); 

    if (clean.includes('@Model') && !clean.includes('import SwiftData')) { clean = 'import SwiftData\n' + clean; }
    return clean.trim();
}

function saveToIosProject(originalPath, swiftCode) {
    // Intelligent Folder Mapping: Logic -> Models, Activity -> Views, etc.
    let subFolder = "Models";
    if (originalPath.includes("Activity") || originalPath.includes("Fragment")) subFolder = "Views";
    if (originalPath.includes("Api") || originalPath.includes("Repository")) subFolder = "Networking";

    const fileName = path.basename(originalPath).replace('.kt', '.swift');
    const targetPath = path.join(IOS_OUTPUT, subFolder, fileName); 
    
    if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, swiftCode);
}

runTitanTransformation();
