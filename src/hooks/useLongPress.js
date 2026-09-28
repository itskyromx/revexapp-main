import { useCallback, useEffect, useRef } from "react";

/**
 * Press-and-hold detection that cooperates with scrolling: the pending press is
 * abandoned the moment the finger travels further than `moveThreshold`, so a
 * scroll never opens the action sheet.
 */
export default function useLongPress(onLongPress, { delay = 500, moveThreshold = 10 } = {}) {
  const timer = useRef(null);
  const origin = useRef(null);
  const handler = useRef(onLongPress);
  handler.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancel();
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        origin.current = null;
        handler.current?.();
      }, delay);
    },
    [cancel, delay]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) cancel();
    },
    [cancel, moveThreshold]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
  };
}