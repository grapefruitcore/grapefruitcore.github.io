import { AssetManager } from './engine/AssetManager.js';
import { Renderer } from './engine/Renderer.js';
import { Room } from './engine/Room.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// set initial canvas size before creating renderer
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const assetManager = new AssetManager();
const renderer = new Renderer(ctx);

// Resize handler - must come after renderer is created
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.updateCenter(canvas.width / 2, canvas.height / 2);
}
window.addEventListener('resize', resizeCanvas);

// ============ PAN CONTROLs ============
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Track spacebar state
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isPanning) {
        isPanning = true;
        canvas.style.cursor = 'grab';
        e.preventDefault(); // Prevent page scroll
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
});

// Track mouse movement for panning
canvas.addEventListener('mousedown', (e) => {
    if (isPanning) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning && e.buttons === 1) { // Left mouse button held
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        renderer.pan(deltaX, deltaY);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    if (isPanning) {
        canvas.style.cursor = 'grab';
    }
});

// Prevent context menu during pan
canvas.addEventListener('contextmenu', (e) => {
    if (isPanning) {
        e.preventDefault();
    }
});

// ============ TILE REGIsTRY ============
// New 3-character Naming Convention:
// Floors: [Type][Ground/Loft][Reserved/Normal] -> eg. wg+ (Wood, Ground, Normal/Left), wg- (Wood, Ground, Reversed/Right)
// Walls: [Type][Ground/Loft][Left(+)/Right(-)] -> eg. sg+ (striped, Ground, Left), sg- (striped, Ground, Right)
// Furniture: [Type (2)][Num] -> eg. rg1 (Rug 1)

const warmshadow = 'rgba(87, 47, 21, 0.25)'; // Warm orange-brown shadow

const tileRegistry = {
    // Floors
    'wg+': { type: 'floor', asset: 'floor', height: 1 },                 // .
    'wg-': { type: 'floor_rev', asset: 'floor_rev', height: 1 },         // ,
    'gg+': { type: 'floor_green_tile', asset: 'floor_green_tile', height: 1 }, // -
    'wl+': { type: 'floor_lofted', asset: 'floor_lofted', height: 1 },   // ^
    'wl-': { type: 'floor_lofted_rev', asset: 'floor_lofted_rev', height: 1 }, // +

    // Walls
    'ng+': { type: 'wall', asset: 'wall', height: 1 },           // W (Generic left)
    'ng-': { type: 'wall', asset: 'wall', height: 1, flip: true, shadow: warmshadow }, // w (Generic right)

    'sg+': { type: 'wall_striped', asset: 'wall_striped', height: 1 },           // s (striped left)
    'sg-': { type: 'wall_striped', asset: 'wall_striped', height: 1, flip: true, shadow: warmshadow }, // s (striped right)
    'Sg+': { type: 'wall_striped_baseboard', asset: 'wall_striped_baseboard', height: 1 },           // s (striped left)
    'Sg-': { type: 'wall_striped_baseboard', asset: 'wall_striped_baseboard', height: 1, flip: true, shadow: warmshadow }, // s (striped right)

    'sl+': { type: 'wall_striped_lofted', asset: 'wall_striped_lofted', height: 1 }, // L
    'sl-': { type: 'wall_striped_lofted', asset: 'wall_striped_lofted', height: 1, flip: true, shadow: warmshadow }, // l

    'bg+': { type: 'wall_brick', asset: 'wall_brick', height: 1 },           // B
    'bg-': { type: 'wall_brick', asset: 'wall_brick', height: 1, flip: true, shadow: warmshadow }, // b

    // Furniture
    'fu1': { type: 'furniture', asset: 'furniture', height: 1 },
    'pl1': { type: 'plant1', asset: 'plant1', height: 1 },
    'rg1': { type: 'green_rug', asset: 'green_rug', height: 1, tileSpanX: 3, tileSpanY: 3 },
    'rg2': { type: 'dark_green_rug', asset: 'dark_green_rug', height: 1, tileSpanX: 3, tileSpanY: 3 },
    'cg1': { type: 'green_couch', asset: 'couch', height: 1, tileSpanX: 2.5, tileSpanY: 2.5 },

    // Wall Objects
    'wd1': { type: 'window_small_rect', asset: 'furniture', height: 1, tileSpanX: 2, tileSpanY: 1, verticalOffset: 1.5 },
    'wd2': { type: 'window_large_arched', asset: 'window_tall', height: 1, tileSpanX: 2, tileSpanY: 2, verticalOffset: -1.9 },
    'st1': { type: 'stairs', asset: 'stairs', height: 1, tileSpanX: 3, tileSpanY: 3, verticalOffset: -2 },
    '[ ]': { type: 'empty', asset: null }
};

// ============ ROOM LAYERs ============
// Base layer: walls and floors
const baseLayer = [
    "sg-sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+"
];

// Loft Layer (Elevated)
const loftLayer = [
    "sg+sg+sg+sg+sg+sg+sl+sl+sl+sl+sl+sl+sl+", // Wall at back of loft
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl-wl+wl-wl+wl-[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl-wl+wl-wl+wl-[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]", // Wall on left side of loft area?
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

// Furniture Layer 0
const furnitureLayer0 = [
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]", // Large window on back wall
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ]rg2[ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]", // Small window on side wall?
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

// Furniture Layer 1
const furnitureLayer1 = [
    "[ ][ ][ ][ ][ ][ ][ ][ ]cg1[ ]pl1[ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

// Furniture Layer 2
const furnitureLayer2 = [
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]wd2[ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ]st1[ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];


// Create room with multiple layers
const room = new Room([
    baseLayer,                     // Ground floor (z=0)
    furnitureLayer0,                    // Furniture on ground (z=0)
    furnitureLayer1,                     // More furniture on ground (z=0)
    { data: loftLayer, zOffset: 5 },    // Loft/second floor elevated by 5 units
    { data: furnitureLayer2, zOffset: 5 }                     // Furniture on layer 2
], tileRegistry);

// set room dimensions in renderer for proper centering
// Note: divide by 3 because each cell is 3 chars
const dims = room.getDimensions();
renderer.setRoomDimensions(dims.width / 3, dims.height);

async function init() {
    try {
        // Load assets
        await assetManager.loadAssets({
            'floor': './assets/wood_floor.png',
            'floor_rev': './assets/wood_floor_reversed.png',
            'floor_green_tile': './assets/green_tile_floor.png',
            'floor_lofted': './assets/wood_floor_lofted.png',
            'floor_lofted_rev': './assets/wood_floor_reversed_lofted.png',
            'wall': './assets/generic_cube_wall.png',
            'wall_striped': './assets/striped_wall_short_baseboard.png',
            'wall_striped_baseboard': './assets/striped_wall_tall_baseboard.png',
            'wall_striped_lofted': './assets/striped_wall_loft.png',
            'wall_brick': './assets/brick_wall.png',
            'furniture': './assets/furniture.png',
            'green_rug': './assets/green_rug.png',
            'dark_green_rug': './assets/dark_green_rug.png',
            'plant1': './assets/plant1.png',
            'window_tall': './assets/window_tall.png',
            'couch': './assets/couch.png',
            'stairs': './assets/stairs.png'
        });

        console.log('Assets loaded successfully.');
        // start game loop
        gameLoop();
    } catch (err) {
        console.error(`Failed to load assets: ${err.message}`);
    }
}

function gameLoop() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw room (all layers)
    room.render(renderer, assetManager);

    requestAnimationFrame(gameLoop);
}

init();
