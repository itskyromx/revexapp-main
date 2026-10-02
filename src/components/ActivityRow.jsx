import { MessageCircle, Tag, Check, ShoppingBag, Package, UserPlus, Heart, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/revex";

const ICONS = {
  message: MessageCircle,
  offer: Tag,
  offer_accepted: Check,
  sale: ShoppingBag,
  order: Package,
  follow: UserPlus,
  like: Heart,
};

/** One line of activity: who did what, with the item or post it concerns. */
export default function ActivityRow({ notification, onOpen, onClear }) {
  const Icon = ICONS[notification.type] || MessageCircle;
  const unread = !notification.read;
  const showName = notification.actor_name && notification.actor_name !== notification.title;

  return (
    <div className="relative flex items-center gap-3 py-3 pl-3 pr-1">
      {unread && <span className="absolute left-0 top-2 bottom-2 w-1 bg-brand-red" />}

      <button onClick={() => onOpen(notification)} className="relative shrink-0" aria-label="Open activity">
        <Avatar name={notification.actor_name} src={notification.actor_avatar} size={44} />
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-border grid place-items-center">
          <Icon className="w-3.5 h-3.5" />
        </span>
      </button>

      <button onClick={() => onOpen(notification)} className="flex-1 min-w-0 text-left">
        {showName && (
          <p className="text-[10px] font-heading uppercase text-muted-foreground truncate">{notification.actor_name}</p>
        )}
        <p className="text-sm truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(notification.created_date)} ago</p>
      </button>

      {notification.thumbnail && (
        <img src={notification.thumbnail} alt="" className="w-12 h-12 object-cover border-2 border-border shrink-0" />
      )}

      <button onClick={() => onClear(notification)} aria-label="Clear alert" className="shrink-0 p-1 text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}