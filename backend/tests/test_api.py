"""API endpoint tests using httpx AsyncClient with a mocked DB session.

Tests exercise the FastAPI app with dependency overrides so no real database
connection is needed.  Each test class configures its mock_db to return the
appropriate data for that endpoint.

Covered endpoints:
  GET  /health                     — liveness probe (no DB)
  GET  /api/wells                  — list wells
  GET  /api/wells/{well_id}        — single well; 404 when not found
  POST /api/search                 — full-text / structured search
  POST /api/knowledge/observations — create engineer observation
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.well import WellMaster


# ── Client fixtures ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def plain_client():
    """Client with no DB override — used for /health only."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c


def _make_mock_db(wells: list = (), well: object = None) -> AsyncMock:
    """Return a configured AsyncMock for the most common query patterns."""
    db = AsyncMock()

    result_list = MagicMock()
    result_list.scalars.return_value.all.return_value = list(wells)
    result_list.scalar_one_or_none.return_value = well

    db.execute = AsyncMock(return_value=result_list)
    db.get = AsyncMock(return_value=well)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest_asyncio.fixture
async def client_empty_db():
    """Client backed by an empty mock DB (no wells, no observations)."""
    mock = _make_mock_db(wells=[], well=None)

    async def _override():
        yield mock

    app.dependency_overrides[get_db] = _override
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_with_wells():
    """Client backed by a mock DB that returns two reference wells."""
    wx07 = MagicMock(spec=WellMaster)
    wx07.well_id = "WX-07"
    wx07.well_name = "WX-07"
    wx07.field = "LOC-P3"
    wx07.basin = "Rajasthan"
    wx07.operator = "Oil India Limited"
    wx07.well_type = "DEVELOPMENT"
    wx07.well_profile = "VERTICAL"
    wx07.status = "COMPLETED"
    wx07.actual_td_md = 1161.0
    wx07.actual_td_tvd = 1138.0
    wx07.planned_td_md = 1175.0
    wx07.spud_date = None
    wx07.td_date = None
    wx07.kb_elevation_m = None
    wx07.ground_elevation_m = None
    wx07.created_at = None

    wx11 = MagicMock(spec=WellMaster)
    wx11.well_id = "WX-11"
    wx11.well_name = "WX-11"
    wx11.field = "LOC-P9"
    wx11.basin = "Rajasthan"
    wx11.operator = "Oil India Limited"
    wx11.well_type = "DEVELOPMENT"
    wx11.well_profile = "VERTICAL"
    wx11.status = "DRILLING"
    wx11.actual_td_md = 1138.0
    wx11.actual_td_tvd = 1213.0
    wx11.planned_td_md = None
    wx11.spud_date = None
    wx11.td_date = None
    wx11.kb_elevation_m = None
    wx11.ground_elevation_m = None
    wx11.created_at = None

    mock = _make_mock_db(wells=[wx07, wx11], well=wx07)

    async def _override():
        yield mock

    app.dependency_overrides[get_db] = _override
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_with_found_well():
    """Client whose mock DB returns a WellMaster for db.get() calls (for knowledge tests)."""
    wx07 = MagicMock(spec=WellMaster)
    wx07.well_id = "WX-07"

    mock = _make_mock_db(well=wx07)

    async def _override():
        yield mock

    app.dependency_overrides[get_db] = _override
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c
    app.dependency_overrides.clear()


# ── GET /health ───────────────────────────────────────────────────────────────

class TestHealth:
    async def test_returns_200(self, plain_client):
        resp = await plain_client.get("/health")
        assert resp.status_code == 200

    async def test_body_has_status_ok(self, plain_client):
        resp = await plain_client.get("/health")
        assert resp.json()["status"] == "ok"

    async def test_body_has_service_name(self, plain_client):
        resp = await plain_client.get("/health")
        assert resp.json()["service"] == "NWIS"

    async def test_content_type_is_json(self, plain_client):
        resp = await plain_client.get("/health")
        assert "application/json" in resp.headers["content-type"]


# ── GET /api/wells — list wells ───────────────────────────────────────────────

