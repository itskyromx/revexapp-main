// A mounted/preloaded card is not a view. Require a continuous, visible
// impression and pause the dwell timer when the browser tab is hidden.
export function observeItemView(element, onView) {
  if (!element || typeof IntersectionObserver === "undefined") return () => {};

  let visible = false;
  let timer = null;
  let recorded = false;
  let disposed = false;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    if (disposed || recorded || !visible || document.visibilityState !== "visible") {
      cancel();
      return;
    }
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      if (disposed || !visible || document.visibilityState !== "visible") return;
      recorded = true;
      Promise.resolve().then(() => {
        if (!disposed) return onView();
      }).catch(error => {
        recorded = false;
        console.error("Could not record item view", error);
      });
    }, 1000);
  };
  const observer = new IntersectionObserver(entries => {
    const entry = entries.filter(entry => entry.target === element).pop();
    if (!entry) return;
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
    schedule();
  }, { threshold: [0, 0.6] });

  observer.observe(element);
  document.addEventListener("visibilitychange", schedule);
  return () => {
    disposed = true;
    cancel();
    observer.disconnect();
    document.removeEventListener("visibilitychange", schedule);
  };
}
