import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dudo",
    short_name: "Dudo",
    description: "Launch your AI employee in 60 seconds. Connect WhatsApp, Telegram, and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F0",
    theme_color: "#22577A",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