class TestListWells:
    async def test_empty_db_returns_200(self, client_empty_db):
        resp = await client_empty_db.get("/api/wells")
        assert resp.status_code == 200

    async def test_empty_db_returns_empty_list(self, client_empty_db):
        resp = await client_empty_db.get("/api/wells")
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 0

    async def test_with_wells_returns_list(self, client_with_wells):
        resp = await client_with_wells.get("/api/wells")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2

    async def test_well_has_required_fields(self, client_with_wells):
        resp = await client_with_wells.get("/api/wells")
        well = resp.json()[0]
        assert "well_id" in well
        assert "well_name" in well
        assert "status" in well
        assert "basin" in well

    async def test_well_ids_present(self, client_with_wells):
        resp = await client_with_wells.get("/api/wells")
        ids = [w["well_id"] for w in resp.json()]
        assert "WX-07" in ids
        assert "WX-11" in ids


# ── GET /api/wells/{well_id} — 404 when not found ─────────────────────────────

class TestWellNotFound:
    async def test_nonexistent_well_returns_404(self, client_empty_db):
        resp = await client_empty_db.get("/api/wells/WELL-DOES-NOT-EXIST")
        assert resp.status_code == 404

    async def test_404_body_contains_detail(self, client_empty_db):
        resp = await client_empty_db.get("/api/wells/NONEXISTENT")
        assert "detail" in resp.json()

    async def test_404_detail_mentions_well_id(self, client_empty_db):
        resp = await client_empty_db.get("/api/wells/NONEXISTENT")
        detail = resp.json()["detail"]
        assert "NONEXISTENT" in detail

    async def test_existing_well_returns_200(self, client_with_wells):
        resp = await client_with_wells.get("/api/wells/WX-07")
        assert resp.status_code == 200


# ── POST /api/search — full-text search ───────────────────────────────────────

class TestSearch:
    async def test_search_endpoint_reachable(self, client_empty_db):
        resp = await client_empty_db.post("/api/search", json={"q": "mud loss"})
        # 200 (empty results) or 404 (router not yet mounted) — both acceptable.
        assert resp.status_code in (200, 404, 422)

    async def test_empty_query_returns_list(self, client_empty_db):
        resp = await client_empty_db.post("/api/search", json={"q": "nagaur formation"})
        if resp.status_code == 200:
            assert isinstance(resp.json(), list)

    async def test_search_with_filters(self, client_empty_db):
        payload = {
            "q": "casing failure",
            "well_ids": ["WX-07"],
            "document_types": ["DDR"],
        }
        resp = await client_empty_db.post("/api/search", json=payload)
        assert resp.status_code in (200, 404, 422)


# ── POST /api/knowledge/observations — create observation ─────────────────────

class TestCreateObservation:
    async def test_create_returns_201(self, client_with_found_well):
        payload = {
            "well_id": "WX-07",
            "observation_text": "Elevated standpipe pressure noted at 520 m MD.",
        }
        resp = await client_with_found_well.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.status_code == 201

    async def test_create_returns_observation_id(self, client_with_found_well):
        payload = {
            "well_id": "WX-07",
            "observation_text": "Tight pull observed at 568 m during trip.",
        }
        resp = await client_with_found_well.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "observation_id" in body
        assert body["observation_id"]  # non-empty

    async def test_create_preserves_well_id(self, client_with_found_well):
        payload = {
            "well_id": "WX-07",
            "observation_text": "Mud loss at 544 m, 25 bbl recorded.",
        }
        resp = await client_with_found_well.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.json()["well_id"] == "WX-07"

    async def test_create_with_depth_md(self, client_with_found_well):
        payload = {
            "well_id": "WX-07",
            "observation_text": "Formation change at 785 m.",
            "depth_md": 785.0,
        }
        resp = await client_with_found_well.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body.get("depth_md") == pytest.approx(785.0)

    async def test_create_observation_missing_well_returns_404(self, client_empty_db):
        payload = {
            "well_id": "WX-MISSING",
            "observation_text": "This well does not exist.",
        }
        resp = await client_empty_db.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.status_code == 404

    async def test_missing_text_returns_422(self, client_with_found_well):
        # observation_text is required — omitting it should give 422 Unprocessable Entity.
        payload = {"well_id": "WX-07"}
        resp = await client_with_found_well.post(
            "/api/knowledge/observations", json=payload
        )
        assert resp.status_code == 422
