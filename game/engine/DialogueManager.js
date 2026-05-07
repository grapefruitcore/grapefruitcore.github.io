export class DialogueManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.dialogues = this.initializeDialogues();
    }

    getFurnitureDialogue(furnitureType) {
        // Return context-specific dialogue based on furniture type and relationship
        if (furnitureType === 'bathtub') {
            return this.getBathtubDialogue();
        } else if (furnitureType === 'green_couch') {
            return this.getCouchDialogue();
        }
        return null;
    }

    getCouchDialogue() {
        const friendship = this.gameState.friendship;
        return {
            text: "Zzz...",
            options: [
                {
                    text: "(Wake them up)",
                    effect: (s) => {
                        s.changeFriendship(-1);
                        s.clearRoommateActivity(); // Wake up
                        console.log("Woke up roommate");
                    }
                },
                {
                    text: "(Let them sleep)",
                    effect: (s) => {
                        s.changeFriendship(1);
                    }
                }
            ]
        };
    }

    getBathtubDialogue() {
        const friendship = this.gameState.friendship;
        const romance = this.gameState.romance;
        const isDating = this.gameState.getFlag('is_dating') || romance > 20;

        const possibleDialogues = [];

        // Condition 1: Dating
        if (isDating) {
            possibleDialogues.push({
                text: "Mmm, this bath feels nice.",
                options: [
                    {
                        text: "Can I join you?",
                        effect: (s) => {
                            s.changeRomance(2);
                            console.log("Bathtub: ;)");
                        }
                    },
                    {
                        text: "Enjoy, baby.",
                        effect: (s) => {
                            s.changeRomance(1);
                        }
                    }
                ]
            });
        }

        // Condition 2: Low Friendship
        if (friendship < 0) {
            possibleDialogues.push({
                text: "Hey! I'm bathing! Get out!",
                emotion: 'nervous',
                options: [
                    {
                        text: "Okay.",
                        effect: (s) => {
                            // No effect
                        }
                    }
                ]
            });
        }

        // Condition 3: High Romance
        if (romance > 20) {
            possibleDialogues.push({
                text: "You really wanna talk, huh?",
                options: [
                    {
                        text: "It's urgent.",
                        effect: (s) => {
                            console.log("Bathtub: urgent conversation");
                            return {
                                text: "Um, what is it?",
                                emotion: 'nervous',
                                options: [
                                    {
                                        text: "Look, you really need to get your life together or get out.",
                                        effect: (state) => {
                                            state.changeFriendship(-10);
                                            console.log("Bathtub: harsh");
                                            return {
                                                text: "I know, I know. I'm trying. Please don't...",
                                                emotion: 'sad',
                                                options: [
                                                    {
                                                        text: "I know you are. I'm sorry. It's just that you forgot to take out the trash again.",
                                                        effect: (state) => {
                                                            state.changeFriendship(5);
                                                            console.log("Bathtub: supportive");
                                                        }
                                                    },
                                                    {
                                                        text: "This is your last fucking chance.",
                                                        effect: (state) => {
                                                            state.changeFriendship(-10);
                                                            console.log("Bathtub: demanding");
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        text: "I have an event tonight I need a plus-one for.",
                                        condition: (state) => state.romanceBudding,
                                        effect: (state) => {
                                            state.changeRomance(1);
                                            state.scheduleDate();
                                            console.log("Bathtub: date invitation");
                                            return {
                                                text: "Oh, really? I'd love to go.",
                                                emotion: 'happy',
                                                options: [
                                                    {
                                                        text: "Great! Get ready after you're done in here.",
                                                        effect: (state) => {
                                                            console.log("Bathtub: date invitation accepted");
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        text: "Just kidding, I just wanted to hang out.",
                                        effect: (state) => {
                                            console.log("Bathtub: casual conversation");
                                            return {
                                                text: "Oh, okay. Well, what's up?",
                                                options: [
                                                    {
                                                        text: "Nothing much. What's up with you?",
                                                        effect: (state) => {
                                                            console.log("Bathtub: casual conversation");
                                                            return {
                                                                text: "Same old, same old. Just trying to figure things out.",
                                                                options: [
                                                                    {
                                                                        text: "Yeah, I feel that.",
                                                                        effect: (state) => {
                                                                            console.log("Bathtub: casual conversation");
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    {
                        text: "I can wait.",
                        effect: (s) => {
                            console.log("Bathtub: cancelled conversation");
                        }
                    }
                ]
            });
        }

        // Condition 4: High Friendship
        if (friendship > 50) {
            possibleDialogues.push({
                text: "Hey, I'm trying to take a bath here.",
                options: [
                    {
                        text: "Oh, sorry.",
                        effect: (s) => {
                            console.log("Bathtub: cancelled conversation");
                        }
                    },
                    {
                        text: "You're always in here.",
                        effect: (s) => {
                            console.log("Bathtub: Complaint");
                            s.changeFriendship(-1);
                        }
                    },
                    {
                        text: "I just wanted to ask you something.",
                        effect: (s) => {
                            console.log("Bathtub: Question");
                            return {
                                text: "What is it?",
                                emotion: 'nervous',
                                options: [
                                    {
                                        text: "About your job.",
                                        effect: (s) => {
                                            console.log("Bathtub: Employment");
                                            return {
                                                text: "What about it?",
                                                options: [
                                                    {
                                                        text: "I was just wondering if you had an employee discount.",
                                                        effect: (s) => {
                                                            console.log("Bathtub: Employment");
                                                            return {
                                                                text: "No.",
                                                                options: [
                                                                    {
                                                                        text: "Oh.",
                                                                        effect: (s) => {
                                                                            console.log("Bathtub: Employment");
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        text: "Have you been eating enough?",
                                        effect: (s) => {
                                            console.log("Bathtub: Health");
                                            s.setFlag('health_concern', true);
                                            s.changeFriendship(1);
                                            return {
                                                text: "I'm fine.",
                                                options: [
                                                    {
                                                        text: "Look, I know you've been skipping meals.",
                                                        effect: (s) => {
                                                            console.log("Bathtub: Health");
                                                            return {
                                                                text: "No, I haven't.",
                                                                options: [
                                                                    {
                                                                        text: "If you say so.",
                                                                        effect: (s) => {
                                                                            console.log("Bathtub: Health");
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    },
                                                    {
                                                        text: "I'm just worried about you.",
                                                        effect: (s) => {
                                                            console.log("Bathtub: Health");
                                                            return {
                                                                text: "That's sweet of you.",
                                                                options: [
                                                                    {
                                                                        text: "I mean it.",
                                                                        effect: (s) => {
                                                                            console.log("Bathtub: Health");
                                                                            s.changeFriendship(1);
                                                                            s.changeRomance(1);
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        text: "I can't find my phone charger. Have you seen it?",
                                        effect: (s) => {
                                            console.log("Bathtub: Lost Item");
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            });
        }

        // Always add default option
        possibleDialogues.push({
            text: "Just ten more minutes then I'm out, I promise.",
            options: [
                {
                    text: "Sure.",
                    effect: (s) => s.changeFriendship(0)
                },
                {
                    text: "Take your time.",
                    effect: (s) => s.changeFriendship(1)
                },
                {
                    text: "Hurry up.",
                    effect: (s) => s.changeFriendship(-1)
                }
            ]
        });

        // Pick one at random
        return possibleDialogues[Math.floor(Math.random() * possibleDialogues.length)];
    }

    initializeDialogues() {
        return [
            {
                id: 'cigarette',
                text: "I want a cigarette.",
                condition: (state) => true,
                options: [
                    {
                        text: "Go outside. No smoking in the house.",
                        effect: (state) => {
                            state.changeFriendship(1);
                            console.log("Response: Responsible");
                        }
                    },
                    {
                        text: "That's not my problem.",
                        effect: (state) => {
                            state.changeFriendship(-2);
                            console.log("Response: Rude");
                        }
                    },
                    {
                        text: "Smoking isn't good for you, you know.",
                        effect: (state) => {
                            state.changeFriendship(2);
                            console.log("Response: Caring");
                        }
                    }
                ]
            },
            {
                id: 'hungry',
                text: "I'm hungry.",
                condition: (state) => true,
                options: [
                    {
                        text: "So?",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            console.log("Response: Rude");
                        }
                    },
                    {
                        text: "Go order takeout.",
                        effect: (state) => {
                            state.changeFriendship(1);
                            console.log("Response: Responsible");
                        }
                    },
                    {
                        text: () => {
                            const hour = new Date().getHours();
                            if (hour < 11) return "Do you want to eat breakfast with me?";
                            if (hour < 17) return "Do you want to eat lunch with me?";
                            return "Do you want to eat dinner with me?";
                        },
                        effect: (state) => {
                            state.changeFriendship(3);
                            state.changeRomance(1);
                            console.log("Response: Friendly/Romantic");
                        }
                    }
                ]
            },
            {
                id: 'work',
                text: "I have to work late tonight.",
                condition: (state) => true,
                options: [
                    {
                        text: "Good, rent's due soon.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            console.log("Response: Rude");
                        }
                    },
                    {
                        text: "That sucks.",
                        effect: (state) => {
                            state.changeFriendship(1);
                            console.log("Response: Responsible");
                        }
                    },
                    {
                        text: "That's too bad. I wanted to hang out tonight.",
                        effect: (state) => {
                            state.changeFriendship(3);
                            console.log("Response: Friendly/Romantic");
                            return {
                                text: "Um, just hanging out? Or...",
                                options: [
                                    {
                                        text: "Just hanging out.",
                                        effect: (state) => {
                                            console.log("Response: Friendly");
                                        }
                                    },
                                    {
                                        text: "I was thinking more along the lines of a date.",
                                        condition: (state) => state.romanceBudding,
                                        effect: (state) => {
                                            state.changeRomance(1);
                                            state.scheduleDate();
                                            console.log("Response: Romantic");
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            },
            // Generic/Filler
            {
                id: 'cleaning',
                text: "This place is a mess.",
                condition: (state) => true,
                options: [
                    {
                        text: "I'll clean it up later.",
                        effect: (state) => state.changeFriendship(0)
                    },
                    {
                        text: "You live here too, you know.",
                        effect: (state) => state.changeFriendship(-1)
                    }
                ]
            },
            {
                id: 'cleaning_2',
                text: "The kitchen sink is full of dishes.",
                condition: (state) => true,
                options: [
                    {
                        text: "I'll do them later.",
                        effect: (state) => state.changeFriendship(0)
                    },
                    {
                        text: "You never do them. Quit whining.",
                        effect: (state) => state.changeFriendship(-1)
                    }
                ]
            },
            {
                id: 'tv_show',
                text: "I've been binge-watching this show about a serial killer who runs a bakery.",
                condition: (state) => true,
                options: [
                    {
                        text: "Sounds... interesting.",
                        effect: (state) => {
                            state.changeFriendship(-2);
                        }
                    },
                    {
                        text: "I love that kind of stuff.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    }
                ]
            },
            {
                id: 'music_volume',
                text: "Is my music too loud?",
                condition: (state) => true,
                options: [
                    {
                        text: "A little bit.",
                        effect: (state) => {
                            state.changeFriendship(0);
                        }
                    },
                    {
                        text: "Nah, crank it up.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    },
                    {
                        text: "Yes, turn it off.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            console.log("Response: Rude");
                        }
                    }
                ]
            },
            {
                id: 'couch_tired',
                text: "I'm so tired...",
                condition: (state) => !state.roommateActivity,
                options: [
                    {
                        text: "Why don't you take a nap?",
                        effect: (state) => {
                            state.changeFriendship(1);
                            state.setRoommateActivity('cg1', 'green_couch', 15); // 15 minutes
                        }
                    },
                    {
                        text: "Haven't you been napping all day?",
                        effect: (state) => {
                            state.changeFriendship(-1);
                        }
                    }
                ]
            },
            // Furniture Interactions
            {
                id: 'bathtub_smell',
                text: "Do I smell?",
                condition: (state) => !state.roommateActivity, // Only if not already busy
                options: [
                    {
                        text: "No.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    },
                    {
                        text: "Maybe you should freshen up.",
                        effect: (state) => {
                            state.changeFriendship(0);
                            state.setRoommateActivity('bt1', 'bathtub', 30); // 30 mins
                        }
                    },
                    {
                        text: "Yeah, you stink.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            state.setRoommateActivity('bt1', 'bathtub', 30); // 30 mins
                        }
                    }
                ]
            },
            // High friendship specific
            {
                id: 'high_friendship',
                text: "You're the best roommate ever.",
                condition: (state) => state.friendship >= 50,
                options: [
                    {
                        text: "I know.",
                        effect: (state) => {
                            console.log("Response: Arrogant");
                        }
                    },
                    {
                        text: "Aw, thanks.",
                        effect: (state) => {
                            console.log("Response: Appreciative");
                            state.changeFriendship(0);
                        }
                    },
                    {
                        text: "No, you are.",
                        effect: (state) => {
                            console.log("Response: Humble");
                            state.changeFriendship(1);
                        }
                    },
                    {
                        text: "Then why don't you ever do anything for me?",
                        effect: (state) => {
                            console.log("Response: Unappreciative");
                            state.changeFriendship(-1);
                        }
                    }
                ]
            },
            // Romance Specific
            {
                id: 'romantic_gaze',
                text: "You catch them looking at you from across the room.",
                condition: (state) => state.romanceUnlocked,
                options: [
                    {
                        text: "Smile back.",
                        effect: (state) => {
                            state.changeRomance(2);
                            console.log("Romance increased");
                        }
                    },
                    {
                        text: "Look away.",
                        effect: (state) => {
                            state.changeRomance(-1);
                            console.log("Shy/Reject");
                        }
                    }
                ]
            },
            {
                id: 'flirty_comment',
                text: "You're looking good today.",
                condition: (state) => state.romanceUnlocked,
                options: [
                    {
                        text: "Thanks, not bad yourself.",
                        effect: (state) => {
                            state.changeRomance(2);
                            console.log("Romance increased");
                        }
                    },
                    {
                        text: "Okay?",
                        effect: (state) => {
                            state.changeRomance(-1);
                            console.log("Shy/Reject");
                        }
                    },
                    {
                        text: "Don't comment on my appearance.",
                        effect: (state) => {
                            state.changeRomance(-2);
                            state.changeFriendship(-1);
                            console.log("Rude");
                        }
                    }
                ]
            },
            {
                id: 'flirty_comment_2',
                text: "Have you been working out?",
                condition: (state) => state.romanceBudding,
                options: [
                    {
                        text: "Something like that.",
                        effect: (state) => {
                            console.log("Indifferent");
                        }
                    },
                    {
                        text: "Don't be weird.",
                        effect: (state) => {
                            state.changeRomance(-1);
                            console.log("Rude");
                        }
                    },
                    {
                        text: "Yeah, you wanna come to the gym with me?",
                        effect: (state) => {
                            state.changeRomance(2);
                            console.log("Flirty");
                        }
                    }
                ]
            },
            {
                id: 'flirty_comment_3',
                text: "I like your hair today.",
                condition: (state) => state.romanceBudding,
                options: [
                    {
                        text: "It looks the same as always.",
                        effect: (state) => {
                            console.log("Indifferent");
                        }
                    },
                    {
                        text: "Fuck off. Stop saying weird shit to me.",
                        effect: (state) => {
                            state.changeRomance(-4);
                            console.log("Rude");
                        }
                    },
                    {
                        text: "Thanks. Yours is cuter.",
                        effect: (state) => {
                            state.changeRomance(2);
                            console.log("Flirty");
                        }
                    }
                ]
            },
            {
                id: 'flirty_comment_4',
                text: "You're looking so handsome today.",
                condition: (state) => state.romanceCrushing,
                options: [
                    {
                        text: "Thanks.",
                        effect: (state) => {
                            console.log("Indifferent");
                        }
                    },
                    {
                        text: "What's your problem?",
                        effect: (state) => {
                            state.changeRomance(-2);
                            console.log("Rude");
                        }
                    },
                    {
                        text: "Aw, thanks, cutie.",
                        effect: (state) => {
                            state.changeRomance(2);
                            console.log("Flirty");
                        }
                    }
                ]
            },
            {
                id: 'tour',
                conversationId: 'tour',
                sequence: 1,
                text: "I've lived here a lot longer than you, you know. I could show you around the city sometime.",
                condition: (state) => state.romanceUnlocked,
                options: [
                    {
                        text: "I'd like that.",
                        effect: (state) => {
                            state.changeRomance(2);
                            state.markDialogueComplete('tour');
                            console.log("Romance increased");
                        }
                    },
                    {
                        text: "I'm busy.",
                        effect: (state) => {
                            state.changeRomance(-1);
                            console.log("Shy/Reject");
                        }
                    },
                    {
                        text: "Why would I want to do that?",
                        effect: (state) => {
                            state.changeRomance(-2);
                            state.changeFriendship(-1);
                            console.log("Rude");
                        }
                    }
                ]
            },
            {
                id: 'tour_2',
                conversationId: 'tour',
                sequence: 2,
                text: "So, about that tour... where do you want to go?",
                condition: (state) => true,
                options: [
                    {
                        text: "Somewhere with good food. It's a date?",
                        effect: (state) => {
                            state.changeRomance(1);
                            state.markDialogueComplete('tour_2');
                        }
                    },
                    {
                        text: "A museum?",
                        effect: (state) => {
                            console.log("You're boring.");
                        }
                    }
                ]
            },
            {
                id: 'tour_3',
                conversationId: 'tour',
                sequence: 3,
                text: "Are you free tonight?",
                condition: (state) => true,
                options: [
                    {
                        text: "Yeah, I am. Let me take you out.",
                        effect: (state) => {
                            state.changeRomance(1);
                            state.scheduleDate();
                            state.markDialogueComplete('tour_3');
                        }
                    },
                    {
                        text: "No, I'm not.",
                        effect: (state) => {
                            state.changeRomance(-1);
                        }
                    }
                ]
            },
            //Health
            {
                id: 'health',
                conversationId: 'health',
                sequence: 1,
                text: "Um, there's something I wanted to talk about.",
                condition: (state) => state.getFlag('health_concern') && state.friendship >= 75,
                options: [
                    {
                        text: "Yeah?",
                        effect: (state) => {
                            return {
                                text: "Can you promise you won't get mad?",
                                emotion: 'nervous',
                                options: [
                                    {
                                        text: "I promise.",
                                        effect: (state) => {
                                            return {
                                                text: "I think I need to go to the doctor. Will you drive me, please? I don't feel well enough to take the bus.",
                                                emotion: 'sad',
                                                options: [
                                                    {
                                                        text: "Yeah, of course. Yeah. What's wrong?",
                                                        effect: (state) => {
                                                            return {
                                                                text: "I'm dizzy...",
                                                                emotion: 'sad',
                                                                options: [
                                                                    {
                                                                        text: "Let's go to a walk-in.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(1);
                                                                        }
                                                                    },
                                                                    {
                                                                        text: "Let's go to the ER.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(2);
                                                                        }
                                                                    },
                                                                    {
                                                                        text: "I don't know, maybe you should just drink some water and wait for it to pass.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(-5);
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    },
                                                    {
                                                        text: "What for?",
                                                        effect: (state) => {
                                                            return {
                                                                text: "I'm dizzy...",
                                                                options: [
                                                                    {
                                                                        text: "Let's go to a walk-in.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(2);
                                                                        }
                                                                    },
                                                                    {
                                                                        text: "I don't know, maybe you should just drink some water and wait for it to pass.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(-5);
                                                                        }
                                                                    },
                                                                    {
                                                                        text: "That's because you lay around all day doing nothing. Go outside.",
                                                                        effect: (state) => {
                                                                            state.changeFriendship(-10);
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        text: "Um....",
                                        effect: (state) => {
                                            state.changeFriendship(-2);
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    {
                        text: "I'm busy.",
                        effect: (state) => {
                            state.changeFriendship(-2);
                        }
                    }
                ]
            },
            // Deep Talk
            {
                id: 'deep_talk',
                conversationId: 'self_esteem',
                sequence: 1,
                text: "Hey...",
                condition: (state) => state.friendship >= 10,
                options: [
                    {
                        text: "What's up?",
                        effect: (state) => {
                            return {
                                text: "I've just been thinking, um...",
                                options: [
                                    {
                                        text: "About what?",
                                        effect: (state) => {
                                            return {
                                                text: "Just... just stuff. Sorry if I'm bugging you.",
                                                options: [
                                                    {
                                                        text: "It's alright. Is something wrong?",
                                                        effect: (state) => {
                                                            return {
                                                                text: "I just don't know what I'm doing with myself. Like... I'm kind of flailing here. I don't know what I want, where to go. My career is going nowhere, I'm working a shitty part-time job, and I'm not even close to thinking about going back to school for my graduate degree. Like... am I gonna just be working retail and selling beats online until I die?",
                                                                options: [
                                                                    {
                                                                        text: "Probably.",
                                                                        effect: (s) => {
                                                                            s.changeFriendship(-2);
                                                                            s.markDialogueComplete('deep_talk');
                                                                            s.setFlag('cynical', true);
                                                                            console.log("Deep Talk: Cynical");
                                                                            return {
                                                                                text: "I was being rhetorical.",
                                                                                options: []
                                                                            };
                                                                        }
                                                                    },
                                                                    {
                                                                        text: "Have you tried looking for grants and scholarships? You're smart enough, that's for sure.",
                                                                        effect: (s) => {
                                                                            s.changeFriendship(2);
                                                                            s.markDialogueComplete('deep_talk');
                                                                            s.setFlag('grad_interest', true);
                                                                            console.log("Deep Talk: Advice");
                                                                            return {
                                                                                text: "You think so?",
                                                                                options: []
                                                                            };
                                                                        }
                                                                    }
                                                                ]
                                                            };
                                                        }
                                                    }
                                                ]
                                            };
                                        }
                                    }
                                ]
                            };
                        }
                    },
                    {
                        text: "What?",
                        effect: (state) => {
                            return {
                                text: "Uh, I don't know, um... sorry. How's it going?",
                                options: [
                                    {
                                        text: "I mean, fine? Kinda bored.",
                                        effect: (state) => {
                                            return {
                                                text: "Okay...",
                                                options: [
                                                    {
                                                        text: "...",
                                                        effect: (state) => {
                                                            return {
                                                                text: "Just kind of, I dunno, I don't know what to do with myself.",
                                                                options: [
                                                                    {
                                                                        text: "Maybe you can start with cleaning your side of the room.",
                                                                        effect: (s) => {
                                                                            s.changeFriendship(0); // Neutral
                                                                            console.log("Deep Talk: Casual/Cleaning");
                                                                            return {
                                                                                text: "Sure.",
                                                                                options: []
                                                                            };
                                                                        }
                                                                    }
                                                                ]
                                                            };
                                                        }
                                                    }
                                                ]
                                            };
                                        }
                                    },
                                    {
                                        text: "Good. How are you holding up?",
                                        effect: (state) => {
                                            return {
                                                text: "Just kind of, I dunno, I don't know what to do with myself.",
                                                options: [
                                                    {
                                                        text: "Maybe you can start with cleaning your side of the room.",
                                                        effect: (s) => {
                                                            s.changeFriendship(0); // Neutral
                                                            console.log("Deep Talk: Casual/Cleaning");
                                                            return {
                                                                text: "Sure.",
                                                                options: []
                                                            };
                                                        }
                                                    }
                                                ]
                                            };
                                        }
                                    }
                                ]
                            };
                        }
                    },
                    {
                        text: "Not now.",
                        effect: (state) => {
                            console.log("Deep Talk: Reject");
                            return null;
                        }
                    }
                ]
            },
            {
                id: 'grad_school',
                conversationId: 'self_esteem',
                sequence: 2,
                text: "I've been looking at some grad school applications...",
                condition: (state) => state.getFlag('grad_interest'),
                options: [
                    {
                        text: "That's great!",
                        effect: (state) => {
                            state.changeFriendship(1);
                            console.log("Grad School: Affirmation");
                        }
                    },
                    {
                        text: "What are you applying for?",
                        effect: (state) => {
                            state.changeFriendship(1);
                            return {
                                text: "Um, I'm not sure yet. I've just been researching.",
                                options: [
                                    {
                                        text: "Okay.",
                                        effect: (state) => {
                                            console.log("Grad School: Research");
                                        }
                                    }
                                ]
                            };
                        }
                    }
                ]
            },
            {
                id: 'self_deprecating',
                conversationId: 'self_esteem',
                sequence: 2,
                text: "I'm just a mess, aren't I?",
                condition: (state) => state.getFlag('cynical'),
                options: [
                    {
                        text: "Kind of.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                        }
                    },
                    {
                        text: "No, you're fine.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    },
                    {
                        text: "Yeah, you're a fucking mess.",
                        effect: (state) => {
                            state.changeFriendship(-2);
                            state.markDialogueComplete('self_deprecating')
                            console.log("Self Deprecating: Cruel");
                        }
                    }
                ]
            },
            {
                id: 'self_hating',
                conversationId: 'self_esteem',
                sequence: 3,
                text: "I can't do anything right.",
                condition: (state) => state.getFlag('cynical'),
                options: [
                    {
                        text: "Don't say that.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    },
                    {
                        text: "Hey, what makes you think that? I like having you around.",
                        effect: (state) => {
                            state.changeFriendship(2);
                            state.markDialogueComplete('self_hating');
                            state.changeRomance(1);
                            console.log("Self Hating: Affirmation");
                        }
                    },
                    {
                        text: "If you spent less time moping and more time applying for jobs, you wouldn't be so useless.",
                        effect: (state) => {
                            state.changeFriendship(-2);
                            console.log("Self Hating: Cruel");
                        }
                    }
                ]
            },
            //Cruel romance (condition: (state) => state.romanceCruel)
            {
                id: 'shirt',
                conversationId: 'shirt',
                sequence: 1,
                text: "[...]",
                condition: (state) => state.getFlag('romanceCruel'),
                options: [
                    {
                        text: "Is that my shirt? Did you steal my fucking shirt? That's fucking weird.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            return {
                                text: "I just wanted to feel closer to you.",
                                options: [
                                    {
                                        text: "Don't do that anymore. Wash it before you give it back.",
                                        effect: (state) => {
                                            state.changeRomance(-1);
                                        }
                                    },
                                    {
                                        text: "What? Ew.",
                                        effect: (state) => {
                                            state.changeRomance(-2);
                                        }
                                    },
                                    {
                                        text: "I think we need to talk about boundaries.",
                                        effect: (state) => {
                                            state.changeFriendship(1);
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    {
                        text: "You're such a little weirdo, stealing my clothes. That looks huge on you.",
                        effect: (state) => {
                            state.changeFriendship(-1);
                            state.changeRomance(1);
                            return {
                                text: "You're just so tall. I feel so small next to you.",
                                options: [
                                    {
                                        text: "I know.",
                                        effect: (state) => {
                                        }
                                    },
                                    {
                                        text: "I could pick you up and throw you off the second floor.",
                                        effect: (state) => {
                                            state.changeFriendship(-1);
                                        }
                                    },
                                    {
                                        text: "I like you small. Don't ever get fat or anything.",
                                        effect: (state) => {
                                            state.changeFriendship(-1);
                                            state.changeRomance(1);
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    {
                        text: "Why so nervous all the time? It's your house too, relax.",
                        effect: (state) => {
                            state.changeFriendship(1);
                        }
                    }
                ]
            }
        ];
    }

    getRandomDialogue() {
        // 1. Filter out already completed dialogues
        let candidates = this.dialogues.filter(d => !this.gameState.completedDialogues.includes(d.id));

        // 2. Handle progressive conversations (conversationId & sequence)
        // Group by conversationId
        const conversations = {};
        const singles = [];

        candidates.forEach(d => {
            if (d.conversationId) {
                if (!conversations[d.conversationId]) conversations[d.conversationId] = [];
                conversations[d.conversationId].push(d);
            } else {
                singles.push(d); // Non-progressive dialogues are candidates
            }
        });

        // For each conversation, pick ONLY the lowest sequence (structural next step)
        Object.values(conversations).forEach(group => {
            // Sort by sequence ascending
            group.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            // The first one is the absolutely next step in the conversation chain
            if (group.length > 0) {
                singles.push(group[0]);
            }
        });

        // 3. Filter by conditions (LAST)
        // If the next step is locked by condition, do NOT fallback to later steps. Just don't show it.
        let available = singles.filter(d => d.condition(this.gameState));

        // 4. Filter out recent dialogues (to avoid repetition)
        const notRecent = available.filter(d => !this.gameState.recentDialogueIds.includes(d.id));
        // Only apply filter if we still have candidates left (don't soft-lock if we run out of unique dialogue)
        if (notRecent.length > 0) {
            available = notRecent;
        }

        if (available.length === 0) return null;

        // Simple random selection
        const selected = available[Math.floor(Math.random() * available.length)];

        // Record as recent
        this.gameState.addRecentDialogue(selected.id);

        // Process options to ensure text is a string (handle dynamic text functions)
        const processedOptions = selected.options.map(opt => ({
            text: typeof opt.text === 'function' ? opt.text(this.gameState) : opt.text,
            onSelect: () => opt.effect(this.gameState)
        }));

        return {
            text: selected.text,
            options: processedOptions
        };
    }
}
