import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import ActivityFeed from "@/components/ActivityFeed";
import InboxThreads from "@/components/InboxThreads";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";

/** Inbox — activity alerts first, with the chat threads one tap away. */
export default function Offers() {
  const [tab, setTab] = useState("activity");
  const unread = useUnreadNotifications();

  return (
    <div className="min-h-screen pb-16 bg-background">
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <span className="font-display text-xl uppercase text-left">Inbox</span>
          {unread > 0 && (
            <span className="ml-auto sticker bg-brand-red text-white px-2 py-0.5 text-xs">{unread} new</span>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        <div className="flex border-[3px] border-border bg-card mb-4">
          <button
            onClick={() => setTab("activity")}
            className={`flex-1 py-2 font-heading font-bold uppercase text-xs ${tab === "activity" ? "bg-brand-red text-white" : "text-foreground"}`}>
            Activity
          </button>
          <button
            onClick={() => setTab("chats")}
            className={`flex-1 py-2 font-heading font-bold uppercase text-xs border-l-2 border-border ${tab === "chats" ? "bg-brand-red text-white" : "text-foreground"}`}>
            Chats
          </button>
        </div>

        {tab === "activity" ? <ActivityFeed /> : <InboxThreads />}
      </div>

      <BottomNav />
    </div>
  );
}