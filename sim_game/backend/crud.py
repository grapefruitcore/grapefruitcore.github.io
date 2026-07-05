from sqlalchemy.orm import Session
from backend.database import Character, Post, DirectMessage, ConversationSession, Community, Setting, ActivityLog, Event
import datetime

# --- CHARACTER OPERATIONS ---

def get_user_character(db: Session) -> Character:
    return db.query(Character).filter(Character.is_user == True).first()

def get_character_by_id(db: Session, character_id: int) -> Character:
    return db.query(Character).filter(Character.id == character_id).first()

def get_character_by_handle(db: Session, handle: str) -> Character:
    return db.query(Character).filter(Character.handle == handle).first()

def get_all_characters(db: Session, exclude_user: bool = True) -> list:
    query = db.query(Character)
    if exclude_user:
        query = query.filter(Character.is_user == False)
    return query.all()

def create_character(db: Session, name: str, handle: str, bio: str, avatar_path: str, avatar_alt_text: str, tweet_history: str, is_predefined: bool = False, following: bool = False) -> Character:
    # Ensure handle starts with @
    if not handle.startswith("@"):
        handle = "@" + handle
        
    db_char = Character(
        name=name,
        handle=handle,
        bio=bio,
        is_predefined=is_predefined,
        is_user=False,
        relationship_score=0,
        following=following,
        avatar_path=avatar_path,
        avatar_alt_text=avatar_alt_text,
        tweet_history=tweet_history
    )
    db.add(db_char)
    db.commit()
    db.refresh(db_char)
    
    # Initialize ConversationSession for this character
    db_session = ConversationSession(
        character_id=db_char.id,
        vibe="Neutral",
        intensity=50,
        replies_left=5
    )
    db.add(db_session)
    db.commit()
    
    return db_char

def update_character(db: Session, character_id: int, name: str = None, handle: str = None, bio: str = None, avatar_path: str = None, avatar_alt_text: str = None, tweet_history: str = None) -> Character:
    char = get_character_by_id(db, character_id)
    if not char:
        return None
        
    if name is not None:
        char.name = name
    if handle is not None:
        if not handle.startswith("@"):
            handle = "@" + handle
        char.handle = handle
    if bio is not None:
        char.bio = bio
    if avatar_path is not None:
        char.avatar_path = avatar_path
    if avatar_alt_text is not None:
        char.avatar_alt_text = avatar_alt_text
    if tweet_history is not None:
        char.tweet_history = tweet_history
        
    db.commit()
    db.refresh(char)
    return char


# --- POST & TIMELINE OPERATIONS ---

def get_posts(db: Session, community_id: int = None, parent_only: bool = True, limit: int = 50) -> list:
    query = db.query(Post)
    if parent_only:
        query = query.filter(Post.parent_id == None)
    if community_id is not None:
        query = query.filter(Post.community_id == community_id)
    
    # Order by timestamp descending
    return query.order_by(Post.timestamp.desc()).limit(limit).all()

def get_post_thread(db: Session, post_id: int) -> list:
    """
    Returns the original post and all its replies sorted by timestamp.
    """
    original = db.query(Post).filter(Post.id == post_id).first()
    if not original:
        return []
        
    # Get all replies (recursively or simple flat list)
    # Since Xialong thread cascades are flat replies under the parent, a simple query is sufficient.
    replies = db.query(Post).filter(Post.parent_id == post_id).order_by(Post.timestamp.asc()).all()
    return [original] + replies

def create_post(db: Session, author_id: int, content: str, community_id: int = None, parent_id: int = None) -> Post:
    db_post = Post(
        author_id=author_id,
        content=content,
        community_id=community_id,
        parent_id=parent_id,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


# --- DIRECT MESSAGE OPERATIONS ---

def get_dms(db: Session, character_a_id: int, character_b_id: int, limit: int = 50) -> list:
    """
    Fetches direct messages between two characters.
    """
    return db.query(DirectMessage).filter(
        ((DirectMessage.sender_id == character_a_id) & (DirectMessage.receiver_id == character_b_id)) |
        ((DirectMessage.sender_id == character_b_id) & (DirectMessage.receiver_id == character_a_id))
    ).order_by(DirectMessage.timestamp.asc()).limit(limit).all()

def create_dm(db: Session, sender_id: int, receiver_id: int, content: str, vibe: str = None, intensity: int = None) -> DirectMessage:
    db_dm = DirectMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        timestamp=datetime.datetime.utcnow(),
        vibe=vibe,
        intensity=intensity
    )
    db.add(db_dm)
    db.commit()
    db.refresh(db_dm)
    return db_dm


# --- SESSION & RELATIONSHIP OPERATIONS ---

