import type { Metadata } from "next";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Trackaa: payday was two weeks ago. Where did the money go?",
  description:
    "See where every cedi goes. Log a spend in five seconds, get a budget that tells you what you can spend today, and check it against your MoMo statement.",
  openGraph: {
    title: "Payday was two weeks ago. Where did the money go?",
    description: "Trackaa shows you where every cedi goes: MoMo, cash and cedis, in seconds a day.",
    images: ["/icon-512.png"],
  },
};

export default function StartPage() {
  return <Landing />;
}
