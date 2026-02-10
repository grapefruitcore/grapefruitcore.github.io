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
            timeLeft: 25 * 60 * 1000,
            timerId: null
        };

        // Load state from local storage or initialize
        this.loadState();
    }

    loadState() {
        const saved = localStorage.getItem('grapefruit_gamestate');
        const now = new Date();

        if (saved) {
            const parsed = JSON.parse(saved);
            this.points = parsed.points || 0;
            this.habits = parsed.habits || [];

            // Migration: Ensure all habits have count and maxCount
            this.habits.forEach(h => {
                if (typeof h.maxCount === 'undefined') h.maxCount = 1;
                if (typeof h.count === 'undefined') h.count = h.completed ? 1 : 0;
            });

            this.lastLogin = parsed.lastLogin || Date.now();
        } else {
            this.points = 0;
            this.habits = [
                { id: 1, name: 'Drink Water', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 6 },
                { id: 2, name: 'Exercise', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1 },
                { id: 3, name: 'Read', completed: false, streak: 0, lastCompleted: null, count: 0, maxCount: 1 }
            ];
            this.lastLogin = Date.now();
        }

        this.checkDailyReset(now);
    }

    saveState() {
        const state = {
            points: this.points,
            habits: this.habits,
            lastLogin: this.lastLogin
        };
        localStorage.setItem('grapefruit_gamestate', JSON.stringify(state));

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('gamestate-updated', { detail: this }));
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

    // --- POMODORO SYSTEM ---
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
}
