const { transformCode } = require('./transformer'); 
const { verifySwiftCode } = require('./validator');

/**
 * CODEXIA PROJECT ORCHESTRATOR v4.2 (Full Product Edition)
 */
async function orchestrateProjectTransform(files, instructions) {
    console.log(`\n🚀 CODEXIA ENGINE: Processing ${files.length} files...`);
    
    let projectManifest = {
        mappings: {},      // Kotlin Class -> Swift Class
        definitions: [],   // List of all Swift types created
        fileExports: {}    // Swift filename mapping
    };

    const results = [];
    const CONTEXT_LIMIT = 4096; // Default Ollama context limit

    for (const file of files) {
        let verified = false;
        let attempts = 0;
        let transformedContent = "";

        while (!verified && attempts < 3) {
            attempts++;
            
            // 1. TOKEN AWARENESS: Estimate if we are overloading the model
            const manifestStr = JSON.stringify(projectManifest.mappings);
            const estimatedTokens = (manifestStr.length + file.content.length + instructions.length) / 4;
            
            if (estimatedTokens > CONTEXT_LIMIT) {
                console.warn(`⚠️ Warning: High token count (${Math.round(estimatedTokens)}). Optimizing context...`);
            }

            // 2. CONTEXT INJECTION
            const enhancedInstructions = `
                ${instructions}
                [PROJECT MEMORY]
                Use these Swift names for consistency: ${manifestStr}
                Existing Types: ${projectManifest.definitions.join(', ')}
                Current File: ${file.path}
            `;

            transformedContent = await transformCode(file.content, enhancedInstructions);
            transformedContent = transformedContent.replace(/```swift|```/gi, '').trim();

            // 3. COMPILER VALIDATION
            const validation = await verifySwiftCode(transformedContent);
            
            if (validation.success) {
                console.log(`✅ ${file.path} verified.`);
                verified = true;
                updateManifest(file.path, file.content, transformedContent, projectManifest);
            } else {
                console.log(`❌ Attempt ${attempts} failed: ${validation.error}`);
                instructions += `\n[Fix]: ${validation.error}`;
            }
        }

        results.push({
            path: file.path,
            transformedContent,
            verified
        });
    }

    // 4. FINAL PROJECT SYNC (The "Product" Polish)
    // Ensures all files use the final naming convention from the manifest.
    const finalProject = results.map(res => {
        let content = res.transformedContent;
        for (const [ktName, swiftName] of Object.entries(projectManifest.mappings)) {
            // Global replace to ensure consistency across the whole module
            const regex = new RegExp(`\\b${ktName}\\b`, 'g');
            content = content.replace(regex, swiftName);
        }
        return { ...res, transformedContent: content };
    });

    return { success: true, results: finalProject, manifest: projectManifest };
}

function updateManifest(filePath, original, transformed, manifest) {
    const ktMatch = original.match(/(?:class|interface|data class)\s+(\w+)/);
    const swiftMatch = transformed.match(/(?:class|struct|protocol|enum)\s+(\w+)/);

    if (ktMatch && swiftMatch) {
        manifest.mappings[ktMatch[1]] = swiftMatch[1];
        if (!manifest.definitions.includes(swiftMatch[1])) {
            manifest.definitions.push(swiftMatch[1]);
        }
        manifest.fileExports[swiftMatch[1]] = filePath.replace('.kt', '.swift');
    }
}

module.exports = { orchestrateProjectTransform };