def get_conversation_session(db: Session, character_id: int) -> ConversationSession:
    session = db.query(ConversationSession).filter(ConversationSession.character_id == character_id).first()
    if not session:
        # Create a default session if somehow missing
        session = ConversationSession(
            character_id=character_id,
            vibe="Neutral",
            intensity=50,
            replies_left=5
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    return session

def update_conversation_session(db: Session, character_id: int, vibe: str, intensity: int, replies_left: int) -> ConversationSession:
    session = get_conversation_session(db, character_id)
    session.vibe = vibe
    session.intensity = intensity
    session.replies_left = replies_left
    db.commit()
    db.refresh(session)
    return session

def increment_relationship_score(db: Session, character_id: int, amount: int) -> int:
    char = get_character_by_id(db, character_id)
    if char and not char.is_user:
        char.relationship_score = max(0, min(100, char.relationship_score + amount))
        db.commit()
        db.refresh(char)
        return char.relationship_score
    return 0


# --- COMMUNITY OPERATIONS ---

def get_communities(db: Session) -> list:
    return db.query(Community).all()

def create_community(db: Session, name: str) -> Community:
    db_comm = db.query(Community).filter(Community.name == name).first()
    if not db_comm:
        db_comm = Community(name=name)
        db.add(db_comm)
        db.commit()
        db.refresh(db_comm)
    return db_comm

# --- SETTINGS & GLOBALS ---

def get_world_context(db: Session) -> str:
    setting = db.query(Setting).filter(Setting.id == 1).first()
    return setting.world_context if setting else ""

def update_world_context(db: Session, context: str) -> str:
    setting = db.query(Setting).filter(Setting.id == 1).first()
    if not setting:
        setting = Setting(id=1, world_context=context)
        db.add(setting)
    else:
        setting.world_context = context
    db.commit()
    db.refresh(setting)
    return setting.world_context

# --- RESET & DELETIONS ---

def clear_posts(db: Session):
    db.query(Post).delete()
    db.commit()

def delete_character(db: Session, character_id: int) -> bool:
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char or char.is_user:
        return False
    
    # Delete direct messages involving this character
    db.query(DirectMessage).filter(
        (DirectMessage.sender_id == character_id) | 
        (DirectMessage.receiver_id == character_id)
    ).delete()
    
    # SQLAlchemy cascade will delete posts and conversation session
    db.delete(char)
    db.commit()
    return True

def delete_post(db: Session, post_id: int) -> bool:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        return False
    # SQLAlchemy cascade deletes child replies
    db.delete(post)
    db.commit()
    return True

# --- STORY LAYER OPERATIONS ---

def get_activity_logs(db: Session, limit: int = 50) -> list:
    return db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(limit).all()

def log_activity(db: Session, trigger_type: str, narrative_outcome: str, xp_gained: int, relationship_change: int, associated_character_id: int = None, associated_post_id: int = None, associated_dm_id: int = None) -> ActivityLog:
    db_log = ActivityLog(
        trigger_type=trigger_type,
        narrative_outcome=narrative_outcome,
        xp_gained=xp_gained,
        relationship_change=relationship_change,
        associated_character_id=associated_character_id,
        associated_post_id=associated_post_id,
        associated_dm_id=associated_dm_id,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_active_event(db: Session):
    return db.query(Event).filter(Event.status == "Active").first()

def create_event(db: Session, scenario_text: str, involved_character_ids: list) -> Event:
    # Resolve any existing active event
    active_ev = get_active_event(db)
    if active_ev:
        active_ev.status = "Resolved"
        db.commit()
        
    ids_str = ",".join(str(cid) for cid in involved_character_ids)
    db_event = Event(
        status="Active",
        scenario_text=scenario_text,
        involved_character_ids=ids_str
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

def resolve_event(db: Session, event_id: int, user_choice_text: str, resolution_text: str) -> Event:
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if db_event:
        db_event.status = "Resolved"
        db_event.user_choice_text = user_choice_text
        db_event.resolution_text = resolution_text
        db.commit()
        db.refresh(db_event)
    return db_event

def undo_last_activity(db: Session) -> dict:
    last_log = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).first()
    if not last_log:
        return {"status": "error", "message": "No activities to undo"}

    # Revert relationship score if any character was associated
    if last_log.associated_character_id and last_log.relationship_change != 0:
        char = db.query(Character).filter(Character.id == last_log.associated_character_id).first()
        if char:
            char.relationship_score = max(0, min(100, char.relationship_score - last_log.relationship_change))
            
    # Delete associated user timeline post/comment
    if last_log.associated_post_id:
        post = db.query(Post).filter(Post.id == last_log.associated_post_id).first()
        if post:
            db.delete(post)
            
    # Delete associated user direct message
    if last_log.associated_dm_id:
        dm = db.query(DirectMessage).filter(DirectMessage.id == last_log.associated_dm_id).first()
        if dm:
            db.delete(dm)
            
    # Delete the activity log itself
    db.delete(last_log)
    db.commit()
    return {"status": "success", "undone_type": last_log.trigger_type}

# --- NPC RELATIONSHIP GRAPH OPERATIONS ---

def get_character_relationships(db: Session, character_id: int) -> list:
    from backend.database import CharacterRelationship
    return db.query(CharacterRelationship).filter(
        (CharacterRelationship.character_a_id == character_id) |
        (CharacterRelationship.character_b_id == character_id)
    ).all()

def add_or_update_relationship(db: Session, char_a_id: int, char_b_id: int, rel_type: str, score: int = 70) -> CharacterRelationship:
    from backend.database import CharacterRelationship
    # Query bidirectionally
    rel = db.query(CharacterRelationship).filter(
        ((CharacterRelationship.character_a_id == char_a_id) & (CharacterRelationship.character_b_id == char_b_id)) |
        ((CharacterRelationship.character_a_id == char_b_id) & (CharacterRelationship.character_b_id == char_a_id))
    ).first()
    
    if rel:
        rel.relationship_type = rel_type
        rel.relationship_score = score
    else:
        rel = CharacterRelationship(
            character_a_id=char_a_id,
            character_b_id=char_b_id,
            relationship_type=rel_type,
            relationship_score=score
        )
        db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel

def clear_character_relationships(db: Session, character_id: int):
    from backend.database import CharacterRelationship
    db.query(CharacterRelationship).filter(
        (CharacterRelationship.character_a_id == character_id) |
        (CharacterRelationship.character_b_id == character_id)
    ).delete()
    db.commit()

def get_character_social_context(db: Session, character_id: int) -> str:
    from backend.database import CharacterRelationship, Character
    rels = db.query(CharacterRelationship).filter(
        (CharacterRelationship.character_a_id == character_id) |
        (CharacterRelationship.character_b_id == character_id)
    ).all()
    if not rels:
        return ""
    
    lines = []
    for rel in rels:
        other_id = rel.character_b_id if rel.character_a_id == character_id else rel.character_a_id
        other = db.query(Character).filter_by(id=other_id).first()
        if other:
            lines.append(f"{rel.relationship_type} of {other.name} ({other.handle})")
            
    if not lines:
        return ""
        
    char = db.query(Character).filter_by(id=character_id).first()
    name = char.name if char else "Character"
    return f"[ {name}'s Relationships: {', '.join(lines)} ]"

def get_character_relationship_context(db: Session, character_id: int) -> str:
    from backend.database import Character, Post, DirectMessage
    
    char = db.query(Character).filter_by(id=character_id).first()
    user = db.query(Character).filter_by(is_user=True).first()
    if not char or not user:
        return ""
        
    parts = []
    
    # 1. Your Focus / Target Relationship
    if char.target_relationship:
        parts.append(f"Relationship Focus: User is pursuing '{char.target_relationship}' relationship with {char.name}.")
    else:
        parts.append(f"Relationship Focus: Acquaintance / General interaction.")
        
    # 2. Relationship Score / Bond
    parts.append(f"Relationship Score: {char.relationship_score}/100 (Stance: {char.session.vibe if char.session else 'Neutral'})")
    
    # 3. Public Timeline Exchanges
    public_exchanges = []
    # Character replying to User
    char_replies = db.query(Post).filter(Post.author_id == character_id, Post.parent_id != None).all()
    for r in char_replies:
        parent = db.query(Post).filter_by(id=r.parent_id).first()
        if parent and parent.author_id == user.id:
            public_exchanges.append(f"- User: \"{parent.content}\" -> {char.name}: \"{r.content}\"")
            
    # User replying to Character
    user_replies = db.query(Post).filter(Post.author_id == user.id, Post.parent_id != None).all()
    for r in user_replies:
        parent = db.query(Post).filter_by(id=r.parent_id).first()
        if parent and parent.author_id == character_id:
            public_exchanges.append(f"- {char.name}: \"{parent.content}\" -> User: \"{r.content}\"")
            
    if public_exchanges:
        # Get last 5 exchanges
        recent_exchanges = public_exchanges[-5:]
        parts.append("Recent Public Post Exchanges:\n" + "\n".join(recent_exchanges))
    else:
        parts.append("Recent Public Post Exchanges: None.")
        
    # 4. DM Conversation History
    dms = db.query(DirectMessage).filter(
        ((DirectMessage.sender_id == user.id) & (DirectMessage.receiver_id == character_id)) |
        ((DirectMessage.sender_id == character_id) & (DirectMessage.receiver_id == user.id))
    ).order_by(DirectMessage.timestamp.asc()).all()
    
    if dms:
        dm_lines = []
        for dm in dms[-8:]:  # Get last 8 DMs
            sender_name = "User" if dm.sender_id == user.id else char.name
            dm_lines.append(f"- {sender_name}: \"{dm.content}\"")
        parts.append("Recent Direct Message (DM) History:\n" + "\n".join(dm_lines))
    else:
        parts.append("Recent Direct Message (DM) History: None.")
        
    # 5. Relationships with other characters in the community
    social_context = get_character_social_context(db, character_id)
    if social_context:
        parts.append(f"Relationships with other characters: {social_context}")
    else:
        parts.append("Relationships with other characters: None.")
        
    return "[ RELATIONSHIP & CONVERSATION CONTEXT ]\n" + "\n".join(parts) + "\n"


