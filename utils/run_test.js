const { orchestrateProjectTransform } = require('./multiFileOrchestrator'); 
const testPayload = require('./triple_threat_test.json');

const instructions = "Convert this Android module to a modern SwiftUI architecture using the provided shadows.";

console.log("🛠️ Initializing Codexia Engine...");

orchestrateProjectTransform(testPayload, instructions)
    .then(result => {
        console.log("\n🚀 TRANSFORMATION COMPLETE!");
        console.log("----------------------------");
        
        // Show the generated Swift files
        result.files.forEach(file => {
            console.log(`\n📄 FILE: ${file.path.replace('.kt', '.swift')}`);
            console.log(file.transformedContent);
            console.log("----------------------------");
        });
    })
    .catch(err => {
        console.error("❌ Critical Error:", err);
    });
