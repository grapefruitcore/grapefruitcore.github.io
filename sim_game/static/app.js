// VIBENET APP LOGIC

// Application State
const state = {
    currentView: 'view-timeline',
    currentUser: null,
    communities: [],
    characters: [],
    posts: [],
    activeChatCharId: null,
    activeThreadPostId: null,
    isThreadPolling: false,
    threadPollInterval: null,
    editingCharacterId: null,
    editingCharacterRelationships: [],
    characterRelationships: {},
    previousView: 'view-timeline',
    gameState: null,
};

// DOM Elements
const views = document.querySelectorAll('.content-view');
const navItems = document.querySelectorAll('.nav-item');
const postForm = document.getElementById('post-form');
const postContent = document.getElementById('post-content');
const postCommunitySelect = document.getElementById('post-community-select');
const timelineFeed = document.getElementById('timeline-posts-feed');
const threadPostsContainer = document.getElementById('thread-posts-container');
const threadReplyForm = document.getElementById('thread-reply-form');
const threadReplyContent = document.getElementById('thread-reply-content');
const threadTypingBanner = document.getElementById('thread-typing-banner');
const userMiniProfile = document.getElementById('user-mini-profile');

// DM Elements
const dmContactsList = document.getElementById('dm-contacts-list');
const dmActiveChatArea = document.getElementById('dm-active-chat-area');
const chatNoSelection = document.getElementById('chat-no-selection');
const chatActivePane = document.getElementById('chat-active-pane');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderName = document.getElementById('chat-header-name');
const chatHeaderHandle = document.getElementById('chat-header-handle');
const chatRelationshipScore = document.getElementById('chat-relationship-score');
const chatRelationshipFill = document.getElementById('chat-relationship-fill');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const dmVibeText = document.getElementById('dm-vibe-text');
const dmVibeIntensityFill = document.getElementById('dm-vibe-intensity-fill');
const dmVibeIntensityPct = document.getElementById('dm-vibe-intensity-pct');
const dmRepliesLeft = document.getElementById('dm-replies-left');
const dmSendForm = document.getElementById('dm-send-form');
const dmInputContent = document.getElementById('dm-input-content');

// Character Studio Elements
const createCharForm = document.getElementById('create-character-form');
const studioGrid = document.getElementById('studio-characters-grid');

// Profile Elements
const profileUpdateForm = document.getElementById('profile-update-form');
const userProfileAvatarPreview = document.getElementById('user-profile-avatar-preview');

// Sidebar Control Elements
const btnTriggerTimeline = document.getElementById('btn-trigger-timeline');
const btnTriggerGossip = document.getElementById('btn-trigger-gossip');
const sidebarRelationshipList = document.getElementById('sidebar-relationship-list');
const activityLogFeed = document.getElementById('activity-log-feed');
const btnUndoAction = document.getElementById('btn-undo-action');
const eventModalBackdrop = document.getElementById('event-modal-backdrop');
const eventCharactersList = document.getElementById('event-characters-list');
const eventScenarioText = document.getElementById('event-scenario-text');
const eventResolveForm = document.getElementById('event-resolve-form');
const eventChoiceInput = document.getElementById('event-choice-input');
const eventResolutionBox = document.getElementById('event-resolution-box');
const eventResolutionText = document.getElementById('event-resolution-text');
const eventResolutionStats = document.getElementById('event-resolution-stats');
const btnCloseEventModal = document.getElementById('btn-close-event-modal');
const btnTriggerSocialEvent = document.getElementById('btn-trigger-social-event');

// HELPER: Format Timestamp
function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${hours}:${minutes} ${ampm}`;
}

// HELPER: Sleep for typing delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// HELPER: Render [image: description] tags as styled placeholder cards
function renderImageTags(text) {
    if (!text || !text.includes('[image:')) return text;
    return text.replace(/\[image:\s*([^\]]+)\]/gi, (_, desc) => {
        const trimmed = desc.trim();
        return `<span class="inline-image-block" style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(0,240,255,0.06);
            border: 1px solid rgba(0,240,255,0.2);
            border-radius: 8px;
            padding: 6px 10px;
            margin: 2px 0;
            font-size: 12.5px;
            color: var(--accent-cyan);
            font-style: italic;
            vertical-align: middle;
        ">
            <span style="font-size:16px; line-height:1;">📷</span>
            <span style="color:var(--text-secondary);">${trimmed}</span>
        </span>`;
    });
}

// INITIALIZE APP
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    await loadUserProfile();
    await loadWorldContext();
    await loadCommunities();
    await loadCharacters();
    await loadTimeline();
    await loadGameState();
    await checkForActiveEvent();
    setupEventListeners();
});

// ROUTING & NAVIGATION
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.getAttribute('data-target');
            switchView(targetView);
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    document.getElementById('btn-back-timeline').addEventListener('click', () => {
        switchView('view-timeline');
        // Reset active nav item highlight
        navItems.forEach(n => n.classList.remove('active'));
        document.getElementById('nav-timeline').classList.add('active');
        stopThreadPolling();
    });
}

function switchView(viewId) {
    const allViews = document.querySelectorAll('.content-view');
    allViews.forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
    }
    state.currentView = viewId;

    if (viewId === 'view-timeline') {
        loadTimeline();
    } else if (viewId === 'view-dms') {
        renderDMContacts();
    } else if (viewId === 'view-studio') {
        renderStudioCharacters();
    } else if (viewId === 'view-profile') {
        renderProfileSettings();
    } else if (viewId === 'view-activity-log') {
        loadActivityLog();
    } else if (viewId === 'view-debug') {
        loadDebugLogs();
    }
    
    if (viewId !== 'view-thread') {
        stopThreadPolling();
    }
}

// API CALLS & DATA RETRIEVAL

async function loadActivityLog() {
    activityLogFeed.innerHTML = '<div class="loading-placeholder">Loading narrative history...</div>';
    try {
        const res = await fetch('/api/activity_log');
        if (res.ok) {
            const logs = await res.json();
            renderActivityLog(logs);
        }
    } catch (err) {
        console.error("Error loading activity log:", err);
        activityLogFeed.innerHTML = '<div class="loading-placeholder">Failed to load narrative history.</div>';
    }
}

function renderActivityLog(logs) {
    if (logs.length === 0) {
        activityLogFeed.innerHTML = '<div class="loading-placeholder">Your story hasn\'t begun yet. Send posts, replies, or DMs to log narrative outcomes!</div>';
        return;
    }
    
    activityLogFeed.innerHTML = '';
    logs.forEach(log => {
        const card = document.createElement('div');
        card.className = `activity-card type-${log.trigger_type.toLowerCase()}`;
        
        const timeStr = new Date(log.timestamp).toLocaleString();
        
        const xpPill = `<span class="stat-pill xp">+${log.xp_gained} XP</span>`;
        let relPill = '';
        if (log.relationship_change !== 0) {
            const isPlus = log.relationship_change > 0;
            relPill = `<span class="stat-pill ${isPlus ? 'rel-plus' : 'rel-minus'}">${isPlus ? '+' : ''}${log.relationship_change}% Rel (${log.character_name || 'NPC'})</span>`;
        }
        
        card.innerHTML = `
            <div class="activity-header">
                <span class="activity-badge">${log.trigger_type.replace('_', ' ')}</span>
                <span>${timeStr}</span>
            </div>
            <div class="activity-outcome">${log.narrative_outcome}</div>
            <div class="activity-accordion">
                <button class="accordion-toggle">📊 View Score Changes</button>
                <div class="accordion-content" style="display: none;">
                    ${xpPill}
                    ${relPill}
                </div>
            </div>
        `;
        
        card.querySelector('.accordion-toggle').addEventListener('click', (e) => {
            const content = card.querySelector('.accordion-content');
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'flex';
            e.target.textContent = isOpen ? '📊 View Score Changes' : '🔽 Hide Score Changes';
        });
        
        activityLogFeed.appendChild(card);
    });
}

async function checkForActiveEvent() {
    try {
        const res = await fetch('/api/events/active');
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'active') {
                showEventModal(data.event);
            }
        }
    } catch (err) {
        console.error("Error checking for active event:", err);
    }
}

let currentActiveEventId = null;

function showEventModal(event) {
    currentActiveEventId = event.id;
    eventScenarioText.textContent = event.scenario_text;
    
    eventChoiceInput.value = '';
    eventResolveForm.style.display = 'block';
    eventResolutionBox.style.display = 'none';
    
    eventCharactersList.innerHTML = '';
    event.involved_characters.forEach(char => {
        eventCharactersList.innerHTML += `<span class="char-badge">${char.name}</span>`;
    });
    
    eventModalBackdrop.style.display = 'flex';
}

async function loadWorldContext() {
    try {
        const res = await fetch('/api/settings/world_context');
        if (res.ok) {
            const data = await res.json();
            const input = document.getElementById('world-context-input');
            if (input) {
                input.value = data.world_context || '';
            }
        }
    } catch (err) {
        console.error("Error loading world context:", err);
    }
}

async function loadUserProfile() {

    try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
            state.currentUser = await res.json();
            updateUserUI();
        }
    } catch (err) {
        console.error("Error loading user profile:", err);
    }
}

function updateUserUI() {
    if (!state.currentUser) return;
    
    // Update sidebar card
    const nameEl = userMiniProfile.querySelector('.mini-name');
    const handleEl = userMiniProfile.querySelector('.mini-handle');
    const avatarContainer = userMiniProfile.querySelector('.mini-avatar-container');
    
    nameEl.textContent = state.currentUser.name;
    handleEl.textContent = state.currentUser.handle;
    
    document.querySelectorAll('.user-handle-txt').forEach(el => {
        el.textContent = state.currentUser.handle;
    });
    
    if (state.currentUser.avatar_path) {
        avatarContainer.innerHTML = `<img src="${state.currentUser.avatar_path}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        avatarContainer.innerHTML = `<div class="mini-avatar-fallback">${state.currentUser.name[0]}</div>`;
    }
}

