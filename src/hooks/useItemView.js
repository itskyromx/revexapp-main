import { useEffect, useRef } from "react";
import { observeItemView } from "@/lib/itemViewTracker";
import { recordItemView } from "@/lib/itemStats";

export function useItemView(itemId, enabled = true) {
  const element = useRef(null);
  useEffect(() => {
    if (!itemId || !enabled) return undefined;
    return observeItemView(element.current, () => recordItemView(itemId));
  }, [itemId, enabled]);
  return element;
}
