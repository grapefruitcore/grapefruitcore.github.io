import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, Character, Post, DirectMessage, ConversationSession, Community

# Set up in-memory database for testing
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

def test_character_creation(db_session):
    char = Character(
        name="Test NPC",
        handle="@testnpc",
        bio="Test Bio",
        is_user=False,
        avatar_path="/static/test.png",
        avatar_alt_text="Alt Text",
        tweet_history="Some tweets"
    )
    db_session.add(char)
    db_session.commit()
    db_session.refresh(char)

    assert char.id is not None
    assert char.name == "Test NPC"
    assert char.handle == "@testnpc"
    assert char.relationship_score == 0

def test_post_hierarchy_and_replies(db_session):
    # Setup author
    author = Character(name="Author", handle="@author", bio="Bio")
    db_session.add(author)
    db_session.commit()

    # Create root post
    root = Post(author_id=author.id, content="Root post")
    db_session.add(root)
    db_session.commit()
    db_session.refresh(root)

    # Create reply post
    reply = Post(author_id=author.id, content="Reply post", parent_id=root.id)
    db_session.add(reply)
    db_session.commit()
    db_session.refresh(reply)

    # Check relation
    assert len(root.replies) == 1
    assert root.replies[0].id == reply.id
    assert root.replies[0].content == "Reply post"

def test_conversation_session_association(db_session):
    char = Character(name="Soren", handle="@soren", bio="Bio")
    db_session.add(char)
    db_session.commit()
    db_session.refresh(char)

    session = ConversationSession(
        character_id=char.id,
        vibe="Excited",
        intensity=90,
        replies_left=3
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(char)

    assert char.session is not None
    assert char.session.vibe == "Excited"
    assert char.session.replies_left == 3
