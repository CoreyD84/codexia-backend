const fs = require('fs');
const path = require('path');

function convertToXcAsset(imageName, iosOutputPath) {
    const assetFolder = path.join(iosOutputPath, `Assets.xcassets/${imageName}.imageset`);
    if (!fs.existsSync(assetFolder)) fs.mkdirSync(assetFolder, { recursive: true });

    const contentsJson = {
        "images": [
            { "idiom": "universal", "scale": "1x", "filename": `${imageName}.png` },
            { "idiom": "universal", "scale": "2x" },
            { "idiom": "universal", "scale": "3x" }
        ],
        "info": { "version": 1, "author": "codexia" }
    };

    fs.writeFileSync(path.join(assetFolder, 'Contents.json'), JSON.stringify(contentsJson, null, 2));
    console.log(`📦 Asset Metadata Created: ${imageName}`);
}

module.exports = { convertToXcAsset };
