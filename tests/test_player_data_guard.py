import copy
import importlib.util
import json
import sys
from pathlib import Path

import pytest


APP_PATH = Path(__file__).resolve().parents[1] / "web" / "app.py"
WEB_DIR = APP_PATH.parent
if str(WEB_DIR) not in sys.path:
    sys.path.insert(0, str(WEB_DIR))

spec = importlib.util.spec_from_file_location("adventure_app_data_guard_test", APP_PATH)
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)


def configure_store(tmp_path, monkeypatch, current):
    player_file = tmp_path / "players.json"
    player_file.write_text(json.dumps(current, indent=2), encoding="utf-8")
    monkeypatch.setattr(A, "DATA_DIR", tmp_path)
    monkeypatch.setattr(A, "PLAYER_FILE", player_file)
    monkeypatch.setattr(A, "PLAYER_LOCK_FILE", tmp_path / "players.json.lock")
    monkeypatch.setattr(A, "PLAYER_BACKUP_DIR", tmp_path / "player_backups", raising=False)
    return player_file


def player(level, xp=0, coins=100, created=1):
    return {
        "user_id": "1",
        "guild_id": "guild",
        "name": "DargoTamber",
        "level": level,
        "xp": xp,
        "coins": coins,
        "created": created,
        "inventory": [],
        "pets": [],
        "mail": [],
    }


def test_bulk_save_rejects_progression_rollback(tmp_path, monkeypatch):
    key = "guild_1"
    original = {key: player(50, xp=6000, coins=1000000)}
    player_file = configure_store(tmp_path, monkeypatch, original)

    with pytest.raises(A.PlayerDataRollbackError):
        A.save_players({key: player(1, xp=0, coins=100)})

    assert json.loads(player_file.read_text()) == original


def test_bulk_save_rejects_deleting_existing_players(tmp_path, monkeypatch):
    original = {"guild_1": player(50), "guild_2": player(12)}
    player_file = configure_store(tmp_path, monkeypatch, original)

    with pytest.raises(A.PlayerDataRollbackError):
        A.save_players({"guild_1": copy.deepcopy(original["guild_1"])})

    assert json.loads(player_file.read_text()) == original


def test_single_player_save_rejects_stale_snapshot(tmp_path, monkeypatch):
    key = "guild_1"
    original = {key: player(50, xp=6000, coins=1000000)}
    player_file = configure_store(tmp_path, monkeypatch, original)

    with pytest.raises(A.PlayerDataRollbackError):
        A.save_player("guild", "1", player(1, xp=0, coins=100))

    assert json.loads(player_file.read_text()) == original


def test_legitimate_progress_update_is_saved_and_snapshotted(tmp_path, monkeypatch):
    key = "guild_1"
    original = {key: player(50, xp=6000, coins=1000000)}
    player_file = configure_store(tmp_path, monkeypatch, original)
    updated = player(51, xp=100, coins=990000)

    A.save_player("guild", "1", updated)

    assert json.loads(player_file.read_text())[key]["level"] == 51
    snapshots = list((tmp_path / "player_backups").glob("players-*.json"))
    assert snapshots
    assert json.loads(snapshots[-1].read_text()) == original
