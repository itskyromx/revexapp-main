import { NavLink } from "react-router-dom";
import { Home, Plus, Search, Inbox, User } from "lucide-react";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";

export default function BottomNav({ overlay = false }) {
  const unread = useUnreadNotifications();
  const items = [
    { to: "/", icon: Home, label: "Home", end: true },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/upload", icon: Plus, label: "Sell", center: true },
    { to: "/inbox", icon: Inbox, label: "Inbox", badge: unread },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  const navBg = overlay ? "border-white/10 bg-black" : "border-border bg-[#f3f4f6] dark:bg-background";
  const inactiveIcon = overlay ? "text-white" : "text-foreground";
  const inactiveText = overlay ? "text-white/70" : "text-muted-foreground";

  return (
    <nav className={`fixed bottom-0 inset-x-0 z-40 border-t-[4px] ${navBg} md:hidden`}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {items.map(({ to, icon: Icon, label, end, center, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="group flex flex-col items-center justify-end gap-0.5 relative pb-1"
          >
            {({ isActive }) =>
              center ? (
                <span className="flex flex-col items-center -mt-5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-card border-2 border-border shadow-brutal">
                    <Plus className="w-5 h-5 text-foreground" strokeWidth={3} />
                  </span>
                  <span className={`text-[9px] font-heading font-bold uppercase tracking-wide ${overlay ? "text-white" : "text-foreground"}`}>{label}</span>
                </span>
              ) : (
                <>
                  <span className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? "bg-brand-red" : overlay ? "group-hover:bg-white/15" : "group-hover:bg-muted"}`}>
                    <Icon
                      className={`w-5 h-5 ${isActive ? "text-white" : inactiveIcon}`}
                      strokeWidth={isActive ? 3 : 2.4}
                    />
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand-red text-white text-[9px] font-display grid place-items-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  <span className={`text-[9px] font-heading font-bold uppercase tracking-wide ${isActive ? "text-brand-red" : inactiveText}`}>
                    {label}
                  </span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}