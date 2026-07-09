import re
import datetime
import httpx
from backend.config import NOVELAI_API_KEY, NOVELAI_BASE_URL

# Default fallback values in case generation fails
DEFAULT_FALLBACK_POSTS = [
    {
        "name": "Daine",
        "handle": "@notdaine",
        "content": "writing songs on the bedroom floor at 3am is a lifestyle. new demos coming."
    },
    {
        "name": "Alex",
        "handle": "@alextunes",
        "content": "just listened to the new track Daine posted. absolute bedroom pop gold."
    }
]

def get_world_context_from_db() -> str:
    try:
        from backend.database import SessionLocal, Setting
        db = SessionLocal()
        try:
            setting = db.query(Setting).filter_by(id=1).first()
            return setting.world_context.strip() if (setting and setting.world_context) else ""
        finally:
            db.close()
    except Exception as e:
        print(f"[Error getting world context]: {e}")
        return ""

def get_overarching_narrative_from_db() -> str:
    try:
        from backend.database import SessionLocal, GameState
        db = SessionLocal()
        try:
            state = db.query(GameState).filter_by(id=1).first()
            return state.overarching_narrative.strip() if (state and state.overarching_narrative) else ""
        finally:
            db.close()
    except Exception as e:
        print(f"[Error getting overarching narrative]: {e}")
        return ""

def get_character_roster_from_db() -> str:
    try:
        from backend.database import SessionLocal, Character
        db = SessionLocal()
        try:
            chars = db.query(Character).filter(Character.is_user == False, Character.handle != "@popcraze").all()
            roster_lines = []
            for c in chars:
                # Include bio, name, handle, and gender context clues from bio
                roster_lines.append(f"- Name: {c.name} ({c.handle}) | Bio: {c.bio}")
            return "\n".join(roster_lines)
        finally:
            db.close()
    except Exception as e:
        print(f"[Error getting character roster]: {e}")
        return ""
def get_relationship_stage_info(target_rel: str) -> dict:
    if not target_rel:
        return {"stage_index": 0, "length_instruction": "Write a very short, brief DM reply (under 15 words).", "max_tokens": 50}
        
    val = target_rel.strip().lower()
    
    ROMANCE_FORWARD = ['online crush', 'flirting', 'sparks', 'seeing someone new', 'going steady', 'partner', 'sweetie', 'baby', 'lover', 'soulmate']
    ROMANCE_BACKWARD = ['crushed', 'jealous', "it's complicated", 'situationship', 'fighting', 'not working out', 'torn up', 'heartbreak', 'one that got away']
    HATE_FORWARD = ['hate follow', 'subtweeting', 'trolling', 'flame war', 'mutual hate', 'bitter rivals', 'nemesis', 'grudge', 'frenemies', 'toxic obsession']
    COLLAB_FORWARD = ['collab goal', 'networking', 'casual jam', 'making plans', 'studio session', 'co-writers', 'joint track', 'bandmates', 'creative partners', 'musical soulmates']
    
    # Find index in whichever list it exists
    idx = 0
    if val in ROMANCE_FORWARD:
        idx = ROMANCE_FORWARD.index(val)
    elif val in ROMANCE_BACKWARD:
        idx = ROMANCE_BACKWARD.index(val)
    elif val in HATE_FORWARD:
        idx = HATE_FORWARD.index(val)
    elif val in COLLAB_FORWARD:
        idx = COLLAB_FORWARD.index(val)
        
    if idx <= 2:
        return {"stage_index": idx, "length_instruction": "Write a very short, brief DM reply (under 15 words).", "max_tokens": 50}
    elif idx <= 5:
        return {"stage_index": idx, "length_instruction": "Write a concise DM reply (under 25 words).", "max_tokens": 80}
    elif idx <= 8:
        return {"stage_index": idx, "length_instruction": "Write a detailed and conversational DM reply (under 40 words).", "max_tokens": 120}
    else:
        return {"stage_index": idx, "length_instruction": "Write a long, deeply descriptive, and highly expressive DM reply (under 60 words).", "max_tokens": 180}

