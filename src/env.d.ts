/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Environnement = {
  /** Espace KV où sont enregistrés mises en page et textes. Absent tant qu'il n'est pas lié. */
  VICTORUM?: KVNamespace;
  /** Mot de passe de l'atelier, défini en variable secrète du Worker. */
  MOT_DE_PASSE?: string;
};

declare namespace App {
  interface Locals extends Runtime {}
}

type Runtime = import('@astrojs/cloudflare').Runtime<Environnement>;
