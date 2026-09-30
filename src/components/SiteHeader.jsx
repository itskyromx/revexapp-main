import { Link, useLocation } from "react-router-dom";
import { Search } from "lucide-react";

const NAV_ITEMS = [
  { to: "/watch", label: "Watch", key: "watch" },
  { to: "/upload", label: "Upload", key: "upload" },
  { to: "/inbox", label: "Inbox", key: "inbox" },
  { to: "/profile", label: "Profile", key: "profile" },
];

export default function SiteHeader({ actions, context }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/home" || pathname === "/";
  const activeKey = NAV_ITEMS.find(({ key }) => pathname.startsWith(`/${key}`))?.key;

  return (
    <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
      <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-14">
        <Link
          to="/home"
          aria-current={isHome ? "page" : undefined}
          className="font-display text-xl uppercase tracking-tight"
        >
          Revex
        </Link>
        {context && <span className="hidden sm:block font-display text-sm uppercase truncate">{context}</span>}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-auto border-2 border-border bg-background px-3 h-9">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input placeholder="Search drops, brands, tags" className="bg-transparent flex-1 outline-none text-sm" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <nav className="flex items-center gap-1 text-sm font-heading uppercase">
            {NAV_ITEMS.map(({ to, label, key }) => {
              const active = activeKey === key;
              return (
                <Link
                  key={key}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`hidden md:inline px-3 py-1.5 ${active ? "border-2 border-border bg-brand-red text-white" : "hover:bg-black/10"}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}