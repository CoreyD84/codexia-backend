const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { validateSwiftCode } = require('../validator/codexiaValidator');
const { convertToXcAsset } = require('./assetMapper');

const ANDROID_SRC = './android_input';
const IOS_OUTPUT = './ios_output';

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        // Use path.join to create a relative path first
        const fullPath = path.join(dirPath, file);
        
        if (fs.statSync(fullPath).isDirectory()) {
            // Recurse into subdirectories
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Push the actual file path to the list
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

function drawProgressBar(current, total, label) {
    const width = 30;
    const progress = Math.round((current / total) * width);
    const bar = "█".repeat(progress) + "-".repeat(width - progress);
    const percentage = Math.round((current / total) * 100);
    process.stdout.write(`\r${label}: [${bar}] ${percentage}% (${current}/${total})`);
    if (current === total) process.stdout.write('\n');
}

async function runTitanTransformation() {
    console.log("\n🐘 TITAN ENGINE: Initiating Full-Scale Sync...");
    const startTime = Date.now();
    let uiKitLeaksPatched = 0;
    
    // 1. Process Assets
    const assetFiles = getAllFiles(ANDROID_SRC).filter(f => /\.(png|jpg|xml|webp)$/i.test(f));
    if (assetFiles.length > 0) {
        console.log("📦 Phase 1: Mapping Assets...");
        assetFiles.forEach((file, index) => {
            const imageName = path.basename(file, path.extname(file));
            convertToXcAsset(imageName, IOS_OUTPUT);
            drawProgressBar(index + 1, assetFiles.length, "Assets");
        });
    }

    // 2. Map Kotlin Files
    const files = getAllFiles(ANDROID_SRC).filter(f => f.endsWith('.kt'));
    const detectedRoutes = [];
    let successCount = 0;
    let selfHealedCount = 0;

    console.log("🛠️ Phase 2: Transforming Logic & UI...");
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.basename(file);
        console.log(`\n[${i + 1}/${files.length}] Processing: ${fileName}`);
        
        const kotlinCode = fs.readFileSync(file, 'utf8');
        if (fileName.includes("Activity")) detectedRoutes.push(fileName.replace('.kt', ''));

        let validation = { success: false, error: ""};
        let attempts = 0;
        let finalSwiftCode = "";

        while(!validation.success && attempts < 3) {
            attempts++;
            
            // SYSTEM PROMPT: THE "SWIFTUI-ONLY" MANDATE
            let prompt = `
            TRANSFORM TO MODERN SWIFTUI ONLY. 
            - ❌ NEVER USE: UIViewController, UIKit, pushViewController.
            - ✅ ALWAYS USE: struct ViewName: View, @Binding var path: NavigationPath.
            - Navigation must use path.append(.RouteName).
            `;

            if (attempts > 1) {
                selfHealedCount++;
                prompt += `\n⚠️ PREVIOUS ERROR: ${validation.error}`;
            }

            try {
                const result = await transformCode(kotlinCode, prompt);
                const { sanitized, patched } = sanitizeOutput(result.transformedCode);
                finalSwiftCode = sanitized;
                if (patched) uiKitLeaksPatched++;

                validation = validateSwiftCode(finalSwiftCode);
                
                if (validation.success) {
                    saveToIosProject(file, finalSwiftCode);
                    successCount++;
                }
            } catch (err) {
                console.error(`  ⚠️ AI Error on ${fileName}: ${err.message}`);
                break;
            }
        }
        drawProgressBar(i + 1, files.length, "Source Code");
    }

    generateTitanRoot(detectedRoutes);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=========================================`);
    console.log(`🎉 TITAN SYNC COMPLETE IN ${duration}s`);
    console.log(`✅ Files Verified: ${successCount}/${files.length}`);
    console.log(`🩹 AI Validation Fixes: ${selfHealedCount}`);
    console.log(`🛡️ UIKit Leaks Patched: ${uiKitLeaksPatched}`);
    console.log(`=========================================\n`);
}

function generateTitanRoot(routes) {
    const routeCases = routes.map(r => `case ${r}`).join('\n    ');
    const routeDestinations = routes.map(r => `case .${r}: ${r.replace('Activity', 'View')}()`).join('\n                ');

    const skeleton = `
import SwiftUI

enum Route: Hashable {
    ${routeCases}
}

struct TitanRootView: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            ContentView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                        ${routeDestinations}
                    }
                }
        }
    }
}
    `;
    const targetPath = path.join(IOS_OUTPUT, 'Views', 'TitanRootView.swift');
    if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, skeleton.trim());
}

function sanitizeOutput(text) {
    if (!text) return { sanitized: "", patched: false };
    let patched = false;
    let clean = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```(swift|kotlin|json|text)?/gi, '').replace(/```/g, ''));
    
    // DETECT AND PATCH UIKIT LEAKS
    if (clean.includes("UIViewController") || clean.includes("navigationController")) {
        patched = true;
        clean = clean.replace(/class\s+(.*)ViewController\s*:\s*UIViewController/g, 'struct $1View: View');
        clean = clean.replace(/navigationController\?\.pushViewController\((.*)VC.*/g, 'path.append(.$1)');
        clean = clean.replace(/import UIKit/g, 'import SwiftUI');
    }

    // Ensure logic starts at first import or struct
    const keywords = [/\bimport\s+/, /\bstruct\b/, /\bclass\b/];
    let start = -1;
    keywords.forEach(k => { const m = clean.search(k); if (m !== -1 && (start === -1 || m < start)) start = m; });
    if (start !== -1) clean = clean.substring(start);
    
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1) clean = clean.substring(0, lastBrace + 1);

    return { sanitized: clean.trim(), patched };
}

function saveToIosProject(originalPath, swiftCode) {
    let sub = "Models";
    if (originalPath.includes("Activity") || originalPath.includes("Fragment")) sub = "Views";
    if (originalPath.includes("Api") || originalPath.includes("Repository")) sub = "Networking";
    const name = path.basename(originalPath).replace('.kt', '.swift').replace('Activity', 'View');
    const target = path.join(IOS_OUTPUT, sub, name); 
    if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, swiftCode);
}

runTitanTransformation();