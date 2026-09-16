#!/usr/bin/env python3
"""
Regenerate JSON cache files from bot.py source data using AST walking.

Usage:
    python3 /home/dargo/.hermes/skills/devops/nightly-maintenance/scripts/regenerate_json_caches.py

This script:
1. Parses bot.py with ast.parse()
2. Walks AST to find ADVENTURE_LOCATIONS assignment and get_default_shop dict
3. Writes data/adventure_locations.json
4. Updates ALL guild keys in data/guild_shops.json with new shop data
5. Verifies output

Uses ast.parse() (not string-based extraction) to avoid bracket-counting bugs
and emoji encoding issues.
"""
import json
import ast
import sys

BASE_DIR = "/home/dargo/hermesthegreathelper/HermesBot"
BOT_PATH = f"{BASE_DIR}/bot.py"
ADVENTURE_JSON = f"{BASE_DIR}/data/adventure_locations.json"
SHOPS_JSON = f"{BASE_DIR}/data/guild_shops.json"


def tuples_to_lists(obj):
    """Recursively convert tuples to lists for JSON serialization."""
    if isinstance(obj, tuple):
        return list(obj)
    elif isinstance(obj, dict):
        return {k: tuples_to_lists(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [tuples_to_lists(i) for i in obj]
    return obj


def main():
    with open(BOT_PATH) as f:
        src = f.read()

    tree = ast.parse(src)

    # --- Extract ADVENTURE_LOCATIONS via AST walk ---
    print("Extracting ADVENTURE_LOCATIONS...")
    loc_node = None
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "ADVENTURE_LOCATIONS":
                    loc_node = node.value
                    break

    if loc_node is None:
        raise ValueError("Could not find ADVENTURE_LOCATIONS in bot.py")

    locations = ast.literal_eval(loc_node)
    # Filter only valid location dicts (exclude leaked changelog entries)
    locations = [l for l in locations if isinstance(l, dict) and 'name' in l and 'monsters' in l]
    locations = tuples_to_lists(locations)

    with open(ADVENTURE_JSON, "w") as f:
        json.dump(locations, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {ADVENTURE_JSON}: {len(locations)} locations")

    # --- Extract get_default_shop data via AST walk ---
    print("Extracting get_default_shop...")
    func_node = None
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "get_default_shop":
            func_node = node
            break

    if func_node is None:
        raise ValueError("Could not find get_default_shop function")

    # Walk function body for the assign shops[gid] = {...}
    shop_data = None
    for node in ast.walk(func_node):
        if isinstance(node, ast.Assign):
            # Check if any target is a Subscript like shops[gid]
            for target in node.targets:
                if isinstance(target, ast.Subscript):
                    try:
                        shop_data = ast.literal_eval(node.value)
                        break
                    except (ValueError, SyntaxError):
                        continue
            if shop_data:
                break

    if shop_data is None:
        raise ValueError("Could not find shops[gid] = { ... } in get_default_shop")

    shop_data = tuples_to_lists(shop_data)

    # --- Update guild_shops.json ---
    print("Updating guild_shops.json...")
    try:
        with open(SHOPS_JSON) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {}

    # Update ALL guild keys with the new shop data
    for guild_key in existing:
        existing[guild_key] = shop_data

    # If no existing keys, create default "0" key
    if not existing:
        existing["0"] = shop_data

    with open(SHOPS_JSON, "w") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    for k in existing:
        s = existing[k]
        print(f"  ✅ Guild {k}: {len(s['weapons'])} weapons, {len(s['armor'])} armor, "
              f"{len(s['potions'])} potions, {len(s['special'])} special")

    # --- Verify ---
    print("\nVerifying...")
    with open(ADVENTURE_JSON) as f:
        verify_locs = json.load(f)
    with open(SHOPS_JSON) as f:
        verify_shops = json.load(f)

    assert len(verify_locs) == len(locations), "Location count mismatch!"
    for k in verify_shops:
        s = verify_shops[k]
        assert len(s['weapons']) > 0, f"No weapons for guild {k}"
        assert all(isinstance(item, dict) for item in s['weapons']), f"Weapons not dicts for guild {k}"
        assert all(isinstance(item, dict) for item in s['armor']), f"Armor not dicts for guild {k}"
        assert all(isinstance(item, dict) for item in s['potions']), f"Potions not dicts for guild {k}"
        assert all(isinstance(item, dict) for item in s['special']), f"Special not dicts for guild {k}"

    print("✅ All verifications passed!")


if __name__ == "__main__":
    main()
