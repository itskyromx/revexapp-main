/** Where an alert takes the user when they tap it. */
export function notificationRoute(n) {
  const id = n?.target_id;
  switch (n?.target_type) {
    case "chat":
      return id ? `/chat/${id}` : "/offers";
    case "item":
      return id ? `/item/${id}` : "/offers";
    case "post":
      return id ? `/haul/${id}` : "/offers";
    case "profile":
      return id ? `/profile/${id}` : "/offers";
    case "order":
      return "/orders";
    default:
      return "/offers";
  }
}