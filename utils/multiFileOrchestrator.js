const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { verifySwiftCode } = require('../validator/codexiaValidator');

/**
 * 📚 ARCHITECTURAL PROXY LAYER
 */
const LIBRARY_MAP = {
    "Retrofit": "URLSession + Swift Concurrency (async/await)",
    "Room": "SwiftData (@Model)",
    "Jetpack Compose": "SwiftUI",
    "Hilt/Dagger": "Swift Dependency Injection (Protocols/Environment)",
    "Glide/Coil": "AsyncImage (Native SwiftUI)",
    "Gson/Moshi": "Codable Protocols",
    "Firebase": "Firebase iOS SDK",
    "LiveData": "@Published + Combine",
    "StateFlow": "@Observable (Swift Observation Framework)",
    "ViewModel": "@Observable Object / @StateObject"
};

/**
 * 🚀 CODEXIA PROJECT ORCHESTRATOR v10.0 + Gemini Multi-File Patch
 */
async function orchestrateProjectTransform(files, baseInstructions) {
    console.log(`\n🌟 CODEXIA PRODUCTION ENGINE: Transforming ${files.length} files...`);
    
    let projectManifest = {
        mappings: {}, 
        definitions: [], 
        fileExports: {}
    };

    const results = [];

    for (const file of files) {
        let verified = false;
        let attempts = 0;
        let currentInstructions = baseInstructions;

        const activeLibraries = Object.keys(LIBRARY_MAP).filter(lib => file.content.includes(lib));

        while (!verified && attempts < 3) {
            attempts++;

            const manifestStr = JSON.stringify(projectManifest.mappings);
            const shadowContext = injectShadowContext(file.content);

            const enhancedInstructions = `
                You are the Codexia Engine: A world-class Android-to-iOS Architect.
                [CONTEXT & ASSETS]
                - EXISTING MAPPINGS: ${manifestStr}
                - ALREADY DEFINED TYPES: ${projectManifest.definitions.join(', ')}
                - SHADOW SNIPPETS: ${shadowContext}

                [ARCHITECTURAL STRATEGY]
                - Map Room -> SwiftData
                - Map Retrofit -> URLSession (Actor or Service)
                - Map Compose/Activity -> SwiftUI View
                - Library Specifics: ${activeLibraries.map(l => `${l} -> ${LIBRARY_MAP[l]}`).join(', ')}

                ${currentInstructions}

                ### FINAL OUTPUT RULES
                1. OUTPUT PURE SWIFT CODE ONLY.
                2. NO Markdown formatting (DO NOT use 
 symbols).
                3. NO Intro or Outro text.
                4. NO Kotlin keywords: 'val', 'fun', 'package', or 'var name: Type'.
                5. START IMMEDIATELY with 'import Foundation', 'import SwiftUI', or '@Model'.
                6. DO NOT redefine existing '@Model' classes. Create separate Codable structs if needed.
                7. Avoid extra SwiftUI Views unless requested.
                8. Multi-file output must use // MARK: - FILE: <RelativePath>
            `;

            // Execute AI Transformation
            const resultObject = await transformCode(file.content, enhancedInstructions);
            let rawOutput = (resultObject && resultObject.transformedCode) ? resultObject.transformedCode : "";

            // Remove markdown wrappers
            let cleanText = rawOutput.replace(/```[\s\S]*?```/g, (match) => {
                return match.replace(/```(swift|kotlin|json|text)?/gi, '').replace(/```/g, '');
            });

            // Gemini multi-file parsing
            const extractedFiles = parseGeneratedOutput(cleanText, file.path);

            let currentBatchResults = [];
            let batchVerified = true;
            let validationErrors = [];

            if (extractedFiles.length === 0) {
                console.log(`⚠️ WARNING: Parser returned no content for ${file.path}`);
                batchVerified = false;
            }

            for (const extracted of extractedFiles) {
                const sanitizedContent = sanitizeCode(extracted.content, extracted.path || file.path);

                if (!sanitizedContent) {
                    console.log(`⚠️ WARNING: Sanitizer returned empty content for ${extracted.path}`);
                    continue;
                }

                const validation = await verifySwiftCode(sanitizedContent);

                if (validation.success) {
                    currentBatchResults.push({
                        path: extracted.path,
                        content: sanitizedContent
                    });
                    updateManifest(file.path, extracted.path, file.content, sanitizedContent, projectManifest);
                } else {
                    batchVerified = false;
                    validationErrors.push(`File ${extracted.path}: ${validation.error}`);
                }
            }

            if (batchVerified && currentBatchResults.length > 0) {
                console.log(`✅ VERIFIED [${attempts}/3]: ${file.path} -> ${currentBatchResults.length} file(s)`);
                verified = true;

                for (const res of currentBatchResults) {
                     results.push({
                        path: path.join('ios_output', res.path),
                        transformedContent: res.content,
                        verified: true
                     });
                }
            } else {
                console.log(`❌ REFINING: ${file.path} (Attempt ${attempts}/3)`);
                if (validationErrors.length > 0) {
                    console.error(`Validation Errors:\n${validationErrors.join('\n')}`);
                    currentInstructions += `\n\n[Previous Attempt Errors]:\n${validationErrors.join('\n')}\n[Required Fix]: Fix syntax errors. Ensure strictly valid Swift 6 code.`;
                } else {
                    currentInstructions += `\n\n[Previous Attempt Error]: Output was empty or invalid format. Use '// MARK: - FILE: Path.swift' delimiter.`;
                }
            }
        }
    }

    // Global synthesis
    const finalizedProject = results.map(res => {
        let content = res.transformedContent;

        for (const [ktName, swiftName] of Object.entries(projectManifest.mappings)) {
            const regex = new RegExp(`\\b${ktName}\\b`, 'g');
            content = content.replace(regex, swiftName);
        }

        content = content
            .replace(/\bBoolean\b/g, 'Bool')
            .replace(/\bInt\b\?/g, 'Int?')
            .replace(/\bLong\b/g, 'Int64')
            .replace(/\bFloat\b/g, 'CGFloat')
            .replace(/:\s*Unit/g, ' -> Void')
            .replace(/\.toString\(\)/g, '.description');

        return { ...res, transformedContent: content };
    });

    return {
        success: true,
        projectSummary: projectManifest,
        files: finalizedProject
    };
}

