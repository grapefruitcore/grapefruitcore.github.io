export class Character {
    constructor(name, x, y, textureId) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = 0; // Default to ground level
        this.textureId = textureId;
        this.isVisible = true;
        this.customization = null;
        this.flip = false;
    }

    setPosition(x, y, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    render(renderer, assetManager) {
        if (!this.isVisible) return;

        if (this.customization) {
            const parts = ['body', 'clothes', 'face', 'hair'];
            for (const part of parts) {
                if (this.customization[part]) {
                    const image = assetManager.getAsset(this.customization[part]);
                    if (image) {
                        renderer.drawIsoTile(this.x, this.y, this.z, image, {
                            tileSpanX: 1,
                            tileSpanY: 1,
                            flip: this.flip
                        });
                    }
                }
            }
        } else {
            const image = assetManager.getAsset(this.textureId);
            if (image) {
                renderer.drawIsoTile(this.x, this.y, this.z, image, {
                    tileSpanX: 1,
                    tileSpanY: 1,
                    flip: this.flip
                });
            }
        }
    }
}
