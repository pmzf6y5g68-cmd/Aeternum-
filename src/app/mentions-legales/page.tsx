import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Mentions légales" };

const l = siteConfig.legal;

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      sections={[
        {
          title: "Éditeur",
          paragraphs: [
            `${siteConfig.name} est édité par ${l.companyName}, ${l.legalForm}, immatriculée au ${l.rcs} sous le numéro ${l.siren}, TVA intracommunautaire ${l.vatNumber}.`,
            `Siège social : ${l.address}. Contact : ${siteConfig.supportEmail}.`,
            `Directeur de la publication : ${l.publicationDirector}.`,
          ],
        },
        { title: "Hébergement", paragraphs: [`Application : ${l.host}.`, `Base de données : ${l.dataHost}.`] },
        {
          title: "Propriété intellectuelle",
          paragraphs: [`L'ensemble des contenus du site ${siteConfig.name} (textes, logos, interfaces) est protégé. Toute reproduction sans autorisation est interdite.`],
        },
      ]}
    />
  );
}
