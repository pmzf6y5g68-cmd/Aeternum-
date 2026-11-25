import type { Metadata } from "next";
import { SearchPage, type RawParams } from "@/components/search/search-page";

export const metadata: Metadata = { title: "Rechercher un professionnel", robots: { index: false } };

export default async function RecherchePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <SearchPage params={await searchParams} basePath="/recherche" />;
}
