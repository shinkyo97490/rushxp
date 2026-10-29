import type { Metadata } from "next";
import { RankingsPage } from "@/components/rankings/RankingsPage";

export const metadata: Metadata = { title: "Divisions" };

export default function Page({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  return <RankingsPage tab="divisions" searchParams={searchParams} />;
}
