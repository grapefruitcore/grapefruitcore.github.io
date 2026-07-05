import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import Base, get_db, Character, Community

import os

# Test database setup using a temporary file
DB_FILE = "./test_endpoints.db"
engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Fixture to initialize schema and override get_db dependency
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
    
    # Seed an NPC Daine for event dilemmas
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

    # Seed an NPC Darcy for relationship endpoints tests
    darcy = Character(
        name="Darcy",
        handle="@darcyebaylis",
        bio="Darcy bio",
        is_user=False,
        relationship_score=40,
        following=True,
        avatar_path="/static/default_npc.png"
    )
    db.add(darcy)

    
    # Seed a community
    comm = Community(name="Underground Music")
    db.add(comm)
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

def test_read_timeline_empty(client):
    response = client.get("/api/timeline")
    assert response.status_code == 200
    assert response.json() == []

def test_create_post(client):
    # Fetch communities to get ID
    comm_resp = client.get("/api/communities")
    assert comm_resp.status_code == 200
    comm_id = comm_resp.json()[0]["id"]

    # Create post
    payload = {"content": "Hello scene!", "community_id": comm_id}
    response = client.post("/api/posts", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["post_id"] is not None

    # Fetch timeline to confirm post appears
    timeline_resp = client.get("/api/timeline")
    assert timeline_resp.status_code == 200
    posts = timeline_resp.json()
    assert len(posts) == 1
    assert posts[0]["content"] == "Hello scene!"
    assert posts[0]["author"]["handle"] == "@playerone"

def test_read_communities(client):
    response = client.get("/api/communities")
    assert response.status_code == 200
    comms = response.json()
    assert len(comms) == 1
    assert comms[0]["name"] == "Underground Music"

def test_get_user_profile(client):
    response = client.get("/api/user/profile")
    assert response.status_code == 200
    profile = response.json()
    assert profile["name"] == "Player One"
    assert profile["handle"] == "@playerone"

def test_trigger_and_resolve_event(client):
    # Trigger event
    resp = client.post("/api/trigger_event")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    event_id = data["event_id"]
    assert event_id is not None

    # Check active event
    active_resp = client.get("/api/events/active")
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data["status"] == "active"
    assert active_data["event"]["id"] == event_id

    # Resolve event
    resolve_payload = {"choice": "I will play a synthesizer solo to resolve the conflict."}
    res_resp = client.post(f"/api/resolve_event/{event_id}", json=resolve_payload)
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert res_data["status"] == "success"
    assert res_data["resolution"] is not None
    assert "xp_gained" in res_data
    assert "relationship_change" in res_data

    # Check active event again (should be resolved)
    active_resp = client.get("/api/events/active")
    assert active_resp.status_code == 200
    assert active_resp.json()["status"] == "none"

    # Check activity log contains the choice outcome
    log_resp = client.get("/api/activity_log")
    assert log_resp.status_code == 200
    logs = log_resp.json()
    assert len(logs) == 1
    assert logs[0]["trigger_type"] == "Event_Choice"

    # Undo last action
    undo_resp = client.post("/api/activity_log/undo")
    assert undo_resp.status_code == 200
    assert undo_resp.json()["status"] == "success"
    assert undo_resp.json()["undone_type"] == "Event_Choice"

    # Verify log is now empty
    log_resp = client.get("/api/activity_log")
    assert log_resp.status_code == 200
    assert log_resp.json() == []

def test_edit_character_and_manage_relationships(client):
    # Fetch all seeded characters
    chars_resp = client.get("/api/characters")
    assert chars_resp.status_code == 200
    chars = chars_resp.json()
    # Find Daine and Darcy
    daine = next((c for c in chars if c["handle"] == "@notdaine"), None)
    darcy = next((c for c in chars if c["handle"] == "@darcyebaylis"), None)
    
    assert daine is not None
    assert darcy is not None
    
    # Edit Darcy and update relationships
    import json
    new_rels = [
        {"target_character_id": daine["id"], "relationship_type": "Collaborator"}
    ]
    payload = {
        "name": "Darcy E. Baylis",
        "handle": "@darcyebaylis",
        "bio": "Edited Bio of Darcy",
        "avatar_alt_text": "New avatar description",
        "tweet_history": "Darcy @darcyebaylis\n* 01:00 AM\nEdited tweet\n----\n",
        "relationships": json.dumps(new_rels)
    }
    
    edit_resp = client.post(f"/api/characters/{darcy['id']}/edit", data=payload)
    assert edit_resp.status_code == 200
    
    # Get details of Darcy to verify changes
    details_resp = client.get(f"/api/characters/{darcy['id']}")
    assert details_resp.status_code == 200
    details = details_resp.json()
    assert details["name"] == "Darcy E. Baylis"
    assert details["bio"] == "Edited Bio of Darcy"
    assert "Edited tweet" in details["tweet_history"]
    
    # Get relationships of Darcy to verify only collaborator is saved
    rels_resp = client.get(f"/api/characters/{darcy['id']}/relationships")
    assert rels_resp.status_code == 200
    rels = rels_resp.json()
    assert len(rels) == 1
    assert rels[0]["target_character_id"] == daine["id"]
    assert rels[0]["relationship_type"] == "Collaborator"

