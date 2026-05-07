export class GameState {
    constructor() {
        if (GameState.instance) {
            return GameState.instance;
        }

        GameState.instance = this;

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

    loadState() {
        const saved = localStorage.getItem('grapefruit_gamestate');
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
            this.dateStories = {};
            this.habits = parsed.habits || [];
            this.completedDialogues = parsed.completedDialogues || [];
            this.recentDialogueIds = parsed.recentDialogueIds || [];
            this.flags = parsed.flags || {};
            this.roommateActivity = parsed.roommateActivity || null;

            // Check if activity expired
            this.checkRoommateActivity();

            console.log("Loaded State. DateHistory length:", this.dateHistory.length);

            // Migration: Ensure all habits have count and maxCount
            this.habits.forEach(h => {
                if (typeof h.maxCount === 'undefined') h.maxCount = 1;
                if (typeof h.count === 'undefined') h.count = h.completed ? 1 : 0;
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
                { id: 1, name: 'Drink Water', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 6 },
                { id: 2, name: 'Exercise', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1 },
                { id: 3, name: 'Read', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1 }
            ];
            this.completedDialogues = [];
            this.recentDialogueIds = [];
            this.flags = {};
            this.roommateActivity = null;
            this.lastLogin = Date.now();
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
            roommateActivity: this.roommateActivity
        };
        console.log("Saving State. DateHistory length:", this.dateHistory.length);
        localStorage.setItem('grapefruit_gamestate', JSON.stringify(state));

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
        localStorage.removeItem('grapefruit_gamestate');
        this.loadState();
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
        console.log("Game state reset.");
    }

    checkDailyReset(now) {
        const last = new Date(this.lastLogin);

        // precise day check
        const isSameDay = now.getDate() === last.getDate() &&
            now.getMonth() === last.getMonth() &&
            now.getFullYear() === last.getFullYear();

        if (!isSameDay) {
            console.log('Daily Reset Triggered');
            this.habits.forEach(h => {
                // If not completed yesterday, reset streak? 
                // For MVP, if lastCompleted wasn't yesterday, streak = 0.
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);

                const lastComp = h.lastCompleted ? new Date(h.lastCompleted) : null;
                const completedYesterday = lastComp &&
                    lastComp.getDate() === yesterday.getDate() &&
                    lastComp.getMonth() === yesterday.getMonth() &&
                    lastComp.getFullYear() === yesterday.getFullYear();

                if (!completedYesterday && !h.completed) {
                    h.streak = 0;
                }

                h.completed = false;
            });
            this.lastLogin = now.getTime();
            this.saveState();
        }
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

    startTimer(minutes) {
        if (this.pomodoro.isRunning) return;

        this.pomodoro.duration = minutes * 60 * 1000;
        // If resuming or starting fresh?
        // Basic start fresh logic for now, unless paused
        if (this.pomodoro.timeLeft <= 0 || this.pomodoro.timeLeft === undefined) {
            this.pomodoro.timeLeft = this.pomodoro.duration;
        }

        this.pomodoro.startTimestamp = Date.now();
        this.pomodoro.isRunning = true;

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

    resetTimer() {
        this.pauseTimer();
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
        // duration is in ms
        const minutes = this.pomodoro.duration / 1000 / 60;

        // Rule: Minimum 30 mins for points
        if (minutes >= 30) {
            // 100 points per 30 mins
            const pointsEarned = Math.floor(minutes / 30) * 100;
            this.addPoints(pointsEarned);
            alert(`Pomodoro complete! You earned ${pointsEarned} points.`);
        } else {
            alert('Pomodoro complete! (No points for sessions under 30m)');
        }
    }

    // --- HABIT SYSTEM ---
    addHabit(name, maxCount = 1) {
        const id = Date.now(); // Simple ID generation
        this.habits.push({
            id,
            name,
            completed: false,
            streak: 0,
            lastCompleted: null,
            count: 0,
            maxCount: parseInt(maxCount) || 1
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
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        // Clamp count
        newCount = Math.max(0, Math.min(newCount, habit.maxCount));

        const wasCompleted = habit.completed;
        habit.count = newCount;

        // Check completion
        const isNowCompleted = habit.count >= habit.maxCount;

        if (isNowCompleted && !wasCompleted) {
            // Mark as complete
            habit.completed = true;
            habit.streak++;
            habit.lastCompleted = Date.now();

            // Calculate points: Base 50 + (Streak * 10)
            const bonus = Math.min(habit.streak * 10, 100);
            this.addPoints(50 + bonus);
        } else if (!isNowCompleted && wasCompleted) {
            // Undo completion
            habit.completed = false;
            // Revert streak
            if (habit.streak > 0) habit.streak--;

            // Refund points
            const bonus = Math.min((habit.streak + 1) * 10, 100);
            this.addPoints(-(50 + bonus));
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
