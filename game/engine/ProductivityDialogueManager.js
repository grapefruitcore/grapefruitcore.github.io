export class ProductivityDialogueManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.defaultDialogues = [
            { id: 'prod_default_1', text: '...', options: [{ text: '...', effect: () => { } }] },
            { id: 'prod_default_2', text: 'Hey.', options: [{ text: 'Hey.', effect: () => { } }] },
            { id: 'prod_default_3', text: "What's up?", options: [{ text: 'Not much.', effect: () => { } }] },
        ];
    }

    getFurnitureDialogue(furnitureType) {
        // Minimal furniture dialogue in productivity mode
        return {
            text: '...',
            options: [{ text: '(Leave them alone)', effect: () => { } }]
        };
    }

    getRandomDialogue() {
        // Combine defaults with custom dialogues
        const customs = (this.gameState.customDialogues || []).map(d => ({
            id: d.id,
            text: d.text,
            options: d.options.map(opt => ({
                text: opt.text,
                onSelect: () => { }
            }))
        }));

        const defaults = this.defaultDialogues.map(d => ({
            text: d.text,
            options: d.options.map(opt => ({
                text: opt.text,
                onSelect: () => opt.effect(this.gameState)
            }))
        }));

        const all = [...defaults, ...customs];
        if (all.length === 0) return null;

        const selected = all[Math.floor(Math.random() * all.length)];
        return selected;
    }
}
