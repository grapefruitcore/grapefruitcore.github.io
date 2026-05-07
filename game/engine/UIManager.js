export class UIManager {
    constructor(gameState, assetManager) {
        this.gameState = gameState;
        this.assetManager = assetManager;

        // Elements
        this.pointsEl = document.getElementById('points-value');
        this.pomodoroOverlay = document.getElementById('pomodoro-overlay');
        this.habitsOverlay = document.getElementById('habits-overlay');
        this.goalsOverlay = document.getElementById('goals-overlay');
        this.dialogueOverlay = document.getElementById('dialogue-overlay');

        this.timerDisplay = document.getElementById('timer-display');
        this.habitsList = document.getElementById('habits-list');
        this.dialogueText = document.getElementById('dialogue-text');
        this.dialoguePortrait = document.getElementById('dialogue-portrait');
        this.dialogueSpeaker = document.getElementById('dialogue-speaker');
        this.dialogueOptions = document.getElementById('dialogue-options');
        this.nextDialogueBtn = document.getElementById('btn-next-dialogue');
        this.playerMenu = document.getElementById('player-menu');
        
        // Goals elements
        this.goalsListPane = document.getElementById('goals-pane-list');
        this.goalsBurndownPane = document.getElementById('goals-pane-burndown');
        this.goalsCalendarPane = document.getElementById('goals-pane-calendar');
        this.goalsList = document.getElementById('goals-list');
        this.burndownChartCanvas = document.getElementById('burndown-chart');
        this.calendarGrid = document.getElementById('goal-calendar-grid');
        this.burndownChartInstance = null;

        // Cutscene elements
        this.cutsceneOverlay = document.getElementById('cutscene-overlay');
        this.cutsceneImage = document.getElementById('cutscene-image');
        this.cutsceneText = document.getElementById('cutscene-text');

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
        // Story mode: names are fixed, skip entry
        if (this.gameState.gameMode === 'story') return;

        if (this.gameState.playerName === "You" || this.gameState.roommateName === "Roommate") {
            this.showNameEntryModal();
        } else if (!this.gameState.getFlag('initialCustomizationDone')) {
            this.showCharacterCustomizationModal(true);
        }
    }

    showNameEntryModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:24px;border-radius:4px;border:1px solid #D4CFC8;text-align:center;color:#2A2420;min-width:300px;';

        const title = document.createElement('h2');
        title.textContent = "Welcome to the Apartment";
        content.appendChild(title);

        const p1 = document.createElement('p');
        p1.textContent = "What is your name?";
        content.appendChild(p1);

        const input1 = document.createElement('input');
        input1.type = 'text';
        input1.value = 'Player';
        input1.style.cssText = 'display:block;margin:10px auto;padding:4px 8px;border:1px solid #D4CFC8;border-radius:4px;font-size:0.95rem;';
        content.appendChild(input1);

        const p2 = document.createElement('p');
        p2.textContent = "What is your roommate's name?";
        content.appendChild(p2);

        const input2 = document.createElement('input');
        input2.type = 'text';
        input2.value = 'Roommate';
        input2.style.cssText = 'display:block;margin:10px auto;padding:4px 8px;border:1px solid #D4CFC8;border-radius:4px;font-size:0.95rem;';
        content.appendChild(input2);

        const btn = document.createElement('button');
        btn.textContent = "Next";
        btn.onclick = () => {
            if (input1.value.trim()) this.gameState.playerName = input1.value.trim();
            if (input2.value.trim()) this.gameState.roommateName = input2.value.trim();
            this.gameState.saveState();
            document.body.removeChild(modal);
            this.showCharacterCustomizationModal(true);
        };
        content.appendChild(btn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showDateSummary(title, story) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:32px;border-radius:4px;border:1px solid #D4CFC8;max-width:600px;max-height:80vh;overflow-y:auto;line-height:1.6;color:#2A2420;';

        const h2 = document.createElement('h2');
        h2.textContent = title;
        h2.style.cssText = 'text-align:center;margin-bottom:20px;border-bottom:1px solid #D4CFC8;padding-bottom:10px;';
        content.appendChild(h2);

        const p = document.createElement('p');
        p.innerHTML = story.replace(/\n/g, '<br>');
        content.appendChild(p);

        const btn = document.createElement('button');
        btn.textContent = "Close";
        btn.style.cssText = 'margin-top:24px;display:block;margin-left:auto;margin-right:auto;';
        btn.onclick = () => document.body.removeChild(modal);
        content.appendChild(btn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showLoadingScreen(durationMs = 500) {
        if (!this.loadingOverlay) {
            this.loadingOverlay = document.createElement('div');
            this.loadingOverlay.id = 'loading-overlay';
            this.loadingOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#F5F0EB;display:none;justify-content:center;align-items:center;z-index:9999;flex-direction:column;font-family:inherit;';

            const loadingText = document.createElement('h2');
            loadingText.textContent = "Moving Furniture...";
            loadingText.style.color = '#2A2420';

            this.loadingOverlay.appendChild(loadingText);
            document.body.appendChild(this.loadingOverlay);
        }

        return new Promise(resolve => {
            this.loadingOverlay.style.display = 'flex';
            setTimeout(() => {
                this.loadingOverlay.style.display = 'none';
                resolve();
            }, durationMs);
        });
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
        document.getElementById('btn-open-goals').addEventListener('click', () => {
            this.showGoals();
            this.hidePlayerMenu();
        });
        document.getElementById('btn-close-menu').addEventListener('click', () => {
            this.hidePlayerMenu();
        });

        // Points Hover Menu Controls
        const hoverPomodoro = document.getElementById('hover-btn-pomodoro');
        const hoverHabits = document.getElementById('hover-btn-habits');
        const hoverGoals = document.getElementById('hover-btn-goals');
        const hoverReminisce = document.getElementById('hover-btn-reminisce');
        const hoverSwitchMode = document.getElementById('hover-btn-switch-mode');
        const hoverResetGame = document.getElementById('hover-btn-reset-game');

        if (hoverPomodoro) hoverPomodoro.addEventListener('click', () => this.showPomodoro());
        if (hoverHabits) hoverHabits.addEventListener('click', () => this.showHabits());
        if (hoverGoals) hoverGoals.addEventListener('click', () => this.showGoals());
        if (hoverReminisce) hoverReminisce.addEventListener('click', () => this.showReminisceUI());
        if (hoverSwitchMode) {
            hoverSwitchMode.addEventListener('click', () => {
                if (window.switchGameMode) window.switchGameMode();
            });
        }
        if (hoverResetGame) {
            hoverResetGame.addEventListener('click', () => {
                if (confirm("Are you sure you want to reset all progress? Points, habits, and relationship will be lost.")) {
                    this.gameState.resetState();
                    localStorage.removeItem('grapefruit_current_mode');
                    window.location.reload();
                }
            });
        }

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
                localStorage.removeItem('grapefruit_current_mode');
                window.location.reload();
            }
        });

        // Switch Mode Button
        const playerMenu = document.getElementById('player-menu');
        const resetGameBtn = document.getElementById('btn-reset-game');
        if (playerMenu && resetGameBtn) {
            // Add Switch Mode button
            if (!document.getElementById('btn-switch-mode')) {
                const switchBtn = document.createElement('button');
                switchBtn.id = 'btn-switch-mode';
                switchBtn.textContent = '\uD83D\uDD04 Switch Mode';
                switchBtn.classList.add('btn-sage');
                switchBtn.style.marginTop = '10px';
                playerMenu.insertBefore(switchBtn, resetGameBtn);

                switchBtn.addEventListener('click', () => {
                    this.hidePlayerMenu();
                    if (window.switchGameMode) {
                        this.showLoadingScreen(600).then(() => {
                            window.switchGameMode();
                        });
                    }
                });
            }

            // Productivity mode specific buttons
            if (this.gameState.gameMode === 'productivity') {
                if (!document.getElementById('btn-add-dialogue')) {
                    const addDialogueBtn = document.createElement('button');
                    addDialogueBtn.id = 'btn-add-dialogue';
                    addDialogueBtn.textContent = '\uD83D\uDCAC Add Dialogue (50 pts)';
                    addDialogueBtn.classList.add('btn-sage');
                    playerMenu.insertBefore(addDialogueBtn, resetGameBtn);

                    addDialogueBtn.addEventListener('click', () => {
                        this.hidePlayerMenu();
                        this.showAddDialogueModal();
                    });
                }

                if (!document.getElementById('btn-customize-player')) {
                    const customizeBtn = document.createElement('button');
                    customizeBtn.id = 'btn-customize-player';
                    customizeBtn.textContent = '🎨 Customize Player';
                    customizeBtn.classList.add('btn-sage');
                    customizeBtn.style.marginTop = '10px';
                    playerMenu.insertBefore(customizeBtn, resetGameBtn);

                    customizeBtn.addEventListener('click', () => {
                        this.hidePlayerMenu();
                        this.showCharacterCustomizationModal(false);
                    });
                }

                if (!document.getElementById('btn-customize-room')) {
                    const customizeRoomBtn = document.createElement('button');
                    customizeRoomBtn.id = 'btn-customize-room';
                    customizeRoomBtn.textContent = '🛋️ Customize Room';
                    customizeRoomBtn.classList.add('btn-sage');
                    customizeRoomBtn.style.marginTop = '10px';
                    playerMenu.insertBefore(customizeRoomBtn, resetGameBtn);

                    customizeRoomBtn.addEventListener('click', () => {
                        this.hidePlayerMenu();
                        this.showRoomCustomizationModal();
                    });
                }
            }
        }

        // Pomodoro Controls
        document.getElementById('btn-start-timer').addEventListener('click', () => {
            const input = document.getElementById('pomodoro-duration-input');
            const goalSelect = document.getElementById('pomodoro-goal-select');
            let duration = parseInt(input.value) || 30;
            if (duration < 1) duration = 1;
            if (duration > 120) duration = 120;
            input.value = duration;
            const linkedGoalId = goalSelect.value ? parseInt(goalSelect.value) : null;
            this.gameState.startTimer(duration, linkedGoalId);
        });
        document.getElementById('btn-pause-timer').addEventListener('click', () => {
            if (this.gameState.pomodoro.isRunning) {
                this.gameState.pauseTimer();
            }
        });
        document.getElementById('btn-reset-timer').addEventListener('click', () => {
            const input = document.getElementById('pomodoro-duration-input');
            let duration = parseInt(input.value) || 30;
            if (duration < 1) duration = 1;
            if (duration > 120) duration = 120;
            input.value = duration;
            this.gameState.resetTimer(duration * 60 * 1000);
        });
        document.getElementById('btn-close-pomodoro').addEventListener('click', () => {
            this.hidePomodoro();
        });
        document.getElementById('btn-log-pomodoro').addEventListener('click', () => {
            const input = document.getElementById('pomodoro-manual-input');
            const goalSelect = document.getElementById('pomodoro-goal-select');
            let duration = parseInt(input.value);
            if (!duration || duration <= 0) return;
            const linkedGoalId = goalSelect.value ? parseInt(goalSelect.value) : null;
            this.gameState.logPomodoro(duration, linkedGoalId);
            input.value = '';
        });

        // Habits Controls
        document.getElementById('btn-close-habits').addEventListener('click', () => {
            this.hideHabits();
        });
        document.getElementById('btn-add-habit').addEventListener('click', () => {
            const nameInput = document.getElementById('new-habit-name');
            const typeInput = document.getElementById('new-habit-type');
            const countInput = document.getElementById('new-habit-count');
            const name = nameInput.value.trim();
            const type = typeInput.value;
            const count = parseInt(countInput.value) || 1;

            if (name) {
                this.gameState.addHabit(name, count, type, type);
                nameInput.value = '';
                countInput.value = 1;
                this.renderHabitsList();
            }
        });
        
        const habitDatePicker = document.getElementById('habit-date-picker');
        if (habitDatePicker) {
            habitDatePicker.addEventListener('change', (e) => {
                this.currentHabitDateStr = e.target.value;
                this.renderHabitsList();
            });
        }
        
        // Goals Controls
        document.getElementById('btn-close-goals').addEventListener('click', () => {
            this.hideGoals();
        });
        
        // Goals Tabs
        document.getElementById('tab-goals-list').addEventListener('click', (e) => this.switchGoalTab('list', e.target));
        document.getElementById('tab-goals-burndown').addEventListener('click', (e) => this.switchGoalTab('burndown', e.target));
        document.getElementById('tab-goals-calendar').addEventListener('click', (e) => this.switchGoalTab('calendar', e.target));

        // Add Goal
        document.getElementById('btn-add-goal').addEventListener('click', () => {
            const name = document.getElementById('new-goal-name').value.trim();
            const category = document.getElementById('new-goal-category').value;
            const estimate = document.getElementById('new-goal-estimate').value;
            const unit = document.getElementById('new-goal-unit').value.trim();
            const linkedStr = document.getElementById('new-goal-habit-link').value;
            const linkedHabitId = linkedStr ? parseInt(linkedStr) : null;
            
            if (name) {
                this.gameState.addGoal(name, category, estimate, unit, linkedHabitId);
                document.getElementById('new-goal-name').value = '';
                document.getElementById('new-goal-estimate').value = '';
                document.getElementById('new-goal-unit').value = '';
                document.getElementById('new-goal-habit-link').value = '';
                this.renderGoalsList();
            }
        });
        
        // Burndown / Calendar dropdowns
        document.getElementById('burndown-goal-select').addEventListener('change', () => this.renderBurndownChart());
        document.getElementById('calendar-goal-select').addEventListener('change', () => this.renderGoalCalendar());

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
        this.goalsOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
    }

    hidePlayerMenu() {
        this.playerMenu.classList.add('hidden');
    }

    showPomodoro() {
        this.pomodoroOverlay.classList.remove('hidden');
        this.habitsOverlay.classList.add('hidden');
        this.goalsOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
        this.hidePlayerMenu();

        const input = document.getElementById('pomodoro-duration-input');
        if (input && this.gameState.pomodoro && this.gameState.pomodoro.duration) {
            input.value = Math.round(this.gameState.pomodoro.duration / 60000);
        }
    }

    hidePomodoro() {
        this.pomodoroOverlay.classList.add('hidden');
    }

    showHabits() {
        this.habitsOverlay.classList.remove('hidden');
        this.pomodoroOverlay.classList.add('hidden');
        this.goalsOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
        
        // initialize datePicker to today if not set
        if (!this.currentHabitDateStr) {
            const d = new Date();
            this.currentHabitDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dp = document.getElementById('habit-date-picker');
            if (dp) dp.value = this.currentHabitDateStr;
        }
        
        this.renderHabitsList();
    }

    hideHabits() {
        this.habitsOverlay.classList.add('hidden');
    }
    
    showGoals() {
        this.goalsOverlay.classList.remove('hidden');
        this.habitsOverlay.classList.add('hidden');
        this.pomodoroOverlay.classList.add('hidden');
        this.dialogueOverlay.classList.add('hidden');
        this.switchGoalTab('list', document.getElementById('tab-goals-list'));
    }
    
    hideGoals() {
        this.goalsOverlay.classList.add('hidden');
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

                    if (nextDialogue && nextDialogue.cutscene) {
                        // Cutscene trigger
                        this.hideDialogue();
                        this.showCutscene(nextDialogue.cutscene.asset, nextDialogue.cutscene.lines);
                    } else if (nextDialogue && nextDialogue.text) {
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
            this.dialogueSpeaker.textContent = this.gameState.roommateName || "Roommate";

            if (this.gameState.gameMode !== 'productivity') {
                this.dialoguePortrait.classList.remove('hidden');
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

    showCutscene(assetName, lines, onComplete = null) {
        // Clear pending hide to prevent race conditions
        if (this.cutsceneTimeout) clearTimeout(this.cutsceneTimeout);

        // Set image
        if (this.assetManager) {
            const img = this.assetManager.getAsset(assetName);
            if (img) {
                this.cutsceneImage.src = img.src;
            } else {
                console.error(`Cutscene asset not found: '${assetName}'`);
                this.cutsceneImage.src = `./assets/${assetName}.png`;
            }
        }

        let lineIndex = 0;
        this.cutsceneText.textContent = lines[lineIndex];

        // precise fade-in sequence
        this.cutsceneOverlay.classList.remove('hidden');
        // Force reflow to ensure transition plays
        void this.cutsceneOverlay.offsetWidth;
        this.cutsceneOverlay.classList.add('visible');

        // Use onclick to ensure single handler and easy cleanup
        this.cutsceneOverlay.onclick = () => {
            lineIndex++;
            if (lineIndex < lines.length) {
                this.cutsceneText.textContent = lines[lineIndex];
            } else {
                this.hideCutscene(onComplete);
                this.cutsceneOverlay.onclick = null;
            }
        };
    }

    hideCutscene(onComplete = null) {
        this.cutsceneOverlay.classList.remove('visible');
        this.cutsceneTimeout = setTimeout(() => {
            this.cutsceneOverlay.classList.add('hidden');
            if (onComplete) onComplete();
            this.cutsceneTimeout = null;
        }, 500); // Match CSS transition duration
    }

    // --- Rendering ---
    onGameStateUpdate(e) {
        this.updatePoints();
        if (!this.habitsOverlay.classList.contains('hidden')) {
            this.renderHabitsList();
        }
        if (!this.goalsOverlay.classList.contains('hidden')) {
             if (!this.goalsListPane.classList.contains('hidden')) this.renderGoalsList();
             if (!this.goalsBurndownPane.classList.contains('hidden')) this.renderBurndownChart();
             if (!this.goalsCalendarPane.classList.contains('hidden')) this.renderGoalCalendar();
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
        
        // Ensure date is set
        if (!this.currentHabitDateStr) {
            const d = new Date();
            this.currentHabitDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        
        const dateStr = this.currentHabitDateStr;
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;

        this.gameState.habits.forEach(habit => {
            const li = document.createElement('li');
            li.style.cssText = 'padding:10px; border:1px solid #D4CFC8; border-radius:4px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px; background:#FAFAFA;';

            // Top row: Checkbox/Counters, Name, Streak, Delete
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
            
            const leftDiv = document.createElement('div');
            leftDiv.style.cssText = 'display:flex; align-items:center;';
            
            // Get history for this date
            const record = (habit.history && habit.history[dateStr]) ? habit.history[dateStr] : { completed: false, value: 0 };
            const currentCount = record.value;
            const isCompleted = record.completed;

            if (habit.maxCount && habit.maxCount > 1 && habit.type !== 'steps') {
                const subHabitsDiv = document.createElement('div');
                subHabitsDiv.style.cssText = 'margin-right:10px; display:flex; gap:2px;';
                for (let i = 0; i < habit.maxCount; i++) {
                    const subCheck = document.createElement('div');
                    subCheck.style.cssText = `width:12px; height:12px; border:1px solid #2A2420; cursor:pointer; background-color:${(i < currentCount) ? '#2A2420' : 'transparent'};`;
                    subCheck.onclick = () => {
                        let newCount = i + 1;
                        if (currentCount === newCount) newCount--;
                        // If it's a specific type, we might want to preserve extraData
                        this.gameState.updateHabitProgressForDate(habit.id, dateStr, newCount, record);
                        this.renderHabitsList();
                    };
                    subHabitsDiv.appendChild(subCheck);
                }
                leftDiv.appendChild(subHabitsDiv);
            } else {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'habit-checkbox';
                checkbox.checked = isCompleted;
                checkbox.style.marginRight = '10px';
                checkbox.onclick = (e) => {
                    const newCount = e.target.checked ? habit.maxCount : 0;
                    this.gameState.updateHabitProgressForDate(habit.id, dateStr, newCount, record);
                    this.renderHabitsList();
                };
                leftDiv.appendChild(checkbox);
            }

            const label = document.createElement('span');
            label.textContent = habit.name;
            if (isCompleted) {
                label.style.textDecoration = 'line-through';
                label.style.opacity = '0.6';
            }
            // Badge
            const badge = document.createElement('span');
            badge.textContent = habit.type === 'boolean' ? 'simple' : habit.type;
            badge.style.cssText = 'font-size:0.65em; background:#E0DCD5; padding:2px 6px; border-radius:10px; margin-left:8px;';
            label.appendChild(badge);

            if (isToday) {
                const streakSpan = document.createElement('span');
                streakSpan.textContent = ` 🔥${habit.streak}`;
                streakSpan.style.fontSize = '0.8em';
                streakSpan.style.marginLeft = '5px';
                label.appendChild(streakSpan);
            }

            leftDiv.appendChild(label);
            topRow.appendChild(leftDiv);

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.style.cssText = 'background:transparent; border:none; cursor:pointer; font-size:1em; padding:0 5px;';
            delBtn.title = 'Delete Habit';
            delBtn.onclick = () => {
                if (confirm(`Delete "${habit.name}"?`)) {
                    this.gameState.deleteHabit(habit.id);
                    this.renderHabitsList();
                }
            };
            topRow.appendChild(delBtn);
            li.appendChild(topRow);

            // Bottom row (Specialized inputs depending on type)
            if (habit.type === 'steps' || habit.type === 'workout' || habit.type === 'sleep' || habit.type === 'productivity') {
                const detailsRow = document.createElement('div');
                detailsRow.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap; font-size:0.85em; margin-top:5px; border-top:1px dashed #E0DCD5; padding-top:5px;';
                
                const createInput = (placeholder, key, min, type='number') => {
                    const inp = document.createElement('input');
                    inp.type = type;
                    inp.min = min;
                    inp.placeholder = placeholder;
                    inp.style.cssText = 'padding:2px 4px; border:1px solid #D4CFC8; border-radius:3px; width:70px;';
                    if (record[key] !== undefined) inp.value = record[key];
                    
                    inp.addEventListener('change', (e) => {
                        const val = type === 'number' ? parseFloat(e.target.value) : e.target.value;
                        const newExtra = { ...record };
                        newExtra[key] = val;
                        // Auto-check if we put in steps? Up to user. Let's just update progress.
                        this.gameState.updateHabitProgressForDate(habit.id, dateStr, currentCount, newExtra);
                    });
                    return inp;
                };

                if (habit.type === 'steps') {
                    detailsRow.appendChild(document.createTextNode('Steps:'));
                    detailsRow.appendChild(createInput('e.g. 5000', 'steps', 0));
                } else if (habit.type === 'workout') {
                    detailsRow.appendChild(document.createTextNode('Duration (m):'));
                    detailsRow.appendChild(createInput('mins', 'duration', 0));
                    detailsRow.appendChild(document.createTextNode('Weight (lbs):'));
                    detailsRow.appendChild(createInput('lbs', 'weight', 0));
                    detailsRow.appendChild(document.createTextNode('Sets:'));
                    detailsRow.appendChild(createInput('sets', 'sets', 0));
                    detailsRow.appendChild(document.createTextNode('Reps:'));
                    detailsRow.appendChild(createInput('reps', 'reps', 0));
                } else if (habit.type === 'sleep') {
                    detailsRow.appendChild(document.createTextNode('Hrs:'));
                    detailsRow.appendChild(createInput('hours', 'hours', 0));
                    detailsRow.appendChild(document.createTextNode('Quality (1-10):'));
                    detailsRow.appendChild(createInput('1-10', 'quality', 1));
                } else if (habit.type === 'productivity') {
                    detailsRow.appendChild(document.createTextNode('Focus Blocks:'));
                    detailsRow.appendChild(createInput('blocks', 'focusBlocks', 0));
                }
                
                li.appendChild(detailsRow);
            }

            this.habitsList.appendChild(li);
        });
    }
    showReminisceUI() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:24px;border-radius:4px;border:1px solid #D4CFC8;width:400px;max-height:70vh;overflow-y:auto;color:#2A2420;';

        const h2 = document.createElement('h2');
        h2.textContent = "Memories";
        h2.style.textAlign = 'center';
        content.appendChild(h2);

        const list = document.createElement('ul');
        list.style.cssText = 'list-style:none;padding:0;';

        if (this.gameState.dateHistory.length === 0) {
            const empty = document.createElement('li');
            empty.textContent = "No memories yet.";
            empty.style.cssText = 'text-align:center;color:#8A8078;';
            list.appendChild(empty);
        } else {
            this.gameState.dateHistory.forEach(item => {
                const li = document.createElement('li');
                li.style.margin = '10px 0';

                const btn = document.createElement('button');
                const dateStr = new Date(item.date).toLocaleDateString();
                btn.textContent = `${dateStr} - ${item.title}`;
                btn.style.cssText = 'width:100%;padding:10px;cursor:pointer;';
                btn.onclick = () => {
                    this.showDateSummary(item.title, item.story);
                };
                li.appendChild(btn);
                list.appendChild(li);
            });
        }
        content.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = "Close";
        closeBtn.classList.add('btn-secondary');
        closeBtn.style.cssText = 'margin-top:16px;width:100%;';
        closeBtn.onclick = () => document.body.removeChild(modal);
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    // --- PRODUCTIVITY MODE MODALS ---
    showAddDialogueModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:24px;border-radius:4px;border:1px solid #D4CFC8;width:400px;color:#2A2420;';

        const title = document.createElement('h2');
        title.textContent = '\uD83D\uDCAC Add Custom Dialogue';
        title.style.textAlign = 'center';
        content.appendChild(title);

        const costInfo = document.createElement('p');
        costInfo.textContent = `Cost: 50 points (You have ${this.gameState.points})`;
        costInfo.style.cssText = 'text-align:center;color:#8A8078;';
        content.appendChild(costInfo);

        const label = document.createElement('p');
        label.textContent = "What should your roommate say?";
        content.appendChild(label);

        const input = document.createElement('textarea');
        input.placeholder = 'Type dialogue here...';
        input.style.cssText = 'width:100%;height:80px;box-sizing:border-box;margin-bottom:10px;padding:8px;border:1px solid #D4CFC8;border-radius:4px;font-size:0.95rem;resize:vertical;';
        content.appendChild(input);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add (50 pts)';
        addBtn.onclick = () => {
            const text = input.value.trim();
            if (!text) { alert('Please enter some dialogue.'); return; }
            if (this.gameState.addCustomDialogue(text)) {
                alert('Dialogue added!');
                document.body.removeChild(modal);
            } else {
                alert('Not enough points! You need 50 points.');
            }
        };
        btnRow.appendChild(addBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('btn-secondary');
        cancelBtn.onclick = () => document.body.removeChild(modal);
        btnRow.appendChild(cancelBtn);

        content.appendChild(btnRow);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showRoomCustomizationModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:24px;border-radius:4px;border:1px solid #D4CFC8;width:400px;max-height:80vh;overflow-y:auto;color:#2A2420;';

        const title = document.createElement('h2');
        title.textContent = 'Customize Room';
        title.style.textAlign = 'center';
        content.appendChild(title);

        // Map tileChars to available asset options
        const categories = {
            'rg2': { name: 'Dark Green Rug', base: 'dark_green_rug' },
            'bd1': { name: 'Single Bed', base: 'bed' },
            'bd2': { name: 'Bunk Bed', base: 'bunk_bed' },
            'cg1': { name: 'Green Couch', base: 'couch' }
        };

        const colors = [
            { id: '', label: 'Default', cost: 0 },
            { id: 'pinkred', label: 'Pink & Red', cost: 150 },
            { id: 'violet', label: 'Violet & Beige', cost: 150 },
            { id: 'hotpink', label: 'Hot Pink', cost: 150 },
            { id: 'blue', label: 'Blue', cost: 150 },
            { id: 'beige', label: 'Beige', cost: 150 }
        ];

        let currentTileTarget = 'rg2';

        const uiContainer = document.createElement('div');

        const renderUI = () => {
            uiContainer.innerHTML = '';

            const categoryTabs = document.createElement('div');
            categoryTabs.style.cssText = 'display:flex;gap:4px;margin-bottom:16px;overflow-x:auto;padding-bottom:5px;';
            Object.keys(categories).forEach(tileKey => {
                const btn = document.createElement('button');
                btn.textContent = categories[tileKey].name;
                btn.style.padding = '6px 12px';
                btn.style.borderRadius = '4px';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.style.whiteSpace = 'nowrap';
                if (currentTileTarget === tileKey) {
                    btn.style.background = '#A8B8A0';
                    btn.style.color = '#FFF';
                } else {
                    btn.style.background = '#e0dcd5';
                }
                btn.onclick = () => {
                    currentTileTarget = tileKey;
                    renderUI();
                };
                categoryTabs.appendChild(btn);
            });
            uiContainer.appendChild(categoryTabs);

            const pointsInfo = document.createElement('p');
            pointsInfo.textContent = `Points: ${this.gameState.points}`;
            pointsInfo.style.marginBottom = '10px';
            pointsInfo.style.fontWeight = 'bold';
            uiContainer.appendChild(pointsInfo);

            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:300px;overflow-y:auto;';

            // Find current equipped asset ID for this tile, or fallback to default base
            const defaultAssetId = categories[currentTileTarget].base;
            const currentEquipped = this.gameState.furnitureCustomization[currentTileTarget] || defaultAssetId;

            colors.forEach(color => {
                const isDefault = color.id === '';
                const fullAssetId = isDefault ? defaultAssetId : `${defaultAssetId}_${color.id}`;
                const isOwned = isDefault || this.gameState.unlockedCosmetics.includes(fullAssetId);
                const isEquipped = currentEquipped === fullAssetId;

                const itemBtn = document.createElement('button');
                itemBtn.style.padding = '10px';
                itemBtn.style.borderRadius = '4px';
                itemBtn.style.border = isEquipped ? '2px solid #8FA387' : '1px solid #D4CFC8';
                itemBtn.style.background = isEquipped ? '#F0F5ED' : '#FFF';
                itemBtn.style.color = '#2A2420';
                itemBtn.style.cursor = 'pointer';
                itemBtn.style.textAlign = 'center';
                itemBtn.style.display = 'flex';
                itemBtn.style.flexDirection = 'column';
                itemBtn.style.alignItems = 'center';
                itemBtn.style.gap = '4px';

                // Image preview if loaded
                const img = document.createElement('img');
                const assetObj = this.assetManager ? this.assetManager.getAsset(fullAssetId) : null;
                if (assetObj) {
                    img.src = assetObj.src;
                    img.style.width = '48px';
                    img.style.height = '48px';
                    img.style.objectFit = 'contain';
                    itemBtn.appendChild(img);
                }

                const label = document.createElement('span');
                label.textContent = color.label;
                label.style.fontSize = '0.85em';
                itemBtn.appendChild(label);

                if (!isOwned) {
                    const costLabel = document.createElement('span');
                    costLabel.textContent = `🔒 ${color.cost} pts`;
                    costLabel.style.color = '#8A8078';
                    costLabel.style.fontSize = '0.8em';
                    itemBtn.appendChild(costLabel);

                    itemBtn.onclick = () => {
                        if (this.gameState.buyCustomization(fullAssetId, color.cost)) {
                            this.updatePoints();
                            this.showLoadingScreen(300).then(() => {
                                this.gameState.equipFurniture(currentTileTarget, fullAssetId);
                                renderUI();
                            });
                        } else {
                            alert(`Not enough points! Need ${color.cost}.`);
                        }
                    };
                } else {
                    itemBtn.onclick = () => {
                        this.showLoadingScreen(300).then(() => {
                            this.gameState.equipFurniture(currentTileTarget, fullAssetId);
                            renderUI();
                        });
                    };
                }
                grid.appendChild(itemBtn);
            });
            uiContainer.appendChild(grid);
        };

        renderUI();
        content.appendChild(uiContainer);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Finish';
        closeBtn.classList.add('btn-secondary');
        closeBtn.style.cssText = 'width:100%;margin-top:16px;background:#C2534C;color:#fff;border:none;';
        closeBtn.onclick = () => {
            // Add tiny loader timeout if needed
            document.body.removeChild(modal);
        };
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showCharacterCustomizationModal(isInitialSetup = false) {
        const modal = document.createElement('div');
        // Overlay instead of corner to avoid overlapping too much if screen is small
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:2000;';

        const content = document.createElement('div');
        content.style.cssText = 'background:#FFFFFF;padding:24px;border-radius:4px;border:1px solid #D4CFC8;width:400px;max-height:80vh;overflow-y:auto;color:#2A2420;';

        const title = document.createElement('h2');
        title.textContent = isInitialSetup ? 'Initial Customization' : 'Customize Character';
        title.style.textAlign = 'center';
        content.appendChild(title);

        const options = {
            body: [
                { id: 'bodyF_skin1', label: 'F Skin 1' },
                { id: 'bodyF_skin2', label: 'F Skin 2' },
                { id: 'bodyF_skin3', label: 'F Skin 3' },
                { id: 'bodyM_skin1', label: 'M Skin 1' },
                { id: 'bodyM_skin2', label: 'M Skin 2' },
                { id: 'bodyM_skin3', label: 'M Skin 3' }
            ],
            clothes: [
                { id: 'clothesF_default', label: 'F Default' },
                { id: 'clothesM_default', label: 'M Default' },
                { id: 'clothesF_red', label: 'F Red' },
                { id: 'clothesF_blue', label: 'F Blue' }
            ],
            face: [
                { id: 'face_default', label: 'Default' }
            ],
            hair: [
                { id: 'hairCurly_colour1', label: 'Curly 1' },
                { id: 'hairCurly_colour2', label: 'Curly 2' },
                { id: 'hairCurly_colour3', label: 'Curly 3' },
                { id: 'hairCurly_colour4', label: 'Curly Purple', cost: 100 },
                { id: 'hairCurly_colour5', label: 'Curly Blue', cost: 100 },
                { id: 'hairCurly_colour6', label: 'Curly Green', cost: 100 },
                { id: 'hairCurly_colour7', label: 'Curly Pink', cost: 100 },
                { id: 'hairStraight_colour1', label: 'Straight 1' },
                { id: 'hairStraight_colour2', label: 'Straight 2' },
                { id: 'hairStraight_colour3', label: 'Straight 3' },
                { id: 'hairStraight_colour4', label: 'Straight Purple', cost: 100 },
                { id: 'hairStraight_colour5', label: 'Straight Blue', cost: 100 },
                { id: 'hairStraight_colour6', label: 'Straight Green', cost: 100 },
                { id: 'hairStraight_colour7', label: 'Straight Pink', cost: 100 }
            ]
        };

        let currentTarget = 'player';
        let currentCategory = 'body';

        const uiContainer = document.createElement('div');

        const renderUI = () => {
            uiContainer.innerHTML = '';

            // Target Selection (only if initial setup)
            if (isInitialSetup) {
                const targetTabs = document.createElement('div');
                targetTabs.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';

                ['player', 'roommate'].forEach(target => {
                    const btn = document.createElement('button');
                    btn.textContent = target === 'player' ? 'Player' : 'Roommate';
                    btn.style.flex = '1';
                    if (currentTarget === target) {
                        btn.classList.add('btn-sage');
                    } else {
                        btn.style.background = '#e0dcd5';
                        btn.style.border = 'none';
                        btn.style.padding = '8px 16px';
                        btn.style.borderRadius = '4px';
                        btn.style.cursor = 'pointer';
                    }
                    btn.onclick = () => {
                        currentTarget = target;
                        renderUI();
                    };
                    targetTabs.appendChild(btn);
                });
                uiContainer.appendChild(targetTabs);
            }

            // Category Selection
            const categoryTabs = document.createElement('div');
            categoryTabs.style.cssText = 'display:flex;gap:4px;margin-bottom:16px;overflow-x:auto;';
            ['body', 'clothes', 'face', 'hair'].forEach(cat => {
                const btn = document.createElement('button');
                btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
                btn.style.padding = '6px 12px';
                btn.style.borderRadius = '4px';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                if (currentCategory === cat) {
                    btn.style.background = '#A8B8A0';
                    btn.style.color = '#FFF';
                } else {
                    btn.style.background = '#e0dcd5';
                }
                btn.onclick = () => {
                    currentCategory = cat;
                    renderUI();
                };
                categoryTabs.appendChild(btn);
            });
            uiContainer.appendChild(categoryTabs);

            // Points info if not initial setup
            if (!isInitialSetup) {
                const pointsInfo = document.createElement('p');
                pointsInfo.textContent = `Points: ${this.gameState.points}`;
                pointsInfo.style.marginBottom = '10px';
                pointsInfo.style.fontWeight = 'bold';
                uiContainer.appendChild(pointsInfo);
            }

            // Items Grid
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:300px;overflow-y:auto;';

            const currentEquipped = currentTarget === 'player' ?
                this.gameState.playerCustomization[currentCategory] :
                this.gameState.roommateCustomization[currentCategory];

            options[currentCategory].forEach(item => {
                if (isInitialSetup && item.cost) return; // Hide premium items during initial setup

                const isOwned = !item.cost || this.gameState.unlockedCosmetics.includes(item.id) || isInitialSetup;
                const isEquipped = currentEquipped === item.id;

                const itemBtn = document.createElement('button');
                itemBtn.style.padding = '10px';
                itemBtn.style.borderRadius = '4px';
                itemBtn.style.border = isEquipped ? '2px solid #8FA387' : '1px solid #D4CFC8';
                itemBtn.style.background = isEquipped ? '#F0F5ED' : '#FFF';
                itemBtn.style.color = '#2A2420'; // Fix text visibility
                itemBtn.style.cursor = 'pointer';
                itemBtn.style.textAlign = 'center';
                itemBtn.style.display = 'flex';
                itemBtn.style.flexDirection = 'column';
                itemBtn.style.alignItems = 'center';
                itemBtn.style.gap = '4px';

                // We can add an image preview here
                const img = document.createElement('img');
                const asset = this.assetManager ? this.assetManager.getAsset(item.id) : null;
                if (asset) {
                    img.src = asset.src;
                    img.style.width = '48px';
                    img.style.height = '48px';
                    img.style.objectFit = 'contain';
                    itemBtn.appendChild(img);
                }

                const label = document.createElement('span');
                label.textContent = item.label;
                label.style.fontSize = '0.85em';
                itemBtn.appendChild(label);

                if (!isOwned) {
                    const costLabel = document.createElement('span');
                    costLabel.textContent = `🔒 ${item.cost} pts`;
                    costLabel.style.color = '#8A8078';
                    costLabel.style.fontSize = '0.8em';
                    itemBtn.appendChild(costLabel);

                    itemBtn.onclick = () => {
                        if (this.gameState.buyCustomization(item.id, item.cost)) {
                            this.updatePoints();
                            this.gameState.equipCustomization(currentTarget, currentCategory, item.id);
                            renderUI();
                        } else {
                            alert(`Not enough points! Need ${item.cost}.`);
                        }
                    };
                } else {
                    itemBtn.onclick = () => {
                        this.gameState.equipCustomization(currentTarget, currentCategory, item.id);
                        renderUI();
                    };
                }

                grid.appendChild(itemBtn);
            });
            uiContainer.appendChild(grid);
        };

        renderUI();
        content.appendChild(uiContainer);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Finish & Play';
        closeBtn.classList.add('btn-secondary');
        closeBtn.style.cssText = 'width:100%;margin-top:16px;background:#C2534C;color:#fff;border:none;';
        closeBtn.onclick = () => {
            if (isInitialSetup) {
                this.gameState.setFlag('initialCustomizationDone', true);
            }
            document.body.removeChild(modal);
        };
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    // --- GOALS UI METHODS ---
    switchGoalTab(tabName, buttonEl) {
        // Update active tab styles
        document.querySelectorAll('#goals-overlay .tabs button').forEach(b => {
            b.classList.remove('active');
            b.style.fontWeight = 'normal';
            b.style.borderBottom = 'none';
        });
        if (buttonEl) {
            buttonEl.classList.add('active');
            buttonEl.style.fontWeight = 'bold';
            buttonEl.style.borderBottom = '2px solid #2A2420';
        }

        // Hide all panes
        this.goalsListPane.classList.add('hidden');
        this.goalsBurndownPane.classList.add('hidden');
        this.goalsCalendarPane.classList.add('hidden');

        // Show the selected pane & trigger render
        if (tabName === 'list') {
            this.goalsListPane.classList.remove('hidden');
            this.renderGoalsList();
        } else if (tabName === 'burndown') {
            this.goalsBurndownPane.classList.remove('hidden');
            this.renderBurndownChart();
        } else if (tabName === 'calendar') {
            this.goalsCalendarPane.classList.remove('hidden');
            this.renderGoalCalendar();
        }
    }

    renderGoalsList() {
        this.goalsList.innerHTML = '';
        this.gameState.goals.forEach(goal => {
            const li = document.createElement('li');
            li.style.cssText = 'padding:10px; border:1px solid #D4CFC8; border-radius:4px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px; background:#FAFAFA;';

            // Header row
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
            const title = document.createElement('strong');
            title.textContent = goal.name;
            if (goal.isCompleted) {
                title.style.textDecoration = 'line-through';
                title.style.opacity = '0.6';
            }
            
            const badge = document.createElement('span');
            badge.textContent = goal.category.toUpperCase();
            badge.style.cssText = 'font-size:0.7em; background:#E0DCD5; padding:2px 6px; border-radius:10px; margin-left:8px;';
            title.appendChild(badge);

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.style.cssText = 'background:transparent; border:none; cursor:pointer;';
            delBtn.onclick = () => {
                if (confirm(`Delete goal "${goal.name}"?`)) {
                    this.gameState.deleteGoal(goal.id);
                    this.renderGoalsList();
                }
            };

            header.appendChild(title);
            header.appendChild(delBtn);
            li.appendChild(header);

            // Progress bar
            if (goal.estimatedAmount > 0) {
                const percent = Math.min(100, (goal.currentAmount / goal.estimatedAmount) * 100).toFixed(1);
                const progressTrack = document.createElement('div');
                progressTrack.style.cssText = 'width:100%; height:12px; background:#E0DCD5; border-radius:6px; overflow:hidden;';
                const progressBar = document.createElement('div');
                progressBar.style.cssText = `width:${percent}%; height:100%; background:#8FA387; transition:width 0.3s;`;
                progressTrack.appendChild(progressBar);
                
                const progressText = document.createElement('div');
                progressText.textContent = `${goal.currentAmount} / ${goal.estimatedAmount} ${goal.unit} (${percent}%)`;
                progressText.style.cssText = 'font-size:0.85em; text-align:right; color:#8A8078; margin-top:2px;';

                li.appendChild(progressTrack);
                li.appendChild(progressText);
            }

            // Actions row
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:8px; margin-top:4px;';
            
            if (!goal.isCompleted) {
                const addManualBtn = document.createElement('button');
                addManualBtn.textContent = '+ Add Progress';
                addManualBtn.style.cssText = 'font-size:0.85em; padding:4px 8px;';
                addManualBtn.onclick = () => {
                    const amount = prompt(`Enter amount of ${goal.unit} to add:`, "1");
                    if (amount && !isNaN(amount)) {
                        this.gameState.updateGoalProgress(goal.id, parseFloat(amount));
                        this.renderGoalsList();
                    }
                };
                actions.appendChild(addManualBtn);

                const completeBtn = document.createElement('button');
                completeBtn.textContent = 'Finish Goal';
                completeBtn.style.cssText = 'font-size:0.85em; padding:4px 8px; background:#A8B8A0; color:#fff; border:none; border-radius:3px; cursor:pointer;';
                completeBtn.onclick = () => {
                     this.gameState.completeGoal(goal.id);
                     this.renderGoalsList();
                };
                actions.appendChild(completeBtn);
            } else {
                const repeatBtn = document.createElement('button');
                repeatBtn.textContent = 'Do it again 🔄';
                repeatBtn.style.cssText = 'font-size:0.85em; padding:4px 8px;';
                repeatBtn.onclick = () => {
                    this.gameState.repeatGoal(goal.id);
                    this.renderGoalsList();
                };
                actions.appendChild(repeatBtn);
                
                const countText = document.createElement('span');
                countText.textContent = `Completed ${goal.completedCount} times`;
                countText.style.cssText = 'font-size:0.8em; color:#8A8078; align-self:center; margin-left:auto;';
                actions.appendChild(countText);
            }

            li.appendChild(actions);
            this.goalsList.appendChild(li);
        });
        
        // Populate Goal dropdowns for other tabs (doing it here to keep them fresh)
        this.populateGoalSelects();
    }
    
    populateGoalSelects() {
        const burndownSelect = document.getElementById('burndown-goal-select');
        const calendarSelect = document.getElementById('calendar-goal-select');
        const habitSelect = document.getElementById('new-goal-habit-link');
        const pomodoroSelect = document.getElementById('pomodoro-goal-select');
        
        const currentBurndown = burndownSelect.value;
        const currentCalendar = calendarSelect.value;
        const currentHabit = habitSelect.value;
        const currentPomodoro = pomodoroSelect.value;
        
        burndownSelect.innerHTML = '';
        calendarSelect.innerHTML = '';
        pomodoroSelect.innerHTML = '<option value="">None</option>';
        habitSelect.innerHTML = '<option value="">-- Link to Habit (Optional) --</option>';
        
        if (this.gameState.goals.length === 0) {
            burndownSelect.innerHTML = '<option value="">No goals available</option>';
            calendarSelect.innerHTML = '<option value="">No goals available</option>';
        } else {
            this.gameState.goals.forEach(g => {
                const opt1 = document.createElement('option');
                opt1.value = g.id;
                opt1.textContent = g.name;
                burndownSelect.appendChild(opt1);
                
                const opt2 = document.createElement('option');
                opt2.value = g.id;
                opt2.textContent = g.name;
                calendarSelect.appendChild(opt2);
                
                const opt3 = document.createElement('option');
                opt3.value = g.id;
                opt3.textContent = g.name;
                pomodoroSelect.appendChild(opt3);
            });
        }
        
        this.gameState.habits.forEach(h => {
             const opt = document.createElement('option');
             opt.value = h.id;
             opt.textContent = h.name;
             habitSelect.appendChild(opt);
        });
        
        if (currentBurndown) burndownSelect.value = currentBurndown;
        if (currentCalendar) calendarSelect.value = currentCalendar;
        if (currentHabit) habitSelect.value = currentHabit;
        if (currentPomodoro) pomodoroSelect.value = currentPomodoro;
    }

    renderBurndownChart() {
        const select = document.getElementById('burndown-goal-select');
        const goalId = parseInt(select.value);
        if (isNaN(goalId)) return;
        
        const goal = this.gameState.goals.find(g => g.id === goalId);
        if (!goal || goal.estimatedAmount <= 0) {
             // Not enough info to make a burndown chart
             if (this.burndownChartInstance) this.burndownChartInstance.destroy();
             return;
        }
        
        // If we don't have historical data for the goal itself (we only stored `currentAmount` in the simplest version),
        // we can draw a simple chart showing "Target vs Current". 
        // For a TRUE burndown, we'd need historical snapshots of progress. 
        // We'll mimic a burndown by drawing the remaining amount vs time since start.
        
        const ctx = this.burndownChartCanvas.getContext('2d');
        if (this.burndownChartInstance) {
            this.burndownChartInstance.destroy();
        }
        
        const daysSinceStart = Math.max(0, Math.floor((Date.now() - goal.startDate) / (1000 * 60 * 60 * 24)));
        const labels = ['Start (Day 0)', `Today (Day ${daysSinceStart})`];
        const remaining = goal.estimatedAmount - goal.currentAmount;
        
        this.burndownChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${goal.unit} remaining`,
                    data: [goal.estimatedAmount, remaining],
                    borderColor: '#C2534C',
                    backgroundColor: 'rgba(194, 83, 76, 0.1)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: goal.estimatedAmount
                    }
                }
            }
        });
    }

    renderGoalCalendar() {
        this.calendarGrid.innerHTML = '';
        const select = document.getElementById('calendar-goal-select');
        const goalId = parseInt(select.value);
        if (isNaN(goalId)) {
             this.calendarGrid.textContent = "Please select a goal.";
             return;
        }
        
        const goal = this.gameState.goals.find(g => g.id === goalId);
        // Find linked habit if exists
        let habit = null;
        if (goal && goal.linkedHabitId) {
            habit = this.gameState.habits.find(h => h.id === goal.linkedHabitId);
        }
        
        if (!habit) {
             this.calendarGrid.innerHTML = "<p style='width:100%; color:#8A8078; font-size:0.9em;'>This goal is not linked to a habit. Calendar view requires a linked habit to track daily activity histories.</p>";
             return;
        }

        // Generate past 30 days grid
        const today = new Date();
        const days = 30;
        
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const cell = document.createElement('div');
            cell.style.cssText = 'width:24px; height:24px; border-radius:3px; border:1px solid #D4CFC8; display:flex; justify-content:center; align-items:center; cursor:help;';
            cell.title = dateStr;
            
            if (habit.history && habit.history[dateStr] && habit.history[dateStr].completed) {
                cell.style.background = '#8FA387'; // Green
                cell.style.borderColor = '#7A8C73';
            } else if (habit.history && habit.history[dateStr] && habit.history[dateStr].value > 0) {
                cell.style.background = '#C0D0B8'; // Light Green
            } else {
                cell.style.background = '#FAFAFA'; // Empty
            }
            
            this.calendarGrid.appendChild(cell);
        }
    }
}
