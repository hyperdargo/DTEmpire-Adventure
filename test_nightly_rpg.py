import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "web"))
import app as app_module
from game_logic import calc_stats


def logged_in_client(monkeypatch, player):
    monkeypatch.setattr(app_module, "get_player", lambda guild_id, user_id: player)
    monkeypatch.setattr(app_module, "save_player", lambda guild_id, user_id, value: None)
    client = app_module.app.test_client()
    with client.session_transaction() as session:
        session["user_id"] = "123456789012345678"
        session["guild_id"] = app_module.HOME_GUILD_ID
        session["username"] = "Tester"
    return client


def test_starter_pool_has_exactly_18_non_unique_classes():
    from game_data import CLASSES

    starters = [c for c in CLASSES.values() if c["rarity"] != "unique"]
    assert len(starters) == 18
    assert {c["rarity"] for c in starters} == {
        "common", "uncommon", "rare", "epic", "legendary"
    }


def test_assign_starter_rolls_rarity_first_and_excludes_unique(monkeypatch):
    import game_logic

    captured = {}

    def fake_choices(population, weights, k):
        captured["population"] = list(population)
        captured["weights"] = list(weights)
        return ["legendary"]

    monkeypatch.setattr(game_logic.random, "choices", fake_choices)
    monkeypatch.setattr(game_logic.random, "choice", lambda pool: pool[0])
    player = {"coins": 100}

    assigned = game_logic.assign_starter(player)

    assert captured["population"] == ["common", "uncommon", "rare", "epic", "legendary"]
    assert captured["weights"] == [40, 30, 18, 9, 3]
    assert assigned["rarity"] == "legendary"
    assert player["class_rarity"] == "legendary"
    assert player["class_name"] not in {"Chronomancer", "Chimera"}


def test_assign_starter_is_idempotent():
    from game_logic import assign_starter

    player = {"class_name": "Warrior", "level": 27}
    assert assign_starter(player) is None
    assert player == {"class_name": "Warrior", "level": 27}


def test_tower_mail_rewards_are_floor_aware_and_boss_boosted(monkeypatch):
    import game_logic

    captured = []
    monkeypatch.setattr(game_logic.random, "choices", lambda items, weights, k: captured.append([i["name"] for i in items]) or [items[-1]])
    monkeypatch.setattr(game_logic.random, "randint", lambda low, high: low)

    low = game_logic.roll_floor_reward(5, False)
    assert "Legendary Weapon" not in captured[-1]
    assert low["qty"] == 1

    high_boss = game_logic.roll_floor_reward(95, True)
    assert "Legendary Weapon" in captured[-1]
    assert high_boss["qty"] >= 5
    assert high_boss["boss_bonus"] is True


def test_sell_uses_required_rarity_price(monkeypatch):
    player = {
        "inventory": [{"id": "mythic_blade", "name": "Mythic Blade", "type": "weapon", "rarity": "mythic"}],
        "coins": 0,
    }
    response = logged_in_client(monkeypatch, player).post("/api/sell", json={"item_id": "mythic_blade"})
    assert response.status_code == 200
    assert player["coins"] == 15000
    assert player["inventory"] == []


def test_sell_rejects_equipped_boots(monkeypatch):
    boots = {"id": "swift_boots", "name": "Swift Boots", "type": "boots", "rarity": "rare"}
    player = {"inventory": [boots], "equipped_boots": boots, "coins": 0}
    response = logged_in_client(monkeypatch, player).post("/api/sell", json={"item_id": "swift_boots"})
    assert response.status_code == 400
    assert player["inventory"] == [boots]


def test_dashboard_displays_equipped_item_names(monkeypatch):
    player = {
        "user_id": "test-user", "level": 1, "xp": 0, "health": 100, "max_health": 100,
        "equipped_weapon": {"id": "dawn", "name": "Sword of Dawn"},
        "equipped_armor": {"id": "plate", "name": "Solar Plate"},
        "equipped_helmet": {"id": "crown", "name": "Solar Crown"},
        "equipped_boots": {"id": "boots", "name": "Swift Boots"},
    }
    monkeypatch.setattr(app_module, "load_players", lambda: {"test-user": player})
    response = logged_in_client(monkeypatch, player).get("/dashboard")
    html = response.get_data(as_text=True)
    assert response.status_code == 200
    assert "Sword of Dawn" in html
    assert "Solar Plate" in html
    assert "Solar Crown" in html
    assert "Swift Boots" in html


def test_inventory_displays_equipped_boots(monkeypatch):
    player = {
        "inventory": [],
        "equipped_boots": {"id": "boots", "name": "Swift Boots", "stats": {"defense": 4}},
    }
    monkeypatch.setattr(app_module, "load_shops", lambda: {})
    response = logged_in_client(monkeypatch, player).get("/inventory")
    assert response.status_code == 200
    assert "Swift Boots" in response.get_data(as_text=True)


def test_pet_page_and_hatch_endpoint(monkeypatch):
    egg = {"id": "egg-1", "name": "Rare Egg", "type": "egg", "rarity": "rare", "icon": "🥚"}
    player = {"level": 8, "inventory": [egg], "pets": [], "equipped_pets": []}
    client = logged_in_client(monkeypatch, player)
    page = client.get("/pet")
    assert page.status_code == 200
    assert "Rare Egg" in page.get_data(as_text=True)
    response = client.post("/api/pet/hatch", json={"egg_id": "egg-1"})
    assert response.status_code == 200
    assert response.get_json()["success"] is True
    assert player["inventory"] == []
    assert len(player["pets"]) == 1


def test_pet_page_and_hatch_support_legacy_pet_egg(monkeypatch):
    egg = {"id": "legacy-egg", "name": "Mysterious Egg", "type": "pet_egg", "rarity": "rare"}
    player = {"level": 8, "inventory": [egg], "pets": [], "equipped_pets": []}
    client = logged_in_client(monkeypatch, player)

    page = client.get("/pet")
    assert "Mysterious Egg" in page.get_data(as_text=True)

    response = client.post("/api/pet/hatch", json={"egg_id": "legacy-egg"})
    assert response.status_code == 200
    assert player["inventory"] == []
    assert len(player["pets"]) == 1


def test_auction_list_endpoint_lists_inventory_item(monkeypatch):
    player = {
        "inventory": [{"id": "iron_sword", "name": "Iron Sword", "type": "weapon", "rarity": "common"}],
        "coins": 0,
    }
    monkeypatch.setattr(app_module, "load_auction", lambda: {"listings": []})
    monkeypatch.setattr(app_module, "save_auction", lambda data: None)
    response = logged_in_client(monkeypatch, player).post(
        "/api/auction/list", json={"item_id": "iron_sword", "price": 100}
    )
    assert response.status_code == 200
    assert player["inventory"] == []


def test_equipped_dict_pet_applies_saved_bonus():
    player = {
        "level": 1,
        "base_atk": 10,
        "base_def": 5,
        "base_spd": 6,
        "base_hp": 80,
        "pets": [{"id": "pet-1", "rarity": "mythic", "atk_bonus": 10, "def_bonus": 5}],
        "equipped_pets": ["pet-1"],
    }
    calc_stats(player)
    assert player["attack"] == 20
    assert player["defense"] == 10
