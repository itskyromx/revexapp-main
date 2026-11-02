import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { toast } from "@/components/ui/use-toast";
import ItemOwnerMenu from "@/components/ItemOwnerMenu";
import EditItemSheet from "@/components/EditItemSheet";
import BoostSheet from "@/components/BoostSheet";
import DeleteItemDialog from "@/components/DeleteItemDialog";

export default function ItemOwnerActions({ item, onChanged = undefined, onDeleted = undefined, renderTrigger = undefined }) {
  const { user } = useAuth();
  const [action, setAction] = useState(null);
  const isOwner = Boolean(user && item.created_by_id === user.id);
  const close = () => setAction(null);
  const open = () => { if (isOwner) setAction("menu"); };
  return <>
    {renderTrigger ? renderTrigger(isOwner ? open : undefined) : isOwner && (
      <button onClick={open} aria-label="Item options" className="sticker bg-black/70 text-white border-white/30 w-9 h-9 rounded-full flex items-center justify-center">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    )}
    {isOwner && <>
      <ItemOwnerMenu open={action === "menu"} onClose={close}
        onEdit={() => setAction("edit")} onBoost={() => setAction("boost")} onDelete={() => setAction("delete")} />
      {action === "edit" && <EditItemSheet item={item} userId={user.id} onClose={close}
        onSaved={(updated) => { close(); toast({ title: "Item updated" }); onChanged?.(updated); }} />}
      {action === "boost" && <BoostSheet item={item} onClose={close} />}
      {action === "delete" && <DeleteItemDialog item={item} onClose={close}
        onDeleted={() => { close(); onDeleted?.(); }} />}
    </>}
  </>;
}
