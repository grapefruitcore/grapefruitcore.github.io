export class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.tileWidth = 128; // Width of the tile sprite
        this.tileHeight = 64; // Height of the *isometric* tile (usually half width)
        this.offsetX = ctx.canvas.width / 2; // Center of the screen
        this.offsetY = ctx.canvas.height / 2; // Center of the screen

        // Pan offset (applied on top of center offset)
        this.panX = 0;
        this.panY = 0;

        // Room dimensions for centering (default 8x8)
        this.roomWidth = 8;
        this.roomHeight = 8;

        // Offscreen canvas for shadow compositing (reused for performance)
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }

    updateCenter(x, y) {
        this.offsetX = x;
        this.offsetY = y;
    }

    setRoomDimensions(width, height) {
        this.roomWidth = width;
        this.roomHeight = height;
    }

    /**
     * Apply pan offset with boundary clamping
     */
    pan(deltaX, deltaY) {
        const roomPixelWidth = (this.roomWidth + this.roomHeight) * (this.tileWidth / 2);
        const roomPixelHeight = (this.roomWidth + this.roomHeight) * (this.tileHeight / 2);

        const maxPanX = roomPixelWidth / 2;
        const maxPanY = roomPixelHeight / 2;

        this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX + deltaX));
        this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY + deltaY));
    }

    resetPan() {
        this.panX = 0;
        this.panY = 0;
    }

    /**
     * Converts cartesian coordinates to isometric screen coordinates.
     */
    cartToIso(x, y) {
        const centerX = this.roomWidth / 2;
        const centerY = this.roomHeight / 2;

        const shiftedX = x - centerX;
        const shiftedY = y - centerY;

        const isoX = (shiftedX - shiftedY) * (this.tileWidth / 2) + this.offsetX + this.panX;
        const isoY = (shiftedX + shiftedY) * (this.tileHeight / 2) + this.offsetY + this.panY;

        return { x: isoX, y: isoY };
    }

    /**
     * Converts screen coordinates to cartesian grid coordinates.
     * Inverse of cartToIso.
     */
    isoToCart(screenX, screenY) {
        // Adjust for center offset and pan
        const adjX = screenX - this.offsetX - this.panX;
        const adjY = screenY - this.offsetY - this.panY;

        // Solve the system of equations from cartToIso:
        // isoX = (shiftedX - shiftedY) * (tileWidth / 2)
        // isoY = (shiftedX + shiftedY) * (tileHeight / 2)

        // Let A = shiftedX, B = shiftedY
        // adjX = (A - B) * (w/2)  => (A - B) = adjX / (w/2)
        // adjY = (A + B) * (h/2)  => (A + B) = adjY / (h/2)

        // Summing the two equations:
        // 2A = adjX / (w/2) + adjY / (h/2)
        // A = 0.5 * (adjX / (w/2) + adjY / (h/2))

        // Subtracting:
        // 2B = adjY / (h/2) - adjX / (w/2)
        // B = 0.5 * (adjY / (h/2) - adjX / (w/2))

        const halfW = this.tileWidth / 2;
        const halfH = this.tileHeight / 2;

        const shiftedX = 0.5 * (adjX / halfW + adjY / halfH);
        const shiftedY = 0.5 * (adjY / halfH - adjX / halfW);

        // Add back the center offset of the room
        const centerX = this.roomWidth / 2;
        const centerY = this.roomHeight / 2;

        return {
            x: Math.floor(shiftedX + centerX),
            y: Math.floor(shiftedY + centerY)
        };
    }

    /**
     * Apply shadow overlay to an image, respecting alpha channel
     * @param {Image} image - Source image
     * @param {number} destWidth - Destination width
     * @param {number} destHeight - Destination height  
     * @param {string} shadowColor - Shadow color (rgba)
     * @param {boolean} flip - Whether to flip horizontally
     * @returns {HTMLCanvasElement} - Canvas with shadowed image
     */
    createShadowedImage(image, destWidth, destHeight, shadowColor, flip) {
        // Resize offscreen canvas if needed
        if (this.offscreenCanvas.width < destWidth || this.offscreenCanvas.height < destHeight) {
            this.offscreenCanvas.width = Math.max(this.offscreenCanvas.width, destWidth);
            this.offscreenCanvas.height = Math.max(this.offscreenCanvas.height, destHeight);
        }

        const ctx = this.offscreenCtx;
        ctx.clearRect(0, 0, destWidth, destHeight);

        // Draw the image (with flip if needed)
        ctx.save();
        if (flip) {
            ctx.translate(destWidth, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(image, 0, 0, destWidth, destHeight);
        ctx.restore();

        // Apply shadow using source-atop to only affect opaque pixels
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = shadowColor;
        ctx.fillRect(0, 0, destWidth, destHeight);
        ctx.restore();

        return this.offscreenCanvas;
    }

    /**
     * Draw an isometric tile with optional horizontal flip and multi-tile support
     */
    drawIsoTile(x, y, z, image, options = {}) {
        const flip = options.flip || false;
        const tileSpanX = options.tileSpanX || 1;
        const tileSpanY = options.tileSpanY || 1;
        const shadow = options.shadow || null;

        const centerOffsetX = (tileSpanX - 1) / 2;
        const centerOffsetY = (tileSpanY - 1) / 2;

        const pos = this.cartToIso(x + centerOffsetX, y + centerOffsetY);
        const zOffset = z * (this.tileHeight);

        if (image) {
            const destWidth = this.tileWidth * tileSpanX;
            const scale = destWidth / image.width;
            const destHeight = image.height * scale;

            const drawX = pos.x - destWidth / 2;
            const drawY = (pos.y - destHeight + this.tileHeight) - zOffset;

            if (shadow) {
                // Use offscreen canvas to apply shadow with alpha masking
                const shadowedCanvas = this.createShadowedImage(image, Math.ceil(destWidth), Math.ceil(destHeight), shadow, flip);
                this.ctx.drawImage(shadowedCanvas, 0, 0, destWidth, destHeight, drawX, drawY, destWidth, destHeight);
            } else if (flip) {
                this.ctx.save();
                this.ctx.translate(pos.x, 0);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(image, -destWidth / 2, drawY, destWidth, destHeight);
                this.ctx.restore();
            } else {
                this.ctx.drawImage(image, drawX, drawY, destWidth, destHeight);
            }
        }
    }
}
