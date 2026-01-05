const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { verifySwiftCode } = require('../validator/codexiaValidator');

/**
 * 📚 GOD-TIER LIBRARY PROXY LAYER
 * Maps Android infrastructure to the high-performance iOS equivalents.
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
    "StateFlow": "@Observable (Swift Observation Framework)"
};

/**
 * 🚀 CODEXIA PROJECT ORCHESTRATOR v8.0 (God-Tier Edition)
 */
async function orchestrateProjectTransform(files, baseInstructions) {
    console.log(`\n🌟 CODEXIA PRODUCTION ENGINE: Transforming ${files.length} files with AI God-Tier logic...`);
    
    let projectManifest = {
        mappings: {},      
        definitions: [],  
        fileExports: {}    
    };

    const results = [];

    for (const file of files) {
        let verified = false;
        let attempts = 0;
        let transformedContent = "";
        let currentInstructions = baseInstructions;

        // Detect libraries used in the current file
        const activeLibraries = Object.keys(LIBRARY_MAP).filter(lib => file.content.includes(lib));

        while (!verified && attempts < 3) {
            attempts++;
            
            const manifestStr = JSON.stringify(projectManifest.mappings);
            const shadowContext = injectShadowContext(file.content);
            
            // 🔥 GOD-TIER ENHANCED PROMPT
            const enhancedInstructions = `
                You are the Codexia Engine: An Android-to-iOS Architectural God.
                [COMMANDMENTS]:
                1. NEVER OUTPUT KOTLIN. Phrases like 'val', 'fun', 'package', or 'var :Type' are forbidden.
                2. NATIVE REPLACEMENTS: ${activeLibraries.map(l => `${l} -> ${LIBRARY_MAP[l]}`).join(', ')}
                3. ARCHITECTURAL MAPPING: Map Room -> SwiftData, Retrofit -> URLSession, and Compose -> SwiftUI.
                4. CONSISTENCY: Use these existing Swift names: ${manifestStr}
                5. TYPES: Do not redefine ${projectManifest.definitions.join(', ')}.
                6. SHADOW COMPLIANCE: Use @Model, @Query, @Observable, and @State as per the Shadow Toolchain.
                7. NO EXPLANATIONS: Output ONLY pure Swift code.
                
                ${currentInstructions}
                ${shadowContext}
            `;

            // Execute the transformation
            const resultObject = await transformCode(file.content, enhancedInstructions);
            
            if (resultObject && resultObject.transformedCode) {
                transformedContent = resultObject.transformedCode;
            } else {
                transformedContent = "";
            }

            // Clean markdown artifacts
            transformedContent = transformedContent.replace(/```swift|```|```kotlin/gi, '').trim();

            // 🛡️ VALIDATION GATE
            const validation = await verifySwiftCode(transformedContent);
            
            if (validation.success) {
                console.log(`✅ VERIFIED: ${file.path}`);
                verified = true;
                updateManifest(file.path, file.content, transformedContent, projectManifest);
            } else {
                console.log(`❌ FIXING: ${file.path} (Attempt ${attempts}/3)`);
                // Feed the compiler error back into the AI for the next attempt
                currentInstructions += `\n[Fix Compiler Error]: ${validation.error}\n[Correction]: ${validation.suggestion || "Ensure Swift 6 syntax."}`;
            }
        }

        results.push({
            path: file.path,
            transformedContent,
            verified
        });
    }

    // 🔄 GLOBAL SYNTHESIS PASS (Rename across all files)
    const finalizedProject = results.map(res => {
        let content = res.transformedContent;
        for (const [ktName, swiftName] of Object.entries(projectManifest.mappings)) {
            const regex = new RegExp(`\\b${ktName}\\b`, 'g');
            content = content.replace(regex, swiftName);
        }
        
        // Final "God-Tier" Cleanup for common missed types
        content = content
            .replace(/\bBoolean\b/g, 'Bool')
            .replace(/\bInt\b\?/g, 'Int?')
            .replace(/\bLong\b/g, 'Int64')
            .replace(/:\s*Unit/g, ' -> Void');

        return { ...res, transformedContent: content };
    });

    return {
        success: true,
        projectSummary: projectManifest,
        files: finalizedProject
    };
}

/**
 * HELPER: SHADOW INJECTION (Architectural Patterns)
 */
function injectShadowContext(kotlinCode) {
    const mappingsPath = path.join(__dirname, '..', 'shadow_library', 'Mappings.json');
    if (!fs.existsSync(mappingsPath)) return "";

    try {
        const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
        let shadowInstructions = "\n[SHADOW CONTEXT DETECTED]:\n";
        let found = false;

        for (const [lib, config] of Object.entries(mappings.libraries)) {
            const pattern = new RegExp(config.replace_pattern, 'i');
            if (kotlinCode.includes(lib) || pattern.test(kotlinCode)) {
                const shadowFilePath = path.join(__dirname, '..', 'shadow_library', config.category, config.inject);
                if (fs.existsSync(shadowFilePath)) {
                    const shadowCode = fs.readFileSync(shadowFilePath, 'utf8');
                    shadowInstructions += `\nImplement logic using this pattern:\n${shadowCode}\n`;
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
 * HELPER: MANIFEST UPDATER (Tracks Class Name Mappings)
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
        manifest.fileExports[swiftName] = filePath.replace('.kt', '.swift');
    }
}

module.exports = { orchestrateProjectTransform };