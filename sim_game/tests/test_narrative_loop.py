import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import AsyncMock, patch

from backend.main import app
from backend.database import Base, get_db, Character, Community, GameState, SideQuest, DailySummary
import os

DB_FILE = "./test_narrative_loop.db"
engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def client():
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except OSError:
            pass
            
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed default user for endpoints testing
    user = Character(
        name="Player One",
        handle="@playerone",
        bio="Player Bio",
        is_user=True,
        relationship_score=-1,
        avatar_path="/static/user.png"
    )
    db.add(user)
    
    daine = Character(
        name="Daine",
        handle="@notdaine",
        bio="Daine bio",
        is_user=False,
        relationship_score=20,
        following=True,
        avatar_path="/static/daine.png"
    )
    db.add(daine)

    comm = Community(name="the scene")
    db.add(comm)
    
    # Initialize GameState
    state = GameState(
        id=1,
        current_day=1,
        available_skill_points=0,
        overarching_narrative="You are a music fan.",
        has_batched_posts=False,
        daily_action_count=0,
        xp=0,
        level=1,
        empathy_pts=0,
        fame_pts=0,
        relevance_pts=0
    )
    db.add(state)
    
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

def test_get_game_state(client):
    response = client.get("/api/game/state")
    assert response.status_code == 200
    data = response.json()
    assert data["current_day"] == 1
    assert data["level"] == 1
    assert data["xp"] == 0
    assert data["available_skill_points"] == 0

def test_allocate_skill_no_points(client):
    response = client.post("/api/game/allocate_skill", json={"skill_name": "empathy"})
    assert response.status_code == 400
    assert "Cannot allocate" in response.json()["detail"]

@patch("backend.novelai.generate_daily_summary", new_callable=AsyncMock)
@patch("backend.novelai.generate_updated_narrative", new_callable=AsyncMock)
def test_narrative_loop_progression(mock_update_narrative, mock_daily_summary, client):
    mock_daily_summary.return_value = "A dramatic day in the music scene."
    mock_update_narrative.return_value = "You are becoming a well-known fan."

    # 1. Attempt sleep without batching
    resp = client.post("/api/game/end_day")
    assert resp.status_code == 400
    assert "must batch posts" in resp.json()["detail"]

    # 2. Batch posts
    resp = client.post("/api/generate_timeline")
    assert resp.status_code == 200

    # 3. Attempt sleep without 20 XP
    resp = client.post("/api/game/end_day")
    assert resp.status_code == 400
    assert "earn at least 20 XP" in resp.json()["detail"]

    # Gain XP and Level Up to LVL 2 to get a skill point
    db = TestingSessionLocal()
    try:
        from backend.crud import gain_xp, log_activity
        gain_xp(db, 115)
        log_activity(db, trigger_type="DM", narrative_outcome="Chatted with Soren", xp_gained=115, relationship_change=0)
        db.commit()
    finally:
        db.close()

    # Now verify game state reflects the level up and unspent skill point
    resp = client.get("/api/game/state")
    data = resp.json()
    assert data["level"] == 2
    assert data["xp"] == 115
    assert data["available_skill_points"] == 1

    # Allocate skill point to Empathy
    resp = client.post("/api/game/allocate_skill", json={"skill_name": "empathy"})
    assert resp.status_code == 200
    data = resp.json()["state"]
    assert data["empathy_pts"] == 1
    assert data["available_skill_points"] == 0

    # End day now that has_batched_posts is true and today_xp is 115 >= 20
    resp = client.post("/api/game/end_day")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["old_day"] == 1
    assert data["new_day"] == 2
    assert data["daily_summary"] == "A dramatic day in the music scene."

    # Verify state is advanced to day 2 and reset
    resp = client.get("/api/game/state")
    data = resp.json()
    assert data["current_day"] == 2
    assert data["has_batched_posts"] is False
    assert data["daily_action_count"] == 0
    assert data["overarching_narrative"] == "You are becoming a well-known fan."
