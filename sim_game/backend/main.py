import os
import shutil
import asyncio
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import random
import datetime

from backend.database import get_db, init_db, Character, Post, DirectMessage, ConversationSession, Community, Event
from backend.config import UPLOAD_DIR
import backend.crud as crud
import backend.novelai as novelai

# Initialize DB on startup
init_db()

app = FastAPI(title="VibeNet Life-Simulator")

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a default placeholder directory structure for static files
os.makedirs("./static", exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Pydantic schemas
class PostCreate(BaseModel):
    content: str
    community_id: Optional[int] = None

class DMCreate(BaseModel):
    content: str

class ProfileUpdate(BaseModel):
    name: str
    handle: str
    bio: str
    avatar_alt_text: Optional[str] = ""

# Helpers for Thread Cascade Background Task
async def run_thread_cascade(db_session_factory, parent_post_id: int, user_reply_content: str, user_handle: str):
    """
    Background worker that simulates other characters responding to a post.
    Takes 1-3 random characters and generates sequential replies.
    """
    # Sleep slightly to let user post render first
    await asyncio.sleep(1.0)
    
    db: Session = db_session_factory()
    try:
        # Fetch parent post and its direct replies to build thread history
        thread_posts = crud.get_post_thread(db, parent_post_id)
        if not thread_posts:
            return
            
        # Build flat thread history for NovelAI
        thread_history = []
        for post in thread_posts:
            author = db.query(Character).filter_by(id=post.author_id).first()
            if author:
                thread_history.append({
                    "handle": author.handle,
                    "content": post.content
                })
        
        # Find the character whom the user is replying to (the author of the parent post)
        from backend.database import Post
        parent_post = db.query(Post).filter_by(id=parent_post_id).first()
        target_char = None
        if parent_post:
            target_char = db.query(Character).filter(
                Character.id == parent_post.author_id,
                Character.is_user == False,
                Character.handle != "@popcraze"
            ).first()

        # Decide how many characters reply (between 1 and 3)
        num_replies = random.randint(1, 3)
        
        # Pick other characters who are not the user, and haven't replied in the last 2 posts to keep it dynamic
        all_chars = crud.get_all_characters(db, exclude_user=True)
        available_chars = [c for c in all_chars if c.handle != "@popcraze"]
        
        # If target_char is valid, place them first, then fill rest
        selected_chars = []
        if target_char:
            selected_chars.append(target_char)
            available_chars = [c for c in available_chars if c.id != target_char.id]
            
        # Shuffle remaining characters
        random.shuffle(available_chars)
        
        # Fill remaining slots up to num_replies
        remaining_needed = num_replies - len(selected_chars)
        if remaining_needed > 0:
            selected_chars.extend(available_chars[:remaining_needed])
            
        # Get the user's handle
        user_char = db.query(Character).filter_by(is_user=True).first()
        user_handle = user_char.handle if user_char else "@playerone"
        
        for char in selected_chars:
            # Simulate "People are typing..." indicator by sleeping
            await asyncio.sleep(random.uniform(2.0, 4.0))
            
            # Check if this reply is replying to a user's post
            replying_to_user = False
            if thread_history:
                last_post = thread_history[-1]
                if last_post["handle"] == user_handle:
                    replying_to_user = True
            
            formatted_history = novelai.format_tweet_history(char.name, char.handle, char.tweet_history or "")
            # Generate reply
            reply_text = await novelai.generate_thread_reply(
                char_name=char.name,
                char_handle=char.handle,
                char_bio=char.bio,
                tweet_history=formatted_history,
                thread_history=thread_history,
                replying_to_user=replying_to_user,
                user_handle=user_handle
            )
            
            # Double-check that it starts with the mention if replying to user
            if replying_to_user:
                reply_stripped = reply_text.strip()
                if not reply_stripped.startswith("@"):
                    reply_text = f"{user_handle} {reply_stripped}"
                elif not reply_stripped.startswith(user_handle):
                    reply_text = f"{user_handle} {reply_stripped}"
            
            # Save reply to database
            new_reply = crud.create_post(
                db=db,
                author_id=char.id,
                content=reply_text,
                community_id=thread_posts[0].community_id,
                parent_id=parent_post_id
            )
            
            # Add this reply to local history for the next character in loop
            thread_history.append({
                "handle": char.handle,
                "content": reply_text
            })
            
            # Slightly increase relationship score for this interaction if user is in thread
            crud.increment_relationship_score(db, char.id, 1)
            
    except Exception as e:
        print(f"[Error in thread cascade background task]: {e}")
    finally:
        db.close()

async def run_outcome_generation_task(db_session_factory, trigger_type: str, context_desc: str, user_reply: str, char_id: Optional[int], post_id: Optional[int], dm_id: Optional[int], relationship_change: int):
    """
    Background worker that runs the NovelAI Outcome generator and creates an activity log entry.
    """
    db: Session = db_session_factory()
    try:
        outcome = await novelai.generate_narrative_outcome(context_desc, user_reply)
        xp = random.randint(5, 15)
        crud.log_activity(
            db=db,
            trigger_type=trigger_type,
            narrative_outcome=outcome,
            xp_gained=xp,
            relationship_change=relationship_change,
            associated_character_id=char_id,
            associated_post_id=post_id,
            associated_dm_id=dm_id
        )
    except Exception as e:
        print(f"[Error in outcome background task]: {e}")
    finally:
        db.close()

@app.get("/api/debug/logs")
def read_debug_logs():
    """
    Returns the in-memory NovelAI API call debug logs.
    """
    from backend.novelai import DEBUG_LOGS
    return DEBUG_LOGS

@app.delete("/api/debug/logs")
def clear_debug_logs():
    """
    Clears the in-memory NovelAI API call debug logs.
    """
    from backend.novelai import DEBUG_LOGS
    DEBUG_LOGS.clear()
    return {"status": "success"}

@app.get("/api/timeline")
def read_timeline(community_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Fetches timeline root posts (parent_id == None), with optional community filtering.
    """
    posts = crud.get_posts(db, community_id=community_id, parent_only=True)
    result = []
    for post in posts:
        # Count replies
        replies_count = db.query(Post).filter(Post.parent_id == post.id).count()
        result.append({
            "id": post.id,
            "content": post.content,
            "timestamp": post.timestamp,
            "community_id": post.community_id,
            "replies_count": replies_count,
            "author": {
                "id": post.author.id,
                "name": post.author.name,
                "handle": post.author.handle,
                "avatar_path": post.author.avatar_path,
                "avatar_alt_text": post.author.avatar_alt_text,
                "is_user": post.author.is_user
            }
        })
    return result

@app.get("/api/posts/{post_id}")
def read_post_thread(post_id: int, db: Session = Depends(get_db)):
    """
    Fetches the original post and all its replies.
    """
    thread = crud.get_post_thread(db, post_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Post not found")
        
    result = []
    for post in thread:
        result.append({
            "id": post.id,
            "content": post.content,
            "timestamp": post.timestamp,
            "community_id": post.community_id,
            "parent_id": post.parent_id,
            "author": {
                "id": post.author.id,
                "name": post.author.name,
                "handle": post.author.handle,
                "avatar_path": post.author.avatar_path,
                "avatar_alt_text": post.author.avatar_alt_text,
                "is_user": post.author.is_user
            }
        })
    return result

@app.post("/api/posts")
def create_timeline_post(payload: PostCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    User creates a new root post. Triggers a Thread Cascade.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    post = crud.create_post(
        db=db,
        author_id=user.id,
        content=payload.content,
        community_id=payload.community_id
    )
    
    # Trigger a thread cascade for the user's new root post
    from backend.database import SessionLocal
    background_tasks.add_task(
        run_thread_cascade,
        SessionLocal,
        post.id,
        payload.content,
        user.handle
    )
    
    return {"status": "success", "post_id": post.id}

@app.post("/api/posts/{post_id}/reply")
def reply_to_post(post_id: int, payload: PostCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    User replies to a timeline post. Schedules a Thread Cascade background task.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    parent_post = db.query(Post).filter(Post.id == post_id).first()
    if not parent_post:
        raise HTTPException(status_code=404, detail="Parent post not found")
        
    # Save the user's reply
    reply = crud.create_post(
        db=db,
        author_id=user.id,
        content=payload.content,
        community_id=parent_post.community_id,
        parent_id=post_id
    )
    
    # Schedule the cascade background task to simulate active replies from other characters
    from backend.database import SessionLocal
    background_tasks.add_task(
        run_thread_cascade,
        SessionLocal,
        post_id,
        payload.content,
        user.handle
    )
    
    # Schedule the narrative outcome log task
    background_tasks.add_task(
        run_outcome_generation_task,
        SessionLocal,
        "Thread_Reply",
        f"Thread post by {parent_post.author.handle}: {parent_post.content[:80]}",
        payload.content,
        parent_post.author_id,
        reply.id,
        None,
        0
    )
    
    return {"status": "success", "reply_id": reply.id}


@app.get("/api/communities")
def read_communities(db: Session = Depends(get_db)):
    """
    Lists available communities.
    """
    return crud.get_communities(db)

@app.get("/api/characters")
def read_characters(db: Session = Depends(get_db)):
    """
    Lists all NPC characters.
    """
    return crud.get_all_characters(db, exclude_user=True)

@app.post("/api/characters")
def create_studio_character(
    name: str = Form(...),
    handle: str = Form(...),
    bio: str = Form(...),
    avatar_alt_text: str = Form(...),
    tweet_history: str = Form(...),
    relationships: Optional[str] = Form(None),
    avatar_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Create a new custom character. Handles optional avatar image uploads and relationships.
    """
    # Check if handle already exists
    existing = crud.get_character_by_handle(db, handle)
    if existing:
        raise HTTPException(status_code=400, detail="Character handle already taken")
        
    avatar_path = "/static/default_npc.png"
    if avatar_file:
        file_ext = os.path.splitext(avatar_file.filename)[1]
        filename = f"char_{handle.replace('@', '')}_{random.randint(1000,9999)}{file_ext}"
        target_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
            
        avatar_path = f"/static/uploads/{filename}"
        
    char = crud.create_character(
        db=db,
        name=name,
        handle=handle,
        bio=bio,
        avatar_path=avatar_path,
        avatar_alt_text=avatar_alt_text,
        tweet_history=tweet_history,
        is_predefined=False,
        following=True  # Rename user-created NPCs to mutuals and follow automatically
    )
    
    # Save relationships if provided
    if relationships is not None:
        import json
        try:
            rel_list = json.loads(relationships)
            for rel_data in rel_list:
                target_id = int(rel_data["target_character_id"])
                rel_type = rel_data["relationship_type"]
                crud.add_or_update_relationship(db, char.id, target_id, rel_type)
        except Exception as e:
            print(f"[Error parsing relationships on create]: {e}")
            
    return {"status": "success", "character_id": char.id}

@app.get("/api/characters/{character_id}")
def get_character_details(character_id: int, db: Session = Depends(get_db)):
    """
    Fetch a single character's profile details.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char

@app.post("/api/characters/{character_id}/edit")
def edit_studio_character(
    character_id: int,
    name: str = Form(...),
    handle: str = Form(...),
    bio: str = Form(...),
    avatar_alt_text: str = Form(...),
    tweet_history: str = Form(...),
    relationships: Optional[str] = Form(None),
    avatar_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Updates an existing character's profile and rebuilds their relationships.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    # Check if handle already exists for another character
    existing = crud.get_character_by_handle(db, handle)
    if existing and existing.id != character_id:
        raise HTTPException(status_code=400, detail="Character handle already taken")
        
    avatar_path = char.avatar_path
    if avatar_file:
        file_ext = os.path.splitext(avatar_file.filename)[1]
        filename = f"char_{handle.replace('@', '')}_{random.randint(1000,9999)}{file_ext}"
        target_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
            
        avatar_path = f"/static/uploads/{filename}"
        
    crud.update_character(
        db=db,
        character_id=character_id,
        name=name,
        handle=handle,
        bio=bio,
        avatar_path=avatar_path,
        avatar_alt_text=avatar_alt_text,
        tweet_history=tweet_history
    )
    
    # Rebuild relationships if provided
    if relationships is not None:
        crud.clear_character_relationships(db, character_id)
        import json
        try:
            rel_list = json.loads(relationships)
            for rel_data in rel_list:
                target_id = int(rel_data["target_character_id"])
                rel_type = rel_data["relationship_type"]
                crud.add_or_update_relationship(db, character_id, target_id, rel_type)
        except Exception as e:
            print(f"[Error parsing relationships on edit]: {e}")
            
    return {"status": "success"}

@app.get("/api/characters/{character_id}/relationships")
def get_character_relationships_endpoint(character_id: int, db: Session = Depends(get_db)):
    """
    Gets all active social network connections for a character.
    """
    rels = crud.get_character_relationships(db, character_id)
    result = []
    for rel in rels:
        other_id = rel.character_b_id if rel.character_a_id == character_id else rel.character_a_id
        other = crud.get_character_by_id(db, other_id)
        if other:
            result.append({
                "id": rel.id,
                "target_character_id": other_id,
                "target_name": other.name,
                "target_handle": other.handle,
                "relationship_type": rel.relationship_type,
                "relationship_score": rel.relationship_score
            })
    return result

# --- MUTUALS & RELATIONSHIPS UTILITY ROUTES ---

class TargetRelUpdate(BaseModel):
    target_relationship: Optional[str]

@app.post("/api/characters/{character_id}/follow_toggle")
def follow_character_toggle(character_id: int, db: Session = Depends(get_db)):
    """
    Toggles the mutual follow state of an NPC.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    char.following = not char.following
    db.commit()
    return {"status": "success", "following": char.following}

@app.post("/api/characters/{character_id}/target_relationship")
def update_target_relationship(character_id: int, payload: TargetRelUpdate, db: Session = Depends(get_db)):
    """
    Saves a custom relationship subtext focus with a mutual.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    char.target_relationship = payload.target_relationship
    db.commit()
    return {"status": "success", "target_relationship": char.target_relationship}

@app.post("/api/characters/wipe_non_mutuals")
def wipe_non_mutuals(db: Session = Depends(get_db)):
    """
    Wipes all dynamically generated NPCs that are not followed (mutuals).
    """
    db.query(Character).filter(
        Character.is_user == False,
        Character.following == False,
        Character.handle != "@popcraze"
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "success"}

@app.get("/api/characters/{character_id}/posts")
def get_character_posts(character_id: int, db: Session = Depends(get_db)):
    """
    Fetches actual timeline posts combined with their parsed tweet history for profile feeds.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    db_posts = db.query(Post).filter(Post.author_id == character_id, Post.parent_id == None).all()
    posts_list = []
    for p in db_posts:
        posts_list.append({
            "id": p.id,
            "content": p.content,
            "timestamp": p.timestamp,
            "is_history": False
        })
        
    if char.tweet_history:
        from backend.novelai import parse_generated_posts, format_tweet_history
        formatted_history = format_tweet_history(char.name, char.handle, char.tweet_history)
        history_posts = parse_generated_posts(formatted_history)
        for idx, hp in enumerate(history_posts):
            fake_time = datetime.datetime.now() - datetime.timedelta(days=idx+1)
            posts_list.append({
                "id": f"history_{idx}",
                "content": hp["content"],
                "timestamp": fake_time,
                "is_history": True
            })
            
    posts_list.sort(key=lambda x: x["timestamp"], reverse=True)
    return posts_list

@app.get("/api/user/profile")
def get_user_profile(db: Session = Depends(get_db)):
    """
    Fetches the user's active profile details.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user

@app.post("/api/user/profile")
def update_user_profile(
    name: str = Form(...),
    handle: str = Form(...),
    bio: str = Form(...),
    avatar_alt_text: str = Form(""),
    avatar_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Updates the user's profile, including avatar upload.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    avatar_path = user.avatar_path
    if avatar_file:
        file_ext = os.path.splitext(avatar_file.filename)[1]
        filename = f"user_avatar{file_ext}"
        target_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
            
        avatar_path = f"/static/uploads/{filename}"
        
    updated_user = crud.update_character(
        db=db,
        character_id=user.id,
        name=name,
        handle=handle,
        bio=bio,
        avatar_path=avatar_path,
        avatar_alt_text=avatar_alt_text
    )
    return {"status": "success", "user": updated_user}

@app.get("/api/dms/{character_id}")
def read_dms(character_id: int, db: Session = Depends(get_db)):
    """
    Fetches direct message logs, relationship score, and session details for a character.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    messages = crud.get_dms(db, user.id, char.id)
    session = crud.get_conversation_session(db, char.id)
    
    # Map messages to simple formats
    formatted_msgs = []
    for msg in messages:
        sender_char = db.query(Character).filter_by(id=msg.sender_id).first()
        formatted_msgs.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_handle": sender_char.handle if sender_char else "",
            "content": msg.content,
            "timestamp": msg.timestamp,
            "vibe": msg.vibe,
            "intensity": msg.intensity
        })
        
    return {
        "character": {
            "id": char.id,
            "name": char.name,
            "handle": char.handle,
            "bio": char.bio,
            "avatar_path": char.avatar_path,
            "avatar_alt_text": char.avatar_alt_text,
            "relationship_score": char.relationship_score
        },
        "session": {
            "vibe": session.vibe,
            "intensity": session.intensity,
            "replies_left": session.replies_left
        },
        "messages": formatted_msgs
    }