async function loadCommunities() {
    try {
        const res = await fetch('/api/communities');
        if (res.ok) {
            state.communities = await res.json();
            // Populate select box
            postCommunitySelect.innerHTML = '<option value="">Public Feed</option>';
            state.communities.forEach(c => {
                postCommunitySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    } catch (err) {
        console.error("Error loading communities:", err);
    }
}

async function loadCharacters() {
    try {
        const res = await fetch('/api/characters');
        if (res.ok) {
            state.characters = await res.json();
            // Fetch relationships for all characters to build local graph
            state.characterRelationships = {};
            for (let char of state.characters) {
                const relRes = await fetch(`/api/characters/${char.id}/relationships`);
                if (relRes.ok) {
                    state.characterRelationships[char.id] = await relRes.json();
                }
            }
            renderSidebarRelationshipList();
            populateConnectionDropdowns();
            updateGameUI();
        }
    } catch (err) {
        console.error("Error loading characters:", err);
    }
}

async function loadTimeline(communityId = null) {
    timelineFeed.innerHTML = '<div class="loading-placeholder">Loading posts...</div>';
    try {
        let url = '/api/timeline';
        if (communityId) {
            url += `?community_id=${communityId}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            state.posts = await res.json();
            renderTimeline();
        }
    } catch (err) {
        console.error("Error loading timeline:", err);
        timelineFeed.innerHTML = '<div class="loading-placeholder">Failed to load feed.</div>';
    }
}

async function loadGameState() {
    try {
        const res = await fetch('/api/game/state');
        if (res.ok) {
            state.gameState = await res.json();
            updateGameUI();
        }
    } catch (err) {
        console.error("Error loading game state:", err);
    }
}

function updateGameUI() {
    if (!state.gameState) return;

    // 1. Update Day label
    const dayLabel = document.getElementById("status-day-val");
    if (dayLabel) {
        dayLabel.textContent = `Day ${state.gameState.current_day}`;
    }

    // 2. Update Milestone Progress Bar tracking active Focus connection
    const milestoneText = document.getElementById("global-milestone-text");
    const milestoneFill = document.getElementById("global-milestone-fill");
    
    if (milestoneText && milestoneFill) {
        // Find the character that has a target relationship set
        const focusChar = state.characters.find(c => c.target_relationship);
        if (focusChar) {
            milestoneText.textContent = `Focus: ${focusChar.name} (${focusChar.target_relationship}) — ${focusChar.relationship_score}/100 Bond`;
            milestoneFill.style.width = `${focusChar.relationship_score}%`;
        } else {
            milestoneText.textContent = "Focus: None (Select Focus connection in character profile)";
            milestoneFill.style.width = "0%";
        }
    }

    // 3. Update XP and Level
    const lvlBadge = document.getElementById("global-level-badge");
    const xpText = document.getElementById("global-xp-text");
    if (lvlBadge && xpText) {
        lvlBadge.textContent = `LVL ${state.gameState.level}`;
        const currentLevelXp = state.gameState.xp % 100;
        xpText.textContent = `${currentLevelXp} / 100 XP`;
    }

    // 4. Update Active Side Quests
    const questsListEl = document.getElementById("timeline-side-quests-list");
    if (questsListEl) {
        if (state.gameState.quests.length === 0) {
            questsListEl.innerHTML = '<div class="loading-placeholder" style="padding:10px;">All quests completed for today!</div>';
        } else {
            questsListEl.innerHTML = '';
            state.gameState.quests.forEach(q => {
                const questDiv = document.createElement("div");
                const isComp = q.status === 'completed';
                questDiv.className = `side-quest-item ${isComp ? 'completed' : ''}`;
                questDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: ${isComp ? 'rgba(0, 255, 128, 0.03)' : 'rgba(255, 255, 255, 0.02)'};
                    border: 1px solid ${isComp ? 'rgba(0, 255, 128, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                    padding: 10px 14px;
                    border-radius: 8px;
                    transition: all 0.2s;
                    opacity: ${isComp ? '0.6' : '1'};
                    text-decoration: ${isComp ? 'line-through' : 'none'};
                `;
                questDiv.innerHTML = `
                    <span class="quest-desc" style="font-size: 13.5px; color: ${isComp ? 'var(--text-muted)' : 'var(--text-primary)'};">${q.description}</span>
                    <span class="quest-reward" style="font-family: monospace; font-size: 11px; font-weight: 700; color: ${isComp ? '#00ff80' : 'var(--accent-cyan)'}; background: ${isComp ? 'rgba(0, 255, 128, 0.1)' : 'rgba(0, 240, 255, 0.1)'}; padding: 2px 6px; border-radius: 4px;">+${q.reward_xp} XP</span>
                `;
                questsListEl.appendChild(questDiv);
            });
        }
    }

    // 5. Update End Day / Sleep progression controls
    const btnEndDay = document.getElementById("btn-end-day");
    const dayProgressionReqs = document.getElementById("day-progression-reqs");
    
    if (btnEndDay && dayProgressionReqs) {
        const hasBatched = state.gameState.has_batched_posts;
        const todayXp = state.gameState.today_xp;
        const requiredXp = 20;
        
        dayProgressionReqs.innerHTML = `
            Requires batching posts (${hasBatched ? '✔️ Done' : '❌ Required'}) <br/>
            and earning 20 XP today (${todayXp >= requiredXp ? '✔️' : '❌'} ${todayXp}/${requiredXp} XP)
        `;
        
        btnEndDay.disabled = !hasBatched || todayXp < requiredXp;
    }

    // 6. Update Skills and Points allocation
    const unspentPointsBadge = document.getElementById("profile-unspent-points-badge");
    const skillEmpathy = document.getElementById("skill-empathy-val");
    const skillFame = document.getElementById("skill-fame-val");
    const skillRelevance = document.getElementById("skill-relevance-val");
    
    if (unspentPointsBadge) {
        unspentPointsBadge.textContent = `${state.gameState.available_skill_points} Skill Points Available`;
        if (state.gameState.available_skill_points > 0) {
            unspentPointsBadge.style.background = 'var(--accent-pink)';
            unspentPointsBadge.style.color = '#000';
        } else {
            unspentPointsBadge.style.background = 'rgba(255,255,255,0.05)';
            unspentPointsBadge.style.color = 'var(--text-muted)';
        }
    }
    
    if (skillEmpathy) skillEmpathy.textContent = state.gameState.empathy_pts;
    if (skillFame) skillFame.textContent = state.gameState.fame_pts;
    if (skillRelevance) skillRelevance.textContent = state.gameState.relevance_pts;
    
    const allocBtns = document.querySelectorAll(".btn-allocate-skill");
    allocBtns.forEach(btn => {
        btn.style.display = state.gameState.available_skill_points > 0 ? "inline-flex" : "none";
    });

    // 7. Update DM Unread Notification badge on sidebar
    const dmBadge = document.getElementById("dm-notification-badge");
    if (dmBadge) {
        const hasAnyUnread = state.characters.some(char => char.following && char.has_unread);
        dmBadge.style.display = hasAnyUnread ? 'inline-block' : 'none';
    }
}

// RENDERING TIMELINE
function renderTimeline() {
    if (state.posts.length === 0) {
        timelineFeed.innerHTML = '<div class="loading-placeholder">No posts here yet. Start the conversation!</div>';
        return;
    }
    
    timelineFeed.innerHTML = '';
    let lastDay = null;
    state.posts.forEach(post => {
        const postDay = post.game_day || 1;
        if (postDay !== lastDay) {
            const separator = document.createElement('div');
            separator.className = 'day-marker';
            separator.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 20px 0 10px 0;
                width: 100%;
                user-select: none;
            `;
            separator.innerHTML = `
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
                <span style="padding: 0 15px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-cyan); background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 20px; padding: 4px 12px;">Day ${postDay}</span>
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            `;
            timelineFeed.appendChild(separator);
            lastDay = postDay;
        }

        const postCard = document.createElement('div');
        postCard.className = 'card post-card';
        postCard.dataset.id = post.id;
        
        postCard.addEventListener('click', () => {
            openThread(post.id);
        });

        // Set up avatar
        const hasAvatar = post.author.avatar_path;
        const avatarImg = hasAvatar 
            ? `<img src="${post.author.avatar_path}" alt="${post.author.avatar_alt_text || ''}" class="post-avatar">`
            : `<div class="post-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;">${post.author.name[0]}</div>`;

        // Render delete button if author is user
        const deleteBtn = post.author.is_user
            ? `<button class="btn-icon delete-post-btn" data-id="${post.id}" title="Delete Post" style="margin-left: auto; font-size: 14px; opacity: 0.6; transition: opacity 0.2s;">🗑️</button>`
            : '';

        postCard.innerHTML = `
            <div class="post-header">
                <div class="post-header-author-click-target" data-author-id="${post.author.id}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    ${avatarImg}
                    <div class="post-meta">
                        <div class="post-author-name">${post.author.name}</div>
                        <div class="post-author-handle">${post.author.handle}</div>
                    </div>
                </div>
                <div class="post-time">${formatTime(post.timestamp)}</div>
                ${deleteBtn}
            </div>
            <div class="post-body">${renderImageTags(post.content)}</div>
            <div class="post-footer">
                <div class="post-action replies-btn">
                    <span>💬</span> <strong>${post.replies_count}</strong> replies
                </div>
            </div>
        `;
        
        // Bind author click listener (to open profile)
        postCard.querySelectorAll('.post-header-author-click-target').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop thread from opening
                const authorId = parseInt(el.dataset.authorId);
                if (authorId !== state.currentUser.id) {
                    openCharacterProfile(authorId);
                }
            });
        });
        
        // Bind delete post listener
        postCard.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent thread navigation
                if (confirm("Are you sure you want to delete your post?")) {
                    const postId = btn.dataset.id;
                    try {
                        const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
                        if (res.ok) {
                            const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                            await loadTimeline(currentTabActiveComm);
                        }
                    } catch (err) {
                        console.error("Error deleting post:", err);
                    }
                }
            });
            btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
            btn.addEventListener('mouseleave', () => btn.style.opacity = '0.6');
        });
        
        timelineFeed.appendChild(postCard);
    });
}

// THREAD VIEW DETAILS & CASCADES
async function openThread(postId) {
    state.activeThreadPostId = postId;
    switchView('view-thread');
    await loadThreadDetails();
    
    // Start polling thread to see cascading replies as they generate
    startThreadPolling();
}

async function loadThreadDetails() {
    if (!state.activeThreadPostId) return;
    try {
        const res = await fetch(`/api/posts/${state.activeThreadPostId}`);
        if (res.ok) {
            const threadData = await res.json();
            renderThread(threadData);
            await loadGameState();
        }
    } catch (err) {
        console.error("Error loading thread details:", err);
    }
}

function renderThread(threadData) {
    threadPostsContainer.innerHTML = '';
    
    // Check if there are replies and if the last reply is from the user
    // If replies exist and the last reply was by user, show the typing indicator banner
    const parentPost = threadData[0];
    const replies = threadData.slice(1);
    
    const isUserLastPoster = threadData.length > 1 && threadData[threadData.length - 1].author.is_user;
    if (isUserLastPoster) {
        threadTypingBanner.classList.add('active');
    } else {
        threadTypingBanner.classList.remove('active');
    }

    // Render Parent Post
    const parentCard = document.createElement('div');
    parentCard.className = 'card post-card';
    const parentAvatar = parentPost.author.avatar_path
        ? `<img src="${parentPost.author.avatar_path}" alt="Avatar" class="post-avatar">`
        : `<div class="post-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;">${parentPost.author.name[0]}</div>`;

    const parentDeleteBtn = parentPost.author.is_user
        ? `<button class="btn-icon delete-thread-post-btn" data-id="${parentPost.id}" title="Delete Post" style="margin-left: auto; font-size: 14px; opacity: 0.6; transition: opacity 0.2s;">🗑️</button>`
        : '';

    parentCard.innerHTML = `
        <div class="post-header">
            <div class="post-header-author-click-target" data-author-id="${parentPost.author.id}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                ${parentAvatar}
                <div class="post-meta">
                    <div class="post-author-name">${parentPost.author.name}</div>
                    <div class="post-author-handle">${parentPost.author.handle}</div>
                </div>
            </div>
            <div class="post-time">${formatTime(parentPost.timestamp)}</div>
            ${parentDeleteBtn}
        </div>
        <div class="post-body">${renderImageTags(parentPost.content)}</div>
    `;
    threadPostsContainer.appendChild(parentCard);

    // Render Replies
    replies.forEach(reply => {
        const replyCard = document.createElement('div');
        replyCard.className = 'card post-card is-reply';
        
        const replyAvatar = reply.author.avatar_path
            ? `<img src="${reply.author.avatar_path}" alt="Avatar" class="post-avatar">`
            : `<div class="post-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;">${reply.author.name[0]}</div>`;

        const replyDeleteBtn = reply.author.is_user
            ? `<button class="btn-icon delete-thread-post-btn" data-id="${reply.id}" title="Delete Reply" style="margin-left: auto; font-size: 14px; opacity: 0.6; transition: opacity 0.2s;">🗑️</button>`
            : '';

        replyCard.innerHTML = `
            <div class="post-header">
                <div class="post-header-author-click-target" data-author-id="${reply.author.id}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    ${replyAvatar}
                    <div class="post-meta">
                        <div class="post-author-name">${reply.author.name}</div>
                        <div class="post-author-handle">${reply.author.handle}</div>
                    </div>
                </div>
                <div class="post-time">${formatTime(reply.timestamp)}</div>
                ${replyDeleteBtn}
            </div>
            <div class="post-body">${renderImageTags(reply.content)}</div>
        `;
        threadPostsContainer.appendChild(replyCard);
    });

    // Bind author click listener in thread
    threadPostsContainer.querySelectorAll('.post-header-author-click-target').forEach(el => {
        el.addEventListener('click', () => {
            const authorId = parseInt(el.dataset.authorId);
            if (authorId !== state.currentUser.id) {
                openCharacterProfile(authorId);
            }
        });
    });

    // Bind thread post deletion listeners
    threadPostsContainer.querySelectorAll('.delete-thread-post-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm("Are you sure you want to delete this?")) {
                const postId = btn.dataset.id;
                try {
                    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (parseInt(postId) === state.activeThreadPostId) {
                            // If root post is deleted, go back to timeline
                            document.getElementById('btn-back-timeline').click();
                        } else {
                            await loadThreadDetails();
                        }
                    }
                } catch (err) {
                    console.error("Error deleting thread post:", err);
                }
            }
        });
        btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
        btn.addEventListener('mouseleave', () => btn.style.opacity = '0.6');
    });
}

function startThreadPolling() {
    stopThreadPolling();
    state.isThreadPolling = true;
    state.threadPollInterval = setInterval(async () => {
        if (state.activeThreadPostId && state.isThreadPolling) {
            await loadThreadDetails();
        }
    }, 2500); // Poll every 2.5 seconds
}

function stopThreadPolling() {
    state.isThreadPolling = false;
    if (state.threadPollInterval) {
        clearInterval(state.threadPollInterval);
        state.threadPollInterval = null;
    }
}

// DIRECT MESSAGES (DMs) & EMOTIONAL STATE
function renderDMContacts() {
    dmContactsList.innerHTML = '';
    // Show only characters that are followed (mutuals)
    const mutuals = state.characters.filter(char => char.following);
    mutuals.forEach(char => {
        const card = document.createElement('div');
        card.className = `contact-card ${state.activeChatCharId === char.id ? 'active' : ''}`;
        card.dataset.id = char.id;
        
        card.addEventListener('click', () => {
            selectDMContact(char.id);
        });

        const avatar = char.avatar_path 
            ? `<img src="${char.avatar_path}" alt="avatar" class="contact-avatar">`
            : `<div class="contact-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;">${char.name[0]}</div>`;

        const targetRelTag = char.target_relationship
            ? `<span style="font-size:10px; background:rgba(255, 0, 128, 0.15); padding:1px 5px; border-radius:4px; margin-left:4px; font-weight:600; color:var(--accent-pink);">${char.target_relationship}</span>`
            : '';

        const unreadDot = char.has_unread 
            ? `<span style="display:inline-block; width:8px; height:8px; background-color:var(--accent-pink); border-radius:50%; margin-left:6px;" title="New message"></span>`
            : '';

        card.innerHTML = `
            ${avatar}
            <div class="contact-info">
                <div class="contact-name-row">
                    <div class="contact-name">${char.name} ${targetRelTag} ${unreadDot}</div>
                    <div class="contact-rel-pill">${char.relationship_score} Rel</div>
                </div>
                <div class="contact-status-preview">${char.bio}</div>
            </div>
        `;
        dmContactsList.appendChild(card);
    });
}

async function selectDMContact(charId) {
    state.activeChatCharId = charId;
    
    // Set UI Active class
    document.querySelectorAll('.contact-card').forEach(card => {
        card.classList.remove('active');
        if (parseInt(card.dataset.id) === charId) {
            card.classList.add('active');
        }
    });

    chatNoSelection.style.display = 'none';
    chatActivePane.style.display = 'flex';
    
    await loadChatHistory();
}

async function loadChatHistory() {
    if (!state.activeChatCharId) return;
    try {
        const res = await fetch(`/api/dms/${state.activeChatCharId}`);
        if (res.ok) {
            const data = await res.json();
            renderActiveChat(data);
            
            // Clear unread status locally for active character
            const targetChar = state.characters.find(c => c.id === state.activeChatCharId);
            if (targetChar) {
                targetChar.has_unread = false;
            }
            renderDMContacts();
            updateGameUI();
        }
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

function renderActiveChat(data) {
    const char = data.character;
    const session = data.session;
    const messages = data.messages;
    
    // Header
    chatHeaderAvatar.src = char.avatar_path || '/static/default_npc.png';
    chatHeaderName.textContent = char.name;
    chatHeaderHandle.textContent = char.handle;
    chatRelationshipScore.textContent = char.relationship_score;
    chatRelationshipFill.style.width = `${char.relationship_score}%`;
    
    // Status Bar Monitor
    dmVibeText.textContent = session.vibe;
    dmVibeIntensityFill.style.width = `${session.intensity}%`;
    dmVibeIntensityPct.textContent = `${session.intensity}%`;
    dmRepliesLeft.textContent = session.replies_left;
    
    // Render Message bubbles
    chatMessagesContainer.innerHTML = '';
    state.activeChatLastDay = null; // Reset last day tracker
    messages.forEach(msg => {
        appendMessageBubble(
            msg.sender_id === state.currentUser.id ? 'sent' : 'received',
            msg.content,
            msg.vibe,
            msg.intensity,
            msg.game_day,
            msg.id
        );
    });
    
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function appendMessageBubble(type, content, vibe = null, intensity = null, gameDay = null, msgId = null) {
    if (gameDay === null) {
        // Fall back to current game day if not specified (e.g. for user sent / AI generated live replies)
        gameDay = (state.gameState && state.gameState.current_day) ? state.gameState.current_day : 1;
    }

    if (state.activeChatLastDay !== gameDay) {
        const separator = document.createElement('div');
        separator.className = 'day-marker dm-day-marker';
        separator.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 15px 0 10px 0;
            width: 100%;
            user-select: none;
        `;
        separator.innerHTML = `
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
            <span style="padding: 0 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-pink); background: rgba(255, 0, 128, 0.05); border: 1px solid rgba(255, 0, 128, 0.15); border-radius: 20px; padding: 2px 10px;">Day ${gameDay}</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
        `;
        chatMessagesContainer.appendChild(separator);
        state.activeChatLastDay = gameDay;
    }

    const msgWrap = document.createElement('div');
    msgWrap.className = `msg-wrapper ${type}`;
    
    let vibeMeta = '';
    if (type === 'received' && vibe) {
        vibeMeta = `<div class="msg-vibe-tag">🎭 ${vibe} (${intensity}%)</div>`;
    }
    
    let rollbackBtn = '';
    if (type === 'sent' && msgId) {
        rollbackBtn = `
            <button class="dm-rollback-btn" data-id="${msgId}" title="Rewind chat history to this message" style="
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 10px;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 4px;
                align-self: flex-end;
                transition: color 0.2s, background-color 0.2s;
            " onmouseover="this.style.color='var(--accent-pink)'; this.style.backgroundColor='rgba(255,0,128,0.05)'" onmouseout="this.style.color='var(--text-muted)'; this.style.backgroundColor='transparent'">
                ↩ Rewind Here
            </button>
        `;
    }
    
    msgWrap.innerHTML = `
        <div class="msg-bubble">
            <div class="msg-content">${renderImageTags(content)}</div>
            ${vibeMeta}
        </div>
        ${rollbackBtn}
    `;
    
    chatMessagesContainer.appendChild(msgWrap);
    
    // Wire up rollback click listener if button exists
    const btn = msgWrap.querySelector('.dm-rollback-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to rewind the chat history to this message? All subsequent messages from both you and this character will be permanently erased.")) {
                try {
                    const res = await fetch(`/api/dms/rollback/${state.activeChatCharId}/${msgId}`, { method: 'POST' });
                    if (res.ok) {
                        await loadChatHistory();
                        await loadCharacters();
                        renderDMContacts();
                    } else {
                        const err = await res.json();
                        alert(err.detail || "Failed to rewind chat");
                    }
                } catch (err) {
                    console.error("Error calling rollback:", err);
                    alert("Connection error.");
                }
            }
        });
    }
    
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// MULTI-BUBBLE DELAYED RENDERING FOR DM REPLIES
async function handleIncomingAIReply(replyData) {
    // Show typing bubble indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-bubble';
    typingIndicator.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    chatMessagesContainer.appendChild(typingIndicator);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    // Split AI reply content into individual sentences/bubbles
    const sentences = replyData.reply.content
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

    // Wait a minimum thinking delay
    await sleep(1500);
    
    // Remove indicator
    typingIndicator.remove();

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        // Show indicator again for next bubbles
        if (i > 0) {
            chatMessagesContainer.appendChild(typingIndicator);
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            // Simulated typing speed based on sentence length
            await sleep(1000 + (sentence.length * 15));
            typingIndicator.remove();
        }

        // On the very last bubble, attach the overall response vibe subtext
        const bubbleVibe = (i === sentences.length - 1) ? replyData.reply.vibe : null;
        const bubbleIntensity = (i === sentences.length - 1) ? replyData.reply.intensity : null;
        
        appendMessageBubble('received', sentence, bubbleVibe, bubbleIntensity);
    }

    // Update relationship header and bottom status bar details
    chatRelationshipScore.textContent = replyData.relationship_score;
    chatRelationshipFill.style.width = `${replyData.relationship_score}%`;
    
    dmVibeText.textContent = replyData.session.vibe;
    dmVibeIntensityFill.style.width = `${replyData.session.intensity}%`;
    dmVibeIntensityPct.textContent = `${replyData.session.intensity}%`;
    dmRepliesLeft.textContent = replyData.session.replies_left;
    
    // Update relationship score in contact list view
    await loadCharacters();
    renderDMContacts();
    await loadGameState();
    await loadChatHistory();

    // Milestone notifications
    if (replyData.milestone_triggered) {
        showMilestoneOverlay(replyData.milestone_message);
    }
}

