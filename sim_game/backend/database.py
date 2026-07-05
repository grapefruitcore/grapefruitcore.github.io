# ==============================================================================
# CRITICAL RULE FOR DEVELOPERS & AI AGENTS:
# NEVER change character persona details (names, handles, bios, tweet_history, 
# avatar descriptions) when editing the codebase. Do NOT summarize, rewrite, 
# or generate new biographies or tweet histories. These must remain preserved exactly as is.
# ==============================================================================
import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from backend.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    handle = Column(String, unique=True, index=True, nullable=False)
    bio = Column(String, nullable=False)
    is_predefined = Column(Boolean, default=False)
    is_user = Column(Boolean, default=False)
    relationship_score = Column(Integer, default=0)
    following = Column(Boolean, default=False)
    target_relationship = Column(String, nullable=True)
    avatar_path = Column(String, nullable=True)
    avatar_alt_text = Column(String, nullable=True)
    tweet_history = Column(Text, nullable=True)

    # Relationships
    posts = relationship("Post", back_populates="author", foreign_keys="Post.author_id", cascade="all, delete-orphan")
    session = relationship("ConversationSession", back_populates="character", uselist=False, cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("posts.id"), nullable=True)

    # Relationships
    author = relationship("Character", back_populates="posts", foreign_keys=[author_id])
    community = relationship("Community", back_populates="posts")
    parent = relationship("Post", back_populates="replies", remote_side=[id])
    replies = relationship("Post", back_populates="parent", cascade="all, delete-orphan")

class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    vibe = Column(String, nullable=True)
    intensity = Column(Integer, nullable=True)

    sender = relationship("Character", foreign_keys=[sender_id])
    receiver = relationship("Character", foreign_keys=[receiver_id])

class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), unique=True, nullable=False)
    vibe = Column(String, default="Neutral")
    intensity = Column(Integer, default=50)
    replies_left = Column(Integer, default=5)

    character = relationship("Character", back_populates="session")

class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    posts = relationship("Post", back_populates="community")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    trigger_type = Column(String, nullable=False)  # 'DM', 'Thread_Reply', 'Event_Choice'
    narrative_outcome = Column(Text, nullable=False)
    xp_gained = Column(Integer, default=0)
    relationship_change = Column(Integer, default=0)
    associated_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    associated_post_id = Column(Integer, ForeignKey("posts.id", ondelete="SET NULL"), nullable=True)
    associated_dm_id = Column(Integer, ForeignKey("direct_messages.id", ondelete="SET NULL"), nullable=True)

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="Active")  # 'Active', 'Resolved'
    scenario_text = Column(Text, nullable=False)
    involved_character_ids = Column(String, nullable=False)  # comma-separated string, e.g., "2,3"
    user_choice_text = Column(Text, nullable=True)
    resolution_text = Column(Text, nullable=True)

