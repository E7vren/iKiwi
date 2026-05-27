import PusherJs from "pusher-js";

let pusherClient: PusherJs | null = null;

export function getPusherClient(): PusherJs | null {
  if (typeof window === "undefined") return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster || key === "your_pusher_key") return null;

  if (!pusherClient) {
    pusherClient = new PusherJs(key, {
      cluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
  }
  return pusherClient;
}
