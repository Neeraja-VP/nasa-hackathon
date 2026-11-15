"""
Unit Tests for LROC QuickMap API Endpoints
"""

try:
    from fastapi.testclient import TestClient
except Exception:
    from fastapi_client import FastAPITestClient as TestClient
from fastapi_client import FastAPITestClient as TestClient
from app.main import app

client = TestClient(app)


def test_quickmap_metadata():
    res = client.get("/api/quickmap/metadata")
    assert res.status_code == 200
    data = res.json()
    assert "QuickMap" in data["service"]
    assert data["stack_id"] == 3314
    assert data["earth_shadow_enabled"] is True
    assert data["projection"]["id"] == 10
    assert len(data["layers"]) >= 5
    assert "shackleton-rim" in data["site_bookmarks"]
    assert "quickmap.lroc.im-ldi.com" in data["resolved_url"]


def test_quickmap_url_by_site_id():
    res = client.get("/api/quickmap/url?site_id=shackleton-rim")
    assert res.status_code == 200
    data = res.json()
    assert data["site_id"] == "shackleton-rim"
    assert "quickmap.lroc.im-ldi.com" in data["url"]
    assert "stack=3314" in data["url"]
    assert "proj=10" in data["url"]


def test_quickmap_url_custom_coordinates():
    res = client.get("/api/quickmap/url?latitude=-85.5&longitude=45.0&radius_km=50")
    assert res.status_code == 200
    data = res.json()
    assert data["latitude"] == -85.5
    assert data["longitude"] == 45.0
    assert "prjExtent=" in data["url"]


def test_quickmap_url_invalid_site():
    res = client.get("/api/quickmap/url?site_id=non-existent-site-xyz")
    assert res.status_code == 404
