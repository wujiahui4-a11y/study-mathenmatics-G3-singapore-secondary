import { useState, useEffect, FormEvent } from "react";
import { Outlet, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search, Tv, Github } from "lucide-react";
import { CATEGORIES } from "./categories";

export default function App() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const activeCat = params.get("q") ? -1 : Number(params.get("cat") ?? 0);

  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-bili-ink/80 border-b border-bili-line">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-bili-pink shadow-glow transition-transform group-hover:scale-105">
              <Tv className="w-5 h-5 text-white" />
            </span>
            <span className="text-lg font-bold tracking-tight hidden sm:block">
              Bili<span className="text-bili-pink">Stream</span>
            </span>
          </Link>

          <form onSubmit={onSubmit} className="flex-1 max-w-2xl mx-auto">
            <div className="relative group">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Bilibili videos…"
                className="w-full h-10 pl-11 pr-4 rounded-full bg-bili-card border border-bili-line
                           text-sm placeholder:text-bili-muted outline-none transition
                           focus:border-bili-pink focus:bg-bili-panel"
              />
              <Search className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-bili-muted" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-4 rounded-full
                           bg-bili-pink hover:bg-bili-pinkdark text-white text-xs font-semibold transition"
              >
                Search
              </button>
            </div>
          </form>

          <a
            href="https://www.bilibili.com"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 hidden md:flex items-center gap-1.5 text-sm text-bili-muted hover:text-white transition"
          >
            <Github className="w-4 h-4" />
            <span>Source: Bilibili</span>
          </a>
        </div>
        <nav className="mx-auto max-w-[1600px] px-4 sm:px-6 pb-2.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => {
              const active = c.rid === activeCat;
              const Icon = c.icon;
              return (
                <Link
                  key={c.rid}
                  to={c.rid === 0 ? "/" : `/?cat=${c.rid}`}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? "bg-bili-pink text-white shadow-glow"
                      : "bg-bili-card text-gray-300 hover:text-white hover:bg-bili-line"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {c.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1 mx-auto max-w-[1600px] w-full px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-bili-line py-6 text-center text-xs text-bili-muted">
        BiliStream — streams are extracted and proxied live from Bilibili for demo/educational use.
      </footer>
    </div>
  );
}
