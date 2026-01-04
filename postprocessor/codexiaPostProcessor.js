// postprocessor/codexiaPostProcessor.js

function postProcess(rawSwiftCode) {
    let code = rawSwiftCode;

    // 1. Fix Color Hallucinations
    // Converts Color(0xFF...) to Color(hex: "...")
    code = code.replace(/Color\(0x([0-9A-Fa-f]+)\)/g, 'Color(hex: "$1")');

    // 2. Fix Text Modifier Hallucinations
    // Converts Text("...", color: .red) to Text("...").foregroundColor(.red)
    code = code.replace(/Text\((.*),\s*color:\s*(.*)\)/g, 'Text($1).foregroundColor($2)');

    // 3. Fix Layout Contamination
    code = code.replace(/LazyRow/g, 'LazyHStack');
    code = code.replace(/LazyColumn/g, 'LazyVStack');

    // 4. Fix Common Closure Errors
    // Fixes instances where the model uses $1 without a $0
    if (code.includes('$1') && !code.includes('$0')) {
        code = code.replace(/\$1/g, '$0');
    }

    // 5. Global Indentation Fix (Deterministic)
    // Runs a basic formatter or passes it to swift-format
    return applyStandardIndentation(code);
}