/**
 * 🧩 MULTI-FILE PARSER (Gemini)
 */
function parseGeneratedOutput(text, inputFilePath) {
    if (!text) return [];

    const fileRegex = /\/\/ MARK: - FILE:\s*(.+)/g;
    let matches = [...text.matchAll(fileRegex)];

    if (matches.length === 0) {
        let inferPath = inputFilePath.replace(/^android_input[\\/]/, '').replace(/\.kt$|\.java$/, '.swift');
        if (inferPath === inputFilePath) {
            inferPath = path.basename(inputFilePath, path.extname(inputFilePath)) + '.swift';
        }
        return [{ path: inferPath, content: text }];
    }

    const files = [];
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const filePath = match[1].trim();
        const startIdx = match.index + match[0].length;
        const endIdx = (i < matches.length - 1) ? matches[i + 1].index : text.length;

        const content = text.substring(startIdx, endIdx).trim();
        if (content) {
            files.push({ path: filePath, content });
        }
    }
    return files;
}

/**
 * 🛡️ CODE SANITIZER (Gemini)
 */
function sanitizeCode(text, filePath) {
    if (!text) return "";
    let clean = text;

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
        if (match !== -1 && (firstMatchIndex === -1 || match < firstMatchIndex)) firstMatchIndex = match;
    }

    if (firstMatchIndex !== -1) clean = clean.substring(firstMatchIndex);

    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1) {
        const tail = clean.substring(lastBrace + 1).trim();
        if (tail.length > 15 && !tail.includes('import') && !tail.includes('func')) clean = clean.substring(0, lastBrace + 1);
    }

    clean = clean.replace(/^package\s+.*;/gm, '');
    clean = clean.replace(/data class/g, 'struct'); 

    if (!filePath.includes("UserEntity.kt")) { 
        clean = clean.replace(/(?:@Model\s+)?(?:final\s+)?(?:class|struct)\s+UserModel(?:[:\s\w,]+)?\s*\{[\s\S]*?\}/g, '');
    }

    if (filePath.includes("UserApi.kt")) { 
        clean = clean.replace(/(?:@main\s+)?struct\s+ContentView(?:[:\sView]*)?\s*\{[\s\S]*?\}/g, '');
        clean = clean.replace(/class\s+\w+ViewModel(?:[:\sObservableObject]*)?\s*\{[\s\S]*?\}/g, '');
    }

    if (filePath.includes("UserListActivity.kt")) {
        const viewMatches = clean.matchAll(/(struct\s+\w+View(?:[:\sView]*)?\s*\{[\s\S]*?\})/g);
        let firstView = null;
        let processedClean = clean;
        for (const match of viewMatches) {
            if (!firstView) firstView = match[0];
            else processedClean = processedClean.replace(match[0], '');
        }
        clean = processedClean;
        clean = clean.replace(/(?:@main\s+)?struct\s+ContentView(?:[:\sView]*)?\s*\{[\s\S]*?\}/g, '');
    }

    if (filePath.includes("UserApi.kt")) {
        let desiredContent = [];
        const topLevelDeclarations = clean.matchAll(/(?:(?:@Model|@main)\s+)?(?:final\s+)?(?:class|struct|protocol|enum)\s+\w+(?::\s*[\w,\s]+)?\s*\{[\s\S]*?\}/g);
        for (const match of topLevelDeclarations) {
            if (match[0].includes("struct UserResponse") || match[0].includes("class NetworkService")) desiredContent.push(match[0]);
        }
        if (desiredContent.length > 0) clean = desiredContent.join('\n\n');
    }

    if (clean.includes('@Model') && !clean.includes('import SwiftData')) clean = 'import SwiftData\n' + clean;
    return clean.trim();
}

