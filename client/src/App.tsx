import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Shell } from "./components/Shell.tsx";
import { Celebrations, Toasts } from "./components/Overlays.tsx";
import { Loading } from "./components/ui.tsx";
import { UpdatePrompt } from "./components/UpdatePrompt.tsx";
import type { HeroSnap } from "./lib/api.ts";
import { useMe } from "./state/game.ts";
import { Landing } from "./pages/Landing.tsx";
import { AuthPage } from "./pages/Auth.tsx";
import { Onboarding } from "./pages/Onboarding.tsx";
import { TablePage } from "./pages/Table.tsx";

// Everything past the home table loads on demand so the first paint stays small.
const BattlePage = lazy(() => import("./pages/Battle.tsx"));
const AdventurePage = lazy(() => import("./pages/Adventure.tsx"));
const TowerPage = lazy(() => import("./pages/Tower.tsx"));
const DungeonPage = lazy(() => import("./pages/Dungeon.tsx"));
const ArenaPage = lazy(() => import("./pages/Arena.tsx"));
const LiveDuelPage = lazy(() => import("./pages/LiveDuel.tsx"));
const RaidPage = lazy(() => import("./pages/Raid.tsx"));
const EventPage = lazy(() => import("./pages/Event.tsx"));
const HeroPage = lazy(() => import("./pages/Hero.tsx"));
const BagPage = lazy(() => import("./pages/Bag.tsx"));
const PetsPage = lazy(() => import("./pages/Pets.tsx"));
const SmithyPage = lazy(() => import("./pages/Smithy.tsx"));
const QuestsPage = lazy(() => import("./pages/Quests.tsx"));
const TownPage = lazy(() => import("./pages/Town.tsx"));
const MarketPage = lazy(() => import("./pages/Market.tsx"));
const AuctionPage = lazy(() => import("./pages/Auction.tsx"));
const LuckyPage = lazy(() => import("./pages/Lucky.tsx"));
const ChatPage = lazy(() => import("./pages/Chat.tsx"));
const GuildPage = lazy(() => import("./pages/Guild.tsx"));
const FriendsPage = lazy(() => import("./pages/Friends.tsx"));
const TradePage = lazy(() => import("./pages/Trade.tsx"));
const RanksPage = lazy(() => import("./pages/Ranks.tsx"));
const RecordsPage = lazy(() => import("./pages/Records.tsx"));
const MailPage = lazy(() => import("./pages/Mail.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile.tsx"));

const TITLES: Record<string, string> = {
  "/": "The Table", "/adventure": "Adventure", "/tower": "Tower of Ascension", "/dungeon": "Dungeon", "/arena": "Arena",
  "/raid": "World Boss", "/festival": "Festival", "/hero": "Hero", "/bag": "Bag", "/pets": "Pets", "/smithy": "Blacksmith", "/quests": "Quests",
  "/town": "Town", "/market": "Market", "/auction": "Auction House", "/lucky": "Lucky Roll", "/chat": "Chat", "/guild": "Guild",
  "/friends": "Friends", "/trade": "Trades", "/ranks": "Leaderboards", "/records": "Records", "/mail": "Mail",
  "/settings": "Settings", "/battle": "Battle", "/login": "Sign in", "/register": "Create account",
};

function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const base = "/" + (pathname.split("/")[1] ?? "");
    const t = TITLES[pathname] ?? TITLES[base] ?? (pathname.startsWith("/players/") ? decodeURIComponent(pathname.split("/")[2] ?? "Player") : null);
    document.title = t ? `${t} · DTEmpire Adventure` : "DTEmpire Adventure";
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);
}

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <img src="/logo.png" alt="DTEmpire Adventure" width={140} height={140} />
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading rows={4} />}>{children}</Suspense>;
}

export function App() {
  const { data, isPending, isError, refetch } = useMe();
  useDocumentTitle();

  let body: ReactNode;
  if (isPending) body = <Splash />;
  else if (isError && !data) {
    body = (
      <div className="splash">
        <img src="/logo.png" alt="" width={120} height={120} />
        <p>We couldn't reach the realm.</p>
        <button type="button" className="btn btn--primary" onClick={() => void refetch()}>Try again</button>
      </div>
    );
  } else if (!data?.user) {
    body = (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/reset" element={<AuthPage mode="reset" />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  } else if (!data.hero) {
    body = <Onboarding />;
  } else {
    const me = data as HeroSnap;
    body = (
      <Shell me={me}>
        <Routes>
          <Route path="/" element={<TablePage />} />
          <Route path="/battle" element={<Page><BattlePage /></Page>} />
          <Route path="/adventure" element={<Page><AdventurePage /></Page>} />
          <Route path="/tower" element={<Page><TowerPage /></Page>} />
          <Route path="/dungeon" element={<Page><DungeonPage /></Page>} />
          <Route path="/arena" element={<Page><ArenaPage /></Page>} />
          <Route path="/arena/live" element={<Page><LiveDuelPage /></Page>} />
          <Route path="/raid" element={<Page><RaidPage /></Page>} />
          <Route path="/festival" element={<Page><EventPage /></Page>} />
          <Route path="/hero" element={<Page><HeroPage /></Page>} />
          <Route path="/bag" element={<Page><BagPage /></Page>} />
          <Route path="/pets" element={<Page><PetsPage /></Page>} />
          <Route path="/smithy" element={<Page><SmithyPage /></Page>} />
          <Route path="/quests" element={<Page><QuestsPage /></Page>} />
          <Route path="/town" element={<Page><TownPage /></Page>} />
          <Route path="/market" element={<Page><MarketPage /></Page>} />
          <Route path="/auction" element={<Page><AuctionPage /></Page>} />
          <Route path="/lucky" element={<Page><LuckyPage /></Page>} />
          <Route path="/chat" element={<Page><ChatPage /></Page>} />
          <Route path="/guild" element={<Page><GuildPage /></Page>} />
          <Route path="/friends" element={<Page><FriendsPage /></Page>} />
          <Route path="/trade" element={<Page><TradePage /></Page>} />
          <Route path="/ranks" element={<Page><RanksPage /></Page>} />
          <Route path="/records" element={<Page><RecordsPage /></Page>} />
          <Route path="/mail" element={<Page><MailPage /></Page>} />
          <Route path="/settings" element={<Page><SettingsPage /></Page>} />
          <Route path="/players/:name" element={<Page><ProfilePage /></Page>} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    );
  }

  return (
    <>
      {body}
      <Toasts />
      <Celebrations />
      <UpdatePrompt />
    </>
  );
}

function NotFound() {
  return (
    <div className="empty">
      <span className="art" aria-hidden>🗺️</span>
      <h3>This path leads nowhere</h3>
      <p>The map ends here. Head back to the table.</p>
      <a className="btn btn--primary" href="/">Back to the table</a>
    </div>
  );
}
