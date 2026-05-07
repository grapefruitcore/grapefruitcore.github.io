export class GameState {
    constructor(gameMode = 'story') {
        if (GameState.instance) {
            return GameState.instance;
        }

        GameState.instance = this;
        this.gameMode = gameMode; // 'story' or 'productivity'

        // Runtime state (not saved)
        this.pomodoro = {
            isRunning: false,
            startTimestamp: null,
            pausedAt: null,
            duration: 25 * 60 * 1000, // Default 25 mins
            timeLeft: 25 * 60 * 1000, // Default 25 mins
            timerId: null
        };

        // Activity state (not saved directly, but loaded/checked)
        // actually we DO need to save this to persist across reloads
        this.roommateActivity = null;

        // Load state from local storage or initialize
        this.loadState();
    }

    get storageKey() {
        return `grapefruit_gamestate_${this.gameMode}`;
    }

    loadState() {
        // Migration: move old key to story mode
        const oldData = localStorage.getItem('grapefruit_gamestate');
        if (oldData && !localStorage.getItem('grapefruit_gamestate_story')) {
            localStorage.setItem('grapefruit_gamestate_story', oldData);
            localStorage.removeItem('grapefruit_gamestate');
        }

        const saved = localStorage.getItem(this.storageKey);
        const now = new Date();

        if (saved) {
            const parsed = JSON.parse(saved);
            this.points = parsed.points || 0;
            this.friendship = parsed.friendship || 0;
            this.romance = parsed.romance || 0;
            this.romanceUnlocked = parsed.romanceUnlocked || false;
            this.romanceBudding = parsed.romanceBudding || false;
            this.romanceCrushing = parsed.romanceCrushing || false;
            this.firstDate = parsed.firstDate || false;
            this.dateScheduled = parsed.dateScheduled || false;
            this.romanceDating = parsed.romanceDating || false;
            this.romanceLover = parsed.romanceLover || false;
            this.romanceCruel = parsed.romanceCruel || false;
            this.dateHistory = parsed.dateHistory || [];
            this.playerName = parsed.playerName || "You";
            this.roommateName = parsed.roommateName || "Roommate";
            this.dateStories = {};
            this.habits = parsed.habits || [];
            this.completedDialogues = parsed.completedDialogues || [];
            this.recentDialogueIds = parsed.recentDialogueIds || [];
            this.flags = parsed.flags || {};
            this.roommateActivity = parsed.roommateActivity || null;
            this.goals = parsed.goals || [];
            this.personalBests = parsed.personalBests || { maxSteps: 0, maxWeight: 0, longestWorkout: 0 };

            // Productivity mode state
            this.customDialogues = parsed.customDialogues || [];
            this.roommateCustomization = parsed.roommateCustomization || {
                body: 'bodyF_skin1',
                clothes: 'clothesF_default',
                face: 'face_default',
                hair: 'hairCurly_colour1'
            };
            this.playerCustomization = parsed.playerCustomization || {
                body: 'bodyF_skin1',
                clothes: 'clothesF_default',
                face: 'face_default',
                hair: 'hairStraight_colour1'
            };
            this.unlockedCosmetics = parsed.unlockedCosmetics || [];

            this.furnitureCustomization = parsed.furnitureCustomization || {};

            // Check if activity expired
            this.checkRoommateActivity();

            console.log("Loaded State. DateHistory length:", this.dateHistory.length);

            // Migration: Ensure all habits have count and maxCount, and history/category/type
            this.habits.forEach(h => {
                if (typeof h.maxCount === 'undefined') h.maxCount = 1;
                if (typeof h.count === 'undefined') h.count = h.completed ? 1 : 0;
                if (!h.history) h.history = {};
                if (!h.category) h.category = 'custom';
                if (!h.type) h.type = 'boolean';
                
                // Migrate legacy completed state to today's history if needed
                if (h.completed && h.lastCompleted) {
                    const d = new Date(h.lastCompleted);
                    // Use local date string YYYY-MM-DD
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    if (!h.history[dateStr]) {
                         h.history[dateStr] = { completed: true, value: h.count };
                    }
                }
            });

            this.lastLogin = parsed.lastLogin || Date.now();
        } else {
            console.log("No saved state found. Initializing new state.");
            this.points = 0;
            this.friendship = 0;
            this.romance = 0;
            this.romanceUnlocked = false;
            this.romanceBudding = false;
            this.romanceCrushing = false;
            this.firstDate = false;
            this.dateScheduled = false;
            this.romanceDating = false;
            this.romanceLover = false;
            this.romanceCruel = false;
            this.dateHistory = [];
            this.playerName = "You";
            this.roommateName = "Roommate";
            this.dateStories = {};
            this.habits = [
                { id: 1, name: 'Drink Water', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 6, history: {}, category: 'health', type: 'boolean' },
                { id: 2, name: 'Exercise', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1, history: {}, category: 'exercise', type: 'boolean' },
                { id: 3, name: 'Read', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1, history: {}, category: 'productivity', type: 'boolean' }
            ];
            this.goals = [];
            this.personalBests = { maxSteps: 0, maxWeight: 0, longestWorkout: 0 };
            this.completedDialogues = [];
            this.recentDialogueIds = [];
            this.flags = {};
            this.roommateActivity = null;
            this.lastLogin = Date.now();

            // Productivity mode state
            this.customDialogues = [];
            this.roommateCustomization = {
                body: 'bodyF_skin1',
                clothes: 'clothesF_default',
                face: 'face_default',
                hair: 'hairCurly_colour1'
            };
            this.playerCustomization = {
                body: 'bodyF_skin1',
                clothes: 'clothesF_default',
                face: 'face_default',
                hair: 'hairStraight_colour1'
            };
            this.unlockedCosmetics = [];
            this.furnitureCustomization = {};
        }

        // Enforce Story mode names
        if (this.gameMode === 'story') {
            this.playerName = 'Charlie';
            this.roommateName = 'Avery';
        }

        // ...
    }

    saveState() {
        const state = {
            points: this.points,
            friendship: this.friendship,
            romance: this.romance,
            romanceUnlocked: this.romanceUnlocked,
            romanceBudding: this.romanceBudding,
            romanceCrushing: this.romanceCrushing,
            firstDate: this.firstDate,
            dateScheduled: this.dateScheduled,
            romanceDating: this.romanceDating,
            romanceLover: this.romanceLover,
            romanceCruel: this.romanceCruel,
            dateHistory: this.dateHistory,
            playerName: this.playerName,
            roommateName: this.roommateName,
            habits: this.habits,
            lastLogin: this.lastLogin,
            completedDialogues: this.completedDialogues,
            recentDialogueIds: this.recentDialogueIds,
            flags: this.flags,
            roommateActivity: this.roommateActivity,
            customDialogues: this.customDialogues,
            roommateCustomization: this.roommateCustomization,
            playerCustomization: this.playerCustomization,
            unlockedCosmetics: this.unlockedCosmetics,
            furnitureCustomization: this.furnitureCustomization,
            goals: this.goals,
            personalBests: this.personalBests
        };
        console.log("Saving State. DateHistory length:", this.dateHistory.length);
        localStorage.setItem(this.storageKey, JSON.stringify(state));

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
    }

    // --- FLAGS & DIALOGUE PROGRESSION ---
    setFlag(key, value) {
        this.flags[key] = value;
        this.saveState();
    }

    getFlag(key) {
        return this.flags[key];
    }

    addRecentDialogue(id) {
        this.recentDialogueIds.push(id);
        if (this.recentDialogueIds.length > 3) {
            this.recentDialogueIds.shift();
        }
        this.saveState();
    }

    markDialogueComplete(id) {
        if (!this.completedDialogues.includes(id)) {
            this.completedDialogues.push(id);
            this.saveState();
        }
    }

    resetState() {
        localStorage.removeItem(this.storageKey);
        this.loadState();
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
        console.log("Game state reset.");
    }

    // --- PRODUCTIVITY MODE METHODS ---
    addCustomDialogue(text, options = []) {
        if (this.gameMode !== 'productivity') return false;
        const cost = 50;
        if (!this.spendPoints(cost)) return false;

        this.customDialogues.push({
            id: 'custom_' + Date.now(),
            text: text,
            options: options.length > 0 ? options : [
                { text: 'Nice.', response: 'neutral' },
                { text: 'Cool.', response: 'neutral' }
            ]
        });
        this.saveState();
        return true;
    }

    buyCustomization(itemId, cost = 100) {
        if (this.gameMode !== 'productivity') return false;
        if (this.unlockedCosmetics.includes(itemId)) return true;
        if (!this.spendPoints(cost)) return false;

        this.unlockedCosmetics.push(itemId);
        this.saveState();
        return true;
    }

    equipCustomization(target, part, itemId) {
        if (target === 'player') {
            this.playerCustomization[part] = itemId;
        } else if (target === 'roommate') {
            this.roommateCustomization[part] = itemId;
        }
        this.saveState();
    }

    equipFurniture(tileChar, assetId) {
        if (this.gameMode !== 'productivity') return;
        this.furnitureCustomization[tileChar] = assetId;
        this.saveState();
    }

    static clearInstance() {
        GameState.instance = null;
    }

    // --- POINTS SYSTEM ---
    addPoints(amount) {
        this.points += amount;
        this.saveState();
        console.log(`Points added: ${amount}. Total: ${this.points}`);
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
    }

    spendPoints(amount) {
        if (this.points >= amount) {
            this.points -= amount;
            this.saveState();
            return true;
        }
        return false;
    }

    // --- RELATIONSHIP SYSTEM ---
    changeFriendship(amount) {
        this.friendship += amount;
        console.log(`Friendship: ${this.friendship}`);

        // Unlock romance if friendship is high enough
        if (this.friendship >= 20 && !this.romanceUnlocked) {
            this.romanceUnlocked = true;
            console.log("Romance Unlocked!");
            alert("You feel closer to your roommate...");
        }
        // If friendship drops below 10 while romance is above crushing, set romanceCruel to true
        if (this.friendship < 10 && this.romanceCrushing) {
            this.romanceCruel = true;
            console.log("Cruel");
            alert("Your roommate's been acting weird... ");
        }
        // If friendship is high enough while romanceCruel is true, set romanceCruel to false
        if (this.friendship >= 10 && this.romanceCruel) {
            this.romanceCruel = false;
            console.log("Not Cruel Anymore");
            alert("Your roommate's been acting normal again.");
        }

        this.saveState();
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
    }

    changeRomance(amount) {
        if (!this.romanceUnlocked) return;
        this.romance += amount;
        console.log(`Romance: ${this.romance}`);
        //if romance is 0, set romanceCruel to false
        if (this.romance === 0) {
            this.romanceCruel = false;
        }
        //if romance is high enough, set romanceBudding to true
        if (this.romance >= 10 && !this.romanceBudding) {
            this.romanceBudding = true;
            console.log("Romance: Budding");
            alert("Your roommate seems to like you more...");
        }
        //if romance is high enough, set romanceCrushing to true
        if (this.romance >= 20 && !this.romanceCrushing) {
            this.romanceCrushing = true;
            console.log("Romance: Crushing");
            alert("You think you're developing feelings for your roommate...");
        }
        //if romance is high enough, set romanceDating to true
        if (this.romance >= 40 && !this.romanceDating) {
            this.romanceDating = true;
            console.log("Romance Dating!");
            alert("You and your roommate are now dating.");
        }
        //if romance is high enough, set romanceLover to true
        if (this.romance >= 60 && !this.romanceLover) {
            this.romanceLover = true;
            console.log("Romance Lover!");
            alert("You and your roommate are now lovers.");
        }
        this.saveState();
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
    }

    scheduleDate() {
        this.setFlag('dateScheduled', true);
        //Schedule the date to happen the next day
        this.setFlag('date', new Date().getDate() + 1);
        console.log("Date Scheduled!");
        this.saveState();
    }

    loadDateStories(text) {
        const stories = {};
        const parts = text.split('---');
        // Parts will be: [empty, metadata, story, metadata, story...]
        // We need to skip the first empty one if it exists

        let currentMetadata = null;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            if (!currentMetadata) {
                // Parse Metadata
                const lines = part.split('\n');
                const meta = {};
                lines.forEach(line => {
                    const [key, value] = line.split(':').map(s => s.trim());
                    if (key && value) meta[key] = value;
                });

                if (meta.title && meta.state) {
                    currentMetadata = meta;
                }
            } else {
                // This part is the story
                if (!stories[currentMetadata.title]) stories[currentMetadata.title] = {};
                stories[currentMetadata.title][currentMetadata.state] = part;
                currentMetadata = null;
            }
        }
        this.dateStories = stories;
        console.log("Date stories loaded:", this.dateStories);
    }

    processDate() {
        if (!this.dateStories['FirstDate']) {
            console.error("Date stories not loaded!");
            return;
        }

        let storyKey = 'sweet';
        let title = 'First Date';

        if (!this.firstDate) {
            // First Date Logic
            if (this.romanceCruel) {
                storyKey = 'disaster';
            } else if (this.friendship < 30) {
                storyKey = 'awkward';
            } else {
                storyKey = 'sweet';
            }
            this.firstDate = true;
        } else {
            // Subsequent dates (using RandomDate for now)
            title = 'Date Night';
            // Placeholder for random date logic
            if (this.dateStories['RandomDate']) {
                const keys = Object.keys(this.dateStories['RandomDate']);
                storyKey = keys[Math.floor(Math.random() * keys.length)]; // Pick random state if multiple exist
                // Actually our file only has 'sweet' for RandomDate right now
                if (this.dateStories['RandomDate'][storyKey]) {
                    // We need to fetch from RandomDate specifically
                    // But the structure below assumes title is FirstDate. 
                    // Let's refactor slightly to get the text directly.
                }
            }
        }

        // Get raw text
        let rawText = "";
        if (title === 'First Date') {
            rawText = this.dateStories['FirstDate'][storyKey];
        } else {
            // For now fallback to RandomDate sweet
            rawText = this.dateStories['RandomDate'] ? this.dateStories['RandomDate']['sweet'] : "You went on a date.";
        }

        if (!rawText) rawText = "You had a date, but I forgot what happened.";

        // Replace names
        const story = rawText.replace(/\[your_name\]/g, this.playerName)
            .replace(/\[roommate_name\]/g, this.roommateName);

        // Update History
        this.dateHistory.push({
            date: Date.now(),
            title: title + ` (${storyKey})`,
            story: story
        });

        // Update Romance Stage if applicable
        if (this.romance >= 40 && !this.romanceDating) {
            this.romanceDating = true;
            console.log("Romance: Dating (Triggered by Date)");
        }

        this.setFlag('dateScheduled', false);
        this.saveState();

        // Dispatch Event
        window.dispatchEvent(new CustomEvent('date-completed', {
            detail: { title: title, story: story }
        }));
    }

    checkDailyReset(currentDate) {
        if (this.lastLogin) {
            const last = new Date(this.lastLogin);
            // Simple check: is it a different calendar day?
            if (last.getDate() !== currentDate.getDate() ||
                last.getMonth() !== currentDate.getMonth() ||
                last.getFullYear() !== currentDate.getFullYear()) {

                console.log("Daily Reset Triggered!");

                // Reset daily habits
                this.habits.forEach(h => {
                    h.completed = false;
                    h.count = 0;
                });

                // Check for scheduled date
                if (this.getFlag('dateScheduled')) {
                    this.processDate();
                }
            }
        }
        this.lastLogin = currentDate.getTime();
        this.saveState();
    }

    // --- GOALS SYSTEM ---
    addGoal(name, category, estimatedAmount, unit, linkedHabitId = null) {
        const id = Date.now();
        this.goals.push({
            id,
            name,
            category,
            startDate: Date.now(),
            estimatedAmount: parseFloat(estimatedAmount) || 0,
            currentAmount: 0,
            unit: unit || 'iterations',
            isCompleted: false,
            completedCount: 0,
            linkedHabitId
        });
        this.saveState();
    }

    deleteGoal(id) {
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveState();
    }

    updateGoalProgress(id, amountToAdd, isAbsolute = false) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return;

        if (isAbsolute) {
            goal.currentAmount = amountToAdd;
        } else {
            goal.currentAmount += amountToAdd;
        }

        // Clamp at 0 or don't clamp depending on desired behavior. Let's clamp at 0.
        if (goal.currentAmount < 0) goal.currentAmount = 0;

        this.saveState();
    }

    completeGoal(id) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal || goal.isCompleted) return;

        goal.isCompleted = true;
        goal.completedCount += 1;
        
        // Calculate points based on duration/estimated amount
        let pointsToAward = 200; // Base points for a goal
        if (goal.estimatedAmount > 0) {
            // Rough heuristic: assuming 30 min = 100 points
            if (goal.unit === 'hours') pointsToAward += goal.estimatedAmount * 200;
            if (goal.unit === 'iterations') pointsToAward += goal.estimatedAmount * 50;
        }
        this.addPoints(Math.floor(pointsToAward));
        alert(`Goal "${goal.name}" completed! You earned ${Math.floor(pointsToAward)} points.`);
        
        this.saveState();
    }

    repeatGoal(id) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return;

        goal.isCompleted = false;
        goal.currentAmount = 0;
        goal.startDate = Date.now();
        this.saveState();
    }

    startTimer(minutes, linkedGoalId = null) {
        if (this.pomodoro.isRunning) return;

        const newDurationMs = minutes * 60 * 1000;

        // If user changed the duration, or if timer ran out previously, start fresh
        if (this.pomodoro.duration !== newDurationMs || this.pomodoro.timeLeft <= 0 || this.pomodoro.timeLeft === undefined || this.pomodoro.timeLeft === this.pomodoro.duration) {
            this.pomodoro.duration = newDurationMs;
            this.pomodoro.timeLeft = newDurationMs;
        }

        this.pomodoro.startTimestamp = Date.now();
        this.pomodoro.isRunning = true;
        this.pomodoro.linkedGoalId = linkedGoalId;

        if (this.pomodoro.timerId) clearInterval(this.pomodoro.timerId);

        this.pomodoro.timerId = setInterval(() => {
            this.tickTimer();
        }, 1000);

        window.dispatchEvent(new CustomEvent('pomodoro-updated', { detail: this.pomodoro }));
    }

    pauseTimer() {
        if (!this.pomodoro.isRunning) return;

        this.pomodoro.isRunning = false;
        clearInterval(this.pomodoro.timerId);
        window.dispatchEvent(new CustomEvent('pomodoro-updated', { detail: this.pomodoro }));
    }

    resetTimer(newDurationMs = null) {
        this.pauseTimer();
        if (newDurationMs) {
            this.pomodoro.duration = newDurationMs;
        }
        this.pomodoro.timeLeft = this.pomodoro.duration;
        window.dispatchEvent(new CustomEvent('pomodoro-updated', { detail: this.pomodoro }));
    }

    tickTimer() {
        if (!this.pomodoro.isRunning) return;

        this.pomodoro.timeLeft -= 1000;

        if (this.pomodoro.timeLeft <= 0) {
            this.completePomodoro();
        }
        window.dispatchEvent(new CustomEvent('pomodoro-updated', { detail: this.pomodoro }));
    }

    completePomodoro() {
        this.pauseTimer();
        this.pomodoro.timeLeft = 0;

        // Calculate points
        const minutes = this.pomodoro.duration / 1000 / 60;
        this.recordPomodoroSession(minutes, this.pomodoro.linkedGoalId);
    }
    
    logPomodoro(minutes, linkedGoalId = null) {
        // Manual log entry
        if (!minutes || isNaN(minutes) || minutes <= 0) return;
        this.recordPomodoroSession(minutes, linkedGoalId);
    }
    
    recordPomodoroSession(minutes, linkedGoalId) {
        // Points calculation Rule: ~3.33 points per minute (100 points per 30 mins)
        const pointsEarned = Math.floor(minutes * (100 / 30));

        let msg = '';
        if (pointsEarned > 0) {
            this.addPoints(pointsEarned);
            msg = `Pomodoro complete! You earned ${pointsEarned} points.`;
        } else {
            msg = 'Pomodoro complete!';
        }
        
        // Auto-update linked goal progress if applicable
        if (linkedGoalId) {
             const goal = this.goals.find(g => g.id === linkedGoalId);
             if (goal) {
                 // Assume goal's unit might be minutes, hours, or blocks
                 let amountToAdd = 1; // Default to 1 block
                 if (goal.unit.toLowerCase().includes('min')) amountToAdd = minutes;
                 else if (goal.unit.toLowerCase().includes('hour') || goal.unit.toLowerCase().includes('hr')) amountToAdd = minutes / 60;
                 
                 this.updateGoalProgress(linkedGoalId, amountToAdd);
                 msg += ` Linked goal "${goal.name}" updated (+${amountToAdd.toFixed(1)} ${goal.unit}).`;
             }
        }
        
        alert(msg);
    }

    // --- HABIT SYSTEM ---
    addHabit(name, maxCount = 1, category = 'custom', type = 'boolean') {
        const id = Date.now(); // Simple ID generation
        this.habits.push({
            id,
            name,
            completed: false,
            streak: 0,
            lastCompleted: null,
            count: 0,
            maxCount: parseInt(maxCount) || 1,
            history: {},
            category,
            type
        });
        this.saveState();
    }

    deleteHabit(id) {
        this.habits = this.habits.filter(h => h.id !== id);
        this.saveState();
    }

    // New logic: Check specific sub-habit (index)
    // Actually, simple count is easier. User asked for "sub-checkboxes". 
    // We can map count to checked boxes.
    // If user clicks box 3, does it mean 1,2,3 are done? usually yes.
    // Or are they independent? "Check sub-checkboxes for each glass".
    // Let's assume they are just a counter visualization.
    updateHabitProgress(id, newCount) {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        this.updateHabitProgressForDate(id, todayStr, newCount);
    }
    
    updateHabitProgressForDate(id, dateStr, newCount, extraData = {}) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        // Ensure history object exists
        if (!habit.history) habit.history = {};

        // Clamp count
        newCount = Math.max(0, Math.min(newCount, habit.maxCount));
        
        // Find existing record for this date
        const existingRecord = habit.history[dateStr] || { completed: false, value: 0 };
        const wasCompleted = existingRecord.completed;
        const isNowCompleted = newCount >= habit.maxCount;

        // Apply new history state
        habit.history[dateStr] = { 
            completed: isNowCompleted, 
            value: newCount, 
            ...extraData // Allow passing steps, weight, duration, etc.
        };

        // If updating today's date, also update the high-level cache for UI convenience
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dateStr === todayStr) {
            habit.count = newCount;
            habit.completed = isNowCompleted;
            if (isNowCompleted && !wasCompleted) {
                habit.streak++;
                habit.lastCompleted = Date.now();
                const bonus = Math.min(habit.streak * 10, 100);
                this.addPoints(50 + bonus);
            } else if (!isNowCompleted && wasCompleted) {
                 if (habit.streak > 0) habit.streak--;
                 const bonus = Math.min((habit.streak + 1) * 10, 100);
                 this.addPoints(-(50 + bonus));
            }
        }
        
        // Personal Best Updates (e.g., max steps, max weight)
        if (extraData.steps && extraData.steps > this.personalBests.maxSteps) {
            this.personalBests.maxSteps = extraData.steps;
            this.addPoints(100);
            alert(`New Personal Best! ${extraData.steps} steps! (+100 pts)`);
        }
        if (extraData.weight && extraData.weight > this.personalBests.maxWeight) {
            this.personalBests.maxWeight = extraData.weight;
            this.addPoints(100);
            alert(`New Personal Best! ${extraData.weight} weight! (+100 pts)`);
        }
        if (extraData.duration && extraData.duration > this.personalBests.longestWorkout) {
            this.personalBests.longestWorkout = extraData.duration;
            this.addPoints(100);
            alert(`New Personal Best! ${extraData.duration} min workout! (+100 pts)`);
        }
        
        // Check for linked Long Term Goals
        // If a linked goal exists, we update its progress. Wait, we should only add the *difference* in progress for the goal.
        const diff = newCount - existingRecord.value;
        if (diff !== 0) {
            const linkedGoal = this.goals.find(g => g.linkedHabitId === habit.id && !g.isCompleted);
            if (linkedGoal) {
                // If it's a steps habit, maybe the goal is steps? 
                // Or if it's a boolean habit, completing it means +1 iteration.
                // It's safest to just add `diff` as the progress unit.
                // For steps, diff = +steps. For boolean, diff = +1.
                let addedAmount = diff;
                if (habit.type === 'steps' && extraData.steps) {
                    // diff is just the count of `1`, but steps is numeric. This gets tricky. 
                    // Let's assume progress is tied to `extraData.value` vs raw `count` if it's specialized.
                }
                
                // Keep it simple: diff is the change in the checkbox count.
                this.updateGoalProgress(linkedGoal.id, addedAmount);
            }
        }

        this.saveState();
    }

    // Deprecated/Modified toggle for backward compatibility if needed, 
    // but we will use updateHabitProgress generally.
    toggleHabit(id) {
        // Legacy toggle acts as 0 or Max
        const habit = this.habits.find(h => h.id === id);
        if (habit) {
            if (habit.completed) {
                this.updateHabitProgress(id, 0);
            } else {
                this.updateHabitProgress(id, habit.maxCount);
            }
        }
    }

    // --- ACTIVITY SYSTEM ---
    setRoommateActivity(id, type, durationMinutes) {
        this.roommateActivity = {
            id: id,
            type: type,
            until: Date.now() + (durationMinutes * 60 * 1000)
        };
        this.saveState();
        console.log(`Roommate activity set: ${type} until ${new Date(this.roommateActivity.until)}`);
    }

    checkRoommateActivity() {
        if (this.roommateActivity) {
            if (Date.now() > this.roommateActivity.until) {
                console.log("Roommate activity expired.");
                this.clearRoommateActivity();
            }
        }
    }

    clearRoommateActivity() {
        this.roommateActivity = null;
        this.saveState();
        console.log("Roommate activity cleared.");
    }
}
