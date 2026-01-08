const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { validateSwiftCode } = require('../validator/codexiaValidator');
const { convertToXcAsset } = require('./assetMapper');
const { titanExtensions } = require('./titanExtensions');

const ANDROID_SRC = process.argv.includes('--input') ? process.argv[process.argv.indexOf('--input') + 1] : './android_input';
const IOS_OUTPUT = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : './ios_output';

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
    
    // 0. Inject Global Extensions (The Infrastructure)
    console.log("🏗️ Phase 0: Injecting Global Infrastructure...");
    const extPath = path.join(IOS_OUTPUT, 'Extensions', 'Foundation+Extensions.swift');
    if (!fs.existsSync(path.dirname(extPath))) fs.mkdirSync(path.dirname(extPath), { recursive: true });
    fs.writeFileSync(extPath, titanExtensions);

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
    
    // Hardware Dependency Tracker
    const hardwareDependencies = new Set();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.basename(file);
        console.log(`\n[${i + 1}/${files.length}] Processing: ${fileName}`);
        
        const kotlinCode = fs.readFileSync(file, 'utf8');
        if (fileName.includes("Activity")) detectedRoutes.push(fileName.replace('.kt', ''));

        // DETECT HARDWARE DEPENDENCIES
        if (kotlinCode.includes("@dependency:SprintRadioManager")) {
            hardwareDependencies.add("SprintRadioManager");
            console.log("  🔌 Detected Hardware Dependency: SprintRadioManager");
        }

        let validation = { success: false, error: ""};
        let attempts = 0;
        let finalSwiftCode = "";

        while(!validation.success && attempts < 3) {
            attempts++;
            
            // SYSTEM PROMPT: THE "SCHOLAR PASS" MANDATE
            let prompt = `
            TRANSFORM TO STRICT SWIFTUI.
            
            [INFRASTRUCTURE]
            - ✅ ASSUME 'Color(hex: String)' exists globally. DO NOT implement it.
            - ✅ ASSUME 'Route' enum exists globally (in Models/Navigation/Route.swift). DO NOT define 'enum Route' locally.
            
            [NAVIGATION & ARCHITECTURE]
            - ❌ NEVER USE: UIViewController, UIKit, NavigationLink(destination:).
            - ✅ ALWAYS USE: struct ViewName: View, @Binding var path: NavigationPath.
            - ✅ BACK LOGIC: If button text says "Back"/"Close" OR logic is 'finish()', usage of 'path.removeLast()' is MANDATORY. This OVERRIDES any 'path.append' derived from Intents.
            - ✅ INTENTS: Map other Android Intents to 'path.append(Route.[destination])'.
            - ✅ SINGLETONS: Use @ObservedObject for Kotlin Singletons/Objects (e.g., RadioManager.shared) instead of local @StateObject initialization.
            - ✅ STATE: Map 'private val _state' or 'StateFlow' to public '@Published' properties.
            - ✅ CONCURRENCY: Mark all Singletons/ObservableObjects with '@MainActor' to ensure UI updates happen on the main thread.
            - ✅ MANAGER: If accessing a Singleton (like RadioManager.getInstance()), use '@ObservedObject var manager = Class.getInstance()'. DO NOT use @StateObject.
            - ✅ PREVIEWS: For @Binding path, use a static wrapper in Previews. DO NOT pass a constant directly if it breaks compilation.
            - ✅ BACK BUTTON: For custom back logic, use '.navigationBarBackButtonHidden(true)' and a '.toolbar' item with 'path.removeLast()'.
            - ✅ ROOT VIEW: If a file is marked as '@file:Root' or represents the initial screen (e.g., HomeView), it MUST NOT have a back button or any 'path.removeLast()' logic.
            - ✅ DESTINATION: Navigation destinations are handled in 'TitanRootView'. DO NOT use 'navigationDestination' inside this view.
            `;

            if (attempts > 1) {
                selfHealedCount++;
                prompt += `\n⚠️ PREVIOUS ERROR: ${validation.error}`;
            }

            try {
                const result = await transformCode(kotlinCode, prompt);
                const { sanitized, patched } = sanitizeOutput(result.transformedCode, file);
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

    // FORCE HARDWARE VIEW GENERATION
    if (hardwareDependencies.has("SprintRadioManager")) {
        console.log("  ⚡ Forcing creation of SprintRadioView.swift...");
        generateSprintRadioView();
        // Add to routes if not present
        if (!detectedRoutes.includes("SprintRadioActivity")) {
             detectedRoutes.push("SprintRadioActivity");
        }
    }

    generateGlobalRoute(detectedRoutes);
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
    const routeDestinations = routes.map(r => {
        const routeName = r.replace('Activity', '').toLowerCase();
        const viewName = r.replace('Activity', 'View');
        return `case .${routeName}: ${viewName}(path: $path)`;
    }).join('\n                        ');

    const skeleton = `
import SwiftUI

struct TitanRootView: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path) // Default entry point
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

function generateGlobalRoute(routes) {
    const routeCases = routes.map(r => {
        const routeName = r.replace('Activity', '').toLowerCase();
        return `case ${routeName}`;
    }).join('\n    ');

    const code = `
import Foundation

enum Route: String, CaseIterable, Hashable, Identifiable {
    ${routeCases}
    
    var id: String { self.rawValue }
}
    `;
    const targetPath = path.join(IOS_OUTPUT, 'Models', 'Navigation', 'Route.swift');
    if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, code.trim());
}

function generateSprintRadioView() {
    const code = `
import SwiftUI

struct SprintRadioView: View {
    @Binding var path: NavigationPath
    @ObservedObject private var radioManager = RadioManager.getInstance()

    var body: some View {
        VStack {
            Text("Sprint Radio Tower Link")
                .font(.title)
                .padding()
            
            if let signal = radioManager.currentSignal {
                Text("Signal: \\(signal.strength)")
                    .foregroundColor(signal.strength == "HIGH" ? Color(hex: "00FF00") : Color(hex: "FF0000"))
            } else {
                ProgressView("Scanning...")
            }
            
            Button("Force Handoff") {
                radioManager.forceLegacyHandoff(protocolType: "GSM")
            }
            .padding()
        }
        .onAppear {
            radioManager.connectToTower("TOWER_AUTO", completion: { _ in })
        }
    }
}
    `;
    const targetPath = path.join(IOS_OUTPUT, 'Views', 'SprintRadioView.swift');
    if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, code.trim());
}

function sanitizeOutput(text, filePath) {
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

    // 4. Hard-strip Kotlin leftovers
    clean = clean.replace(/^package\s+.*;/gm, '');
    clean = clean.replace(/data class/g, 'struct'); 

    // POST-PROCESSING: Remove redundant UserModel class/struct definitions from non-UserEntity files
    if (!filePath.includes("UserEntity.kt")) { 
        // More robust regex to catch protocol conformances, etc.
        clean = clean.replace(/(?:@Model\s+)?(?:final\s+)?(?:class|struct)\s+UserModel(?::\s*[\w,\s]+)?\s*\{[\s\S]*?\}/g, '');
    }

    // 🛡️ FINAL SCHEMA GUARD: Forcefully remove any local Route enum declarations
    clean = finalCleanup(clean);

    // 🛡️ UI LEAK GUARD: Remove TitanRootView/ContentView from non-root files
    if (!filePath.includes("TitanRootView")) {
        clean = clean.replace(/struct TitanRootView[\s\S]*?\{[\s\S]*?\}/g, '');
        clean = clean.replace(/struct ContentView[\s\S]*?\{[\s\S]*?\}/g, '');
        clean = clean.replace(/@main[\s\S]*?struct.*?App[\s\S]*?\{[\s\S]*?\}/g, '');
    }

    return { sanitized: clean.trim(), patched };
}

function finalCleanup(content) {
    // 1. Forcefully remove any local Route enum declarations
    const cleaned = content.replace(/enum Route[\s\S]*?\{[\s\S]*?\}/g, '');
    
    // 2. Ensure it didn't accidentally remove the global import reference
    return cleaned.trim();
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