async def generate_spontaneous_dm(char_name: str, char_handle: str, char_bio: str, target_rel: str) -> str:
    """
    Generates a spontaneous direct message from a character at a high relationship stage.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    instruction = (
        f"{{ Generate a short, realistic, single direct message from {char_name} ({char_handle}) to the user. "
        f"The message must be consistent with their relationship stage: '{target_rel}' and their biography. "
        f"For romantic relationship stages (like partner, sweetie, baby, lover, soulmate), they should call the user a pet name, say they miss them, or ask about their day. "
        f"For collab relationship stages, they should ask about making music together, a new beat, or scheduling a jam. "
        f"For hate relationship stages, they should send a snarky, confrontational, or trolling message. "
        f"Write ONLY the direct message text. Do not include quotes, handles, or labels. }}"
    )
    
    prompt = (
        f"{wc_prefix}"
        f"{instruction}\n"
        f"Character: {char_name}\n"
        f"Bio: {char_bio}\n"
        f"Relationship Stage: {target_rel}\n"
        f"Message:"
    )
    try:
        raw_output = await generate_completion(prompt, max_tokens=60, temperature=0.85, log_type="Spontaneous DM")
        return raw_output.strip().replace('"', '')
    except Exception as e:
        print(f"[Error generating spontaneous DM]: {e}")
        # Fallback
        return "hey, just thinking about you. hope you're having a good day <3"


from datetime import datetime

# Global debug log list
DEBUG_LOGS = []

def log_debug_api_call(api_type: str, prompt: str, response: str, status: str = "success"):
    """
    Logs an API call. Keeps the last 50 calls in memory.
    """
    DEBUG_LOGS.append({
        "timestamp": datetime.now().isoformat(),
        "api_type": api_type,
        "prompt": prompt,
        "response": response,
        "status": status
    })
    # Keep only the last 50 calls
    if len(DEBUG_LOGS) > 50:
        DEBUG_LOGS.pop(0)

async def generate_completion(
    prompt: str,
    max_tokens: int = 150,
    temperature: float = 0.8,
    stop: list = None,
    log_type: str = "Completion"
) -> str:
    """
    Sends a completion request to the NovelAI OpenAI-compatible completions endpoint.
    """
    # Prepend overarching narrative if it is a gameplay prompt
    if log_type not in ("Update Narrative", "Daily Summary"):
        overarching = get_overarching_narrative_from_db()
        if overarching and not prompt.startswith("{ Overarching Story:"):
            prompt = f"{{ Overarching Story: {overarching} }}\n{prompt}"

    if not NOVELAI_API_KEY:
        # If API key is missing, log a warning and return mock/empty response to keep app running in offline dev mode
        print("[WARNING] NOVELAI_API_KEY is not set. Using empty string fallback.")
        log_debug_api_call(
            api_type=log_type,
            prompt=prompt,
            response="[WARNING] NOVELAI_API_KEY is not set. Returned empty string fallback.",
            status="warning"
        )
        return ""

    headers = {
        "Authorization": f"Bearer {NOVELAI_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "xialong-v1",
        "prompt": prompt,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.9,
    }
    if stop:
        payload["stop"] = stop

    url = f"{NOVELAI_BASE_URL}/completions"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            result = data["choices"][0]["text"]
            log_debug_api_call(
                api_type=log_type,
                prompt=prompt,
                response=result,
                status="success"
            )
            return result
    except httpx.HTTPStatusError as e:
        err_msg = f"[Error] NovelAI API returned error status {e.response.status_code}: {e.response.text}"
        print(err_msg)
        log_debug_api_call(
            api_type=log_type,
            prompt=prompt,
            response=err_msg,
            status="error"
        )
        raise e
    except Exception as e:
        err_msg = f"[Error] Failed to connect to NovelAI API: {e}"
        print(err_msg)
        log_debug_api_call(
            api_type=log_type,
            prompt=prompt,
            response=err_msg,
            status="error"
        )
        raise e

def parse_generated_posts(text: str) -> list:
    """
    Parses a batch of timeline posts generated by NovelAI.
    Standardizes '====' separators to '----' and discards redacted or malformed content.
    """
    # Replace alternative separators the AI might produce
    text = text.replace("====", "----")
    
    posts = []
    chunks = text.split("----")
    
    for chunk in chunks:
        lines = [line.strip() for line in chunk.split("\n") if line.strip()]
        if not lines:
            continue
            
        # Ignore chunks containing redactions or bracketed placeholders
        placeholder_pat = r'\[(?:reply|response|insert|write|text|content|comment|here).*?\]'
        if any("[REDACTED]" in line for line in lines) or any(re.search(placeholder_pat, line, re.IGNORECASE) for line in lines):
            continue
            
        # We search for the handle (starts with or contains '@')
        handle_idx = -1
        for i, line in enumerate(lines):
            if "@" in line:
                handle_idx = i
                break
        
        if handle_idx == -1:
            continue
            
        handle_line = lines[handle_idx]
        name = "Unknown"
        handle = "Unknown"
        
        # Check if handle line contains the name too (e.g. "daine @notdaine")
        if handle_line.strip().startswith("@"):
            if handle_idx > 0:
                name = lines[handle_idx - 1]
            handle = handle_line
        else:
            # Split on the @ symbol
            parts = handle_line.split("@", 1)
            name = parts[0].strip()
            handle = "@" + parts[1].strip()
            
        # Strip repost headers if any
        if "reposted:" in name.lower():
            name = name.split("reposted:")[0].strip()
            if not name and handle_idx > 1:
                name = lines[handle_idx - 2]

        if name == "Unknown" or "[REDACTED]" in name or not name:
            continue

        # Clean up handle: must start with @ and have only valid chars
        handle_match = re.search(r"@\w+", handle)
        if handle_match:
            handle = handle_match.group(0)
        else:
            continue # Ignore malformed handle records
            
        if "[REDACTED]" in handle:
            continue

        content_start_idx = handle_idx + 1
        if content_start_idx < len(lines) and (
            lines[content_start_idx].startswith("*") or 
            "XM" in lines[content_start_idx] or 
            "AM" in lines[content_start_idx] or 
            "PM" in lines[content_start_idx]
        ):
            content_start_idx += 1
            
        content_lines = lines[content_start_idx:]
        if not content_lines:
            continue
            
        content = "\n".join(content_lines)
        if not content.strip() or "[REDACTED]" in content:
            continue
            
        posts.append({
            "name": name,
            "handle": handle,
            "content": content
        })
        
    return posts

def parse_dm_response(text: str) -> dict:
    """
    Parses a DM response which is expected to follow the format:
    Vibe: [Vibe description]
    Intensity: [Vibe intensity %]
    Message: [The message text]
    
    Returns a dict: {"vibe": str, "intensity": int, "text": str}
    """
    vibe = "Neutral"
    intensity = 50
    message = text.strip()

    # Try matching lines
    vibe_match = re.search(r"Vibe:\s*(.*)", text, re.IGNORECASE)
    intensity_match = re.search(r"Intensity:\s*(\d+)", text, re.IGNORECASE)
    message_match = re.search(r"Message:\s*([\s\S]*)", text, re.IGNORECASE)

    if vibe_match:
        vibe = vibe_match.group(1).strip()
    if intensity_match:
        try:
            intensity = int(intensity_match.group(1).strip())
            # bound check
            intensity = max(0, min(100, intensity))
        except ValueError:
            pass
    if message_match:
        message = message_match.group(1).strip()
    else:
        # If Message: tag wasn't found but we got other tags, clean up the text
        # by removing Vibe: and Intensity: lines
        cleaned = []
        for line in text.split("\n"):
            if not (line.lower().startswith("vibe:") or line.lower().startswith("intensity:") or line.lower().startswith("message:")):
                cleaned.append(line)
        message = "\n".join(cleaned).strip()

    return {
        "vibe": vibe,
        "intensity": intensity,
        "text": message
    }

def format_tweet_history(name: str, handle: str, tweet_history: str) -> str:
    """
    Formats a raw tweet history string (one tweet per line) into the standard structured format:
    Name @handle
    * 00:00 AM
    Tweet content
    ----
    """
    if not tweet_history:
        return ""
    
    # Split by newlines and clean
    lines = [line.strip() for line in tweet_history.split("\n") if line.strip()]
    formatted_posts = []
    
    # Generate some slightly varied times to make it look realistic
    hours = [3, 8, 11, 2, 6, 10]
    minutes = [15, 30, 45, 12, 20, 55]
    meridians = ["AM", "PM", "AM", "PM", "AM", "PM"]
    
    for idx, content in enumerate(lines):
        # Skip separator lines or headers if they got in there
        if content == "----" or content == "====" or content.startswith("*@"):
            continue
            
        h = hours[idx % len(hours)]
        m = minutes[idx % len(minutes)]
        mer = meridians[idx % len(meridians)]
        time_str = f"{h:02d}:{m:02d} {mer}"
        
        # Format name and handle on the same line
        formatted_posts.append(f"{name} {handle}\n* {time_str}\n{content}\n----")
        
    return "\n".join(formatted_posts) + "\n"

async def generate_timeline_posts(community_name: str, seed_history: str = "") -> list:
    """
    Generates new posts for a specific community. Incorporates world context.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    # Fetch active characters to construct instruction prompt
    active_handles = []
    try:
        from backend.database import SessionLocal, Character
        db = SessionLocal()
        try:
            chars = db.query(Character).filter(Character.is_user == False, Character.handle != "@popcraze").all()
            active_handles = [c.handle for c in chars]
        finally:
            db.close()
    except Exception:
        pass

    if active_handles:
        handles_str = ", ".join(active_handles)
        instruction = (
            f"{{ Generate a batch of short, realistic, single-perspective Twitter/X timeline posts about {community_name}. "
            f"Do not write dialogue scripts, play scripts, or conversations between multiple users. "
            f"Write posts for some of the following active users: {handles_str}."
            f"Each post must follow the exact format of the examples below, separated by '----'. }}"
        )
    else:
        instruction = (
            f"{{ Generate a batch of short, realistic, single-perspective Twitter/X timeline posts about {community_name}. "
            f"Do not write dialogue scripts, play scripts, or conversations between multiple users. "
            f"Each post must follow the exact format of the examples below, separated by '----'. }}"
        )
    
    prompt = f"{wc_prefix}{instruction}\n"
    
    # Format and shuffle seed history to guide the model cleanly
    seed_posts = []
    if seed_history:
        # Standardize separators and split
        normalized = seed_history.replace("====", "----")
        raw_chunks = normalized.split("----")
        for chunk in raw_chunks:
            cleaned_chunk = chunk.strip()
            if cleaned_chunk:
                seed_posts.append(cleaned_chunk)
                
    if seed_posts:
        import random
        random.shuffle(seed_posts)
        # Select up to 5 posts to keep prompt compact and fast
        selected_seeds = seed_posts[:5]
        prompt += "{ Post Style Examples:\n" + "\n----\n".join(selected_seeds) + " }\n"
    else:
        # Default seed format to guide the model if seed history is missing
        prompt += (
            "{ Post Style Examples:\n"
            "daine @notdaine\n* 03:15 AM\nwriting songs on the bedroom floor at 3am is a lifestyle. new demos soon.\n----\n"
            "Ella @moviesforguyss\n* 03:15 PM\nSobbing my eyes out listening to don't mind me by Quadeca. hits way too hard today.\n }"
        )
    
    try:
        raw_output = await generate_completion(prompt, max_tokens=300, temperature=0.85, log_type="Timeline Posts")
        if not raw_output:
            return DEFAULT_FALLBACK_POSTS
        parsed = parse_generated_posts(raw_output)
        return parsed
    except Exception:
        return DEFAULT_FALLBACK_POSTS