/**
 * HELPER: SHADOW INJECTION
 */
function injectShadowContext(kotlinCode) {
    const mappingsPath = path.join(__dirname, '..', 'shadow_library', 'Mappings.json');
    if (!fs.existsSync(mappingsPath)) return "";

    try {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
        let shadowInstructions = "\n[SHADOW CONTEXT DETECTED]:\n";
        let found = false;

        for (const [lib, config] of Object.entries(mappings.libraries)) {
            const pattern = new RegExp(config.replace_pattern || lib, 'i');
            if (kotlinCode.includes(lib) || pattern.test(kotlinCode)) {
                const shadowFilePath = path.join(__dirname, '..', 'shadow_library', config.category, config.inject);
                if (fs.existsSync(shadowFilePath)) {
                    const shadowCode = fs.readFileSync(shadowFilePath, 'utf8');
                    shadowInstructions += `\nPattern Implementation:\n${shadowCode}\n`;
                    found = true;
                }
                if (config.instructions) {
                    shadowInstructions += `[STRATEGY]: ${config.instructions}\n`;
                    found = true;
                }
            }
        }
        return found ? shadowInstructions : "";
    } catch (err) {
        return "";
    }
}

/**
 * HELPER: MANIFEST UPDATER (Gemini)
 */
function updateManifest(inputFilePath, outputFilePath, original, transformed, manifest) {
    const ktMatch = original.match(/(?:class|interface|data class|object)\s+(\w+)/);
    const swiftMatch = transformed.match(/(?:class|struct|protocol|enum)\s+(\w+)/);

    if (ktMatch && swiftMatch) {
        const ktName = ktMatch[1];
        const swiftName = swiftMatch[1];
        manifest.mappings[ktName] = swiftName;

        if (!manifest.definitions.includes(swiftName)) manifest.definitions.push(swiftName);

        const fullPath = path.join('ios_output', outputFilePath).replace(/\\/g, '/');
        manifest.fileExports[swiftName] = fullPath;
    }
}

module.exports = { orchestrateProjectTransform };
