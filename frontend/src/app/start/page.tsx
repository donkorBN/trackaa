import type { Metadata } from "next";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Trackaa: know where every cedi goes",
  description:
    "Log what you spend in seconds, see your money clearly, and check it against your MoMo statement. A personal finance tracker built for Ghana.",
  openGraph: {
    title: "Trackaa: know where every cedi goes",
    description: "Log spending in seconds, set a budget that tells you what's left today, and check it against your MoMo statement.",
    images: ["/icon-512.png"],
  },
};

export default function StartPage() {
  return <Landing />;
}
