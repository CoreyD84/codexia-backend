// utils/titanReport.js
const fs = require('fs');
const path = require('path');

function generateMigrationReport() {
    const androidInput = process.argv.includes('--input') ? process.argv[process.argv.indexOf('--input') + 1] : './android_input';
    const iosOutput = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : './ios_project';

    // Helper to recursively get files
    function getFilesRecursive(dir, ext) {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFilesRecursive(fullPath, ext));
            } else if (file.endsWith(ext)) {
                results.push(file);
            }
        });
        return results;
    }

    const sourceFiles = getFilesRecursive(androidInput, '.kt');
    const outputFiles = getFilesRecursive(iosOutput, '.swift');

    console.log("\n🚀 TITAN MIGRATION COVERAGE REPORT");
    console.log(`Source: ${androidInput}`);
    console.log(`Output: ${iosOutput}`);
    console.log("------------------------------------ ");

    sourceFiles.forEach(file => {
        // Map Kotlin Activity/Fragment to View for comparison
        let swiftName = file.replace('.kt', '.swift');
        if (swiftName.includes('Activity')) swiftName = swiftName.replace('Activity', 'View');
        if (swiftName.includes('Fragment')) swiftName = swiftName.replace('Fragment', 'View');

        const isSynced = outputFiles.includes(swiftName);
        const status = isSynced ? "✅ SYNCED" : "❌ PENDING";
        
        console.log(`${file.padEnd(30)} -> ${status}`);
    });
    console.log("------------------------------------\n");
}

generateMigrationReport();