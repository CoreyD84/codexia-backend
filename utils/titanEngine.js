const fs = require('fs');
const path = require('path');
const { orchestrateProjectTransform } = require('./multiFileOrchestrator');
const { convertToXcAsset } = require('./assetMapper');

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const PROJECT_ROOT = process.cwd();
const DEFAULT_INPUT = path.join(PROJECT_ROOT, 'android_input');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'ios_project');

// ---------------------------------------------------------
// HELPER: File Scanning
// ---------------------------------------------------------
function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return [];
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    }
    return arrayOfFiles;
}

// ---------------------------------------------------------
// HELPER: Categorization Strategy
// ---------------------------------------------------------
function determineOutputCategory(filename, content) {
    const lower = filename.toLowerCase();
    
    if (lower.includes('activity') || lower.includes('fragment') || lower.includes('view') || content.includes('View')) {
        return 'Views';
    }
    if (lower.includes('model') || lower.includes('entity') || lower.includes('dto') || content.includes('struct') || content.includes('@Model')) {
        return 'Models';
    }
    if (lower.includes('api') || lower.includes('service') || lower.includes('repository') || lower.includes('manager')) {
        return 'Networking';
    }
    if (lower.includes('util') || lower.includes('helper') || lower.includes('extension')) {
        return 'Utils';
    }
    
    return 'Core';
}

// ---------------------------------------------------------
// TITAN ENGINE v2.0
// ---------------------------------------------------------
async function runTitan() {
    console.log(`\n⚔️  TITAN ENGINE v2.0 - Activating...`);

    // 1. Parse Arguments
    const args = process.argv.slice(2);
    let inputDir = DEFAULT_INPUT;
    let outputDir = DEFAULT_OUTPUT;

    if (args.includes('--input')) inputDir = args[args.indexOf('--input') + 1];
    if (args.includes('--output')) outputDir = args[args.indexOf('--output') + 1];

    inputDir = path.resolve(inputDir);
    outputDir = path.resolve(outputDir);

    console.log(`📂 INPUT:  ${inputDir}`);
    console.log(`📂 OUTPUT: ${outputDir}`);

    if (!fs.existsSync(inputDir)) {
        console.error(`❌ Error: Input directory does not exist: ${inputDir}`);
        process.exit(1);
    }

    // 2. Scan Files
    const allFiles = getAllFiles(inputDir);
    const kotlinFiles = allFiles.filter(f => f.endsWith('.kt') || f.endsWith('.java'));
    const assetFiles = allFiles.filter(f => /\.(png|jpg|jpeg|webp|xml)$/i.test(f) && !f.endsWith('.xml')); // XMLs are tricky, focusing on images

    if (kotlinFiles.length === 0) {
        console.warn("⚠️  No Kotlin/Java source files found.");
    } else {
        console.log(`📝 Found ${kotlinFiles.length} source files.`);
    }

    // 3. Prepare Payload for Orchestrator
    const filePayloads = kotlinFiles.map(filePath => ({
        path: path.basename(filePath), // We pass basename, but we track origin if needed
        content: fs.readFileSync(filePath, 'utf8')
    }));

    // 4. Run Transformation
    if (filePayloads.length > 0) {
        try {
            const result = await orchestrateProjectTransform(filePayloads, "Convert to clean SwiftUI. Use modern Swift concurrency.");
            
            console.log("\n💾 Saving Transformed Files...");

            // 5. Write Files
            result.files.forEach(file => {
                if (!file.transformedContent) return;

                const filename = file.path.replace(/\.kt$|\.java$/, '.swift');
                const category = determineOutputCategory(filename, file.transformedContent);
                const targetDir = path.join(outputDir, category);
                const targetPath = path.join(targetDir, filename);

                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                
                fs.writeFileSync(targetPath, file.transformedContent);
                console.log(`   ✅ ${category}/${filename}`);
            });
            
            console.log("\n✨ Code Transformation Complete.");

        } catch (err) {
            console.error("\n❌ Orchestration Failed:", err);
        }
    }

    // 6. Handle Assets
    if (assetFiles.length > 0) {
        console.log(`\n📦 Processing ${assetFiles.length} Assets...`);
        const assetsDir = path.join(outputDir, 'Assets.xcassets');
        
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        assetFiles.forEach(assetPath => {
            const filename = path.basename(assetPath);
            const name = path.parse(filename).name;
            
            // Create Asset Catalog Structure
            const imageSetDir = path.join(assetsDir, `${name}.imageset`);
            if (!fs.existsSync(imageSetDir)) fs.mkdirSync(imageSetDir, { recursive: true });

            // Copy File (Assume 1x for now)
            fs.copyFileSync(assetPath, path.join(imageSetDir, filename));

            // Generate JSON using helper
            convertToXcAsset(name, outputDir); 
            // Note: convertToXcAsset in utils/assetMapper.js writes to IOS_OUTPUT/Assets.xcassets/name.imageset/Contents.json
            // We just need to make sure the paths align.
            
            // Actually, let's just write the JSON manually here to be safe and self-contained, 
            // OR ensure we use the helper correctly.
            // The helper does: path.join(iosOutputPath, `Assets.xcassets/${imageName}.imageset`)
            // So passing outputDir is correct.
        });
        console.log("   ✅ Assets migrated.");
    }
}

// Execute
runTitan();
