import { AssetManager } from './engine/AssetManager.js';
import { Renderer } from './engine/Renderer.js';
import { Room } from './engine/Room.js';
import { GameState } from './engine/GameState.js';
import { Character } from './engine/Character.js';
import { UIManager } from './engine/UIManager.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// set initial canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Globals
let assetManager;
let renderer;
let gameState;
let uiManager;
let room;
let player;
let roommate;

// Resize handler
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (renderer) renderer.updateCenter(canvas.width / 2, canvas.height / 2);
}
window.addEventListener('resize', resizeCanvas);

// ============ PAN CONTROLs ============
let isPanning = false;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isPanning) {
        isPanning = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mousedown', (e) => {
    isDragging = false;
    if (isPanning) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning && e.buttons === 1) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;

        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            isDragging = true;
        }

        if (renderer) renderer.pan(deltaX, deltaY);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    if (isPanning) {
        canvas.style.cursor = 'grab';
    }
});

canvas.addEventListener('contextmenu', (e) => {
    if (isPanning) {
        e.preventDefault();
    }
});

// INTERACTION
canvas.addEventListener('click', (e) => {
    if (isPanning || isDragging || !renderer || !gameState || !uiManager || !player || !roommate) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridPos = renderer.isoToCart(x, y);
    console.log(`Clicked grid: ${gridPos.x}, ${gridPos.y}`);

    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const rx = Math.floor(roommate.x);
    const ry = Math.floor(roommate.y);

    if (gridPos.x === px && gridPos.y === py) {
        console.log('Player clicked');
        uiManager.showPlayerMenu();

    } else if (gridPos.x === rx && gridPos.y === ry) {
        console.log('Roommate clicked');

        // Interaction cost logic
        if (gameState.spendPoints(5)) {
            const dialogues = [
                "Only 5 more minutes of sleep...",
                "Did you do the laundry yet?",
                "I'm thinking about becoming a professional napper.",
                "Work hard so I don't have to!",
                "Have you seen the remote?"
            ];
            const text = dialogues[Math.floor(Math.random() * dialogues.length)];
            uiManager.showDialogue('Roommate', text);
        } else {
            uiManager.showDialogue('Roommate', "(You need 5 points to wake them up!)");
        }
    }
});

// ============ TILE REGISTRY & LAYERS ============
const warmshadow = 'rgba(87, 47, 21, 0.25)';

const tileRegistry = {
    'wg+': { type: 'floor', asset: 'floor', height: 1 },
    'wg-': { type: 'floor_rev', asset: 'floor_rev', height: 1 },
    'gg+': { type: 'floor_green_tile', asset: 'floor_green_tile', height: 1 },
    'bw+': { type: 'floor_bw_tile', asset: 'floor_bw_tile', height: 1 },
    'wl+': { type: 'floor_lofted', asset: 'floor_lofted', height: 1 },
    'wl-': { type: 'floor_lofted_rev', asset: 'floor_lofted_rev', height: 1 },

    'ng+': { type: 'wall', asset: 'wall', height: 1 },
    'ng-': { type: 'wall', asset: 'wall', height: 1, flip: true, shadow: warmshadow },

    'sg+': { type: 'wall_striped', asset: 'wall_striped', height: 1 },
    'sg-': { type: 'wall_striped', asset: 'wall_striped', height: 1, flip: true, shadow: warmshadow },
    'Sg+': { type: 'wall_striped_baseboard', asset: 'wall_striped_baseboard', height: 1 },
    'Sg-': { type: 'wall_striped_baseboard', asset: 'wall_striped_baseboard', height: 1, flip: true, shadow: warmshadow },

    'sl+': { type: 'wall_striped_lofted', asset: 'wall_striped_lofted', height: 1 },
    'sl-': { type: 'wall_striped_lofted', asset: 'wall_striped_lofted', height: 1, flip: true, shadow: warmshadow },

    'si+': { type: 'wall_striped_interior', asset: 'wall_striped_interior', height: 1, shadow: warmshadow },

    'bg+': { type: 'wall_brick', asset: 'wall_brick', height: 1 },
    'bg-': { type: 'wall_brick', asset: 'wall_brick', height: 1, flip: true, shadow: warmshadow },

    'fu1': { type: 'furniture', asset: 'furniture', height: 1},
    'bl1': { type: 'large_bookshelf', asset: 'bookshelf', height: 1, tileSpanX: 2, tileSpanY: 3 },
    'pl1': { type: 'plant', asset: 'plant1', height: 1 },
    'rg1': { type: 'green_rug', asset: 'green_rug', height: 1, tileSpanX: 3, tileSpanY: 3 },
    'rg2': { type: 'dark_green_rug', asset: 'dark_green_rug', height: 1, tileSpanX: 3, tileSpanY: 3 },
    'cg1': { type: 'green_couch', asset: 'couch', height: 1, tileSpanX: 2.5, tileSpanY: 2.5 },

    'wd1': { type: 'window_small_rect', asset: 'furniture', height: 1, tileSpanX: 2, tileSpanY: 1, verticalOffset: 1.5 },
    'wd2': { type: 'window_large_arched', asset: 'window_tall', height: 1, tileSpanX: 2, tileSpanY: 2, verticalOffset: -1.9 },
    'st1': { type: 'stairs', asset: 'stairs', height: 1, tileSpanX: 3, tileSpanY: 3, verticalOffset: -2 },
    '[ ]': { type: 'empty', asset: null }
};

