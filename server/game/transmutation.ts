import { TRANSMUTATION_BY_ID, TRANSMUTATION_RECIPES, type TransmutationRecipe } from "../../shared/data/transmutation.ts";
import { CONSUMABLE_BY_ID } from "../../shared/data/items.ts";
import { GameError, notFound } from "../lib/errors.ts";
import type { GameCtx } from "./context.ts";
import { type Player, addStack, bump, countStack, spendCoins, takeStack } from "./player.ts";
import { logEvent } from "./logbook.ts";

export interface TransmutationState {
  recipes: (TransmutationRecipe & {
    available: number;
    canAfford: boolean;
    userFromQty: number;
    fromName: string;
    fromIcon: string;
    toName: string;
    toIcon: string;
  })[];
}

export function getTransmutationState(g: GameCtx, p: Player): TransmutationState {
  const recipes = TRANSMUTATION_RECIPES.map((r) => {
    const fromItem = CONSUMABLE_BY_ID[r.fromMaterial];
    const toItem = CONSUMABLE_BY_ID[r.toMaterial];
    const userFromQty = countStack(g, p.userId, r.fromMaterial);
    const maxByMaterial = Math.floor(userFromQty / r.fromQty);
    const maxByCoins = r.coins > 0 ? Math.floor(p.coins / r.coins) : 999;
    const available = Math.max(0, Math.min(maxByMaterial, maxByCoins));
    const canAfford = p.level >= r.minLevel && available >= 1;

    return {
      ...r,
      available,
      canAfford,
      userFromQty,
      fromName: fromItem?.name ?? r.fromMaterial,
      fromIcon: fromItem?.icon ?? "📦",
      toName: toItem?.name ?? r.toMaterial,
      toIcon: toItem?.icon ?? "📦",
    };
  });

  return { recipes };
}

export function transmuteMaterial(g: GameCtx, p: Player, recipeId: string, count = 1) {
  const recipe = TRANSMUTATION_BY_ID[recipeId];
  if (!recipe) throw notFound("Transmutation recipe");

  const times = Math.max(1, Math.min(50, Math.floor(count)));
  if (p.level < recipe.minLevel) {
    throw new GameError(`Requires Level ${recipe.minLevel} (you are Lv.${p.level}).`);
  }

  const fromItem = CONSUMABLE_BY_ID[recipe.fromMaterial];
  const toItem = CONSUMABLE_BY_ID[recipe.toMaterial];
  const fromName = fromItem?.name ?? recipe.fromMaterial;
  const toName = toItem?.name ?? recipe.toMaterial;

  const totalCost = recipe.coins * times;
  const totalFrom = recipe.fromQty * times;
  const totalTo = recipe.toQty * times;

  const userFromQty = countStack(g, p.userId, recipe.fromMaterial);
  if (userFromQty < totalFrom) {
    throw new GameError(`You need ${totalFrom}× ${fromName} (you have ${userFromQty}).`, { code: "insufficient_materials" });
  }

  spendCoins(p, totalCost, "material transmutation");
  takeStack(g, p.userId, recipe.fromMaterial, totalFrom, fromName);
  addStack(g, p.userId, recipe.toMaterial, totalTo);

  bump(g, p, "itemsTransmuted", times);

  logEvent(
    g,
    p.userId,
    "craft",
    `Transmuted ${totalFrom}× ${fromName} into ${totalTo}× ${toName} at the Alchemical Chamber`,
    "⚗️",
    { recipeId, times, fromMaterial: recipe.fromMaterial, toMaterial: recipe.toMaterial, totalTo },
  );

  return {
    success: true,
    recipeId,
    times,
    fromMaterial: recipe.fromMaterial,
    fromName,
    usedQty: totalFrom,
    toMaterial: recipe.toMaterial,
    toName,
    receivedQty: totalTo,
    coinsSpent: totalCost,
  };
}
