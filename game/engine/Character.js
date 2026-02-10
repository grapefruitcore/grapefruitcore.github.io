export class Character {
    constructor(name, x, y, textureId) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = 0; // Default to ground level
        this.textureId = textureId;
        this.isVisible = true;
    }

    setPosition(x, y, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    render(renderer, assetManager) {
        if (!this.isVisible) return;

        const image = assetManager.getAsset(this.textureId);
        if (image) {
            // Characters are usually 1x1 or slightly larger.
            // Assuming 1x1 tile footprint for now, adjust as needed.
            // Center characters on the tile?
            renderer.drawIsoTile(this.x, this.y, this.z, image, {
                tileSpanX: 1,
                tileSpanY: 1
            });
        }
    }
}
