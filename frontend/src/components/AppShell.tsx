import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  ChevronsLeft,
  CircleHelp,
  FileText,
  FolderOpen,
  Home,
  KeyRound,
  Map as MapIcon,
  Monitor,
  Paperclip,
  Radar,
  Search,
  Settings,
  Sparkles,
  SquareStack,
} from "lucide-react";
import { FlameMark } from "./FlameMark";
import { cn } from "../lib/utils";
import type { ReactNode } from "react";

const PLAY = [
  { to: "/", icon: Search, label: "Search the web", key: "search" },
  { to: "/playground?endpoint=scrape", icon: FileText, label: "Scrape a web page", key: "scrape" },
  { to: "/playground?endpoint=interact", icon: Sparkles, label: "Interact with a page", key: "interact" },
  { to: "/playground?endpoint=parse", icon: Paperclip, label: "Parse a file", key: "parse" },
  { to: "/playground?endpoint=crawl", icon: SquareStack, label: "Crawl entire website", key: "crawl" },
  { to: "/playground?endpoint=map", icon: MapIcon, label: "Map all website links", key: "map" },
  { to: "/playground?endpoint=monitor", icon: Radar, label: "Monitor the web", key: "monitor", badge: "NEW" },
] as const;

export function AppShell({
  children,
  endpoint = "crawl",
}: {
  children: ReactNode;
  endpoint?: string;
}) {
  const navigate = (to: string) => {
    window.location.href = to;
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="grid-wash absolute inset-0" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-bg lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <button
            type="button"
            className="flex items-center gap-2.5"
            onClick={() => navigate("/")}
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-heat text-heat-fg">
              <FlameMark className="size-5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">WebCrawler</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 text-[13px]">
          <NavRow icon={Home} label="Overview" onClick={() => navigate("/")} />
          <p className="mt-4 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
            Playground
          </p>
          {PLAY.map((item) => (
            <NavRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={endpoint === item.key}
              badge={"badge" in item ? item.badge : undefined}
              onClick={() => {
                if (item.key === "search") navigate("/");
                else navigate(`/playground?endpoint=${item.key}`);
              }}
            />
          ))}
          <p className="mt-4 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
            Research Preview
          </p>
          <NavRow icon={Bot} label="Agent" />
          <p className="mt-4 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
            Account
          </p>
          <NavRow icon={Activity} label="Activity Logs" />
          <NavRow icon={FolderOpen} label="Usage" />
          <NavRow icon={KeyRound} label="API Keys" />
          <NavRow icon={Settings} label="Settings" />
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg px-1 py-1.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-semibold">
              RP
            </span>
            <span className="truncate text-[12px] text-muted">you@webcrawler.app</span>
          </div>
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-muted hover:bg-bg-subtle"
          >
            <ChevronsLeft className="size-3.5" />
            Collapse
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex h-full flex-col lg:pl-64">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <a href="/" className="lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-md bg-heat text-heat-fg">
                <FlameMark className="size-4" />
              </span>
            </a>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border-loud bg-bg-elevated px-2.5 py-1.5 text-[12px] font-medium"
            >
              <span className="flex size-5 items-center justify-center rounded bg-heat text-[10px] font-bold text-heat-fg">
                P
              </span>
              Personal Team
              <ChevronDown className="size-3.5 text-subtle" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn>
              <Bell className="size-4" />
            </IconBtn>
            <IconBtn>
              <Monitor className="size-4" />
            </IconBtn>
            <GhostBtn>
              <CircleHelp className="size-3.5" />
              <span className="hidden sm:inline">Help</span>
            </GhostBtn>
            <GhostBtn>
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </GhostBtn>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-heat px-3 py-1.5 text-[12px] font-semibold text-heat-fg transition-colors hover:brightness-110"
            >
              Upgrade
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function NavRow({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors",
        active ? "bg-heat/10 text-heat" : "text-muted hover:bg-bg-subtle hover:text-fg",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded bg-heat px-1 py-px text-[9px] font-semibold leading-none text-heat-fg">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function IconBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="hidden size-8 items-center justify-center rounded-lg border border-border-loud text-muted hover:bg-bg-subtle sm:flex"
    >
      {children}
    </button>
  );
}

function GhostBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="hidden items-center gap-1.5 rounded-lg border border-border-loud px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-subtle sm:inline-flex"
    >
      {children}
    </button>
  );
}