const baseLayer = [
    "sg-sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+sg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-wg+wg-wg+",
    "sg-gg+gg+gg+wg-wg+wg-wg+wg-wg+wg-wg+wg-",
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-[ ][ ][ ]",
    "sg-wg+wg-wg+wg-wg+wg-wg+wg-wg+[ ][ ][ ]",
    "sg-wg-wg+wg-wg+wg-wg+wg-wg+wg-[ ][ ][ ]",
    "sg-bw+bw+bw+bw+bw+bw+[ ][ ][ ][ ][ ][ ]",
    "sg-bw+bw+bw+bw+bw+bw+[ ][ ][ ][ ][ ][ ]",
    "sg-bw+bw+bw+bw+bw+bw+[ ][ ][ ][ ][ ][ ]",
];

const loftLayer = [
    "sg+sg+sg+sg+sg+sg+sl+sl+sl+sl+sl+sl+sl+",
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl-wl+wl-wl+wl-[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl-wl+wl-wl+wl-[ ][ ][ ][ ][ ][ ][ ]",
    "sg-wl+wl-wl+wl-wl+[ ][ ][ ][ ][ ][ ][ ]",
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "sl-[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

const furnitureLayer0 = [
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ]rg2[ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "si+si+[ ]si+si+si+[ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

const furnitureLayer1 = [
    "[ ][ ][ ][ ][ ]bl1[ ][ ]cg1[ ]pl1[ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

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

// INIT
async function init() {
    try {
        console.log('Initializing game...');

        assetManager = new AssetManager();
        renderer = new Renderer(ctx);
        gameState = new GameState();
        resizeCanvas();

        uiManager = new UIManager(gameState);

        room = new Room([
            baseLayer,
            furnitureLayer0,
            furnitureLayer1,
            { data: loftLayer, zOffset: 5 },
            { data: furnitureLayer2, zOffset: 5 }
        ], tileRegistry);

        const dims = room.getDimensions();
        renderer.setRoomDimensions(dims.width / 3, dims.height);

        player = new Character('Player', 7, 5, 'player');
        roommate = new Character('Roommate', 6, 6, 'roommate');

        await assetManager.loadAssets({
            'floor': './assets/wood_floor.png',
            'floor_rev': './assets/wood_floor_reversed.png',
            'floor_green_tile': './assets/green_tile_floor.png',
            'floor_bw_tile': './assets/bw_tile_floor.png',
            'floor_lofted': './assets/wood_floor_lofted.png',
            'floor_lofted_rev': './assets/wood_floor_reversed_lofted.png',
            'wall': './assets/generic_cube_wall.png',
            'wall_striped': './assets/striped_wall_short_baseboard.png',
            'wall_striped_baseboard': './assets/striped_wall_tall_baseboard.png',
            'wall_striped_lofted': './assets/striped_wall_loft.png',
            'wall_striped_interior': './assets/striped_wall_interior.png',
            'wall_brick': './assets/brick_wall.png',
            'furniture': './assets/furniture.png',
            'bookshelf': './assets/bookshelf.png',
            'green_rug': './assets/green_rug.png',
            'dark_green_rug': './assets/dark_green_rug.png',
            'plant1': './assets/plant1.png',
            'window_tall': './assets/window_tall.png',
            'couch': './assets/couch.png',
            'stairs': './assets/stairs.png',
            'player': './assets/player.png',
            'roommate': './assets/roommate.png'
        });

        console.log('Assets loaded. Starting game loop.');
        gameLoop();
    } catch (err) {
        console.error(`Init error: ${err.message}`);
        alert(`Error initializing game: ${err.message}`);
    }
}

function gameLoop() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render characters
    const entities = [];
    if (player) entities.push(player);
    if (roommate) entities.push(roommate);

    if (room && renderer && assetManager) {
        room.render(renderer, assetManager, entities);
    }

    requestAnimationFrame(gameLoop);
}

init();
