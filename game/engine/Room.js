export class Room {
    /**
     * Create a room with layered floorplans
     * @param {Array} layers - Array of layer configs. Each can be:
     *   - A string array (floorplan at z=0)
     *   - An object { data: string[], zOffset: number } for elevated layers
     * @param {Object} tileRegistry - Tile definitions
     */
    constructor(layers, tileRegistry) {
        // Normalize layers to objects with { data, zOffset }
        this.layers = layers.map(layer => {
            if (Array.isArray(layer) && typeof layer[0] === 'string') {
                // Simple string array, default zOffset = 0
                return { data: layer, zOffset: 0 };
            } else if (layer.data) {
                // Already an object with data property
                return { data: layer.data, zOffset: layer.zOffset || 0 };
            } else {
                // Fallback
                return { data: layer, zOffset: 0 };
            }
        });
        this.tileRegistry = tileRegistry;
    }

    /**
     * Add a furniture/overlay layer
     * @param {string[]|Object} layer - Floorplan layer to add (string array or { data, zOffset })
     */
    addLayer(layer) {
        if (Array.isArray(layer)) {
            this.layers.push({ data: layer, zOffset: 0 });
        } else {
            this.layers.push({ data: layer.data, zOffset: layer.zOffset || 0 });
        }
    }

    /**
     * Get the base layer dimensions
     */
    getDimensions() {
        const baseLayer = this.layers[0].data;
        return {
            width: baseLayer[0] ? baseLayer[0].length : 0,
            height: baseLayer.length
        };
    }

    render(renderer, assetManager) {
        // Render each layer in order (base first, then overlays)
        for (const layer of this.layers) {
            this.renderLayer(layer.data, layer.zOffset, renderer, assetManager);
        }
    }

    renderLayer(floorplan, layerZOffset, renderer, assetManager) {
        for (let y = 0; y < floorplan.length; y++) {
            const row = floorplan[y];
            // Iterate by 3 characters for the new naming convention
            for (let x = 0; x < row.length / 3; x++) {
                const char = row.substring(x * 3, x * 3 + 3);
                const tileDef = this.tileRegistry[char];

                if (tileDef && tileDef.asset) {
                    const image = assetManager.getAsset(tileDef.asset);
                    if (image) {
                        const height = tileDef.height || 1;
                        const options = {
                            flip: tileDef.flip || false,
                            tileSpanX: tileDef.tileSpanX || 1,
                            tileSpanY: tileDef.tileSpanY || 1,
                            shadow: tileDef.shadow || null
                        };
                        const verticalOffset = tileDef.verticalOffset || 0;
                        // Apply layer z-offset to all tiles in this layer
                        for (let z = 0; z < height; z++) {
                            renderer.drawIsoTile(x, y, z + layerZOffset + verticalOffset, image, options);
                        }
                    }
                }
            }
        }
    }
}
