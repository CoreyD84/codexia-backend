const fs = require('fs');
const path = require('path');
const { transformCode } = require('./codeTransformers');
const { validateSwiftCode } = require('../validator/codexiaValidator');
const { convertToXcAsset } = require('./assetMapper');
const { titanExtensions } = require('./titanExtensions');

// ✅ ALWAYS RESOLVE FROM PROJECT ROOT
const PROJECT_ROOT = process.cwd();

const ANDROID_SRC = process.argv.includes('--input')
    ? path.resolve(PROJECT_ROOT, process.argv[process.argv.indexOf('--input') + 1])
    : path.resolve(PROJECT_ROOT, 'android_input');

const IOS_OUTPUT = process.argv.includes('--output')
    ? path.resolve(PROJECT_ROOT, process.argv[process.argv.indexOf('--output') + 1])
    : path.resolve(PROJECT_ROOT, 'ios_project');

console.log("📂 ANDROID_SRC =", ANDROID_SRC);
console.log("📂 IOS_OUTPUT =", IOS_OUTPUT);

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

function drawProgressBar(current, total, label) {
    const width = 30;
    const progress = total === 0 ? 0 : Math.round((current / total) * width);
    const bar = "█".repeat(progress) + "-".repeat(width - progress);
    const percentage = total === 0 ? 0 : Math.round((current / total) * 100);
    process.stdout.write(`\r${label}: [${bar}] ${percentage}% (${current}/${total})`);
    if (current === total) process.stdout.write('\n');
}

// 🛡️ HARD UIKit Firewall
function containsForbiddenUIKit(code) {
    if (!code) return true;

    const forbidden = [
        "import UIKit",
        "UIKit",
        "UIViewController",
        "UIView",
        "UIWindow",
        "UIApplication",
        "UIAlertController",
        "UINavigationController",
        "UIButton",
        "UILabel",
        "@UIApplicationMain",
        "AppDelegate",
        "SceneDelegate",
        "present(",
        ".present(",
        "addSubview",
        "viewDidLoad",
        "UIHostingController"
    ];

    return forbidden.some(f => code.includes(f));
}

// ✅ SANITIZER — CLEANS BUT NEVER DESTROYS VALID CODE
function sanitizeOutput(text) {
    if (!text) return "";

    let clean = text.trim();

    // Extract from ``` if present
    const fenceMatch = clean.match(/```(?:swift)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        clean = fenceMatch[1].trim();
    }

    // 🚫 Hard reject UIKit
    if (containsForbiddenUIKit(clean)) {
        console.log("🧨 REJECTED: UIKit detected");
        return "";
    }

    // 🚫 Reject imperative NavigationLink usage
    if (/func\s+\w+\s*\([\s\S]*?\)\s*\{[\s\S]*?NavigationLink/.test(clean)) {
        console.log("🧨 REJECTED: Imperative NavigationLink inside function");
        return "";
    }

    // 🚫 Reject UIApplication / UIWindow
    if (clean.includes("UIApplication") || clean.includes("UIWindow")) {
        console.log("🧨 REJECTED: UIApplication usage");
        return "";
    }

    // 🚫 Reject @main or App
    if (clean.includes("@main") || /struct\s+\w+App\s*:/.test(clean)) {
        console.log("🧨 REJECTED: App entrypoint generated");
        return "";
    }

    return clean;
}

function saveToIosProject(originalPath, swiftCode) {
    let sub = "Models";
    if (originalPath.includes("Activity") || originalPath.includes("Fragment")) sub = "Views";
    if (originalPath.includes("Api") || originalPath.includes("Repository")) sub = "Networking";

    const name = path.basename(originalPath)
        .replace('.kt', '.swift')
        .replace('Activity', 'View');

    const target = path.join(IOS_OUTPUT, sub, name);

    if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, swiftCode);
}

async function runTitanTransformation() {
    console.log("\n🐘 TITAN ENGINE — STRICT SWIFTUI MODE");

    console.log("🔍 Scanning:", ANDROID_SRC);

    const kotlinFiles = getAllFiles(ANDROID_SRC).filter(f => f.endsWith('.kt'));
    console.log("📄 Found Kotlin files:", kotlinFiles.length);

    if (kotlinFiles.length === 0) {
        console.log("🛑 NO FILES FOUND — PATH BUG");
        return;
    }

    const assetFiles = getAllFiles(ANDROID_SRC).filter(f => /\.(png|jpg|xml|webp)$/i.test(f));

    const extPath = path.join(IOS_OUTPUT, 'Extensions', 'Foundation+Extensions.swift');
    fs.mkdirSync(path.dirname(extPath), { recursive: true });
    fs.writeFileSync(extPath, titanExtensions);

    assetFiles.forEach((file, index) => {
        const imageName = path.basename(file, path.extname(file));
        convertToXcAsset(imageName, IOS_OUTPUT);
        drawProgressBar(index + 1, assetFiles.length, "Assets");
    });

    for (let i = 0; i < kotlinFiles.length; i++) {
        const file = kotlinFiles[i];
        const fileName = path.basename(file);

        console.log(`\n[${i + 1}/${kotlinFiles.length}] Processing: ${fileName}`);

        const kotlinCode = fs.readFileSync(file, 'utf8');

        let attempts = 0;
        let validation = { success: false };

        while (!validation.success && attempts < 6) {
            attempts++;

            console.log(`🔁 Attempt ${attempts}/6`);

            const result = await transformCode(
                kotlinCode,
                "Transform to pure SwiftUI. Do not use UIKit. Use NavigationStack and NavigationLink. No UIKit APIs."
            );

            if (!result || !result.transformedCode) {
                console.log("❌ transformCode failed");
                continue;
            }

            const clean = sanitizeOutput(result.transformedCode);
            if (!clean) continue;

            validation = validateSwiftCode(clean);

            if (validation.success) {
                saveToIosProject(file, clean);
                console.log("✅ Saved:", fileName.replace(".kt", ".swift"));
            } else {
                console.log("⚠️ Validation failed, retrying...");
            }
        }

        drawProgressBar(i + 1, kotlinFiles.length, "Source");
    }

    console.log("\n✅ TITAN COMPLETE");
}

runTitanTransformation();