async def summarize_older_dms(char_name: str, older_dms: list) -> str:
    """
    Calls NovelAI to summarize direct messages older than the last 30.
    """
    history_str = ""
    for msg in older_dms:
        history_str += f"- {msg['sender']}: \"{msg['content']}\"\n"
        
    instruction = (
        f"{{ Summarize the following direct message exchange between User and {char_name} in a brief 1-2 sentence paragraph. "
        f"Focus on the main topics discussed, agreements reached, and the general tone. Write only the summary. }}"
    )
    prompt = f"{instruction}\n{{ Direct Messages:\n{history_str} }}\nSummary:"
    try:
        raw_output = await generate_completion(prompt, max_tokens=100, temperature=0.7, log_type="Conversation Summary")
        return raw_output.strip().replace('"', '')
    except Exception as e:
        print(f"[Error summarizing older DMs]: {e}")
        return ""

async def generate_dm_reply(char_name: str, char_handle: str, char_bio: str, char_avatar_alt: str, tweet_history: str, message_history: list) -> dict:
    """
    Generates a DM reply using the custom Vibe/Intensity format, incorporating world context.
    message_history is a list of dicts: [{'sender': str, 'content': str}]
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    # Fetch social relationship context
    relationship_context = ""
    older_summary = ""
    target_rel = None
    try:
        from backend.database import SessionLocal, Character, DirectMessage, ConversationSession
        from backend.crud import get_character_relationship_context
        db = SessionLocal()
        try:
            char = db.query(Character).filter_by(handle=char_handle).first()
            user = db.query(Character).filter_by(is_user=True).first()
            if char and user:
                target_rel = char.target_relationship
                relationship_context = get_character_relationship_context(db, char.id)
                
                # Fetch all messages in the thread ordered chronologically (ascending)
                all_dms = db.query(DirectMessage).filter(
                    ((DirectMessage.sender_id == user.id) & (DirectMessage.receiver_id == char.id)) |
                    ((DirectMessage.sender_id == char.id) & (DirectMessage.receiver_id == user.id))
                ).order_by(DirectMessage.timestamp.asc()).all()
                
                session = db.query(ConversationSession).filter_by(character_id=char.id).first()
                
                if len(all_dms) > 30 and session:
                    older_dms = all_dms[:-30]
                    # Regenerate summary if the number of older messages changed or summary is missing
                    if session.summarized_msg_count != len(older_dms) or not session.conversation_summary:
                        formatted_older = []
                        for msg in older_dms:
                            s_name = "User" if msg.sender_id == user.id else char_name
                            formatted_older.append({
                                "sender": s_name,
                                "content": msg.content
                            })
                        
                        summary = await summarize_older_dms(char_name, formatted_older)
                        session.conversation_summary = summary
                        session.summarized_msg_count = len(older_dms)
                        db.commit()
                        
                    older_summary = session.conversation_summary
                elif session and session.conversation_summary:
                    # Clear summary if DMs were rolled back or deleted below 30
                    session.conversation_summary = ""
                    session.summarized_msg_count = 0
                    db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"[Error loading or updating older DMs summary]: {e}")
        
    history_str = ""
    for msg in message_history:
        history_str += f"{msg['sender']}: {msg['content']}\n"

    # Detect if the player's most recent message contains an image — if so, allow the character to share one back
    last_user_msg = next((m["content"] for m in reversed(message_history) if "User" in m.get("sender", "")), "")
    player_sent_image = "[image:" in last_user_msg.lower()
    image_instruction = (
        " The player has shared an image. You may optionally share an image back by including [image: your description] anywhere in your Message — describe something personal or relevant to the conversation."
        if player_sent_image else ""
    )

    alt_text_str = f"{{ Character Appearance Description: {char_avatar_alt} }}\n" if char_avatar_alt else ""
    
    stage_info = get_relationship_stage_info(target_rel)
    instruction = f"{{ Generate the next direct message reply in the following chat. Write your reply as a structured block detailing the character's internal vibe, the intensity of that vibe, and the chat response. {stage_info['length_instruction']}{image_instruction} }}"
    
    open_brace = "{"
    close_brace = "}"

    summary_str = f"{{ Summary of older conversation:\n{older_summary} }}\n" if older_summary else ""

    prompt = (
        f"{wc_prefix}"
        f"{relationship_context}"
        f"{instruction}\n"
        f"Character: {char_name} ({char_handle})\n"
        f"Bio: {char_bio}\n"
        f"{alt_text_str}"
        f"\n{{ {char_name}'s Post Style Examples:\n"
        f"{tweet_history} }}\n"
        f"{summary_str}"
        f"Message History:\n"
        f"{history_str}"
        f"\n{open_brace}Response Format:\n"
        f"Vibe: [Describe the character's emotional subtext, e.g., \"flustered yet amused\"]\n"
        f"Intensity: [An integer from 0 to 100 representing intensity]\n"
        f"Message: [The message text]{close_brace}\n\n"
        f"Response:\n"
        f"Vibe:"
    )
    
    try:
        raw_output = await generate_completion(prompt, max_tokens=stage_info['max_tokens'], temperature=0.75, stop=[f"\n{char_name}", "\nMessage History:"], log_type="DM Reply")
        # Since we prefilled "Vibe:", prepend it back to raw_output to parse correctly
        full_text = "Vibe:" + raw_output
        return parse_dm_response(full_text)
    except Exception:
        # Safe fallback
        return {
            "vibe": "Slightly flustered",
            "intensity": 60,
            "text": "Uh, sorry, my signal cut out for a second. What were we saying?"
        }

async def generate_thread_reply(
    char_name: str, 
    char_handle: str, 
    char_bio: str, 
    tweet_history: str, 
    thread_history: list,
    replying_to_user: bool = False,
    user_handle: str = "@playerone"
) -> str:
    """
    Generates a single character's reply to an existing timeline thread, incorporating world context.
    thread_history is a list of dicts: [{'handle': str, 'content': str}]
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    # Fetch social relationship context
    relationship_context = ""
    try:
        from backend.database import SessionLocal, Character
        from backend.crud import get_character_relationship_context
        db = SessionLocal()
        try:
            char = db.query(Character).filter_by(handle=char_handle).first()
            if char:
                relationship_context = get_character_relationship_context(db, char.id)
        finally:
            db.close()
    except Exception:
        pass
        
    history_str = ""
    for post in thread_history:
        history_str += f"{post['handle']}: {post['content']}\n"
        
    if replying_to_user:
        instruction = f"{{ Below is an online social media thread. Write a reply from {char_name} ({char_handle}) directly replying to the user ({user_handle}). Start your reply by mentioning {user_handle}. Keep it short, conversational, and in character. }}"
        prefill = f"{char_handle}: {user_handle}"
    else:
        instruction = f"{{ Below is an online social media thread. Write a reply from {char_name} ({char_handle}) reacting to the conversation. Keep it short, conversational, and in character. }}"
        prefill = f"{char_handle}:"
    
    prompt = (
        f"{wc_prefix}"
        f"{relationship_context}"
        f"{instruction}\n"
        f"Character: {char_name} ({char_handle})\n"
        f"Bio: {char_bio}\n"
        f"\n{{ {char_name}'s Post Style Examples:\n"
        f"{tweet_history} }}\n"
        f"Thread:\n"
        f"{history_str}"
        f"{prefill}"
    )
    
    try:
        raw_output = await generate_completion(prompt, max_tokens=80, temperature=0.8, stop=["\n@", "\n----"], log_type="Thread Reply")
        reply = raw_output.strip()
        
        # Check for bracketed placeholders like [reply here] or [insert response]
        placeholder_pat = r'\[(?:reply|response|insert|write|text|content|comment|here).*?\]'
        if re.search(placeholder_pat, reply, re.IGNORECASE) or not reply:
            # Fallback attempt with a lower temperature
            raw_output = await generate_completion(prompt, max_tokens=80, temperature=0.5, stop=["\n@", "\n----"], log_type="Thread Reply (Retry)")
            reply = raw_output.strip()
                
        if replying_to_user:
            # Check if the generated output already starts with or includes the handle to avoid repetition
            if not reply.startswith(user_handle) and not reply.startswith("@"):
                reply = f"{user_handle} {reply}"
        return reply
    except Exception:
        if replying_to_user:
            return f"{user_handle} wait, really?"
        return "wait, really?"

