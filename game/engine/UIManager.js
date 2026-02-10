export class UIManager {
    constructor(gameState) {
        this.gameState = gameState;

        // Elements
        this.pointsEl = document.getElementById('points-value');
        this.pomodoroOverlay = document.getElementById('pomodoro-overlay');
        this.habitsOverlay = document.getElementById('habits-overlay');
        this.dialogueOverlay = document.getElementById('dialogue-overlay');

        this.timerDisplay = document.getElementById('timer-display');
        this.habitsList = document.getElementById('habits-list');
        this.dialogueText = document.getElementById('dialogue-text');
        this.dialogueSpeaker = document.getElementById('dialogue-speaker');
        this.playerMenu = document.getElementById('player-menu');

        // Buttons
        this.setupEventListeners();

        // Listen for GameState updates
        window.addEventListener('gamestate-updated', (e) => this.onGameStateUpdate(e));
        window.addEventListener('pomodoro-updated', (e) => this.onPomodoroUpdate(e));

        // Initial render
        this.updatePoints();
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
        document.getElementById('btn-next-dialogue').addEventListener('click', () => {
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

    showDialogue(speaker, text) {
        this.dialogueSpeaker.textContent = speaker;
        this.dialogueText.textContent = text;
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
}