function showMilestoneOverlay(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'milestone-alert';
    alertDiv.innerHTML = `
        <div class="milestone-alert-content">
            <div class="milestone-icon">💖</div>
            <h4>Milestone Unlocked!</h4>
            <p>${message}</p>
            <button class="btn btn-primary btn-sm btn-close-alert">Sweet</button>
        </div>
    `;
    document.body.appendChild(alertDiv);
    
    alertDiv.querySelector('.btn-close-alert').addEventListener('click', () => {
        alertDiv.remove();
    });
    
    setTimeout(() => {
        alertDiv.classList.add('active');
    }, 100);
}

// CHARACTER STUDIO VIEWS
function renderStudioCharacters() {
    studioGrid.innerHTML = '';
    state.characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'card registry-card';
        
        const avatar = char.avatar_path
            ? `<img src="${char.avatar_path}" alt="avatar" class="registry-avatar">`
            : `<div class="registry-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;width:48px;height:48px;">${char.name[0]}</div>`;

        const rels = state.characterRelationships[char.id] || [];
        let relsListHtml = '';
        if (rels.length > 0) {
            const relTags = rels.map(r => `<span style="font-size:11px; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary);">${r.relationship_type}: ${r.target_handle}</span>`).join(' ');
            relsListHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">${relTags}</div>`;
        }

        const followBadge = char.following 
            ? `<span style="font-size:10px; background:rgba(0, 240, 255, 0.12); padding:1px 5px; border-radius:4px; margin-left:4px; font-weight:600; color:var(--accent-cyan);">Mutual</span>` 
            : `<span style="font-size:10px; background:rgba(255,255,255,0.05); padding:1px 5px; border-radius:4px; margin-left:4px; font-weight:600; color:var(--text-muted);">NPC</span>`;

        const targetRelTag = char.target_relationship
            ? `<span style="font-size:10px; background:rgba(255, 0, 128, 0.15); padding:1px 5px; border-radius:4px; margin-left:4px; font-weight:600; color:var(--accent-pink);">${char.target_relationship}</span>`
            : '';

        card.innerHTML = `
            <div class="studio-avatar-click-target" data-id="${char.id}" style="cursor: pointer;">${avatar}</div>
            <div class="registry-info">
                <div class="registry-name-row studio-name-click-target" data-id="${char.id}" style="cursor: pointer;">
                    <span class="registry-name">${char.name} ${followBadge} ${targetRelTag}</span>
                    <span class="registry-handle">${char.handle}</span>
                </div>
                <div class="registry-bio">${char.bio}</div>
                ${relsListHtml}
                <div class="studio-card-actions">
                    <button class="btn btn-secondary btn-sm edit-char-btn" data-id="${char.id}">Edit</button>
                    <button class="btn btn-secondary btn-sm delete-char-btn" data-id="${char.id}" style="border-color: rgba(255, 0, 100, 0.3); color: var(--accent-pink);">Delete</button>
                </div>
            </div>
        `;
        studioGrid.appendChild(card);
    });

    // Bind character delete listeners
    studioGrid.querySelectorAll('.delete-char-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const charId = btn.dataset.id;
            if (confirm("Are you sure you want to delete this character? This will wipe their chats and sessions too.")) {
                try {
                    const res = await fetch(`/api/characters/${charId}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (state.activeChatCharId === parseInt(charId)) {
                            state.activeChatCharId = null;
                            chatNoSelection.style.display = 'flex';
                            chatActivePane.style.display = 'none';
                        }
                        await loadCharacters();
                        renderStudioCharacters();
                        if (state.currentView === 'view-dms') {
                            renderDMContacts();
                        }
                    } else {
                        const err = await res.json();
                        alert(err.detail || "Could not delete character");
                    }
                } catch (err) {
                    console.error("Error deleting character:", err);
                }
            }
        });
    });

    // Bind character edit listeners
    studioGrid.querySelectorAll('.edit-char-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const charId = parseInt(btn.dataset.id);
            const char = state.characters.find(c => c.id === charId);
            if (!char) return;
            
            // Set editing state
            state.editingCharacterId = charId;
            state.editingCharacterRelationships = [];
            
            // Populate form fields
            document.getElementById('char-name').value = char.name;
            document.getElementById('char-handle').value = char.handle;
            document.getElementById('char-bio').value = char.bio;
            document.getElementById('char-avatar-alt').value = char.avatar_alt_text || '';
            document.getElementById('char-history').value = char.tweet_history || '';
            
            // Load relationships from our local state
            const rels = state.characterRelationships[charId] || [];
            rels.forEach(r => {
                state.editingCharacterRelationships.push({
                    target_character_id: r.target_character_id,
                    target_handle: r.target_handle,
                    relationship_type: r.relationship_type
                });
            });
            
            // Update Form titles & submit labels
            document.getElementById('studio-form-title').textContent = `Edit Persona: ${char.name}`;
            document.getElementById('btn-submit-character').textContent = 'Update Character';
            document.getElementById('btn-cancel-character-edit').style.display = 'block';
            
            // Refresh connection dropdown and connections list
            populateConnectionDropdowns();
            renderEditingRelationships();
            
            // Scroll to the top of studio form card
            document.querySelector('.studio-form-card').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Bind avatar / name clicks for profile page
    studioGrid.querySelectorAll('.studio-avatar-click-target, .studio-name-click-target').forEach(el => {
        el.addEventListener('click', () => {
            openCharacterProfile(parseInt(el.dataset.id));
        });
    });
}

function populateConnectionDropdowns() {
    const select = document.getElementById('rel-target-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Character --</option>';
    state.characters.forEach(char => {
        if (state.editingCharacterId && char.id === state.editingCharacterId) return;
        select.innerHTML += `<option value="${char.id}">${char.name} (${char.handle})</option>`;
    });
}

function renderEditingRelationships() {
    const list = document.getElementById('studio-relationships-list');
    if (!list) return;
    list.innerHTML = '';
    state.editingCharacterRelationships.forEach((rel, index) => {
        const tag = document.createElement('span');
        tag.className = 'relationship-tag';
        tag.innerHTML = `
            ${rel.relationship_type}: ${rel.target_handle}
            <span class="remove-btn" data-index="${index}">✕</span>
        `;
        tag.querySelector('.remove-btn').addEventListener('click', () => {
            state.editingCharacterRelationships.splice(index, 1);
            renderEditingRelationships();
        });
        list.appendChild(tag);
    });
}

function resetStudioForm() {
    state.editingCharacterId = null;
    state.editingCharacterRelationships = [];
    
    document.getElementById('studio-form-title').textContent = 'Create Persona';
    document.getElementById('btn-submit-character').textContent = 'Instantiate Character';
    document.getElementById('btn-cancel-character-edit').style.display = 'none';
    
    createCharForm.reset();
    document.getElementById('studio-relationships-list').innerHTML = '';
    
    populateConnectionDropdowns();
}

async function openCharacterProfile(charId) {
    if (state.currentView !== 'view-character-profile') {
        state.previousView = state.currentView;
    }
    
    switchView('view-character-profile');
    
    const avatarEl = document.getElementById('char-profile-avatar');
    const nameEl = document.getElementById('char-profile-name');
    const handleEl = document.getElementById('char-profile-handle');
    const badgeEl = document.getElementById('char-profile-status-badge');
    const bioEl = document.getElementById('char-profile-bio');
    const relSection = document.getElementById('char-profile-target-rel-section');
    const relSelect = document.getElementById('char-profile-target-rel-select');
    const saveRelBtn = document.getElementById('btn-save-profile-target-rel');
    const followBtn = document.getElementById('btn-profile-follow-toggle');
    const feedEl = document.getElementById('char-profile-posts-feed');
    
    feedEl.innerHTML = '<div class="loading-placeholder">Loading posts...</div>';
    
    let char = null;
    try {
        const charRes = await fetch(`/api/characters/${charId}`);
        if (charRes.ok) {
            char = await charRes.json();
        }
    } catch (err) {
        console.error("Error fetching character metadata:", err);
    }
    
    if (!char) {
        char = state.characters.find(c => c.id === charId);
    }
    
    if (!char) {
        alert("Character not found");
        return;
    }
    
    nameEl.textContent = char.name;
    handleEl.textContent = char.handle;
    bioEl.textContent = char.bio;
    
    if (char.avatar_path) {
        avatarEl.innerHTML = `<img src="${char.avatar_path}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        avatarEl.innerHTML = char.name[0];
    }
    
    let badgeHtml = '';
    if (char.following) {
        badgeHtml += `<span class="profile-badge mutual">✨ Mutual</span>`;
    } else {
        badgeHtml += `<span class="profile-badge generated">Generated NPC</span>`;
    }
    
    if (char.target_relationship) {
        badgeHtml += `<span class="profile-badge target-rel">Focus: ${char.target_relationship}</span>`;
    }
    badgeEl.innerHTML = badgeHtml;
    
    followBtn.textContent = char.following ? 'Unfollow' : 'Follow & Match';
    if (char.following) {
        followBtn.className = 'btn btn-secondary';
        relSection.style.display = 'flex';
        let baseRelValue = '';
        if (char.target_relationship) {
            const tr = char.target_relationship.toLowerCase();
            const romance = ['online crush', 'flirting', 'sparks', 'seeing someone new', 'going steady', 'partner', 'sweetie', 'baby', 'lover', 'soulmate', 'crushed', 'jealous', "it's complicated", 'situationship', 'fighting', 'not working out', 'torn up', 'heartbreak', 'one that got away'];
            const hate = ['hate follow', 'subtweeting', 'trolling', 'flame war', 'mutual hate', 'bitter rivals', 'nemesis', 'grudge', 'frenemies', 'toxic obsession'];
            const collab = ['collab goal', 'networking', 'casual jam', 'making plans', 'studio session', 'co-writers', 'joint track', 'bandmates', 'creative partners', 'musical soulmates'];
            
            if (romance.includes(tr)) baseRelValue = 'online crush';
            else if (hate.includes(tr)) baseRelValue = 'hate follow';
            else if (collab.includes(tr)) baseRelValue = 'collab goal';
            else baseRelValue = char.target_relationship;
        }
        relSelect.value = baseRelValue;
    } else {
        followBtn.className = 'btn btn-primary';
        relSection.style.display = 'none';
    }
    
    // Bind Follow Toggle
    const newFollowBtn = followBtn.cloneNode(true);
    followBtn.parentNode.replaceChild(newFollowBtn, followBtn);
    newFollowBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`/api/characters/${char.id}/follow_toggle`, { method: 'POST' });
            if (res.ok) {
                const resData = await res.json();
                char.following = resData.following;
                await loadCharacters();
                openCharacterProfile(char.id); // Refresh view
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
        }
    });
    
    // Bind Save Relationship Focus
    const newSaveRelBtn = saveRelBtn.cloneNode(true);
    saveRelBtn.parentNode.replaceChild(newSaveRelBtn, saveRelBtn);
    newSaveRelBtn.addEventListener('click', async () => {
        const val = relSelect.value || null;
        try {
            const res = await fetch(`/api/characters/${char.id}/target_relationship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_relationship: val })
            });
            if (res.ok) {
                const resData = await res.json();
                char.target_relationship = resData.target_relationship;
                await loadCharacters();
                alert("Target relationship focus saved!");
                openCharacterProfile(char.id); // Refresh view
            }
        } catch (err) {
            console.error("Error saving target relationship:", err);
        }
    });

    // Tweet History Editor (for NPCs only)
    const tweetSection = document.getElementById('char-profile-tweet-history-section');
    const tweetEditorBody = document.getElementById('tweet-editor-body');
    const tweetToggleBtn = document.getElementById('btn-toggle-tweet-editor');
    const tweetToggleIcon = document.getElementById('tweet-editor-toggle-icon');
    const tweetHistoryInput = document.getElementById('char-profile-tweet-history-input');
    const saveTweetBtn = document.getElementById('btn-save-tweet-history');

    if (!char.is_user && tweetSection) {
        tweetSection.style.display = 'flex';
        // Populate textarea with existing tweet history
        tweetHistoryInput.value = char.tweet_history || '';

        // Collapse toggle
        const newTweetToggleBtn = tweetToggleBtn.cloneNode(true);
        tweetToggleBtn.parentNode.replaceChild(newTweetToggleBtn, tweetToggleBtn);
        newTweetToggleBtn.addEventListener('click', () => {
            const isOpen = tweetEditorBody.style.display === 'flex';
            tweetEditorBody.style.display = isOpen ? 'none' : 'flex';
            document.getElementById('tweet-editor-toggle-icon').style.transform = isOpen ? '' : 'rotate(90deg)';
        });

        // Save tweet history using existing edit endpoint
        const newSaveTweetBtn = saveTweetBtn.cloneNode(true);
        saveTweetBtn.parentNode.replaceChild(newSaveTweetBtn, saveTweetBtn);
        newSaveTweetBtn.addEventListener('click', async () => {
            const newHistory = tweetHistoryInput.value.trim();
            const formData = new FormData();
            formData.append('name', char.name);
            formData.append('handle', char.handle);
            formData.append('bio', char.bio || '');
            formData.append('avatar_alt_text', char.avatar_alt_text || '');
            formData.append('tweet_history', newHistory);
            try {
                newSaveTweetBtn.disabled = true;
                newSaveTweetBtn.textContent = 'Saving…';
                const res = await fetch(`/api/characters/${char.id}/edit`, {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    await loadCharacters();
                    // Re-enable button before navigating away (openCharacterProfile
                    // replaces the DOM node via cloneNode, so the old clone must be
                    // reset first or it stays stuck as "Saving…")
                    newSaveTweetBtn.textContent = 'Save Archive';
                    newSaveTweetBtn.disabled = false;
                    // Re-open the profile to re-render the posts feed with updated history
                    await openCharacterProfile(char.id);
                } else {
                    const err = await res.json();
                    alert(`Failed to save: ${err.detail || 'Unknown error'}`);
                    newSaveTweetBtn.textContent = 'Save Archive';
                    newSaveTweetBtn.disabled = false;
                }
            } catch (err) {
                console.error("Error saving tweet history:", err);
                newSaveTweetBtn.textContent = 'Save Archive';
                newSaveTweetBtn.disabled = false;
            }
        });
    } else if (tweetSection) {
        tweetSection.style.display = 'none';
    }

    // Load and render posts
    try {
        const postsRes = await fetch(`/api/characters/${char.id}/posts`);
        if (postsRes.ok) {
            const posts = await postsRes.json();
            if (posts.length === 0) {
                feedEl.innerHTML = '<div class="loading-placeholder">No posts by this user yet.</div>';
                return;
            }
            
            feedEl.innerHTML = '';
            let lastDay = null;
            posts.forEach(p => {
                const postDay = p.is_history ? 'Archive' : (p.game_day || 1);
                if (postDay !== lastDay) {
                    const separator = document.createElement('div');
                    separator.className = 'day-marker';
                    separator.style.cssText = `
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 20px 0 10px 0;
                        width: 100%;
                        user-select: none;
                    `;
                    const label = postDay === 'Archive' ? 'Creation Archive' : `Day ${postDay}`;
                    const color = postDay === 'Archive' ? 'var(--accent-pink)' : 'var(--accent-cyan)';
                    const bg = postDay === 'Archive' ? 'rgba(255, 0, 128, 0.08)' : 'rgba(0, 240, 255, 0.08)';
                    const border = postDay === 'Archive' ? 'rgba(255, 0, 128, 0.2)' : 'rgba(0, 240, 255, 0.2)';
                    
                    separator.innerHTML = `
                        <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
                        <span style="padding: 0 15px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${color}; background: ${bg}; border: 1px solid ${border}; border-radius: 20px; padding: 4px 12px;">${label}</span>
                        <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
                    `;
                    feedEl.appendChild(separator);
                    lastDay = postDay;
                }

                const card = document.createElement('div');
                card.className = 'card post-card';

                const badge = p.is_history
                    ? `<span style="font-size: 11px; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.2); padding: 1px 6px; border-radius: 4px; color: var(--accent-cyan); margin-left: 6px;">Creation Archive</span>`
                    : '';

                // Delete button only on real (non-archive) posts
                const deleteBtn = !p.is_history
                    ? `<button class="profile-post-delete-btn" title="Delete post" style="margin-left:auto; background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; padding:2px 6px; border-radius:4px; line-height:1;" onmouseover="this.style.color='var(--accent-pink)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>`
                    : '';

                card.innerHTML = `
                    <div class="post-header" style="align-items:flex-start;">
                        ${char.avatar_path ? `<img src="${char.avatar_path}" alt="avatar" class="post-avatar">` : `<div class="post-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--accent-cyan), var(--accent-pink));font-weight:700;color:#000;">${char.name[0]}</div>`}
                        <div class="post-meta">
                            <div class="post-author-name">${char.name} ${badge}</div>
                            <div class="post-author-handle">${char.handle}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div class="post-time">${formatTime(p.timestamp)}</div>
                            ${deleteBtn}
                        </div>
                    </div>
                    <div class="post-body" style="margin-top: 12px;">${renderImageTags(p.content)}</div>
                `;

                if (!p.is_history) {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', () => {
                        openThread(p.id);
                    });

                    // Wire up delete button — stop propagation so it doesn't open thread
                    const btn = card.querySelector('.profile-post-delete-btn');
                    if (btn) {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (!confirm('Delete this post and its replies?')) return;
                            try {
                                const res = await fetch(`/api/posts/${p.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                    card.remove();
                                    // If feed is now empty, show placeholder
                                    if (feedEl.children.length === 0) {
                                        feedEl.innerHTML = '<div class="loading-placeholder">No posts by this user yet.</div>';
                                    }
                                } else {
                                    const errData = await res.json();
                                    alert(errData.detail || 'Failed to delete post');
                                }
                            } catch (err) {
                                console.error('Error deleting post:', err);
                                alert('Connection error.');
                            }
                        });
                    }
                }

                feedEl.appendChild(card);
            });
        } else {
            feedEl.innerHTML = '<div class="loading-placeholder">Failed to load posts.</div>';
        }
    } catch (err) {
        console.error("Error loading character posts:", err);
        feedEl.innerHTML = '<div class="loading-placeholder">Connection error.</div>';
    }
}

// PROFILE UI RENDER
function renderProfileSettings() {
    if (!state.currentUser) return;
    
    document.getElementById('profile-name').value = state.currentUser.name;
    document.getElementById('profile-handle').value = state.currentUser.handle;
    document.getElementById('profile-bio').value = state.currentUser.bio;
    document.getElementById('profile-avatar-alt').value = state.currentUser.avatar_alt_text || '';
    
    if (state.currentUser.avatar_path) {
        userProfileAvatarPreview.innerHTML = `<img src="${state.currentUser.avatar_path}" alt="Preview">`;
    } else {
        userProfileAvatarPreview.innerHTML = state.currentUser.name[0];
    }
}

// SIDEBAR UTILITIES RENDER
function renderSidebarRelationshipList() {
    sidebarRelationshipList.innerHTML = '';
    // Sort characters by relationship score descending
    const sorted = [...state.characters].sort((a, b) => b.relationship_score - a.relationship_score);
    
    sorted.forEach(char => {
        // Find their session vibe
        const vibe = char.session ? char.session.vibe : 'Neutral';
        
        const row = document.createElement('div');
        row.className = 'scoreboard-row';
        row.innerHTML = `
            <img src="${char.avatar_path || '/static/default_npc.png'}" alt="Avatar" class="scoreboard-avatar">
            <div class="scoreboard-info">
                <div class="scoreboard-name">${char.name}</div>
                <div class="scoreboard-vibe">🎭 ${vibe}</div>
            </div>
            <div class="scoreboard-score">${char.relationship_score}</div>
        `;
        sidebarRelationshipList.appendChild(row);
    });
}

// EVENT LISTENERS BINDING
function setupEventListeners() {
    // Timeline Tabs Filtering
    document.getElementById('tab-all-posts').addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        loadTimeline(null);
    });
    
    document.getElementById('tab-community-posts').addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        // Seeded the scene community ID is 1
        loadTimeline(1);
    });

    // ── IMAGE ATTACH: Post Composer ──────────────────────────────────────────
    const btnPostAttachImg = document.getElementById('btn-post-attach-image');
    const postImagePopover = document.getElementById('post-image-popover');
    const postImageDesc    = document.getElementById('post-image-desc');
    const btnPostImgConfirm = document.getElementById('btn-post-image-confirm');
    const btnPostImgCancel  = document.getElementById('btn-post-image-cancel');

    if (btnPostAttachImg) {
        btnPostAttachImg.addEventListener('click', () => {
            const isOpen = postImagePopover.style.display === 'flex';
            postImagePopover.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) { postImageDesc.value = ''; postImageDesc.focus(); }
        });
        btnPostImgConfirm.addEventListener('click', () => {
            const desc = postImageDesc.value.trim();
            if (!desc) return;
            const tag = `[image: ${desc}]`;
            postContent.value = postContent.value
                ? postContent.value.trimEnd() + '\n' + tag
                : tag;
            postImagePopover.style.display = 'none';
            postImageDesc.value = '';
            postContent.focus();
        });
        btnPostImgCancel.addEventListener('click', () => {
            postImagePopover.style.display = 'none';
        });
        postImageDesc.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); btnPostImgConfirm.click(); }
            if (e.key === 'Escape') btnPostImgCancel.click();
        });
    }

    // ── IMAGE ATTACH: DM Composer ────────────────────────────────────────────
    const btnDmAttachImg   = document.getElementById('btn-dm-attach-image');
    const dmImagePopover   = document.getElementById('dm-image-popover');
    const dmImageDesc      = document.getElementById('dm-image-desc');
    const btnDmImgConfirm  = document.getElementById('btn-dm-image-confirm');
    const btnDmImgCancel   = document.getElementById('btn-dm-image-cancel');

    if (btnDmAttachImg) {
        btnDmAttachImg.addEventListener('click', () => {
            const isOpen = dmImagePopover.style.display === 'flex';
            dmImagePopover.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) { dmImageDesc.value = ''; dmImageDesc.focus(); }
        });
        btnDmImgConfirm.addEventListener('click', () => {
            const desc = dmImageDesc.value.trim();
            if (!desc) return;
            // Submit the image tag directly as a DM
            dmInputContent.value = `[image: ${desc}]`;
            dmImagePopover.style.display = 'none';
            dmImageDesc.value = '';
            dmSendForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        btnDmImgCancel.addEventListener('click', () => {
            dmImagePopover.style.display = 'none';
        });
        dmImageDesc.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); btnDmImgConfirm.click(); }
            if (e.key === 'Escape') btnDmImgCancel.click();
        });
    }

    // Create Root Post Form
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContent.value.trim();
        const commId = postCommunitySelect.value ? parseInt(postCommunitySelect.value) : null;
        
        if (!content) return;
        
        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, community_id: commId })
            });
            
            if (res.ok) {
                const data = await res.json();
                postContent.value = '';
                await loadGameState();
                setTimeout(loadGameState, 2000);
                // Open the thread of the newly created post immediately so the player can watch the cascade replies happen!
                if (data.post_id) {
                    openThread(data.post_id);
                } else {
                    const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                    await loadTimeline(currentTabActiveComm);
                }
            }
        } catch (err) {
            console.error("Error creating post:", err);
        }
    });

    // Reply to Thread Form
    threadReplyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = threadReplyContent.value.trim();
        if (!content || !state.activeThreadPostId) return;

        try {
            const res = await fetch(`/api/posts/${state.activeThreadPostId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (res.ok) {
                threadReplyContent.value = '';
                // Render the thread replies instantly with user's new message
                await loadThreadDetails();
                await loadGameState();
                setTimeout(loadGameState, 2000);
                
                // Active typing banner is triggered since user just replied
                threadTypingBanner.classList.add('active');
            }
        } catch (err) {
            console.error("Error sending thread reply:", err);
        }
    });

    // Send DM Form
    dmSendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = dmInputContent.value.trim();
        if (!content || !state.activeChatCharId) return;

        // Render user message bubble immediately
        appendMessageBubble('sent', content);
        dmInputContent.value = '';

        try {
            const res = await fetch(`/api/dms/${state.activeChatCharId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (res.ok) {
                const replyData = await res.json();
                // Hand off to the typing bubble animator
                await handleIncomingAIReply(replyData);
            }
        } catch (err) {
            console.error("Error sending DM:", err);
        }
    });

    // Character Studio creation form
    createCharForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('char-name').value.trim();
        let handle = document.getElementById('char-handle').value.trim();
        const bio = document.getElementById('char-bio').value.trim();
        const avatarAlt = document.getElementById('char-avatar-alt').value.trim();
        const history = document.getElementById('char-history').value.trim();
        const fileInput = document.getElementById('char-avatar-file');
        
        if (!name || !handle || !bio || !history) {
            alert("Please fill in all required fields.");
            return;
        }
        if (!handle.startsWith("@")) {
            handle = "@" + handle;
        }
        
        const submitBtn = document.getElementById('btn-submit-character');
        submitBtn.disabled = true;
        submitBtn.textContent = state.editingCharacterId ? 'Updating...' : 'Instantiating...';
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('handle', handle);
        formData.append('bio', bio);
        formData.append('avatar_alt_text', avatarAlt);
        formData.append('tweet_history', history);
        formData.append('relationships', JSON.stringify(state.editingCharacterRelationships));
        
        if (fileInput.files.length > 0) {
            formData.append('avatar_file', fileInput.files[0]);
        }

        let url = '/api/characters';
        if (state.editingCharacterId) {
            url = `/api/characters/${state.editingCharacterId}/edit`;
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                alert(state.editingCharacterId ? "Character updated successfully!" : "Character instantiated successfully!");
                resetStudioForm();
                await loadCharacters();
                renderStudioCharacters();
                if (state.currentView === 'view-dms') {
                    renderDMContacts();
                }
            } else {
                const errData = await res.json();
                alert(errData.detail || "Failed to save character");
            }
        } catch (err) {
            console.error("Error saving character:", err);
            alert("Connection error.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = state.editingCharacterId ? 'Update Character' : 'Instantiate Character';
        }
    });

    // Cancel Edit Button click listener
    const cancelEditBtn = document.getElementById('btn-cancel-character-edit');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            resetStudioForm();
        });
    }

    // Add connection button click listener
    const btnAddRel = document.getElementById('btn-add-relationship');
    if (btnAddRel) {
        btnAddRel.addEventListener('click', () => {
            const targetSelect = document.getElementById('rel-target-select');
            const typeSelect = document.getElementById('rel-type-select');
            
            const targetId = parseInt(targetSelect.value);
            const relType = typeSelect.value;
            
            if (!targetId || !relType) {
                alert("Please select a character to connect with.");
                return;
            }
            
            // Exclude current character
            if (state.editingCharacterId && targetId === state.editingCharacterId) {
                alert("Cannot connect a character to themselves.");
                return;
            }
            
            const exists = state.editingCharacterRelationships.some(r => r.target_character_id === targetId);
            if (exists) {
                alert("This connection is already in the list.");
                return;
            }
            
            const targetChar = state.characters.find(c => c.id === targetId);
            if (!targetChar) return;
            
            state.editingCharacterRelationships.push({
                target_character_id: targetId,
                target_handle: targetChar.handle,
                relationship_type: relType
            });
            
            renderEditingRelationships();
            targetSelect.value = '';
        });
    }

    // My Profile form submission
    profileUpdateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('profile-name').value.trim();
        const handle = document.getElementById('profile-handle').value.trim();
        const bio = document.getElementById('profile-bio').value.trim();
        const avatarAlt = document.getElementById('profile-avatar-alt').value.trim();
        const fileInput = document.getElementById('profile-avatar-file');
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('handle', handle);
        formData.append('bio', bio);
        formData.append('avatar_alt_text', avatarAlt);
        
        if (fileInput.files.length > 0) {
            formData.append('avatar_file', fileInput.files[0]);
        }

        try {
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                state.currentUser = data.user;
                updateUserUI();
                renderProfileSettings();
                alert("Profile successfully updated!");
            }
        } catch (err) {
            console.error("Error saving profile:", err);
        }
    });

    // Simulation Trigger: Batch Posts
    btnTriggerTimeline.addEventListener('click', async () => {
        btnTriggerTimeline.disabled = true;
        btnTriggerTimeline.textContent = 'Generating...';
        try {
            const res = await fetch('/api/generate_timeline', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                alert(`Successfully generated ${data.posts_generated} timeline posts!`);
                await loadGameState();
                const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                await loadTimeline(currentTabActiveComm);
            }
        } catch (err) {
            console.error("Error triggering timeline generation:", err);
        } finally {
            btnTriggerTimeline.disabled = false;
            btnTriggerTimeline.textContent = 'Batch Posts';
        }
    });

    // Simulation Trigger: Gossip headline
    btnTriggerGossip.addEventListener('click', async () => {
        btnTriggerGossip.disabled = true;
        btnTriggerGossip.textContent = 'Generating...';
        try {
            const res = await fetch('/api/generate_gossip', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                alert(`GOSSIP OUT NOW: ${data.headline}`);
                await loadGameState();
                const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                await loadTimeline(currentTabActiveComm);
            } else {
                const errData = await res.json();
                alert(errData.detail || "Could not generate gossip. Ensure at least 2 characters exist.");
            }
        } catch (err) {
            console.error("Error triggering gossip generation:", err);
        } finally {
            btnTriggerGossip.disabled = false;
            btnTriggerGossip.textContent = 'Gossip Headline';
        }
    });

    // Reset Timeline Event Listener
    const btnResetTimeline = document.getElementById('btn-reset-timeline');
    if (btnResetTimeline) {
        btnResetTimeline.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all posts from the timeline? (This will not delete characters)")) {
                try {
                    const res = await fetch('/api/reset_timeline', { method: 'POST' });
                    if (res.ok) {
                        alert("Timeline reset successfully.");
                        await loadGameState();
                        const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                        await loadTimeline(currentTabActiveComm);
                    }
                } catch (err) {
                    console.error("Error resetting timeline:", err);
                }
            }
        });
    }

    // Save World Context Event Listener
    const btnSaveWorldContext = document.getElementById('btn-save-world-context');
    if (btnSaveWorldContext) {
        btnSaveWorldContext.addEventListener('click', async () => {
            const contextInput = document.getElementById('world-context-input');
            const world_context = contextInput ? contextInput.value.trim() : '';
            try {
                const res = await fetch('/api/settings/world_context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ world_context })
                });
                if (res.ok) {
                    alert("World context saved successfully!");
                }
            } catch (err) {
                console.error("Error saving world context:", err);
            }
        });
    }

    // Trigger Social Event Event Listener
    if (btnTriggerSocialEvent) {
        btnTriggerSocialEvent.addEventListener('click', async () => {
            btnTriggerSocialEvent.disabled = true;
            btnTriggerSocialEvent.textContent = 'Generating Event...';
            try {
                const res = await fetch('/api/trigger_event', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    showEventModal({
                        id: data.event_id,
                        scenario_text: data.scenario_text,
                        involved_characters: data.involved_characters
                    });
                } else {
                    const err = await res.json();
                    alert(err.detail || "Could not trigger social dilemma event. Make sure characters exist.");
                }
            } catch (err) {
                console.error("Error triggering event:", err);
            } finally {
                btnTriggerSocialEvent.disabled = false;
                btnTriggerSocialEvent.textContent = 'Social Event';
            }
        });
    }

    // Event Resolve Submission Listener
    if (eventResolveForm) {
        eventResolveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const choice = eventChoiceInput.value.trim();
            if (!choice || !currentActiveEventId) return;

            const submitBtn = document.getElementById('btn-submit-event-choice');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Deciding...';

            try {
                const res = await fetch(`/api/resolve_event/${currentActiveEventId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choice })
                });
                if (res.ok) {
                    const data = await res.json();
                    eventResolveForm.style.display = 'none';
                    eventResolutionBox.style.display = 'block';
                    eventResolutionText.textContent = data.resolution;

                    const relText = data.relationship_change > 0 ? `+${data.relationship_change}% Relationship` : `${data.relationship_change}% Relationship`;
                    eventResolutionStats.innerHTML = `
                        <span class="stat-pill xp">+${data.xp_gained} XP</span>
                        <span class="stat-pill ${data.relationship_change > 0 ? 'rel-plus' : 'rel-minus'}">${relText}</span>
                    `;

                    await loadCharacters();
                    await loadGameState();
                    if (state.currentView === 'view-activity-log') {
                        await loadActivityLog();
                    }
                } else {
                    alert("Failed to resolve event.");
                }
            } catch (err) {
                console.error("Error resolving event:", err);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Action';
            }
        });
    }

    // Close Event Modal Action Listener
    if (btnCloseEventModal) {
        btnCloseEventModal.addEventListener('click', () => {
            eventModalBackdrop.style.display = 'none';
            currentActiveEventId = null;
        });
    }

    // Undo Last Action Event Listeners
    const btnUndoActionSidebar = document.getElementById('btn-undo-action-sidebar');
    const undoButtons = [btnUndoAction, btnUndoActionSidebar];
    
    undoButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                if (confirm("Are you sure you want to revert your last logged action? Score changes and any posts or DMs created by that action will be deleted.")) {
                    try {
                        const res = await fetch('/api/activity_log/undo', { method: 'POST' });
                        if (res.ok) {
                            const data = await res.json();
                            alert(`Undid last action: ${data.undone_type}`);
                            await loadCharacters();
                            if (state.currentView === 'view-activity-log') {
                                await loadActivityLog();
                            } else if (state.currentView === 'view-timeline') {
                                const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                                await loadTimeline(currentTabActiveComm);
                            } else if (state.currentView === 'view-dms' && state.activeChatCharId) {
                                await loadChatHistory();
                            }
                        } else {
                            const err = await res.json();
                            alert(err.detail || "Could not undo last action.");
                        }
                    } catch (err) {
                        console.error("Error undoing last action:", err);
                    }
                }
            });
        }
    });

    // Wipe Non-Mutuals Event Listener
    const btnWipeNonMutuals = document.getElementById('btn-wipe-non-mutuals');
    if (btnWipeNonMutuals) {
        btnWipeNonMutuals.addEventListener('click', async () => {
            if (confirm("Are you sure you want to wipe all dynamically generated NPCs that you are not following? This will clean up your timelines and chat sessions.")) {
                try {
                    const res = await fetch('/api/characters/wipe_non_mutuals', { method: 'POST' });
                    if (res.ok) {
                        alert("Wiped non-mutual characters successfully!");
                        await loadCharacters();
                        if (state.currentView === 'view-studio') {
                            renderStudioCharacters();
                        } else if (state.currentView === 'view-dms') {
                            renderDMContacts();
                        } else if (state.currentView === 'view-timeline') {
                            const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                            await loadTimeline(currentTabActiveComm);
                        }
                    } else {
                        alert("Failed to wipe characters.");
                    }
                } catch (err) {
                    console.error("Error wiping non-mutuals:", err);
                }
            }
        });
    }

    // Reset DMs Event Listener
    const btnResetDMs = document.getElementById('btn-reset-dms');
    if (btnResetDMs) {
        btnResetDMs.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all DMs and reset conversation session states?")) {
                try {
                    const res = await fetch('/api/reset_dms', { method: 'POST' });
                    if (res.ok) {
                        alert("DMs reset successfully.");
                        await loadCharacters();
                        if (state.currentView === 'view-dms') {
                            renderDMContacts();
                            document.getElementById('chat-active-pane').style.display = 'none';
                            document.getElementById('chat-no-selection').style.display = 'flex';
                            state.activeChatCharId = null;
                        }
                    }
                } catch (err) {
                    console.error("Error resetting DMs:", err);
                }
            }
        });
    }

    // Reset Relationships Event Listener
    const btnResetRelationships = document.getElementById('btn-reset-relationships');
    if (btnResetRelationships) {
        btnResetRelationships.addEventListener('click', async () => {
            if (confirm("Are you sure you want to reset all mutual character relationship scores to 20?")) {
                try {
                    const res = await fetch('/api/reset_relationships', { method: 'POST' });
                    if (res.ok) {
                        alert("Relationship scores reset successfully.");
                        await loadCharacters();
                        if (state.currentView === 'view-dms') {
                            renderDMContacts();
                            if (state.activeChatCharId) {
                                const activeChar = state.characters.find(c => c.id === state.activeChatCharId);
                                if (activeChar) {
                                    document.getElementById('chat-relationship-score').textContent = activeChar.relationship_score;
                                    document.getElementById('chat-relationship-fill').style.width = `${activeChar.relationship_score}%`;
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error resetting relationships:", err);
                }
            }
        });
    }

    // Reset Activity Log Event Listener
    const btnResetActivityLog = document.getElementById('btn-reset-activity-log');
    if (btnResetActivityLog) {
        btnResetActivityLog.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all narrative activity logs? (This will also reset your game day/level to Day 1)")) {
                try {
                    const res = await fetch('/api/game/reset', { method: 'POST' });
                    if (res.ok) {
                        alert("Game loop progress and activity logs cleared successfully.");
                        await loadGameState();
                        const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
                        await loadTimeline(currentTabActiveComm);
                        await loadCharacters();
                        if (state.currentView === 'view-activity-log') {
                            await loadActivityLog();
                        }
                    }
                } catch (err) {
                    console.error("Error resetting game state and activity logs:", err);
                }
            }
        });
    }

    // Go to Sleep / End Day Listener
    const btnEndDay = document.getElementById('btn-end-day');
    if (btnEndDay) {
        btnEndDay.addEventListener('click', async () => {
            if (!state.gameState) return;
            
            // If action count is 0, prompt confirmation
            if (state.gameState.daily_action_count === 0) {
                const proceed = confirm("You haven't interacted with anyone today (no DMs, replies, or event resolutions). Are you sure you want to go to sleep?");
                if (!proceed) return;
            }
            
            btnEndDay.disabled = true;
            btnEndDay.textContent = 'Sleeping...';
            
            try {
                const res = await fetch('/api/game/end_day', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    
                    // Show Day Summary Modal
                    const modal = document.getElementById("day-summary-modal-backdrop");
                    const narrativeText = document.getElementById("day-summary-narrative");
                    const statsList = document.getElementById("day-summary-stats-list");
                    
                    if (modal && narrativeText && statsList) {
                        narrativeText.textContent = data.daily_summary;
                        
                        statsList.innerHTML = `
                            <span class="stat-pill xp" style="align-self: flex-start;">+${data.xp_gained} XP Earned Today</span>
                        `;
                        
                        data.relationship_adjustments.forEach(adj => {
                            const changeText = adj.change > 0 ? `+${adj.change}` : `${adj.change}`;
                            const pill = document.createElement("span");
                            pill.className = `stat-pill ${adj.change > 0 ? 'rel-plus' : 'rel-minus'}`;
                            pill.style.alignSelf = "flex-start";
                            pill.textContent = `${adj.character_name}: ${changeText} Bond`;
                            statsList.appendChild(pill);
                        });
                        
                        modal.style.display = "flex";
                    } else {
                        alert(`Day ${data.old_day} ended successfully! Advanced to Day ${data.new_day}.`);
                    }
                } else {
                    const errData = await res.json();
                    alert(errData.detail || "Failed to end day.");
                }
            } catch (err) {
                console.error("Error ending day:", err);
                alert("Connection error occurred while ending day.");
            } finally {
                btnEndDay.disabled = false;
                btnEndDay.textContent = 'Go to Sleep';
                await loadGameState();
            }
        });
    }

    // Close Day Summary Modal Listener
    const btnCloseDaySummary = document.getElementById('btn-close-day-summary');
    if (btnCloseDaySummary) {
        btnCloseDaySummary.addEventListener('click', async () => {
            const modal = document.getElementById("day-summary-modal-backdrop");
            if (modal) {
                modal.style.display = "none";
            }
            // Wipe timeline feed and reload active components
            const currentTabActiveComm = document.getElementById('tab-community-posts').classList.contains('active') ? 1 : null;
            await loadTimeline(currentTabActiveComm);
            await loadCharacters();
            await loadGameState();
            if (state.currentView === 'view-activity-log') {
                await loadActivityLog();
            }
        });
    }

    // Skill Points Allocation buttons delegation
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('btn-allocate-skill')) {
            const skillName = e.target.getAttribute('data-skill');
            try {
                const res = await fetch('/api/game/allocate_skill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ skill_name: skillName })
                });
                if (res.ok) {
                    await loadGameState();
                } else {
                    const err = await res.json();
                    alert(err.detail || "Could not allocate skill point.");
                }
            } catch (err) {
                console.error("Error allocating skill point:", err);
            }
        }
    });

    // Profile Back button Event Listener
    const btnProfileBack = document.getElementById('btn-profile-back');
    if (btnProfileBack) {
        btnProfileBack.addEventListener('click', () => {
            switchView(state.previousView || 'view-timeline');
            navItems.forEach(n => n.classList.remove('active'));
            if (state.previousView === 'view-timeline') {
                document.getElementById('nav-timeline').classList.add('active');
            } else if (state.previousView === 'view-dms') {
                document.getElementById('nav-dms').classList.add('active');
            } else if (state.previousView === 'view-studio') {
                document.getElementById('nav-studio').classList.add('active');
            }
        });
    }

    // DM Header Profile Click Listener to open Profile
    const chatHeaderProfile = document.querySelector('.chat-header-profile');
    if (chatHeaderProfile) {
        chatHeaderProfile.style.cursor = 'pointer';
        chatHeaderProfile.addEventListener('click', () => {
            if (state.activeChatCharId) {
                openCharacterProfile(state.activeChatCharId);
            }
        });
    }

    // Debug logs refresh
    const btnRefreshDebug = document.getElementById('btn-refresh-debug-logs');
    if (btnRefreshDebug) {
        btnRefreshDebug.addEventListener('click', loadDebugLogs);
    }

    // Debug logs filter select change
    const selectFilterDebug = document.getElementById('debug-log-filter-select');
    if (selectFilterDebug) {
        selectFilterDebug.addEventListener('change', loadDebugLogs);
    }

    // Debug logs clear
    const btnClearDebug = document.getElementById('btn-clear-debug-logs');
    if (btnClearDebug) {
        btnClearDebug.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all API debug logs?")) {
                try {
                    const res = await fetch('/api/debug/logs', { method: 'DELETE' });
                    if (res.ok) {
                        loadDebugLogs();
                    }
                } catch (e) {
                    console.error("Error clearing debug logs:", e);
                }
            }
        });
    }
}

