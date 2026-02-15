import webpush from "web-push";

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn("⚠️ VAPID keys missing in environment variables");
} else {
  webpush.setVapidDetails(
    "mailto:support@lovculator.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  console.log("🔔 Web Push configured successfully");
}

export default webpush;
