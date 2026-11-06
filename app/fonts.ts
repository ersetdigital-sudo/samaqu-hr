import localFont from "next/font/local";

export const plusJakartaSans = localFont({
  src: [
    {
      path: "../fonts/plusjakartasans-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/plusjakartasans-medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/plusjakartasans-semibold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/plusjakartasans-bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/plusjakartasans-extrabold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
