import { AssetManager } from './engine/AssetManager.js';
import { Renderer } from './engine/Renderer.js';
import { Room } from './engine/Room.js';
import { GameState } from './engine/GameState.js';
import { Character } from './engine/Character.js';
import { UIManager } from './engine/UIManager.js';
import { DialogueManager } from './engine/DialogueManager.js';

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
let dialogueManager;
let hoverGridPos = null;

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
let currentMouseX = 0;
let currentMouseY = 0;

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
        // Immediately restore hover state
        if (renderer && room) {
            const target = room.getInteractionTarget(renderer, currentMouseX, currentMouseY);
            if (target) {
                hoverGridPos = target;
            } else {
                // Fallback to ground plane
                const pos = renderer.isoToCart(currentMouseX, currentMouseY);
                hoverGridPos = { x: pos.x, y: pos.y, z: 0 };
            }
        }
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
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentMouseX = x;
    currentMouseY = y;

    if (isPanning && e.buttons === 1) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;

        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            isDragging = true;
        }

        if (renderer) renderer.pan(deltaX, deltaY);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Hide hover when panning
        hoverGridPos = null;
    } else {
        // Update hover position if not panning
        if (renderer && room) {
            const target = room.getInteractionTarget(renderer, x, y);
            if (target) {
                hoverGridPos = target;
            } else {
                // Fallback to ground plane
                const pos = renderer.isoToCart(x, y);
                hoverGridPos = { x: pos.x, y: pos.y, z: 0 };
            }
        }
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
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

    // Check interaction target directly
    let interactionTarget = null;
    if (room) {
        interactionTarget = room.getInteractionTarget(renderer, x, y);
    }

    // Default grid pos for ground movement if nothing hit
    let gridPos = interactionTarget || renderer.isoToCart(x, y);
    console.log(`Clicked grid: ${gridPos.x}, ${gridPos.y}, z: ${gridPos.z || 0}`);

    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const rx = Math.floor(roommate.x);
    const ry = Math.floor(roommate.y);

    if (gridPos.x === px && gridPos.y === py) {
        console.log('Player clicked');
        uiManager.showPlayerMenu();

    } else if (gridPos.x === rx && gridPos.y === ry && !gameState.roommateActivity) {
        console.log('Roommate clicked');

        // Move player next to roommate
        // Check Z height at destination
        const destZ = room.getTopZAt(rx + 1, ry - 1);
        player.setPosition(rx + 1, ry - 1, destZ);

        // Interaction cost logic
        if (gameState.spendPoints(5)) {
            const dialogue = dialogueManager.getRandomDialogue();
            if (dialogue) {
                uiManager.showDialogue('Roommate', dialogue.text, dialogue.options, dialogue.emotion);
            } else {
                uiManager.showDialogue('Roommate', "They seem busy right now.");
            }
        } else {
            uiManager.showDialogue('Roommate', "(You need 5 points to talk to them!)");
        }
    } else {
        // Check for furniture interaction from the target we found
        const tile = interactionTarget ? interactionTarget.tile : room.getObjectAt(gridPos.x, gridPos.y);

        // Check for ACTIVE roommate interaction on this tile
        // We need to know if this tile is the one the roommate is using
        // We can get the char code from the room layer data, but we don't have easy access to it here without re-querying.
        // However, we can check if the clicked tile type matches the activity type? 
        // Or better yet, check if the clicked global coordinate matches the activity, but activity stores ID 'bt1', not coordinate.

        let handled = false;

        if (gameState.roommateActivity && tile) {
            // Simplified check: if the tile type matches the activity type
            if (gameState.roommateActivity.type === tile.type) {
                console.log('Interacting with occupied furniture:', tile.type);

                const dialogue = dialogueManager.getFurnitureDialogue(gameState.roommateActivity.type);
                if (dialogue) {
                    handled = true;
                    // Interaction cost logic for occupied furniture
                    if (gameState.spendPoints(5)) {
                        // Move player near furniture (default furniture pos)
                        let sx = gridPos.x;
                        let sy = gridPos.y;
                        // Use specific offsets if defined
                        if (tile.interaction && tile.interaction.offset) {
                            sx += tile.interaction.offset.x;
                            sy += tile.interaction.offset.y;
                        } else {
                            sx += 1;
                        }
                        const destZ = room.getTopZAt(sx, sy);
                        player.setPosition(sx, sy, destZ);

                        // Show dialogue
                        uiManager.showDialogue('Roommate', dialogue.text, dialogue.options, dialogue.emotion);
                    } else {
                        uiManager.showDialogue('Roommate', "(You need 5 points to disturb them!)");
                    }
                }
            }
        }

        if (!handled && tile && tile.interaction) {
            console.log('Furniture clicked:', tile.type);

            // Determine stand position
            let sx = gridPos.x;
            let sy = gridPos.y;

            if (tile.interaction.offset) {
                sx += tile.interaction.offset.x;
                sy += tile.interaction.offset.y;
            } else {
                // Default: one tile "forward" (let's assume +1 x for consistency with roommate example)
                sx += 1;
            }

            // Move player to target position with correct Z
            const destZ = room.getTopZAt(sx, sy);
            player.setPosition(sx, sy, destZ);

            // Process text formatting
            let text = tile.interaction.text;
            if (gameState) {
                text = text.replace(/\[roommate_name\]/g, gameState.roommateName || "Roommate");
                text = text.replace(/\[player_name\]/g, gameState.playerName || "You");
            }

            // Format speaker name from type (e.g. "large_bookshelf" -> "Large Bookshelf")
            const speakerName = tile.type
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            // Show dialogue
            uiManager.showDialogue(speakerName, text);
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
    'ti+': { type: 'wall_tiled_interior', asset: 'wall_tiled_interior', height: 3 },
    'fi+': { type: 'fence', asset: 'fence', height: 1 },
    'fi-': { type: 'fence', asset: 'fence', height: 1, flip: true },

    'bg+': { type: 'wall_brick', asset: 'wall_brick', height: 1 },
    'bg-': { type: 'wall_brick', asset: 'wall_brick', height: 1, flip: true, shadow: warmshadow },

    'pc1': { type: 'concrete_porch', asset: 'concrete_porch', height: 1 },

    'fu1': { type: 'furniture', asset: 'furniture', height: 1 },
    'bl1': { type: 'large_bookshelf', asset: 'bookshelf', height: 1, tileSpanX: 2, tileSpanY: 3 },
    'pl1': { type: 'plant', asset: 'plant1', height: 1 },
    'rg1': { type: 'green_rug', asset: 'green_rug', height: 1, tileSpanX: 3, tileSpanY: 3 },
    'rg2': {
        type: 'dark_green_rug',
        asset: 'dark_green_rug',
        height: 1,
        tileSpanX: 3,
        tileSpanY: 3,
        interaction: {
            text: "I need to vacuum.",
            offset: { x: 1, y: 1 }
        }
    },
    'cg1': { type: 'green_couch', asset: 'couch', height: 1, tileSpanX: 2.5, tileSpanY: 2.5 },
    'bt1': {
        type: 'bathtub',
        asset: 'bathtub',
        height: 1,
        tileSpanX: 2,
        tileSpanY: 3,
        interaction: {
            text: "Should I shower?",
            offset: { x: -3, y: 0 }
        }
    },
    'si1': { type: 'sink', asset: 'sink', height: 1, tileSpanX: 1, tileSpanY: 2 },
    'bd1': {
        type: 'bed',
        asset: 'bed',
        height: 1,
        tileSpanX: 2,
        tileSpanY: 2,
        flip: true,
        verticalOffset: -0.5,
        interaction: {
            text: "This is [roommate_name]'s bed.",
            offset: { x: 3, y: 0 }
        }
    },
    'bd2': {
        type: 'bunk_bed',
        asset: 'bunk_bed',
        height: 1,
        tileSpanX: 2,
        tileSpanY: 3,
        verticalOffset: -0.2,
        interaction: {
            text: "Should I take a nap?",
            offset: { x: 1, y: 1 }
        }
    },
    'rd1': { type: 'room_divider', asset: 'room_divider', height: 2, tileSpanX: 1, tileSpanY: 1, verticalOffset: -0.2 },
    'tb1': { type: 'rect_table', asset: 'rect_table', height: 1, tileSpanX: 2, tileSpanY: 2, flip: true },
    'tb2': { type: 'round_table', asset: 'round_table', height: 1, tileSpanX: 1.25, tileSpanY: 1 },
    'kc1': { type: 'kitchen_counter', asset: 'kitchen_counter', height: 1, tileSpanX: 1.5, tileSpanY: 1.5 },
    'kc2': { type: 'kitchen_counter_sink', asset: 'kitchen_counter_sink', height: 1, tileSpanX: 1.5, tileSpanY: 1.5 },
    'kc3': { type: 'kitchen_counter_stove', asset: 'kitchen_counter_stove', height: 1, tileSpanX: 1.5, tileSpanY: 1.5 },
    'fr1': { type: 'fridge', asset: 'fridge', height: 1, tileSpanX: 1, tileSpanY: 2 },

    'wd1': { type: 'window_small', asset: 'window_small', height: 1, tileSpanX: 2, tileSpanY: 1, verticalOffset: 0.9 },
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
    "sg-gg+gg+gg+wg+wg-wg+wg-wg+wg-pc1pc1[ ]",
    "sg-wg+wg-wg+wg-wg+wg-wg+wg-wg+pc1pc1[ ]",
    "sg-wg-wg+wg-wg+wg-wg+wg-wg+wg-pc1pc1[ ]",
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
    "[ ]wd1[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "kc2[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ]rg2[ ][ ][ ]",
    "kc3[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "fr1[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "tb2[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "si+si+[ ]si+ti+ti+[ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

const furnitureLayer1 = [
    "[ ][ ][ ][ ][ ]bl1[ ][ ]cg1[ ]pl1[ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ]tb1[ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]pl1[ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "si1[ ][ ][ ][ ]bt1[ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

const furnitureLayer2 = [
    "bd2[ ]wd1[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]wd2[ ][ ]",
    "rd1[ ][ ][ ][ ]fi-[ ][ ][ ][ ][ ][ ][ ]",
    "bd1[ ][ ][ ][ ]fi-[ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ]fi-[ ]st1[ ][ ][ ][ ][ ]",
    "fi+fi+fi+fi+fi+[ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]",
    "[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]"
];

// INIT
async function init() {
    try {
        console.log('Initializing game...');

        assetManager = new AssetManager();
        renderer = new Renderer(ctx);
        gameState = new GameState();
        window.gameState = gameState; // Expose for debugging

        // Load Date Stories
        fetch('./misc/date_stories.txt')
            .then(response => response.text())
            .then(text => {
                gameState.loadDateStories(text);
                gameState.checkDailyReset(new Date());
            })
            .catch(err => {
                console.error("Failed to load date stories:", err);
                // Still check reset even if stories fail, just won't have date content
                gameState.checkDailyReset(new Date());
            });

        resizeCanvas();

        uiManager = new UIManager(gameState, assetManager);
        dialogueManager = new DialogueManager(gameState);

        room = new Room([
            baseLayer,
            furnitureLayer0,
            furnitureLayer1,
            { data: loftLayer, zOffset: 5 },
            { data: furnitureLayer2, zOffset: 5 }
        ], tileRegistry);

        const dims = room.getDimensions();
        renderer.setRoomDimensions(dims.width / 3, dims.height);

        player = new Character('Player', 8, 7, 'player');
        roommate = new Character('Roommate', 9, 3, 'roommate');

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
            'wall_tiled_interior': './assets/tiled_wall_interior.png',
            'wall_brick': './assets/brick_wall.png',
            'furniture': './assets/furniture.png',
            'bookshelf': './assets/bookshelf.png',
            'green_rug': './assets/green_rug.png',
            'dark_green_rug': './assets/dark_green_rug.png',
            'plant1': './assets/plant1.png',
            'window_tall': './assets/window_tall.png',
            'window_small': './assets/window_small.png',
            'couch': './assets/couch.png',
            'couch_with_roommate': './assets/couch_with_roommate.png',
            'bathtub': './assets/bathtub.png',
            'bathtub_with_roommate': './assets/bathtub_with_roommate.png',
            'stairs': './assets/stairs.png',
            'player': './assets/player.png',
            'roommate': './assets/roommate.png',
            'roommate_dialogue': './assets/roommate_dialogue.png',
            'roommate_dialogue_happy': './assets/roommate_dialogue_happy.png',
            'roommate_dialogue_sad': './assets/roommate_dialogue_sad.png',
            'roommate_dialogue_nervous': './assets/roommate_dialogue_nervous.png',
            'sink': './assets/sink.png',
            'rect_table': './assets/rect_table.png',
            'round_table': './assets/round_table.png',
            'kitchen_counter': './assets/kitchen_counter.png',
            'concrete_porch': './assets/concrete_porch.png',
            'kitchen_counter_sink': './assets/kitchen_counter_sink.png',
            'kitchen_counter_stove': './assets/kitchen_counter_stove.png',
            "bed": "./assets/bed.png",
            "bunk_bed": "./assets/bunk_bed.png",
            "room_divider": "./assets/room_divider.png",
            "fence": "./assets/fence.png",
            "fridge": "./assets/fridge.png"
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

    if (room && renderer && assetManager) {
        // Prepare entities
        // const entities = [player]; // This line is removed as entities is already declared and player added above.

        // Check roommate activity
        const assetOverrides = {};
        let showRoommate = true;

        if (gameState.roommateActivity) {
            // Roommate is busy with furniture
            showRoommate = false;

            // Map activity type to asset override
            // e.g. type "bathtub" -> override the bathtub tile with "bathtub_with_roommate"
            // We need to know WHICH tile char corresponds to the furniture.
            // For now, hardcode mapping based on requirements
            if (gameState.roommateActivity.type === 'bathtub') {
                // 'bt1' is the bathtub tile char in main.js logic (we need to verify this or find it dynamically)
                // Actually looking at main.js, we don't see the map definition here, it's likely passed to Room constructor.
                // But we know 'bathtub' asset is used by 'bt1' (implied).
                // Let's assume 'bt1' is the char.
                assetOverrides['bt1'] = 'bathtub_with_roommate';
            } else if (gameState.roommateActivity.type === 'green_couch') {
                assetOverrides['cg1'] = 'couch_with_roommate';
            }
        }

        if (showRoommate) {
            entities.push(roommate);
        }

        room.render(renderer, assetManager, entities, assetOverrides);

        // Draw hover highlight
        if (hoverGridPos && !isPanning && !isDragging) {
            renderer.drawHighlight(hoverGridPos.x, hoverGridPos.y, hoverGridPos.z || 0, 'rgba(100, 100, 100, 0.4)');
        }
    }

    requestAnimationFrame(gameLoop);
}

init();