async def generate_gossip_headline(char_a_name: str, char_b_name: str, recent_event_summary: str = "") -> str:
    """
    Generates a dramatic pop-culture gossip headline about two characters, incorporating world context.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"[ World Context: {world_context} ]\n" if world_context else ""
    
    # Look up if there is a recorded relationship between Person A and Person B
    relationship_context = ""
    try:
        from backend.database import SessionLocal, Character, CharacterRelationship
        db = SessionLocal()
        try:
            char_a = db.query(Character).filter(Character.name.like(f"%{char_a_name}%")).first()
            char_b = db.query(Character).filter(Character.name.like(f"%{char_b_name}%")).first()
            if char_a and char_b:
                rel = db.query(CharacterRelationship).filter(
                    ((CharacterRelationship.character_a_id == char_a.id) & (CharacterRelationship.character_b_id == char_b.id)) |
                    ((CharacterRelationship.character_a_id == char_b.id) & (CharacterRelationship.character_b_id == char_a.id))
                ).first()
                if rel:
                    relationship_context = f"[ Relationship Context: {char_a_name} and {char_b_name} are: {rel.relationship_type}s ]\n"
        finally:
            db.close()
    except Exception:
        pass
    
    instruction = "{Generate a dramatic pop-culture gossip headline about the recent interactions between the two mentioned people. Keep it scandalous and under 25 words. Do not use quotes.}"
    
    prompt = (
        f"{wc_prefix}"
        f"{relationship_context}"
        f"{instruction}\n"
        f"Person A: {char_a_name}\n"
        f"Person B: {char_b_name}\n"
    )
    if recent_event_summary:
        prompt += f"Context: {recent_event_summary}\n"
    prompt += "Headline:"
    
    try:
        raw_output = await generate_completion(prompt, max_tokens=40, temperature=0.85, stop=["\n"], log_type="Gossip Headline")
        return raw_output.strip()
    except Exception:
        return f"EXCLUSIVE: Rumors swirling about {char_a_name} and {char_b_name} after a mysterious studio sighting last night!"

async def generate_narrative_outcome(context_desc: str, user_reply: str) -> str:
    """
    Generates a single dramatic sentence outcome of the user's latest interaction.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    instruction = "{ Generate a single, stylish, and dramatic sentence describing the narrative outcome of the user's latest message in this conversation. Write ONLY the sentence. Do not add quotes. }"
    
    prompt = (
        f"{wc_prefix}"
        f"{instruction}\n"
        f"{{ Context: {context_desc} }}\n"
        f"User Reply: {user_reply}\n"
        f"Outcome:"
    )
    try:
        raw_output = await generate_completion(prompt, max_tokens=50, temperature=0.8, stop=["\n"], log_type="Narrative Outcome")
        return raw_output.strip().replace('"', '')
    except Exception:
        return "The digital air shifted slightly as the community took note of the player's response."

