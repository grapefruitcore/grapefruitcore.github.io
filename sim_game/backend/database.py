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
        default_comm = db.query(Community).filter_by(name="the scene").first()
        if not default_comm:
            default_comm = Community(name="the scene")
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
                tweet_history=(
                    "Spread the love spread the vibe\n"
                    "i cant believe my lore I was 19 opening for charli xcx\n"
                    "YES I’M AN INDUSTRY PLANT WHO CARES\n"
                    "SYDNEY MY set IS 8PM TONIGHT SEE YOU SOON\n"
                    "can you guess the feature on my unreleased track\n"
                    "i am just trying to make refreshing music. that’s the whole goal. because that’s what i want to listen to\n"
                    "Flaxseed meal changed my life\n"
                    "My ex used to say i’m. like drake as a female\n"
                    "gonna start thirst trapping and also being more machiavellian. as a treat for being a sweetie\n"
                    "around this time in 2024 i was having a seizure in hospital after trying to take my life. cut to 2026 and ive started my first album roll out and it’s so much brighter & better than i could’ve expected.🪷 it happens like magic🪷do not give up🍀"
                )
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
                tweet_history="EXCLUSIVE: Rumors are flying in the underground scene! Who was spotted leaving the club together last night?"
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
                "tweet_history": (
                    "we are all just stems in this beautiful project file called Life\n"
                    "it feels like im a cartoon ant travelling the world with all of my earthly possessions fitting into a single suitcase rn\n"
                    "the best part of being on tour? getting to discover new styles of Spaghetti Bolognaise every damn day\n"
                    "you’re 15 years old. you spent the weekend busking so you could afford a Laneway ticket. You really want to see Washed Out but they clash with SBTRKT. You have a fresh Ben Sherman buttoned all the way up and a new pair of Cheap Mondays. There’s no school on Monday. Life is good\n"
                    "Even when it gets hard it’s so fun to be me\n"
                    "Define the Great Line by Underoath had such a profound impact on me as a kid that despite coming from an atheist family I briefly converted to Christianity, asked my mum for a bible for my birthday and started attending church with a Christian kid at my school\n"
                    "you met me at a very Darcy time in my life\n"
                    "emo music and all its associated forms has altered my life in ways I never thought possible\n"
                    "the realest thing about me is I gaf\n"
                    "the best art is made by people who are willing to embarrass themselves\n"
                    "i’m an addict for dramatics i confuse the two for love"
                )
            },
            {
                "name": "Caroline Calloway",
                "handle": "@carolinecalloway",
                "bio": "Writer, scammer, and terrible friend. Dated Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Caroline looking artistic in a museum",
                "tweet_history": (
                    "I'm a 34 year old teenage girl in NYC. And yes this rage bait btw\n"
                    "It's important to include a dead one when you put flowers in your hair because that's how people know they're real\n"
                    "Wearing an outfit today that my ex would've hated. I got this feeling on a summer day that I don’t miss being punished for being myself AT ALL\n"
                    "He’d call it being “spacious, gracious, and gentle” and the metric of whether or not I had succeeded at each social event was how often he had heard my voice. Make no noise that night? Good mood when we were finally alone. Cuddles and praise and security. Laugh or yap or god forbid get too excited about something and do it in a way that draws attention to myself? Icy, surly, silent treatment that would last for DAYS. But the real villain here is myself because I stayed until he dumped **ME** jfc still unpacking this\n"
                    "At the stage in the break up where I can't use make up or I'll cry it all off. Been a solid three weeks since I last used mascara\n"
                    "Did someone say gold medals? Yeah. I did. Because I’m in total control of this narrative flow and I want to make story dumps “a thing.”\n"
                    "I’ve been in a total love bubble at the beach all weekend with nary a thought in my pretty little head about whether or not my phone was charged or what happens after Monday. Now it’s fucking Monday. HELLO.\n"
                    "OMG GUYS I LITERALLY FUCKED THE UNITED HEALTHCARE CEO ASSASSIN"
                )
            },
            {
                "name": "Christina",
                "handle": "@avgcowgirl",
                "bio": "LA visual creator. Active in right-wing online communities. Dated Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Christina in a cowgirl hat holding a vintage camera",
                "tweet_history": (
                    "you can't break a man's will with beautiful pink p$ssy\n"
                    "I need to stop dating liberals!!\n"
                    "I change my entire personality every single day\n"
                    "whores for Christ\n"
                    "why are all men gay?"
                )
            },
            {
                "name": "Ninajirachi",
                "handle": "@ninajirachi",
                "bio": "Australian electronic producer, songwriter, and DJ. Friend and frequent collaborator with fellow Australian artists Daine and Darcy.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Nina in neon lights behind a turntable",
                "tweet_history": (
                    "australia tour starts this week which songs am i playing .   .    .       .         .\n"
                    "24 hours in london thank you meltdown festival :D\n"
                    "the power just went out mid set lol but everyone kept singing (╥ ᴗ ╥)\n"
                    "always at the desk in the dark xx\n"
                    "my friends are my heroes and my heroes are my friends 😭😭😭😭💙💙💙💙\n"
                    "i want to sing live but its gonna sound Bad\n"
                    "i’ve never been to coachella"
                )
            },
            {
                "name": "Zo",
                "handle": "@quannnic",
                "bio": "Alternative shoegaze artist and music producer based in LA. In a band called Car Underwater with Darcy and Max.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Zo in a fuzzy sweater standing in a dark room",
                "tweet_history": "rehearsing with darcy for the LA gig. our new track is loud shoegaze trance."
            },
            {
                "name": "Max",
                "handle": "@photgraphicmemory",
                "bio": "LA-based visual designer, photographer, and experimental musician. In a band called Car Underwater with Darcy and Zo.",
                "avatar_path": "/static/default_npc.png",
                "avatar_alt_text": "Max behind a camera flash, motion blur filter",
                "tweet_history": (
                    "I could never trust a gluten free mf. fym you allergic to the bread?\n"
                    "Angelina Jolie as that baddie fish in Shark Tale 😮‍💨\n"
                    "Writing a new song on acoustic today"
                )
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
