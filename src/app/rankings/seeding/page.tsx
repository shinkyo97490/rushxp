import type { Metadata } from "next";
import { RankingsPage } from "@/components/rankings/RankingsPage";

export const metadata: Metadata = { title: "Seeding" };

export default function Page({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  return <RankingsPage tab="seeding" searchParams={searchParams} />;
}
