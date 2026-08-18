/**
 * Ce que Romain écrit, et la façon dont il veut le voir présenté.
 *
 * Deux choses distinctes vivent ici :
 *  - `src/contenu/<section>/<slug>.md`  — ses textes ;
 *  - `src/contenu/mises-en-page/<section>/<slug>.json` — la disposition de blocs
 *    qu'il a composée dans l'éditeur.
 *
 * Les deux sont facultatifs. Sans texte, la fiche affiche ses faits et le
 * chemin du fichier à créer ; sans mise en page, elle prend la disposition
 * par défaut. Le script d'import ne touche jamais à ces fichiers.
 */

interface ModuleMarkdown {
  frontmatter: Record<string, unknown> & { titre?: string; resume?: string };
  Content: unknown;
  compiledContent: () => string;
}

const textes = import.meta.glob<ModuleMarkdown>('/src/contenu/**/*.md', { eager: true });
const dispositions = import.meta.glob<{ default: { blocs: unknown[] } }>(
  '/src/contenu/mises-en-page/**/*.json',
  { eager: true }
);

/** Le module Markdown d'une fiche, ou null si elle n'est pas encore écrite. */
export function texteDe(section: string, slug: string): ModuleMarkdown | null {
  return textes[`/src/contenu/${section}/${slug}.md`] ?? null;
}

/** Le même texte, déjà transformé en HTML — c'est ce que consomment les blocs. */
export function htmlDe(section: string, slug: string): string | null {
  const module = texteDe(section, slug);
  if (!module) return null;
  try {
    return module.compiledContent();
  } catch {
    return null;
  }
}

/** La disposition composée dans l'éditeur, si elle a été enregistrée. */
export function dispositionDe(section: string, slug: string): unknown[] | null {
  const module = dispositions[`/src/contenu/mises-en-page/${section}/${slug}.json`];
  const blocs = module?.default?.blocs;
  return Array.isArray(blocs) && blocs.length ? blocs : null;
}

/** Nombre de fiches déjà rédigées, par section — utilisé sur l'accueil. */
export function avancement(): { total: number; parSection: Record<string, number> } {
  const parSection: Record<string, number> = {};
  for (const chemin of Object.keys(textes)) {
    if (chemin.includes('/mises-en-page/')) continue;
    const section = chemin.split('/')[3] ?? 'divers';
    parSection[section] = (parSection[section] ?? 0) + 1;
  }
  return { total: Object.values(parSection).reduce((n, v) => n + v, 0), parSection };
}

/** Pages libres : tout .md rangé dans src/contenu/articles/. */
export function articles(): { slug: string; module: ModuleMarkdown }[] {
  return Object.entries(textes)
    .filter(([chemin]) => chemin.startsWith('/src/contenu/articles/'))
    .map(([chemin, module]) => ({
      slug: chemin.replace('/src/contenu/articles/', '').replace(/\.md$/, ''),
      module,
    }));
}
