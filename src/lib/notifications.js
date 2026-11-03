/** Where an alert takes the user when they tap it. */
export function notificationRoute(n) {
  const id = n?.target_id;
  switch (n?.target_type) {
    case "chat":
      return id ? `/chat/${id}` : "/inbox";
    case "item":
      return id ? `/item/${id}` : "/inbox";
    case "post":
      return id ? `/haul/${id}` : "/inbox";
    case "profile":
      return id ? `/profile/${id}` : "/inbox";
    case "order":
      return "/orders";
    default:
      return "/inbox";
  }
}