class CharacterRelationship(Base):
    __tablename__ = "character_relationships"

    id = Column(Integer, primary_key=True, index=True)
    character_a_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    character_b_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String, nullable=False)  # 'Friend', 'Ex-partner', 'Collaborator', 'Bandmate', 'Rival'
    relationship_score = Column(Integer, default=50)

    character_a = relationship("Character", foreign_keys=[character_a_id])
    character_b = relationship("Character", foreign_keys=[character_b_id])

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    world_context = Column(Text, default="")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if settings exist
        settings = db.query(Setting).filter_by(id=1).first()
        if not settings:
            settings = Setting(id=1, world_context="")
            db.add(settings)
            db.commit()

        # Check if default community exists
        default_comm = db.query(Community).filter_by(name="Underground Music").first()
        if not default_comm:
            default_comm = Community(name="Underground Music")
            db.add(default_comm)
            db.commit()
            db.refresh(default_comm)
            
        # Check if User exists
        user_char = db.query(Character).filter_by(is_user=True).first()
        if not user_char:
            user_char = Character(
                name="You",
                handle="@playerone",
                bio="An aspiring producer and music enthusiast looking for connection in the local scene.",
                is_predefined=False,
                is_user=True,
                relationship_score=-1, # user has special/no score
                avatar_path="/static/default_user.png",
                avatar_alt_text="A friendly looking avatar of the player",
                tweet_history=""
            )
            db.add(user_char)
            db.commit()

        # Check if default character (Daine) exists
        daine = db.query(Character).filter_by(handle="@notdaine").first()
        if not daine:
            daine = Character(
                name="Daine",
                handle="@notdaine",
                bio="Independent alternative singer, songwriter, and producer blending emo, cloud rap, and bedroom pop. Making music from the bedroom floor.",
                is_predefined=True,
                is_user=False,
                relationship_score=20,
                following=True,
                avatar_path="/static/daine.png",
                avatar_alt_text="A moody close-up photo of Daine, soft flash lighting, cool-toned retro filter.",
                tweet_history="daine @notdaine\n* 03:15 AM\nwriting songs on the bedroom floor at 3am is a lifestyle. new demos soon.\n----\ndaine @notdaine\n* 01:24 PM\ntired of the algorithm hiding my music. real support is in the DMs.\n----\ndaine @notdaine\n* 08:45 PM\nmelancholy and 808s. that's the whole album.\n----\n"
            )
            db.add(daine)
            db.commit()
            db.refresh(daine)

            # Create default session for Daine
            session = ConversationSession(
                character_id=daine.id,
                vibe="Introspective and soft",
                intensity=40,
                replies_left=5
            )
            db.add(session)
            db.commit()

        # Check if "Pop Craze" bot character exists
        pop_craze = db.query(Character).filter_by(handle="@popcraze").first()
        if not pop_craze:
            pop_craze = Character(
                name="Pop Craze Gossip",
                handle="@popcraze",
                bio="Your #1 source for scene drama, relationship updates, and music community gossip. Spotted in the wild!",
                is_predefined=True,
                is_user=False,
                relationship_score=-1,
                following=True,
                avatar_path="/static/popcraze.png",
                avatar_alt_text="A shiny neon pink camera lens icon with flash sparks",
                tweet_history="Pop Craze Gossip @popcraze\n* 04:00 PM\nEXCLUSIVE: Rumors are flying in the underground scene! Who was spotted leaving the club together last night?\n----\n"
            )
            db.add(pop_craze)
            db.commit()

        # Seed Darcy and his network
        network = [
            {
                "name": "Darcy",
                "handle": "@darcyebaylis",
                "bio": "Darcy is a 31 year old artist, songwriter, singer and producer, originally from Melbourne, but now based in LA. He makes solo music that combines emo and trance influences, and he is in a band called Car Underwater. Darcy has a storied past; he's sensitive and grew up in an abusive household. However, since getting sober from a long-running drug addiction in his twenties, he's been doing a lot better. Darcy is chronically online but not as much of an attention-seeker now. Friend and frequent collaborator with Daine and Ninajirachi.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Close-up of Darcy looking creative",
                "tweet_history": "Darcy @darcyebaylis\n* 02:15 AM\nnew demo mixing Emo with Trance synthesizers, what do we think?\n----\n"
            },
            {
                "name": "Caroline Calloway",
                "handle": "@carolinecalloway",
                "bio": "Writer, scammer, and terrible friend. Dated Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Caroline looking artistic in a museum",
                "tweet_history": "Caroline Calloway @carolinecalloway\n* 11:15 AM\nart is scamming people into feeling something. buy my paintings.\n----\n"
            },
            {
                "name": "Christina",
                "handle": "@avgcowgirl",
                "bio": "LA visual creator. Active in right-wing online communities. Dated Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Christina in a cowgirl hat holding a vintage camera",
                "tweet_history": "Christina @avgcowgirl\n* 04:30 PM\nanalogue grain is the only way to save visual media from the bots.\n----\n"
            },
            {
                "name": "Ninajirachi",
                "handle": "@ninajirachi",
                "bio": "Australian electronic producer, songwriter, and DJ. Friend and frequent collaborator with fellow Australian artists Daine and Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Nina in neon lights behind a turntable",
                "tweet_history": "Ninajirachi @ninajirachi\n* 01:45 AM\ncollaborating with daine is always a vibe, wait until you hear the synth loop we just cooked.\n----\n"
            },
            {
                "name": "Zo",
                "handle": "@quannnic",
                "bio": "Alternative shoegaze artist and music producer based in LA. In a band called Car Underwater with Darcy and Max.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Zo in a fuzzy sweater standing in a dark room",
                "tweet_history": "Zo @quannnic\n* 10:20 PM\nrehearsing with darcy for the LA gig. our new track is loud shoegaze trance.\n----\n"
            },
            {
                "name": "Max",
                "handle": "@photgraphicmemory",
                "bio": "LA-based visual designer, photographer, and experimental musician. In a band called Car Underwater with Darcy and Zo.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Max behind a camera flash, motion blur filter",
                "tweet_history": "Max @photgraphicmemory\n* 08:12 PM\nvisuals for our band Car Underwater are done. Darcy's vocals on track 4 are insane.\n----\n"
            }
        ]

        char_objects = {}
        for char_data in network:
            char = db.query(Character).filter_by(handle=char_data["handle"]).first()
            if not char:
                char = Character(
                    name=char_data["name"],
                    handle=char_data["handle"],
                    bio=char_data["bio"],
                    is_predefined=True,
                    is_user=False,
                    relationship_score=40,
                    following=True,
                    avatar_path=char_data["avatar_path"],
                    avatar_alt_text=char_data["avatar_alt_text"],
                    tweet_history=char_data["tweet_history"]
                )
                db.add(char)
                db.commit()
                db.refresh(char)

                # Initialize conversation sessions for them
                sess = ConversationSession(
                    character_id=char.id,
                    vibe="Friendly",
                    intensity=50,
                    replies_left=5
                )
                db.add(sess)
                db.commit()
            char_objects[char_data["handle"]] = char

        # Fetch Daine to link Daine in relationships
        daine_char = db.query(Character).filter_by(handle="@notdaine").first()
        if daine_char:
            char_objects["@notdaine"] = daine_char

        # Setup relationship definitions
        relationships_to_seed = [
            ("@darcyebaylis", "@carolinecalloway", "Ex-partner"),
            ("@darcyebaylis", "@avgcowgirl", "Ex-partner"),
            ("@darcyebaylis", "@notdaine", "Friend"),
            ("@darcyebaylis", "@notdaine", "Collaborator"),
            ("@darcyebaylis", "@ninajirachi", "Friend"),
            ("@darcyebaylis", "@ninajirachi", "Collaborator"),
            ("@darcyebaylis", "@quannnic", "Friend"),
            ("@darcyebaylis", "@quannnic", "Bandmate"),
            ("@darcyebaylis", "@photgraphicmemory", "Friend"),
            ("@darcyebaylis", "@photgraphicmemory", "Bandmate"),
        ]

        for handle_a, handle_b, r_type in relationships_to_seed:
            char_a = char_objects.get(handle_a)
            char_b = char_objects.get(handle_b)
            if char_a and char_b:
                # Check if relationship already exists
                existing_rel = db.query(CharacterRelationship).filter(
                    ((CharacterRelationship.character_a_id == char_a.id) & (CharacterRelationship.character_b_id == char_b.id)) |
                    ((CharacterRelationship.character_a_id == char_b.id) & (CharacterRelationship.character_b_id == char_a.id))
                ).filter_by(relationship_type=r_type).first()
                
                if not existing_rel:
                    new_rel = CharacterRelationship(
                        character_a_id=char_a.id,
                        character_b_id=char_b.id,
                        relationship_type=r_type,
                        relationship_score=70
                    )
                    db.add(new_rel)
                    db.commit()

    finally:
        db.close()
