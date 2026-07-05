import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db, Character, ConversationSession

import os

# Setup test db using a temporary file
DB_FILE = "./test_relationship.db"
engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def client():
    # Ensure any old test file is removed
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except OSError:
            pass
            
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # User character
    user = Character(
        name="User",
        handle="@playerone",
        bio="Player Bio",
        is_user=True,
        relationship_score=-1
    )
    db.add(user)
    
    # NPC character
    npc = Character(
        name="Daine",
        handle="@notdaine",
        bio="Daine Bio",
        is_user=False,
        relationship_score=20
    )
    db.add(npc)
    db.commit()
    db.refresh(npc)
    
    # Conversation session for Soren
    session = ConversationSession(
        character_id=npc.id,
        vibe="Chill",
        intensity=50,
        replies_left=5
    )
    db.add(session)
    db.commit()
    db.close()

    def override_get_db():
        try:
            db_session = TestingSessionLocal()
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except OSError:
            pass

@patch("backend.novelai.generate_dm_reply", new_callable=AsyncMock)
def test_dm_turn_counter_and_milestones(mock_generate, client):
    # Setup mock response from NovelAI
    mock_generate.return_value = {
        "vibe": "playful",
        "intensity": 65,
        "text": "Hey there! Ready to make some music?"
    }

    # Fetch initial DM state
    resp = client.get("/api/dms/2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session"]["replies_left"] == 5
    assert data["character"]["relationship_score"] == 20

    # Send 1st DM message
    resp = client.post("/api/dms/2", json={"content": "Hey Daine!"})
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["session"]["replies_left"] == 4
    assert res_data["relationship_score"] == 22 # Standard +2 relationship increment
    assert res_data["milestone_triggered"] is False

    # Send 4 more DMs to exhaust the turn counter (replies_left: 4 -> 3 -> 2 -> 1 -> 0 -> reset to 5)
    # The 5th message should trigger the milestone reset
    for i in range(3):
        client.post("/api/dms/2", json={"content": "ping"})
        
    # Send the 5th message which triggers the milestone
    resp = client.post("/api/dms/2", json={"content": "final ping"})
    assert resp.status_code == 200
    milestone_data = resp.json()
    
    # After 5 messages, relationship score should be:
    # Starting: 20
    # Msg 1: +2 -> 22
    # Msg 2: +2 -> 24
    # Msg 3: +2 -> 26
    # Msg 4: +2 -> 28
    # Msg 5: triggers replies_left <= 0, resets to 5, and adds +10 -> 38
    assert milestone_data["relationship_score"] == 38
    assert milestone_data["session"]["replies_left"] == 5
    assert milestone_data["milestone_triggered"] is True
    assert "Milestone reached" in milestone_data["milestone_message"]
