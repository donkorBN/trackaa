import type { Metadata } from "next";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Trackaa: why does money never stay in your hands?",
  description:
    "You're earning more than ever, but keeping very little. It's not spiritual and you don't need a bigger salary. See where your money really goes.",
  openGraph: {
    title: "You're earning more than ever. So why does the money never stay in your hands?",
    description: "It's not spiritual. It's not your village people. See where your money really goes, in five seconds a day.",
    images: ["/icon-512.png"],
  },
};

export default function StartPage() {
  return <Landing />;
}
