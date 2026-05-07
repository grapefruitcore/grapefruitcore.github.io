export class UIManager {
    constructor(gameState, assetManager) {
        this.gameState = gameState;
        this.assetManager = assetManager;

        // Elements
        this.pointsEl = document.getElementById('points-value');
        this.pomodoroOverlay = document.getElementById('pomodoro-overlay');
        this.habitsOverlay = document.getElementById('habits-overlay');
        this.dialogueOverlay = document.getElementById('dialogue-overlay');

        this.timerDisplay = document.getElementById('timer-display');
        this.habitsList = document.getElementById('habits-list');
        this.dialogueText = document.getElementById('dialogue-text');
        this.dialoguePortrait = document.getElementById('dialogue-portrait');
        this.dialogueSpeaker = document.getElementById('dialogue-speaker');
        this.dialogueOptions = document.getElementById('dialogue-options');
        this.nextDialogueBtn = document.getElementById('btn-next-dialogue');
        this.playerMenu = document.getElementById('player-menu');

        // Buttons
        this.setupEventListeners();

        // Listen for GameState updates
        window.addEventListener('gamestate-updated', (e) => this.onGameStateUpdate(e));
        window.addEventListener('pomodoro-updated', (e) => this.onPomodoroUpdate(e));
        window.addEventListener('date-completed', (e) => this.showDateSummary(e.detail.title, e.detail.story));

        // Initial render
        this.updatePoints();
        this.checkNameEntry();
    }

    checkNameEntry() {
        if (this.gameState.playerName === "You" || this.gameState.roommateName === "Roommate") {
            this.showNameEntryModal();
        }
    }

    showNameEntryModal() {
        // Create simple modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';

        const content = document.createElement('div');
        content.style.backgroundColor = '#fff';
        content.style.padding = '20px';
        content.style.borderRadius = '8px';
        content.style.textAlign = 'center';
        content.style.fontFamily = 'monospace';

        const title = document.createElement('h2');
        title.textContent = "Welcome to the Apartment";
        content.appendChild(title);

        const p1 = document.createElement('p');
        p1.textContent = "What is your name?";
        content.appendChild(p1);

        const input1 = document.createElement('input');
        input1.type = 'text';
        input1.value = 'Player';
        input1.style.display = 'block';
        input1.style.margin = '10px auto';
        content.appendChild(input1);

        const p2 = document.createElement('p');
        p2.textContent = "What is your roommate's name?";
        content.appendChild(p2);

        const input2 = document.createElement('input');
        input2.type = 'text';
        input2.value = 'Roommate';
        input2.style.display = 'block';
        input2.style.margin = '10px auto';
        content.appendChild(input2);

        const btn = document.createElement('button');
        btn.textContent = "Start Game";
        btn.onclick = () => {
            if (input1.value.trim()) this.gameState.playerName = input1.value.trim();
            if (input2.value.trim()) this.gameState.roommateName = input2.value.trim();
            this.gameState.saveState();
            document.body.removeChild(modal);
        };
        content.appendChild(btn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showDateSummary(title, story) {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';

        const content = document.createElement('div');
        content.style.backgroundColor = '#fffbed';
        content.style.padding = '40px';
        content.style.borderRadius = '2px';
        content.style.maxWidth = '600px';
        content.style.maxHeight = '80vh';
        content.style.overflowY = 'auto';
        content.style.fontFamily = 'Georgia, serif';
        content.style.lineHeight = '1.6';
        content.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';

        const h2 = document.createElement('h2');
        h2.textContent = title;
        h2.style.textAlign = 'center';
        h2.style.marginBottom = '20px';
        h2.style.borderBottom = '1px solid #ccc';
        h2.style.paddingBottom = '10px';
        content.appendChild(h2);

        const p = document.createElement('p');
        p.innerHTML = story.replace(/\n/g, '<br>');
        content.appendChild(p);

        const btn = document.createElement('button');
        btn.textContent = "Close";
        btn.style.marginTop = '30px';
        btn.style.display = 'block';
        btn.style.marginLeft = 'auto';
        btn.style.marginRight = 'auto';
        btn.onclick = () => document.body.removeChild(modal);
        content.appendChild(btn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    setupEventListeners() {
        // Player Menu Controls
        document.getElementById('btn-open-pomodoro').addEventListener('click', () => {
            this.showPomodoro();
            this.hidePlayerMenu();
        });
        document.getElementById('btn-open-habits').addEventListener('click', () => {
            this.showHabits();
            this.hidePlayerMenu();
        });
        document.getElementById('btn-close-menu').addEventListener('click', () => {
            this.hidePlayerMenu();
        });

        // Add Reminisce Button dynamically since it's not in HTML
        if (!document.getElementById('btn-reminisce')) {
            const menu = document.getElementById('player-menu');
            const resetBtn = document.getElementById('btn-reset-game');

            if (menu && resetBtn) {
                const btn = document.createElement('button');
                btn.id = 'btn-reminisce';
                btn.textContent = '📔 Reminisce';
                // Insert before Reset Game button
                menu.insertBefore(btn, resetBtn);

                btn.addEventListener('click', () => {
                    this.showReminisceUI();
                    this.hidePlayerMenu();
                });
            }
        }

        document.getElementById('btn-reset-game').addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all progress? Points, habits, and relationship will be lost.")) {
                this.gameState.resetState();
                this.hidePlayerMenu();
                alert("Game has been reset.");
            }
        });

        // Pomodoro Controls
        document.getElementById('btn-start-timer').addEventListener('click', () => {
            this.gameState.startTimer(30);
        });
        document.getElementById('btn-pause-timer').addEventListener('click', () => {
            if (this.gameState.pomodoro.isRunning) {
                this.gameState.pauseTimer();
            }
        });
        document.getElementById('btn-reset-timer').addEventListener('click', () => {
            this.gameState.resetTimer();
        });
        document.getElementById('btn-close-pomodoro').addEventListener('click', () => {
            this.hidePomodoro();
        });

        // Habits Controls
        document.getElementById('btn-close-habits').addEventListener('click', () => {
            this.hideHabits();
        });
        document.getElementById('btn-add-habit').addEventListener('click', () => {
            const nameInput = document.getElementById('new-habit-name');
            const countInput = document.getElementById('new-habit-count');
            const name = nameInput.value.trim();
            const count = parseInt(countInput.value) || 1;

            if (name) {
                this.gameState.addHabit(name, count);
                nameInput.value = '';
                countInput.value = 1;
                // Render update is automatic via gamestate-updated event
            }
        });

        // Dialogue Controls
        this.nextDialogueBtn.addEventListener('click', () => {
            this.hideDialogue();
        });
    }

    // --- Visibility Toggles ---
    showPlayerMenu() {
        this.playerMenu.classList.remove('hidden');
        this.pomodoroOverlay.classList.add('hidden');
        this.habitsOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
    }

    hidePlayerMenu() {
        this.playerMenu.classList.add('hidden');
    }

    showPomodoro() {
        this.pomodoroOverlay.classList.remove('hidden');
        this.habitsOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
        this.hidePlayerMenu();
    }

    hidePomodoro() {
        this.pomodoroOverlay.classList.add('hidden');
    }

    showHabits() {
        this.habitsOverlay.classList.remove('hidden');
        this.pomodoroOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
        this.renderHabitsList();
    }

    hideHabits() {
        this.habitsOverlay.classList.add('hidden');
    }

    showDialogue(speaker, text, options = [], emotion = null) {
        this.dialogueSpeaker.textContent = speaker;
        this.dialogueText.textContent = text;

        // Clear previous options
        this.dialogueOptions.innerHTML = '';

        if (options && options.length > 0) {
            this.nextDialogueBtn.classList.add('hidden');
            options.forEach(opt => {
                const btn = document.createElement('button');
                // Handle dynamic text
                const text = typeof opt.text === 'function' ? opt.text(this.gameState) : opt.text;
                btn.textContent = text;
                btn.className = 'dialogue-option-btn';
                btn.onclick = () => {
                    let nextDialogue = null;
                    if (opt.onSelect) {
                        nextDialogue = opt.onSelect();
                    } else if (opt.effect && this.gameState) {
                        // Fallback for chained dialogues that use raw 'effect'
                        nextDialogue = opt.effect(this.gameState);
                    }

                    if (nextDialogue && nextDialogue.text) {
                        // Chained dialogue
                        this.showDialogue(speaker, nextDialogue.text, nextDialogue.options, nextDialogue.emotion);
                    } else {
                        this.hideDialogue();
                    }
                };
                this.dialogueOptions.appendChild(btn);
            });
        } else {
            this.nextDialogueBtn.classList.remove('hidden');
        }



        // Only show portrait for Roommate?
        if (speaker === 'Roommate') {
            this.dialoguePortrait.classList.remove('hidden');
            this.dialogueSpeaker.textContent = this.gameState.roommateName || "Roommate";

            // Set portrait source
            let assetName = 'roommate_dialogue'; // Default
            if (emotion) {
                console.log("Emotion: " + emotion);
                assetName = `roommate_dialogue_${emotion}`;
            }

            // Try to get asset from manager if available (it stores Images, but we need src)
            // If AssetManager stores Image objects, we can get .src from them.
            if (this.assetManager) {
                const img = this.assetManager.getAsset(assetName);
                if (img) {
                    console.log(`Portrait: changing from '${this.dialoguePortrait.src}' to '${img.src}'`);
                    this.dialoguePortrait.src = img.src;
                    console.log(`Portrait src after set: '${this.dialoguePortrait.src}'`);
                } else {
                    // Fallback if asset not found/loaded yet?
                    console.error(`ERROR: Asset not found: '${assetName}'`);
                    console.log(`Available Asset Keys (first 50):`, Object.keys(this.assetManager.assets).slice(0, 50));
                    // Try default if emotion failed
                    const defaultImg = this.assetManager.getAsset('roommate_dialogue');
                    if (defaultImg) this.dialoguePortrait.src = defaultImg.src;
                }
            }

        } else {
            this.dialoguePortrait.classList.add('hidden');
            this.dialogueSpeaker.textContent = speaker; // Or player name if speaker == 'Player'
        }

        this.dialogueOverlay.classList.remove('hidden');
        this.pomodoroOverlay.classList.add('hidden');
        this.habitsOverlay.classList.add('hidden');
    }

    hideDialogue() {
        this.dialogueOverlay.classList.add('hidden');
    }

    // --- Rendering ---
    onGameStateUpdate(e) {
        this.updatePoints();
        if (!this.habitsOverlay.classList.contains('hidden')) {
            this.renderHabitsList();
        }
    }

    onPomodoroUpdate(e) {
        const p = this.gameState.pomodoro;
        const minutes = Math.floor(p.timeLeft / 1000 / 60);
        const seconds = Math.floor((p.timeLeft / 1000) % 60);
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePoints() {
        this.pointsEl.textContent = this.gameState.points;
    }

    renderHabitsList() {
        this.habitsList.innerHTML = '';
        this.gameState.habits.forEach(habit => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.width = '100%';

            const leftDiv = document.createElement('div');
            leftDiv.style.display = 'flex';
            leftDiv.style.alignItems = 'center';

            if (habit.maxCount && habit.maxCount > 1) {
                // Render counter/sub-habits
                const current = habit.count || 0;

                // Show X small checkboxes? User asked for "sub-checkboxes".
                const subHabitsDiv = document.createElement('div');
                subHabitsDiv.style.marginRight = '10px';
                subHabitsDiv.style.display = 'flex';
                subHabitsDiv.style.gap = '2px';

                for (let i = 0; i < habit.maxCount; i++) {
                    const subCheck = document.createElement('div');
                    subCheck.style.width = '12px';
                    subCheck.style.height = '12px';
                    subCheck.style.border = '1px solid #4a2c1d';
                    subCheck.style.cursor = 'pointer';
                    subCheck.style.backgroundColor = (i < current) ? '#4a2c1d' : 'transparent';

                    subCheck.onclick = () => {
                        // If clicking index i, we set count to i+1. 
                        // If we click the last filled one, maybe toggle off?
                        // Simple logic: click 3rd box -> count = 3. 
                        let newCount = i + 1;
                        if (current === newCount) newCount--; // Toggle off top one if clicked
                        this.gameState.updateHabitProgress(habit.id, newCount);
                    };
                    subHabitsDiv.appendChild(subCheck);
                }
                leftDiv.appendChild(subHabitsDiv);

            } else {
                // Normal Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'habit-checkbox';
                checkbox.checked = habit.completed;
                checkbox.onclick = () => {
                    this.gameState.toggleHabit(habit.id);
                };
                leftDiv.appendChild(checkbox);
            }

            const label = document.createElement('span');
            label.textContent = `${habit.name}`;
            if (habit.completed) {
                label.style.textDecoration = 'line-through';
                label.style.opacity = '0.6';
            }

            // Streak info
            const streakSpan = document.createElement('span');
            streakSpan.textContent = ` 🔥${habit.streak}`;
            streakSpan.style.fontSize = '0.8em';
            streakSpan.style.marginLeft = '5px';
            label.appendChild(streakSpan);

            leftDiv.appendChild(label);
            li.appendChild(leftDiv);

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.style.background = 'transparent';
            delBtn.style.border = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontSize = '1em';
            delBtn.style.padding = '0 5px';
            delBtn.title = 'Delete Habit';
            delBtn.onclick = () => {
                if (confirm(`Delete "${habit.name}"?`)) {
                    this.gameState.deleteHabit(habit.id);
                }
            };
            li.appendChild(delBtn);

            this.habitsList.appendChild(li);
        });
    }
    showReminisceUI() {
        // Create modal for Reminisce list
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';

        const content = document.createElement('div');
        content.style.backgroundColor = '#fff';
        content.style.padding = '20px';
        content.style.borderRadius = '8px';
        content.style.width = '400px';
        content.style.maxHeight = '70vh';
        content.style.overflowY = 'auto';
        content.style.fontFamily = 'monospace';

        const h2 = document.createElement('h2');
        h2.textContent = "Memories";
        h2.style.textAlign = 'center';
        content.appendChild(h2);

        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';

        if (this.gameState.dateHistory.length === 0) {
            const empty = document.createElement('li');
            empty.textContent = "No memories yet.";
            empty.style.textAlign = 'center';
            empty.style.color = '#888';
            list.appendChild(empty);
        } else {
            this.gameState.dateHistory.forEach(item => {
                const li = document.createElement('li');
                li.style.margin = '10px 0';

                const btn = document.createElement('button');
                const dateStr = new Date(item.date).toLocaleDateString();
                btn.textContent = `${dateStr} - ${item.title}`;
                btn.style.width = '100%';
                btn.style.padding = '10px';
                btn.style.cursor = 'pointer';
                btn.onclick = () => {
                    this.showDateSummary(item.title, item.story);
                    // Don't close this modal? Or maybe close it?
                    // Let's keep it open or replace it? 
                    // The showDateSummary creates a NEW modal on top. That's fine.
                };
                li.appendChild(btn);
                list.appendChild(li);
            });
        }
        content.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = "Close";
        closeBtn.style.marginTop = '20px';
        closeBtn.style.width = '100%';
        closeBtn.onclick = () => document.body.removeChild(modal);
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }
}
