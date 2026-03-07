const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);
if (args.length < 3) {
    console.log('Usage: node extract-atlas.js <atlas_png> <atlas_json> <output_dir>');
    process.exit(1);
}

const atlasPng = args[0];
const atlasJsonFile = args[1];
const outputDir = args[2];

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
    const data = JSON.parse(fs.readFileSync(atlasJsonFile, 'utf8'));
    
    // The atlas.json from the user's read_file show m_PackedSpriteNamesToIndex and m_RenderData
    // We need to find where the box definitions are.
    // Based on standard Unity SpriteAtlas export:
    const names = data.m_PackedSpriteNamesToIndex || [];
    const renderDataEntries = data.m_RenderDataMap || [];
    
    const mapping = {};
    const img = sharp(atlasPng);
    const metadata = await img.metadata();

    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const entry = renderDataEntries[i];
        if (!entry || !entry.Value) continue;
        
        const rect = entry.Value.m_TextureRect;
        if (!rect) continue;

        const { m_X: x, m_Y: y, m_Width: w, m_Height: h } = rect;
        
        const filename = name.replace(/[\\/:*?"<>|\\s]+/g, '_') + '.png';
        mapping[name] = filename;

        try {
            // Unity Y is from bottom.
            const top = metadata.height - y - h;

            await sharp(atlasPng)
                .extract({ 
                    left: Math.max(0, Math.round(x)), 
                    top: Math.max(0, Math.round(top)), 
                    width: Math.min(metadata.width - Math.round(x), Math.round(w)), 
                    height: Math.min(metadata.height - Math.round(top), Math.round(h)) 
                })
                .toFile(path.join(outputDir, filename));
            console.log(`Extracted ${name} -> ${filename}`);
        } catch (err) {
            console.error(`Failed to extract ${name}:`, err.message);
        }
    }

    fs.writeFileSync(path.join(outputDir, 'atlas-map.json'), JSON.stringify(mapping, null, 2));
    console.log('Generated atlas-map.json');
}

run().catch(console.error);