async def generate_social_event(characters_info: list) -> str:
    """
    Generates a social dilemma event scenario involving 1-3 characters.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    roster = get_character_roster_from_db()
    roster_str = f"{{ Scene Character Roster:\n{roster} }}\n" if roster else ""
    
    char_details = ""
    char_names = []
    for char in characters_info:
        char_details += f"Character: {char['name']} ({char['handle']})\nBio: {char['bio']}\n"
        char_names.append(char['name'])
        
    names_str = " and ".join(char_names)
    
    user_name = "You"
    try:
        from backend.database import SessionLocal, Character
        db = SessionLocal()
        try:
            user = db.query(Character).filter_by(is_user=True).first()
            if user:
                user_name = user.name
        finally:
            db.close()
    except Exception:
        pass

    instruction = (
        f"{{ Write an immersive, dramatic, and concise scene set in the music scene involving You ({user_name}) and {names_str}. "
        f"Do NOT write outline bullet points, planning notes, character perspectives, meta outlines, or list headings. "
        f"Instead, write a single fluid, stylish story paragraph (under 120 words) depicting the event, setting, and actions in real-time. "
        f"Conclude the paragraph with a direct question asking You ({user_name}) what choice you will make to resolve this difficult social choice. }}"
    )
    
    prompt = (
        f"{wc_prefix}"
        f"{roster_str}"
        f"{instruction}\n"
        f"{{ Example Format:\n"
        f"Event: You ({user_name}) find yourself at the Echo Park record store where Darcy is arguing with the clerk about an indie vinyl. "
        f"Max is sitting on a speaker nearby, looking completely bored and zoning out. "
        f"When Darcy spots you, she gestures for you to come over and take her side in the argument, but Max shoots you a text saying 'don't get involved, let's just go grab tacos.' "
        f"What will you, {user_name}, do? }}\n\n"
        f"{char_details}\n"
        f"Event:"
    )
    try:
        raw_output = await generate_completion(prompt, max_tokens=250, temperature=0.85, log_type="Social Dilemma Scenario")
        return raw_output.strip()
    except Exception:
        return f"A rumor starts circulating that Soren and Pop Craze are collaborating secretly. You notice them whispering in the green room. What will you, {user_name}, do?"

async def generate_event_resolution(scenario_text: str, user_action: str) -> dict:
    """
    Based on user's action, describes the outcome in a stylish paragraph.
    Explicitly classifies the relationship impact as POSITIVE, NEGATIVE, or NEUTRAL.
    Returns a dict: {"text": str, "impact": str}
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    roster = get_character_roster_from_db()
    roster_str = f"{{ Scene Character Roster:\n{roster} }}\n" if roster else ""
    
    user_name = "You"
    try:
        from backend.database import SessionLocal, Character
        db = SessionLocal()
        try:
            user = db.query(Character).filter_by(is_user=True).first()
            if user:
                user_name = user.name
        finally:
            db.close()
    except Exception:
        pass

    instruction = (
        f"{{ Based on the user's chosen action, describe the outcome of this scenario in a stylish, narrative paragraph. "
        f"At the very end of your response, on a new line, explicitly declare the relationship impact in the format: 'Impact: [POSITIVE]' "
        f"if the action would improve relationship/bond, 'Impact: [NEGATIVE]' if it hurts relationship/reputation, "
        f"or 'Impact: [NEUTRAL]' if it is mixed or has no net impact. }}"
    )
    
    prompt = (
        f"{wc_prefix}"
        f"{roster_str}"
        f"{instruction}\n"
        f"{{ Scenario: {scenario_text} }}\n"
        f"User Action: {user_action}\n"
        f"{{ Example Format:\n"
        f"Resolution: Darcy smiles and feels supported by your choice.\n"
        f"Impact: [POSITIVE] }}\n\n"
        f"Resolution:"
    )
    
    fallback = {
        "text": "Your action resolved the crisis, moving the scene forward.",
        "impact": "NEUTRAL"
    }
    
    try:
        raw_output = await generate_completion(prompt, max_tokens=200, temperature=0.8, log_type="Social Dilemma Resolution")
        text = raw_output.strip()
        
        # Parse Impact
        impact = "NEUTRAL"
        if "Impact: [POSITIVE]" in text:
            impact = "POSITIVE"
        elif "Impact: [NEGATIVE]" in text:
            impact = "NEGATIVE"
        elif "Impact: [NEUTRAL]" in text:
            impact = "NEUTRAL"
            
        # Clean text by removing Impact line
        cleaned_lines = []
        for line in text.split("\n"):
            if "impact:" not in line.lower() and "resolution:" not in line.lower():
                cleaned_lines.append(line)
        cleaned_text = "\n".join(cleaned_lines).strip()
        
        # Fallback to original text if cleanup empties it
        if not cleaned_text:
            cleaned_text = text
            
        return {
            "text": cleaned_text,
            "impact": impact
        }
    except Exception as e:
        print(f"[Error generating event resolution]: {e}")
        return fallback

