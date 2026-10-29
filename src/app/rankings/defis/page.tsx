import type { Metadata } from "next";
import { RankingsPage } from "@/components/rankings/RankingsPage";

export const metadata: Metadata = { title: "Centre des défis" };

export default function Page({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  return <RankingsPage tab="defis" searchParams={searchParams} />;
}
