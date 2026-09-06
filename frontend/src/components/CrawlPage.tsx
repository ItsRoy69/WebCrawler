import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  Code2,
  Copy,
  Download,
  FileText,
  Link2,
  Map as MapIcon,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Square,
  SquareStack,
  WandSparkles,
} from "lucide-react";
import { AppShell } from "./AppShell";
import { useAppStore } from "../store";
import { search } from "../api";
import { cn, favLetter, hostFromUrl, normalizeUrl } from "../lib/utils";

const ENDPOINTS = [
  { key: "search", label: "Search", group: "DISCOVER", icon: Search },
  { key: "scrape", label: "Scrape", group: "EXTRACT", icon: Sparkles },
  { key: "map", label: "Map", group: "EXTRACT", icon: MapIcon },
  { key: "crawl", label: "Crawl", group: "CRAWL", icon: SquareStack },
] as const;

export function CrawlPlayground({
  endpoint,
  url: urlParam,
  job,
}: {
  endpoint: string;
  url?: string;
  job?: string;
}) {
  const {
    isCrawling,
    results,
    setResults,
    setCrawlJob,
    pollCrawlStatus,
    fetchStats,
    addToPlaygroundHistory,
    crawlError,
  } = useAppStore();

  const [input, setInput] = useState(urlParam ?? "www.ycombinator.com/");
  const [jobId, setJobId] = useState(job ?? "");
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"markdown" | "json">("markdown");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (urlParam) setInput(urlParam.replace(/^https?:\/\//, ""));
  }, [urlParam]);

  useEffect(() => {
    if (job && !jobId) setJobId(job);
  }, [job, jobId]);

  useEffect(() => {
    if (!jobId) return;
    setCrawlJob(jobId);
    pollCrawlStatus(async (error) => {
      if (error) return;
      const refreshed = await search(urlParam || input, 50, 0, undefined, 0.5, 100, false);
      setResults(refreshed.results, refreshed.total);
      fetchStats();
    });
  }, [jobId]);

  const pages = results.map((result) => ({ ...result, markdown: result.snippet }));
  const run = {
    url: urlParam || input,
    message: "",
    progress: 100,
    stored: pages.length,
    found: pages.length,
  };
  const selectedPage = pages[selected];

  const displayHost = useMemo(
    () => hostFromUrl(run?.url || normalizeUrl(input) || "example.com"),
    [run?.url, input],
  );

  function onStart() {
    const raw = input.trim();
    if (!raw) return;
    addToPlaygroundHistory(normalizeUrl(raw));
    void search(normalizeUrl(raw), 50, 0, undefined, 0.5, 100, true).then((data) => {
      setResults(data.results, data.total);
      if (data.job_id) {
        setJobId(data.job_id);
        setCrawlJob(data.job_id);
        window.history.replaceState(
          null,
          "",
          `/playground?endpoint=crawl&url=${encodeURIComponent(normalizeUrl(raw))}&job=${data.job_id}`,
        );
      }
    });
  }

  function copy() {
    if (!selectedPage) return;
    const text =
      tab === "json" ? JSON.stringify(selectedPage, null, 2) : selectedPage.markdown;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <AppShell endpoint={endpoint || "crawl"}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Mode groups */}
        <div className="mb-3 flex items-center justify-center gap-8 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle">
          <span>Discover</span>
          <span>Extract</span>
          <span className={endpoint === "crawl" ? "text-fg" : ""}>Crawl</span>
        </div>
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-border-loud bg-bg-elevated p-1">
            {ENDPOINTS.map((ep) => {
              const Icon = ep.icon;
              const active = (endpoint || "crawl") === ep.key;
              return (
                <a
                  key={ep.key}
                  href={`/playground?endpoint=${ep.key}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-3.5" />
                  {ep.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* URL composer */}
        <div className="mb-8 rounded-xl border border-border-loud bg-bg-elevated shadow-panel">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <span className="rounded-md border border-border-loud bg-bg px-2 py-1 font-mono text-[12px] text-muted">
              https://
            </span>
            <input
              value={input.replace(/^https?:\/\//, "")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onStart();
              }}
              placeholder="www.ycombinator.com/"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-subtle"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <ToolIcon>
                <Settings2 className="size-3.5" />
              </ToolIcon>
              <ToolIcon>
                <WandSparkles className="size-3.5" />
              </ToolIcon>
              <span className="ml-1 inline-flex items-center gap-1 text-[12px] text-muted">
                <FileText className="size-3.5" />
                Format: <span className="text-fg">Markdown</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-loud px-3 py-1.5 text-[12px] text-muted hover:bg-bg-subtle"
              >
                <Code2 className="size-3.5" />
                Get code
              </button>
              <button
                type="button"
                onClick={onStart}
                disabled={isCrawling}
                className="inline-flex items-center rounded-lg bg-heat px-3.5 py-1.5 text-[12px] font-semibold text-heat-fg hover:brightness-110 disabled:opacity-50"
              >
                {isCrawling ? "Crawling…" : "Start crawling"}
              </button>
            </div>
          </div>
        </div>

        {run ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-heat text-[13px] font-bold text-heat-fg">
                  {favLetter(run.url)}
                </span>
                <p className="truncate text-[14px] font-medium">{displayHost}/</p>
              </div>
              <div className="flex items-center gap-2">
                <Ghost>
                  <Share2 className="size-3.5" /> Share
                </Ghost>
                {isCrawling ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-[12px] text-danger"
                  >
                    <Square className="size-3 fill-current" />
                    Stop
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
              <div className="border-b border-border p-4 sm:border-b-0 sm:border-r">
                <p className="mb-2 text-[11px] text-subtle">Endpoint</p>
                <p className="flex items-center gap-2 text-[13px]">
                  <SquareStack className="size-3.5 text-heat" />
                  Crawl
                </p>
              </div>
              <div className="p-4">
                <p className="mb-2 text-[11px] text-subtle">Status</p>
                {isCrawling ? (
                  <p className="flex items-center gap-2 text-[13px] text-heat">
                    <span className="size-1.5 animate-pulse rounded-full bg-heat" />
                    Pending
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-success">
                    <span className="text-success">●</span>
                    Success
                  </p>
                )}
              </div>
            </div>

            {isCrawling ? (
              <div className="mb-5 rounded-xl border border-border bg-bg-elevated px-4 py-3.5">
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="text-muted">{run.message || "Crawling the pages…"}</span>
                  <span className="tabular-nums text-subtle">{run.progress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-border-loud">
                  <div
                    className="h-full rounded-full bg-heat transition-all duration-500"
                    style={{ width: `${run.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-subtle">
                  {run.stored} stored · {run.found} found
                </p>
              </div>
            ) : null}

            {crawlError ? (
              <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
                Crawl failed: {crawlError}
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold">
                  Results{pages.length ? ` (${pages.length})` : ""}
                </h2>
                {isCrawling ? (
                  <p className="mt-0.5 text-[12px] text-subtle">Crawling the pages…</p>
                ) : pages.length ? (
                  <p className="mt-0.5 text-[12px] text-subtle">
                    You can see the rest of the results in the JSON data, or below.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Ghost>
                  <Sparkles className="size-3.5" /> Debug issue
                </Ghost>
                <span className="hidden h-4 w-px bg-border-loud sm:block" />
                <Ghost>
                  <Download className="size-3.5" /> Markdown
                </Ghost>
                <Ghost>
                  <Download className="size-3.5" /> JSON
                </Ghost>
              </div>
            </div>

            <div className="space-y-3 pb-16">
              {pages.map((page, i) => {
                const open = selected === i;
                return (
                  <article key={page.url} className="overflow-hidden rounded-xl border border-border">
                    <button
                      type="button"
                      className="w-full px-5 py-3.5 text-left hover:bg-bg-elevated"
                      onClick={() => setSelected(i)}
                    >
                      <p className="text-[13px] font-medium text-heat">
                        #{i + 1} {page.title}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-subtle">
                        {page.url.replace(/^https?:\/\//, "")}
                      </p>
                    </button>
                    {open ? (
                      <>
                        <div className="flex items-center border-y border-border px-3">
                          <button
                            type="button"
                            onClick={() => setTab("markdown")}
                            className={cn(
                              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-medium",
                              tab === "markdown"
                                ? "border-heat text-heat"
                                : "border-transparent text-subtle hover:text-muted",
                            )}
                          >
                            <FileText className="size-3.5" />
                            Markdown
                            <span className="rounded-full bg-heat/15 px-1.5 py-0.5 text-[10px] text-heat">
                              ~93% tokens
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab("json")}
                            className={cn(
                              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-medium",
                              tab === "json"
                                ? "border-heat text-heat"
                                : "border-transparent text-subtle hover:text-muted",
                            )}
                          >
                            <Braces className="size-3.5" />
                            JSON
                          </button>
                        </div>
                        <pre className="max-h-80 overflow-y-auto bg-bg-elevated px-5 py-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-muted">
                          {tab === "markdown"
                            ? page.markdown
                            : JSON.stringify(page, null, 2)}
                        </pre>
                        <div className="flex justify-end border-t border-border px-4 py-2.5">
                          <button
                            type="button"
                            onClick={copy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border-loud px-3 py-1.5 text-[11px] text-muted hover:bg-bg-subtle"
                          >
                            <Copy className="size-3" />
                            {copied
                              ? "Copied"
                              : tab === "json"
                                ? "Copy as JSON"
                                : "Copy as Markdown"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}

              {isCrawling && pages.length === 0 ? (
                <div className="rounded-xl border border-border py-16 text-center text-[13px] text-subtle">
                  Waiting for pages…
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <RecentRuns />
        )}
      </div>
    </AppShell>
  );
}

function RecentRuns() {
  const history = useAppStore((s) => s.history);
  if (!history.length) {
    return (
      <div>
        <h2 className="mb-3 text-[15px] font-semibold">Recent Runs</h2>
        <p className="text-[13px] text-subtle">No crawls yet. Paste a URL and start crawling.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="mb-3 text-[15px] font-semibold">Recent Runs</h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {history.slice(0, 6).map((url) => (
          <a
            key={url}
            href={`/playground?endpoint=crawl&url=${encodeURIComponent(url)}`}
            className="grid grid-cols-1 gap-3 p-4 hover:bg-bg-elevated sm:grid-cols-[1.4fr_1fr_1fr_1fr]"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded bg-heat text-[10px] font-bold text-heat-fg">
                {favLetter(url)}
              </span>
              <span className="truncate text-[13px]">{hostFromUrl(url)}/</span>
              <Link2 className="size-3.5 text-subtle" />
            </div>
            <div>
              <p className="text-[11px] text-subtle">Endpoint</p>
              <p className="text-[13px]">Crawl</p>
            </div>
            <div>
              <p className="text-[11px] text-subtle">Status</p>
              <p className="text-[13px] text-success">Previous query</p>
            </div>
            <div>
              <p className="text-[11px] text-subtle">Started</p>
              <p className="text-[13px]">
                Search history
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Ghost({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-loud px-2.5 py-1.5 text-[11px] text-muted hover:bg-bg-subtle"
    >
      {children}
    </button>
  );
}

function ToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex size-8 items-center justify-center rounded-lg border border-border-loud text-muted hover:bg-bg-subtle"
    >
      {children}
    </button>
  );
}
