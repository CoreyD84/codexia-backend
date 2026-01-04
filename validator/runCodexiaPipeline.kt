async function runCodexiaPipeline(kotlinFile) {
    // Step 1: LLM Generation
    let swiftCode = await callCodexiaLLM(kotlinFile);

    // Step 2: Post-Processing (Deterministic)
    swiftCode = postProcess(swiftCode);

    // Step 3: Validation
    let validation = validateSwiftCode(swiftCode);

    // Step 4: Recursive Fix (The Loop)
    let attempts = 0;
    while (!validation.isValid && attempts < 2) {
        console.log("Validation failed. Re-prompting Codexia with error context...");
        
        // Feed the specific compiler error back to the model
        swiftCode = await rePromptCodexia(swiftCode, validation.errorContext);
        swiftCode = postProcess(swiftCode);
        validation = validateSwiftCode(swiftCode);
        
        attempts++;
    }

    return swiftCode;
}
