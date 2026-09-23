import {
  Award, Backpack, BookOpen, Castle, Compass, Contact, PartyPopper, Crown, Dices, Flame, Gavel, Hammer, Handshake, Home, LayoutGrid, Mail, MessageCircle,
  PawPrint, ScrollText, Settings, Shield, Store, Swords, Trophy, Users, Landmark, type LucideIcon,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: string; minLevel?: number }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: "Play",
    items: [
      { to: "/", label: "The Table", icon: LayoutGrid },
      { to: "/adventure", label: "Adventure", icon: Swords },
      { to: "/tower", label: "Tower", icon: Castle },
      { to: "/dungeon", label: "Dungeon", icon: Flame, minLevel: 5 },
      { to: "/arena", label: "Arena", icon: Trophy, minLevel: 5 },
      { to: "/raid", label: "World Boss", icon: Crown, minLevel: 10, badge: "worldBoss" },
      { to: "/festival", label: "Festival", icon: PartyPopper, badge: "event" },
    ],
  },
  {
    label: "Hero",
    items: [
      { to: "/hero", label: "Hero & Skills", icon: Shield },
      { to: "/bag", label: "Bag", icon: Backpack },
      { to: "/pets", label: "Pets", icon: PawPrint },
      { to: "/smithy", label: "Blacksmith", icon: Hammer },
    ],
  },
  {
    label: "Town",
    items: [
      { to: "/quests", label: "Quests", icon: ScrollText, badge: "quests" },
      { to: "/town", label: "Town", icon: Landmark, badge: "town" },
      { to: "/estate", label: "Estate", icon: Home, minLevel: 5 },
      { to: "/market", label: "Market", icon: Store },
      { to: "/auction", label: "Auction House", icon: Gavel, minLevel: 15 },
      { to: "/lucky", label: "Lucky Roll", icon: Dices },
    ],
  },
  {
    label: "Realm",
    items: [
      { to: "/chat", label: "Chat", icon: MessageCircle },
      { to: "/guild", label: "Guild", icon: Users },
      { to: "/friends", label: "Friends", icon: Contact, badge: "friends" },
      { to: "/trade", label: "Trades", icon: Handshake, badge: "trades" },
      { to: "/ranks", label: "Leaderboards", icon: Award },
      { to: "/records", label: "Records", icon: BookOpen },
      { to: "/guide", label: "Guide Book", icon: Compass },
      { to: "/mail", label: "Mail", icon: Mail, badge: "mail" },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
