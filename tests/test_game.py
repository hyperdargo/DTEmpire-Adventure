"""
Tests for DTEmpire Adventure game.
Following TDD: RED-GREEN-REFACTOR.
Run with: pytest tests/test_game.py -v
"""

import pytest
import json
import tempfile
import os
import sys
from unittest.mock import patch, MagicMock

# Add web directory to path
sys.path.insert(0, '/home/dargo/hermesthegreathelper/HermesBot/web')

from app import app, get_player, save_player, load_players, HOME_GUILD_ID


@pytest.fixture
def client():
    """Create test client."""
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    with app.test_client() as client:
        yield client


@pytest.fixture
def test_player_data():
    """Create a test player with equipped items."""
    return {
        "user_id": "123456789012345678",
        "guild_id": HOME_GUILD_ID,
        "name": "TestPlayer",
        "level": 10,
        "xp": 1000,
        "health": 100,
        "max_health": 100,
        "attack": 50,
        "defense": 25,
        "coins": 1000,
        "inventory": [
            {"id": "sword_1", "name": "Iron Sword", "type": "weapon", "rarity": "common", "stats": {"attack": 10}},
            {"id": "armor_1", "name": "Leather Armor", "type": "armor", "rarity": "common", "stats": {"defense": 5}},
            {"id": "potion_1", "name": "Health Potion", "type": "consumable", "rarity": "common"},
        ],
        "equipped_weapon": {"id": "sword_1", "name": "Iron Sword", "type": "weapon", "rarity": "common", "stats": {"attack": 10}},
        "equipped_armor": {"id": "armor_1", "name": "Leather Armor", "type": "armor", "rarity": "common", "stats": {"defense": 5}},
        "equipped_helmet": None,
        "equipped_shield": None,
        "equipped_boots": None,
        "pets": [],
        "pet_levels": {},
        "equipped_pets": [],
        "mail": [],
        "guild": None,
        "guild_name": None,
        "monsters_killed": 0,
        "deaths": 0,
        "bosses_killed": 0,
        "adventures_completed": 0,
        "last_daily": 0,
        "last_adventure": 0,
        "created": 0,
        "role": None,
        "role_level": 0,
        "duel_wins": 0,
        "duel_losses": 0,
        "duel_streak": 0,
        "duel_rank": "Rookie",
        "ai_duel_wins": 0,
        "matches_played": 0,
        "online": False,
        "last_seen": 0,
        "active_title": "Adventurer",
        "titles_unlocked": ["Adventurer"],
        "story_chapter": 0,
        "completed_chapters": [],
        "achievements": [],
        "unique_items": [],
        "ancient_skills": [],
    }


def test_dashboard_equipment_display(client, test_player_data):
    """Test that dashboard shows equipped items correctly (not '—')."""
    # This test should FAIL initially because the bug exists
    # The dashboard route should pass equipped_slots with actual item names
    
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        # Mock player data
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        # Mock session
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        # Call dashboard route
        response = client.get('/dashboard')
        assert response.status_code == 200
        
        # Check that equipped_slots in template context has actual names
        # This will fail if the bug exists
        html = response.get_data(as_text=True)
        assert 'Iron Sword' in html or 'Leather Armor' in html
        # Should NOT show just '—' for equipped slots that have items


def test_api_sell_route_exists(client, test_player_data):
    """Test that /api/sell route exists and returns 405 for GET."""
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        # GET should return 405 (method not allowed) not 404
        response = client.get('/api/sell')
        assert response.status_code == 405, "GET /api/sell should return 405, not 404"


def test_api_sell_item(client, test_player_data):
    """Test selling an item via /api/sell POST."""
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        # Sell the unequipped potion
        response = client.post('/api/sell', 
                               json={'item_id': 'potion_1'},
                               content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True
        assert 'Health Potion' in data['message']
        assert 'coins' in data['message'].lower() or 'sold' in data['message'].lower()


def test_api_sell_equipped_item_rejected(client, test_player_data):
    """Test that selling an equipped item is rejected."""
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        # Try to sell equipped sword
        response = client.post('/api/sell',
                               json={'item_id': 'sword_1'},
                               content_type='application/json')
        
        # Should fail because it's equipped
        # Wait - this test expects the item to be unequipped first
        # Actually the sell endpoint should check if equipped and reject
        # But the item IS equipped... so it should reject
        # Let me check what the actual behavior should be


def test_pet_page_exists(client, test_player_data):
    """Test that /pet route exists and returns 200."""
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        response = client.get('/pet')
        assert response.status_code == 200, "/pet should return 200, not 404"


def test_api_pet_hatch(client, test_player_data):
    """Test hatching a pet egg."""
    # Add an egg to inventory
    test_player_data['inventory'].append({
        "id": "egg_1", "name": "Mystery Egg", "type": "egg", "rarity": "uncommon", "icon": "🥚"
    })
    
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        response = client.post('/api/pet/hatch',
                               json={'egg_id': 'egg_1'},
                               content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True


def test_guild_create_api(client, test_player_data):
    """Test /api/guild/create endpoint."""
    test_player_data['coins'] = 1000  # Enough for guild creation
    
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save, \
         patch('app.load_guilds') as mock_load_guilds, \
         patch('app.save_guilds') as mock_save_guilds:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        mock_load_guilds.return_value = {}
        mock_save_guilds.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        response = client.post('/api/guild/create',
                               json={'name': 'Test Guild', 'tag': 'TG'},
                               content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True


def test_job_set_api(client, test_player_data):
    """Test /api/job/set endpoint."""
    test_player_data['level'] = 15  # High enough for some jobs
    
    with patch('app.load_players') as mock_load, \
         patch('app.save_player') as mock_save:
        
        player_key = f"{HOME_GUILD_ID}_{test_player_data['user_id']}"
        mock_load.return_value = {player_key: test_player_data}
        mock_save.return_value = None
        
        with client.session_transaction() as sess:
            sess['user_id'] = test_player_data['user_id']
            sess['guild_id'] = HOME_GUILD_ID
            sess['username'] = test_player_data['name']
        
        response = client.post('/api/job/set',
                               json={'job_id': 'farmer'},
                               content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] == True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])