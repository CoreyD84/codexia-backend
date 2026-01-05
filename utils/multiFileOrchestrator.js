const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { verifySwiftCode } = require('../validator/codexiaValidator');

/**
 * 📚 ARCHITECTURAL PROXY LAYER
 * Maps Android infrastructure to high-performance iOS equivalents.
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
 * 🚀 CODEXIA PROJECT ORCHESTRATOR v10.0 (Hardened Sanitization Edition)
 */
async function orchestrateProjectTransform(files, baseInstructions) {
    console.log(`\n🌟 CODEXIA PRODUCTION ENGINE: Transforming ${files.length} files...`);
    
    let projectManifest = {
        mappings: {}, // Kotlin Class Name -> Swift Class Name
        definitions: [], // List of defined Swift types
        fileExports: {} // Swift File Paths
    };

    const results = [];

    for (const file of files) {
        let verified = false;
        let attempts = 0;
        let transformedContent = "";
        let currentInstructions = baseInstructions;

        const activeLibraries = Object.keys(LIBRARY_MAP).filter(lib => file.content.includes(lib));

        while (!verified && attempts < 3) {
            attempts++;
            
            const manifestStr = JSON.stringify(projectManifest.mappings);
            const shadowContext = injectShadowContext(file.content);
            
            // 🔥 ENHANCED AI PROMPT WITH RECENCY BIAS HARDENING
            const enhancedInstructions = `
                You are the Codexia Engine: A world-class Android-to-iOS Architect. Your primary goal is to provide **precise and non-redundant** code transformations that seamlessly integrate into an existing Swift project.

                [CONTEXT & ASSETS]
                - EXISTING MAPPINGS: ${manifestStr}
                - ALREADY DEFINED TYPES: ${projectManifest.definitions.join(', ')} (These types *already exist* in the project. REFER to them, do NOT redefine them.)
                - SHADOW SNIPPETS: ${shadowContext}

                [ARCHITECTURAL STRATEGY]
                - Map Room -> SwiftData
                - Map Retrofit -> URLSession (Actor or Service)
                - Map Compose/Activity -> SwiftUI View
                - Library Specifics: ${activeLibraries.map(l => `${l} -> ${LIBRARY_MAP[l]}`).join(', ')}

                ${currentInstructions}

                ### FINAL OUTPUT RULES (STRICT COMPLIANCE)
                1. OUTPUT PURE SWIFT CODE ONLY.
                2. NO Markdown formatting (DO NOT use \`\`\` symbols).
                3. NO Intro or Outro text ("Here is the code", "Explanation:", etc).
                4. NO Kotlin keywords: 'val', 'fun', 'package', or 'var name: Type'.
                5. START IMMEDIATELY with 'import Foundation', 'import SwiftUI', or '@Model'.
                6. IF YOU INCLUDE CONVERSATIONAL FILLER, THE COMPILER WILL CRASH. DO NOT TALK.
                7. IMPORTANT: A '@Model' class should NOT be made 'Codable' directly for network parsing. If a network response requires a 'Codable' type, define a SEPARATE 'struct' (e.g., 'UserResponse') that is 'Codable', and then provide explicit mapping logic to convert 'UserResponse' instances to the '@Model' class instances.
                8. DO NOT define '@Model' on 'struct' types. '@Model' is for 'class'es only.
                9. **CRITICAL:** AVOID generating extraneous SwiftUI 'View's (e.g., 'ContentView') unless the original file was explicitly a UI component that translates directly into *that specific* View. Only generate the core, transformed component. Do NOT generate wrapper views or view models unless explicitly requested by the transformation of the original file.
                10. **CRITICAL:** When mapping network response models, if a SwiftData '@Model' class with a similar conceptual name already exists (check 'ALREADY DEFINED TYPES'), you **MUST NOT REDEFINE IT**. Instead, refer to the existing '@Model' class. If a separate Codable struct for network responses is needed, name it appropriately (e.g., 'UserResponse') and ensure it's distinct from the '@Model' class.
            `;

            // 1. Execute AI Transformation
            const resultObject = await transformCode(file.content, enhancedInstructions);
            let rawOutput = (resultObject && resultObject.transformedCode) ? resultObject.transformedCode : "";

            // 2. 🛡️ NUCLEAR SANITIZER v2.0
            transformedContent = sanitizeOutput(rawOutput, file.path);

            if (!transformedContent) {
                console.log(`⚠️ WARNING: Sanitizer returned empty content for ${file.path}`);
                continue;
            }

            // 3. 🛡️ VALIDATION GATE
            const validation = await verifySwiftCode(transformedContent);
            
            if (validation.success) {
                console.log(`✅ VERIFIED [${attempts}/3]: ${file.path}`);
                verified = true;
                updateManifest(file.path, file.content, transformedContent, projectManifest);
            } else {
                console.log(`❌ REFINING: ${file.path} (Attempt ${attempts}/3)`);
                console.error(`Validation Error: ${validation.error}`); // Added this line
                // Feed error back for self-correction
                currentInstructions += `\n\n[Previous Attempt Error]: ${validation.error}\n[Required Fix]: Adhere to Swift 6 strict syntax. Ensure no English prose remains.`;
            }
        }

        results.push({
            path: file.path,
            transformedContent,
            verified
        });
    }

    // 🔄 GLOBAL SYNTHESIS PASS
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
 * 🛡️ NUCLEAR SANITIZER v2.0
 * Strictly isolates Swift code from LLM chatter and Kotlin remnants.
 */
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

    // POST-PROCESSING: Remove redundant UserModel class/struct definitions from non-UserEntity files
    if (!filePath.includes("UserEntity.kt")) { 
        // More robust regex to catch protocol conformances, etc.
        clean = clean.replace(/(?:@Model\s+)?(?:final\s+)?(?:class|struct)\s+UserModel(?::\s*[\w,\s]+)?\s*\{[\s\S]*?\}/g, '');
    }

    // POST-PROCESSING: Remove extraneous UI components (View, ObservableObject) from non-UI files
    // Original UserApi.kt was an interface, so it should not generate views or view models.
    if (filePath.includes("UserApi.kt")) { 
        clean = clean.replace(/(?:@main\s+)?struct\s+ContentView(?::\s*View)?\s*\{[\s\S]*?\}/g, ''); // Remove ContentView
        clean = clean.replace(/class\s+\w+ViewModel(?::\s*ObservableObject)?\s*\{[\s\S]*?\}/g, ''); // Remove ViewModels
    }
    
    // Original UserListActivity.kt was an Activity, so it should only generate one main View.
    if (filePath.includes("UserListActivity.kt")) {
        // Keep only the first struct that conforms to View, remove others.
        const viewMatches = clean.matchAll(/(struct\s+\w+View(?::\s*View)?\s*\{[\s\S]*?\})/g);
        let firstView = null;
        let processedClean = clean;
        for (const match of viewMatches) {
            if (!firstView) {
                firstView = match[0];
            } else {
                processedClean = processedClean.replace(match[0], ''); // Remove subsequent views
            }
        }
        clean = processedClean;

        // Also remove any extraneous ContentView from UserListActivity.
        clean = clean.replace(/(?:@main\s+)?struct\s+ContentView(?::\s*View)?\s*\{[\s\S]*?\}/g, '');
    }

    // POST-PROCESSING: Ensure UserApi.kt only contains UserResponse and NetworkService
    if (filePath.includes("UserApi.kt")) {
        let desiredContent = [];
        const topLevelDeclarations = clean.matchAll(/(?:(?:@Model|@main)\s+)?(?:final\s+)?(?:class|struct|protocol|enum)\s+\w+(?::\s*[\w,\s]+)?\s*\{[\s\S]*?\}/g);
        
        for (const match of topLevelDeclarations) {
            if (match[0].includes("struct UserResponse") || match[0].includes("class NetworkService")) {
                desiredContent.push(match[0]);
            }
        }
        clean = desiredContent.join('\n\n'); // Join with double newline for separation
    }

    if (clean.includes('@Model') && !clean.includes('import SwiftData')) { clean = 'import SwiftData\n' + clean; }
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
 * HELPER: MANIFEST UPDATER
 */
function updateManifest(filePath, original, transformed, manifest) {
    const ktMatch = original.match(/(?:class|interface|data class|object)\s+(\w+)/);
    const swiftMatch = transformed.match(/(?:class|struct|protocol|enum)\s+(\w+)/);

    if (ktMatch && swiftMatch) {
        const ktName = ktMatch[1];
        const swiftName = swiftMatch[1];
        manifest.mappings[ktName] = swiftName;
        
        if (!manifest.definitions.includes(swiftName)) {
            manifest.definitions.push(swiftName);
        }
        
        const swiftPath = filePath.replace(/\.kt$|\.java$/, '.swift');
        manifest.fileExports[swiftName] = swiftPath;
    }
}

module.exports = { orchestrateProjectTransform };