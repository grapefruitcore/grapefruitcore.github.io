export class AssetManager {
    constructor() {
        this.assets = {};
    }

    async loadAssets(assetList) {
        const promises = [];
        for (const [name, path] of Object.entries(assetList)) {
            promises.push(this.loadImage(name, path));
        }
        await Promise.all(promises);
    }

    loadImage(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.assets[name] = img;
                resolve(img);
            };
            img.onerror = (err) => {
                reject(new Error(`Failed to load image ${path}: ${err}`));
            };
        });
    }

    getAsset(name) {
        return this.assets[name];
    }
}
