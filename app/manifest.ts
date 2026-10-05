import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "I-Manage — Property Operations",
    short_name: "I-Manage",
    description: "The focused workspace for landlords and property teams.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f3ed",
    theme_color: "#15231d",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  }
}
