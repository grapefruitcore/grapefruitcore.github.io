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

    render(renderer, assetManager, entities = [], assetOverrides = {}) {
        // Draw room outline before tiles
        const dims = this.getDimensions();
        renderer.drawRoomOutline(dims.width / 3, dims.height);

        // Group layers by Z (preserving relative order)
        const layersByZ = new Map();

        for (const layer of this.layers) {
            const z = layer.zOffset || 0;
            if (!layersByZ.has(z)) {
                layersByZ.set(z, []);
            }
            layersByZ.get(z).push(layer);
        }

        // Group entities by Z (floored)
        const entitiesByZ = new Map();
        if (entities) {
            for (const entity of entities) {
                const z = Math.floor(entity.z || 0);
                if (!entitiesByZ.has(z)) {
                    entitiesByZ.set(z, []);
                }
                entitiesByZ.get(z).push(entity);
            }
        }

        // Get all unique Z levels sorted
        const allZs = new Set([...layersByZ.keys(), ...entitiesByZ.keys()]);
        const sortedZs = Array.from(allZs).sort((a, b) => a - b);

        // Render in order
        for (const z of sortedZs) {
            // 1. Render Layers at this Z
            if (layersByZ.has(z)) {
                for (const layer of layersByZ.get(z)) {
                    this.renderLayer(layer.data, z, renderer, assetManager, assetOverrides);
                }
            }

            // 2. Render Entities at this Z
            if (entitiesByZ.has(z)) {
                const levelEntities = entitiesByZ.get(z);
                // Sort by depth (x + y)
                levelEntities.sort((a, b) => (a.x + a.y) - (b.x + b.y));

                for (const entity of levelEntities) {
                    entity.render(renderer, assetManager);
                }
            }
        }
    }

    getTopZAt(x, y) {
        // Find the highest layer that has a non-empty tile at x,y
        // Iterate backwards through layers
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            const data = layer.data;
            if (y >= 0 && y < data.length) {
                const row = data[y];
                if (x >= 0 && x < row.length / 3) {
                    const char = row.substring(x * 3, x * 3 + 3);
                    const tileDef = this.tileRegistry[char];
                    if (tileDef && tileDef.type !== 'empty') {
                        return layer.zOffset || 0;
                    }
                }
            }
        }
        return 0; // Default to ground
    }

    renderLayer(floorplan, layerZOffset, renderer, assetManager, assetOverrides = {}) {
        for (let y = 0; y < floorplan.length; y++) {
            const row = floorplan[y];
            // Iterate by 3 characters for the new naming convention
            for (let x = 0; x < row.length / 3; x++) {
                const char = row.substring(x * 3, x * 3 + 3);
                const tileDef = this.tileRegistry[char];

                // Draw tile
                if (tileDef && tileDef.asset) {
                    let assetName = tileDef.asset;

                    // Check for override
                    // We need a unique ID for the tile to check overrides. 
                    // Using "char" is one way, but if multiple tiles have same char, all change.
                    // The requirement says "the roommate should share a tile with the bathtub".
                    // The bathtub has a unique char 'bt1'.
                    if (assetOverrides[char]) {
                        assetName = assetOverrides[char];
                    }

                    const image = assetManager.getAsset(assetName);
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

    getObjectAt(x, y) {
        // Iterate mainly through furniture/overlay layers first? 
        // Or just iterate backwards through layers to find the top-most interactable
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i].data;
            if (y >= 0 && y < layer.length) {
                const row = layer[y];
                if (x >= 0 && x < row.length / 3) {
                    const char = row.substring(x * 3, x * 3 + 3);
                    const tileDef = this.tileRegistry[char];
                    if (tileDef && tileDef.type !== 'empty') {
                        return tileDef;
                    }
                }
            }
        }
        return null;
    }

    getInteractionTarget(renderer, screenX, screenY) {
        // Iterate backwards (top layers first)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layerObj = this.layers[i];
            const z = layerObj.zOffset || 0;
            const layerData = layerObj.data;

            // Adjust screenY because of Z height
            // VisualY = BaseY - z*th
            // BaseY = VisualY + z*th
            const adjustedY = screenY + (z * renderer.tileHeight);

            const gridPos = renderer.isoToCart(screenX, adjustedY);

            // Check bounds
            if (gridPos.y >= 0 && gridPos.y < layerData.length &&
                gridPos.x >= 0) {

                const row = layerData[gridPos.y];
                if (gridPos.x < row.length / 3) {
                    const char = row.substring(gridPos.x * 3, gridPos.x * 3 + 3);
                    const tileDef = this.tileRegistry[char];

                    if (tileDef && tileDef.type !== 'empty') {
                        return { x: gridPos.x, y: gridPos.y, z: z, tile: tileDef };
                    }
                }
            }
        }

        // Return null if nothing hit, let main handle fallback
        return null;
    }
}