@app.post("/api/dms/{character_id}")
async def send_dm_message(character_id: int, payload: DMCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    User sends a DM message. Triggers the NovelAI generator for response and updates session state.
    """
    user = crud.get_user_character(db)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    # Log user message
    user_dm = crud.create_dm(db, sender_id=user.id, receiver_id=character_id, content=payload.content)

    
    # Process turn details
    session = crud.get_conversation_session(db, character_id)
    session.replies_left -= 1
    
    milestone_triggered = False
    milestone_msg = ""
    # Relationship milestone check
    if session.replies_left <= 0:
        session.replies_left = 5
        # Trigger score bonus
        crud.increment_relationship_score(db, character_id, 10)
        milestone_triggered = True
        milestone_msg = f"[Relationship Milestone reached! Your bond with {char.name} has strengthened (+10 Rel).]"
    else:
        # Standard increment
        crud.increment_relationship_score(db, character_id, 2)
        
    # Build context history for NovelAI (last 8 DMs)
    recent_dms = crud.get_dms(db, user.id, char.id, limit=8)
    msg_history = []
    for msg in recent_dms:
        sender_char = db.query(Character).filter_by(id=msg.sender_id).first()
        sender_name = sender_char.name if sender_char else "Someone"
        sender_handle = sender_char.handle if sender_char else "@someone"
        # If msg is user sending and includes reference to image, can format it
        msg_history.append({
            "sender": f"{sender_name} ({sender_handle})",
            "content": msg.content
        })
        
    formatted_history = novelai.format_tweet_history(char.name, char.handle, char.tweet_history or "")
    # Call NovelAI to generate response
    ai_reply = await novelai.generate_dm_reply(
        char_name=char.name,
        char_handle=char.handle,
        char_bio=char.bio,
        char_avatar_alt=char.avatar_alt_text or "",
        tweet_history=formatted_history,
        message_history=msg_history
    )
    
    # Log AI message with parsed vibe/intensity
    logged_reply = crud.create_dm(
        db=db,
        sender_id=character_id,
        receiver_id=user.id,
        content=ai_reply["text"],
        vibe=ai_reply["vibe"],
        intensity=ai_reply["intensity"]
    )
    
    # Update active session details
    crud.update_conversation_session(
        db=db,
        character_id=character_id,
        vibe=ai_reply["vibe"],
        intensity=ai_reply["intensity"],
        replies_left=session.replies_left
    )
    
    # Reload character details to get updated relationship score
    db.refresh(char)
    
    # Schedule DM narrative outcome task
    from backend.database import SessionLocal
    rel_change = 10 if milestone_triggered else 2
    background_tasks.add_task(
        run_outcome_generation_task,
        SessionLocal,
        "DM",
        f"Direct message conversation with {char.name} ({char.handle})",
        payload.content,
        char.id,
        None,
        user_dm.id,
        rel_change
    )
    
    response_data = {
        "status": "success",
        "reply": {
            "id": logged_reply.id,
            "sender_id": character_id,
            "sender_handle": char.handle,
            "content": logged_reply.content,
            "timestamp": logged_reply.timestamp,
            "vibe": logged_reply.vibe,
            "intensity": logged_reply.intensity
        },
        "session": {
            "vibe": logged_reply.vibe,
            "intensity": logged_reply.intensity,
            "replies_left": session.replies_left
        },
        "relationship_score": char.relationship_score,
        "milestone_triggered": milestone_triggered,
        "milestone_message": milestone_msg
    }
    return response_data


@app.post("/api/generate_timeline")
async def generate_timeline(db: Session = Depends(get_db)):
    """
    Triggers NovelAI to generate new timeline posts individually,
    incorporating bio, tweet history, and spawning 0-3 new AI-generated NPCs.
    """
    import re
    # Pick a random community (or standard one since we only seed 1 initially)
    communities = crud.get_communities(db)
    if not communities:
        raise HTTPException(status_code=400, detail="No communities available")
    comm = random.choice(communities)
    
    # 1. Decide how many new characters to generate (0 to 3)
    num_new_chars = random.randint(0, 3)
    
    # 2. Decide how many existing characters to generate posts for (e.g. 3 to 5)
    num_existing_posts = random.randint(3, 5)
    
    saved_posts_count = 0
    
    # 3. Generate new dynamic AI characters
    for _ in range(num_new_chars):
        # Check maximum character count limit (100)
        npc_count = db.query(Character).filter(Character.is_user == False).count()
        if npc_count >= 100:
            break
            
        npc_data = await novelai.generate_new_ai_character(comm.name)
        
        # Save character
        char = crud.create_character(
            db=db,
            name=npc_data["name"],
            handle=npc_data["handle"],
            bio=npc_data["bio"],
            avatar_path="/static/default_npc.png",
            avatar_alt_text=f"A default profile photo of {npc_data['name']}",
            tweet_history=f"{npc_data['name']}\n{npc_data['handle']}\n* 00:00 AM\n{npc_data['content']}\n----\n",
            is_predefined=False,
            following=False  # Dynamic generated NPCs are not mutuals by default
        )
        
        # Create post
        crud.create_post(
            db=db,
            author_id=char.id,
            content=npc_data["content"],
            community_id=comm.id
        )
        saved_posts_count += 1
        
    # 4. Generate posts for existing characters
    all_npcs = db.query(Character).filter(Character.is_user == False, Character.handle != "@popcraze").all()
    if all_npcs:
        # Choose a subset to generate posts for
        chosen_npcs = random.sample(all_npcs, min(num_existing_posts, len(all_npcs)))
        for npc in chosen_npcs:
            content = await novelai.generate_single_character_post(
                char_name=npc.name,
                char_handle=npc.handle,
                char_bio=npc.bio,
                tweet_history=npc.tweet_history or "",
                community_name=comm.name
            )
            
            # Check for bracketed placeholders like [reply here] or [insert response]
            placeholder_pat = r'\[(?:reply|response|insert|write|text|content|comment|here).*?\]'
            if re.search(placeholder_pat, content, re.IGNORECASE) or not content.strip():
                continue
                
            # Create post
            crud.create_post(
                db=db,
                author_id=npc.id,
                content=content,
                community_id=comm.id
            )
            
            # Add to character's tweet history in raw single-line format
            content_clean = content.strip().replace("\n", " ")
            if npc.tweet_history:
                npc.tweet_history = f"{npc.tweet_history.strip()}\n{content_clean}\n"
            else:
                npc.tweet_history = f"{content_clean}\n"
            db.commit()
            
            saved_posts_count += 1
            
    return {"status": "success", "posts_generated": saved_posts_count}

@app.post("/api/generate_gossip")
async def trigger_gossip_headline(db: Session = Depends(get_db)):
    """
    Triggers the gossip bot to generate a post about two characters.
    """
    gossip_bot = db.query(Character).filter_by(handle="@popcraze").first()
    if not gossip_bot:
        raise HTTPException(status_code=400, detail="Gossip bot not registered")
        
    # Get any two NPC characters in the system (excluding popcraze itself)
    chars = db.query(Character).filter(
        Character.is_user == False, 
        Character.handle != "@popcraze"
    ).all()
    
    if len(chars) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 characters to generate gossip")
        
    # Select two characters
    char_a, char_b = random.sample(chars, 2)
    
    # Generate gossip headline
    headline = await novelai.generate_gossip_headline(
        char_a_name=char_a.name,
        char_b_name=char_b.name
    )
    
    # Create gossip post
    post = crud.create_post(
        db=db,
        author_id=gossip_bot.id,
        content=headline,
        community_id=None # general public feed
    )
    
    return {"status": "success", "post_id": post.id, "headline": headline}

# Settings Schema
class WorldContextUpdate(BaseModel):
    world_context: str

@app.get("/api/settings/world_context")
def get_world_context(db: Session = Depends(get_db)):
    """
    Fetches the global world context setting.
    """
    context = crud.get_world_context(db)
    return {"world_context": context}

@app.post("/api/settings/world_context")
def update_world_context(payload: WorldContextUpdate, db: Session = Depends(get_db)):
    """
    Updates the global world context setting.
    """
    context = crud.update_world_context(db, payload.world_context)
    return {"status": "success", "world_context": context}

@app.post("/api/reset_timeline")
def reset_timeline(db: Session = Depends(get_db)):
    """
    Clears all posts from the database timeline (retaining characters).
    """
    crud.clear_posts(db)
    return {"status": "success"}

@app.post("/api/reset_dms")
def reset_dms(db: Session = Depends(get_db)):
    """
    Clears all direct messages and resets conversation sessions.
    """
    crud.clear_dms(db)
    return {"status": "success"}

@app.post("/api/reset_relationships")
def reset_relationships(db: Session = Depends(get_db)):
    """
    Resets relationship score for all mutual characters to 20.
    """
    crud.reset_relationship_scores(db)
    return {"status": "success"}

@app.delete("/api/posts/{post_id}")
def delete_timeline_post(post_id: int, db: Session = Depends(get_db)):
    """
    Deletes a user's post or comment from the database.
    """
    user = crud.get_user_character(db)
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    crud.delete_post(db, post_id)
    return {"status": "success"}

@app.delete("/api/characters/{character_id}")
def delete_studio_character(character_id: int, db: Session = Depends(get_db)):
    """
    Deletes an instantiated character from the registry.
    """
    char = crud.get_character_by_id(db, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.is_user:
        raise HTTPException(status_code=400, detail="Cannot delete the player profile")
    
    crud.delete_character(db, character_id)
    return {"status": "success"}

# Event Resolution Schema
class EventResolve(BaseModel):
    choice: str

@app.get("/api/activity_log")
def get_activity_log(db: Session = Depends(get_db)):
    """
    Fetches the chronological history of narrative outcomes and stats.
    """
    logs = crud.get_activity_logs(db)
    result = []
    for log in logs:
        char_name = None
        if log.associated_character_id:
            char = crud.get_character_by_id(db, log.associated_character_id)
            if char:
                char_name = char.name
        result.append({
            "id": log.id,
            "timestamp": log.timestamp,
            "trigger_type": log.trigger_type,
            "narrative_outcome": log.narrative_outcome,
            "xp_gained": log.xp_gained,
            "relationship_change": log.relationship_change,
            "character_name": char_name
        })
    return result

@app.post("/api/activity_log/undo")
def undo_activity(db: Session = Depends(get_db)):
    """
    Reverts the last action logged in the activity log.
    """
    res = crud.undo_last_activity(db)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/events/active")
def read_active_event_route(db: Session = Depends(get_db)):
    """
    Fetches the currently unresolved active event if any.
    """
    ev = crud.get_active_event(db)
    if not ev:
        return {"status": "none"}
    
    char_ids = [int(x) for x in ev.involved_character_ids.split(",") if x.strip()]
    chars = []
    for cid in char_ids:
        char = crud.get_character_by_id(db, cid)
        if char:
            chars.append({"name": char.name, "handle": char.handle})
            
    return {
        "status": "active",
        "event": {
            "id": ev.id,
            "scenario_text": ev.scenario_text,
            "involved_characters": chars
        }
    }

@app.post("/api/trigger_event")
async def trigger_social_event(db: Session = Depends(get_db)):
    """
    Triggers a new social dilemma event focusing on exactly one mutual character.
    """
    chars = db.query(Character).filter(
        Character.is_user == False,
        Character.following == True,
        Character.handle != "@popcraze"
    ).all()
    if not chars:
        raise HTTPException(status_code=400, detail="No mutual characters available to trigger an event. Please follow or create a mutual persona first.")
        
    selected_char = random.choice(chars)
    selected = [selected_char]
    
    chars_info = [{"name": c.name, "handle": c.handle, "bio": c.bio} for c in selected]
    scenario = await novelai.generate_social_event(chars_info)
    
    event = crud.create_event(db, scenario, [c.id for c in selected])
    
    return {
        "status": "success",
        "event_id": event.id,
        "scenario_text": scenario,
        "involved_characters": [{"name": c.name, "handle": c.handle} for c in selected]
    }

@app.post("/api/resolve_event/{event_id}")
async def resolve_social_event(event_id: int, payload: EventResolve, db: Session = Depends(get_db)):
    """
    Resolves the social dilemma event with user choice.
    """
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.status == "Resolved":
        raise HTTPException(status_code=400, detail="Event already resolved")
        
    resolution = await novelai.generate_event_resolution(ev.scenario_text, payload.choice)
    
    is_positive = any(word in resolution.lower() for word in ["positively", "increased", "strengthened", "improved", "grew"])
    rel_change = 10 if is_positive else -10
    
    char_ids = [int(x) for x in ev.involved_character_ids.split(",") if x.strip()]
    primary_char_id = char_ids[0] if char_ids else None
    if primary_char_id:
        crud.increment_relationship_score(db, primary_char_id, rel_change)
        
    crud.resolve_event(db, event_id, payload.choice, resolution)
    
    xp_gained = random.randint(15, 30)
    
    crud.log_activity(
        db=db,
        trigger_type="Event_Choice",
        narrative_outcome=resolution,
        xp_gained=xp_gained,
        relationship_change=rel_change,
        associated_character_id=primary_char_id
    )
    
    return {
        "status": "success",
        "resolution": resolution,
        "relationship_change": rel_change,
        "xp_gained": xp_gained
    }

# Mount static files to serve the frontend UI
app.mount("/", StaticFiles(directory="static", html=True), name="static")
