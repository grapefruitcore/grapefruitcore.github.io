import pytest
from unittest.mock import patch, AsyncMock
import httpx
from backend import novelai

def test_parse_generated_posts_standard():
    raw_text = (
        "daine\n@notdaine\n* 12:00 AM\nthis is a cool post\n"
        "---- \n"
        "Ella\n@moviesforguyss\n* 01:00 AM\nanother post\n"
    )
    posts = novelai.parse_generated_posts(raw_text)
    assert len(posts) == 2
    assert posts[0]["name"] == "daine"
    assert posts[0]["handle"] == "@notdaine"
    assert posts[0]["content"] == "this is a cool post"
    
    assert posts[1]["name"] == "Ella"
    assert posts[1]["handle"] == "@moviesforguyss"
    assert posts[1]["content"] == "another post"

def test_parse_generated_posts_repost_handling():
    raw_text = (
        "kay reposted:\ndaine\n@notdaine\n* 03:15 AM\nbedroom demos soon\n"
    )
    posts = novelai.parse_generated_posts(raw_text)
    assert len(posts) == 1
    assert posts[0]["name"] == "daine"
    assert posts[0]["handle"] == "@notdaine"
    assert posts[0]["content"] == "bedroom demos soon"

def test_parse_dm_response_standard():
    raw_text = "Vibe: flirtatious yet teasing\nIntensity: 78\nMessage: Hey! You look nice today."
    parsed = novelai.parse_dm_response(raw_text)
    assert parsed["vibe"] == "flirtatious yet teasing"
    assert parsed["intensity"] == 78
    assert parsed["text"] == "Hey! You look nice today."

def test_parse_dm_response_malformed():
    raw_text = "Wait, what are you talking about? I don't know what you mean."
    parsed = novelai.parse_dm_response(raw_text)
    # Check that fallbacks work correctly
    assert parsed["vibe"] == "Neutral"
    assert parsed["intensity"] == 50
    assert parsed["text"] == "Wait, what are you talking about? I don't know what you mean."

@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
def test_generate_completion_api_error(mock_post):
    # Mocking httpx to throw an error
    mock_post.side_effect = httpx.HTTPStatusError(
        message="API Down", 
        request=httpx.Request("POST", "http://test"), 
        response=httpx.Response(500, request=httpx.Request("POST", "http://test"))
    )
    
    import asyncio
    async def run_test():
        with pytest.raises(httpx.HTTPStatusError):
            await novelai.generate_completion(prompt="Test", max_tokens=10)
            
    asyncio.run(run_test())