async function loadDebugLogs() {
    const listEl = document.getElementById('debug-logs-list');
    const filterEl = document.getElementById('debug-log-filter-select');
    const filterVal = filterEl ? filterEl.value : 'all';
    
    listEl.innerHTML = '<div class="loading-placeholder">Fetching debug records...</div>';
    
    try {
        const res = await fetch('/api/debug/logs');
        if (res.ok) {
            const logs = await res.json();
            
            // Filter logs
            const filtered = logs.filter(log => {
                if (filterVal === 'all') return true;
                return log.api_type === filterVal;
            });
            
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="loading-placeholder">No matching API logs found.</div>';
                return;
            }
            
            // Sort by timestamp descending (newest first)
            filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            listEl.innerHTML = '';
            filtered.forEach((log, idx) => {
                const card = document.createElement('div');
                card.className = 'card debug-log-card';
                card.style.padding = '16px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.gap = '12px';
                card.style.cursor = 'pointer';
                card.style.transition = 'background 0.2s';
                
                const timeStr = new Date(log.timestamp).toLocaleTimeString();
                
                // Color badge based on log type
                let badgeClass = 'generated';
                if (log.api_type.includes('Reply')) badgeClass = 'mutual';
                if (log.api_type.includes('Dilemma')) badgeClass = 'target-rel';
                if (log.status === 'error') badgeClass = 'rel-minus';
                
                // Prompt preview (first 100 characters)
                const preview = log.prompt.length > 100 
                    ? log.prompt.substring(0, 100).replace(/\n/g, ' ') + '...' 
                    : log.prompt.replace(/\n/g, ' ');
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="profile-badge ${badgeClass}" style="font-size: 11px;">${log.api_type}</span>
                        <span style="font-size: 11px; color: var(--text-muted);">${timeStr}</span>
                    </div>
                    <div class="log-preview" style="font-size: 13.5px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        ${preview}
                    </div>
                    <div class="log-details" style="display: none; flex-direction: column; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div>
                            <div style="font-size: 11px; font-weight: 600; color: var(--accent-cyan); margin-bottom: 6px; text-transform: uppercase;">Prompt Sent to AI</div>
                            <pre style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); border: 1px solid var(--border-color);"></pre>
                        </div>
                        <div>
                            <div style="font-size: 11px; font-weight: 600; color: var(--accent-pink); margin-bottom: 6px; text-transform: uppercase;">AI Completion / Response</div>
                            <pre style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--text-primary); border: 1px solid var(--border-color);"></pre>
                        </div>
                    </div>
                `;
                
                // Safe content injection to prevent HTML injection XSS issues
                const preElements = card.querySelectorAll('.log-details pre');
                preElements[0].textContent = log.prompt;
                preElements[1].textContent = log.response;
                
                // Toggle accordion details
                card.addEventListener('click', (e) => {
                    if (e.target.tagName === 'PRE') return;
                    const details = card.querySelector('.log-details');
                    const isHidden = details.style.display === 'none';
                    details.style.display = isHidden ? 'flex' : 'none';
                });
                
                listEl.appendChild(card);
            });
        } else {
            listEl.innerHTML = '<div class="loading-placeholder">Failed to fetch debug logs.</div>';
        }
    } catch (err) {
        console.error("Error loading debug logs:", err);
        listEl.innerHTML = '<div class="loading-placeholder">Connection error.</div>';
    }
}