async def generate_new_ai_character(community_name: str) -> dict:
    """
    Generates a brand new AI character active in the community, including name, handle, bio, and first post.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    prompt = (
        f"{wc_prefix}"
        f"{{ Generate a brand new, highly realistic and interesting character active in the {community_name} community, "
        f"along with their first social media post. Do not use any existing predefined characters. "
        f"Return the profile in the exact format shown below. Keep the handle creative and unique, starting with @. "
        f"Do not write dialogue scripts or conversations. }}\n"
        f"Format:\n"
        f"Name: [Full Name]\n"
        f"Handle: @[username]\n"
        f"Bio: [A short 1-2 sentence bio describing their style, background, or behavior]\n"
        f"Post: [A short, stylish, single-perspective post reflecting their style]\n"
    )
    
    raw_output = await generate_completion(prompt, max_tokens=200, temperature=0.85, log_type="Generate New NPC Profile")
    
    name = ""
    handle = ""
    bio = ""
    post_content = ""
    
    for line in raw_output.split("\n"):
        line = line.strip()
        if line.lower().startswith("name:"):
            name = line[5:].strip()
        elif line.lower().startswith("handle:"):
            handle = line[7:].strip()
        elif line.lower().startswith("bio:"):
            bio = line[4:].strip()
        elif line.lower().startswith("post:"):
            post_content = line[5:].strip()
            
    # Remove surrounding brackets/quotes from post content if any
    post_content = post_content.replace('"', '').strip()
    
    if not name or not handle or not post_content:
        import random
        num = random.randint(100, 999)
        name = f"Vibe Seeker {num}"
        handle = f"@vibeseeker{num}"
        bio = f"Floating through the LA art scene in search of good energy."
        post_content = "another night, another gallery opening. the scene is alive."
        
    return {
        "name": name,
        "handle": handle,
        "bio": bio,
        "content": post_content
    }

async def generate_single_character_post(char_name: str, char_handle: str, char_bio: str, tweet_history: str, community_name: str) -> str:
    """
    Generates a single post for an existing character, incorporating their full profile and tweet history.
    """
    world_context = get_world_context_from_db()
    wc_prefix = f"{{ World Context: {world_context} }}\n" if world_context else ""
    
    instruction = (
        f"{{ Generate a single, short, realistic, single-perspective Twitter/X timeline post by {char_name} ({char_handle}) "
        f"who is part of the {community_name} community. "
        f"The post must match their personality, bio, and style of previous posts. "
        f"Write ONLY the post content. Do not write dialogue scripts, play scripts, or conversations between multiple users. "
        f"Do not include their name, handle, timestamp, or any quotes. Write only the post itself. }}"
    )
    
    prompt = (
        f"{wc_prefix}"
        f"{instruction}\n"
        f"Character: {char_name}\n"
        f"Handle: {char_handle}\n"
        f"Bio: {char_bio}\n"
    )
    if tweet_history:
        lines = [line.strip() for line in tweet_history.split("\n") if line.strip()]
        clean_lines = []
        for line in lines:
            if line in ("----", "====", ">", "New Post:"):
                continue
            if line.startswith("@") or line.startswith("*"):
                continue
            if line.lower() == char_name.lower():
                continue
            if "Only write the content" in line or "(Only write" in line:
                continue
            # Strip leading/trailing formatting characters
            line = line.strip('"-* ')
            if line:
                clean_lines.append(line)
        if clean_lines:
            prompt += "\n{{ Previous Posts:\n"
            for cl in clean_lines:
                prompt += f"- {cl}\n"
            prompt += " }}\n"
    prompt += "\nNew Post:\n-"
    
    raw_output = await generate_completion(prompt, max_tokens=60, temperature=0.85, log_type="Timeline Posts")
    
    # Strip any leading hyphens, quotes, or whitespace
    result = raw_output.strip().strip('"-* ')
    return result

async def generate_daily_summary(posts_text: str, actions_text: str) -> str:
    overarching = get_overarching_narrative_from_db()
    narrative_prefix = f"{{ Overarching Story: {overarching} }}\n" if overarching else ""
    
    instruction = (
        "{ Write a concise, realistic, and highly stylized 2-3 sentence diary summary of today's social events and music scene drama. "
        "Base it on the following timeline posts and user actions. Do not use generic filler text or bullet points. Write only the summary. }"
    )
    prompt = (
        f"{narrative_prefix}"
        f"{instruction}\n"
        f"{{ Timeline Posts:\n{posts_text} }}\n"
        f"{{ User Actions:\n{actions_text} }}\n"
        f"Summary:"
    )
    try:
        raw_output = await generate_completion(prompt, max_tokens=150, temperature=0.8, log_type="Daily Summary")
        return raw_output.strip().replace('"', '')
    except Exception:
        return "The day passed with quiet beats and keyboard yaps. You worked on your music track and chatted with Soren."

async def generate_updated_narrative(old_narrative: str, daily_summary: str) -> str:
    instruction = (
        "{ Update the following overarching story of the music scene simulator to seamlessly integrate today's events. "
        "Merge them into a single, cohesive, dramatic narrative arc. Keep the final narrative under 150 words. Do not write list entries. }"
    )
    prompt = (
        f"{instruction}\n"
        f"Current Overarching Story:\n{old_narrative}\n"
        f"Today's Events:\n{daily_summary}\n"
        f"Updated Story:"
    )
    try:
        raw_output = await generate_completion(prompt, max_tokens=250, temperature=0.75, log_type="Update Narrative")
        return raw_output.strip().replace('"', '')
    except Exception:
        return f"{old_narrative} {daily_summary}"

