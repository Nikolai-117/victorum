/**
 * Textes écrits par Romain.
 *
 * Un fichier `src/contenu/<section>/<slug>.md` est facultatif : quand il
 * n'existe pas, la fiche affiche ses faits et une invitation à écrire.
 * Le script d'import ne crée ni ne modifie jamais ces fichiers.
 */

interface ModuleMarkdown {
  frontmatter: Record<string, unknown> & { titre?: string; resume?: string };
  Content: unknown;
}

const modules = import.meta.glob<ModuleMarkdown>('/src/contenu/**/*.md', { eager: true });

/** Retourne le texte de la fiche, ou null si Romain ne l'a pas encore écrite. */
export function texteDe(section: string, slug: string): ModuleMarkdown | null {
  return modules[`/src/contenu/${section}/${slug}.md`] ?? null;
}

/** Nombre de fiches déjà rédigées, par section — utilisé sur l'accueil. */
export function avancement(): { total: number; parSection: Record<string, number> } {
  const parSection: Record<string, number> = {};
  for (const chemin of Object.keys(modules)) {
    const section = chemin.split('/')[3] ?? 'divers';
    parSection[section] = (parSection[section] ?? 0) + 1;
  }
  return { total: Object.keys(modules).length, parSection };
}

/** Pages libres : tout .md rangé dans src/contenu/articles/. */
export function articles(): { slug: string; module: ModuleMarkdown }[] {
  return Object.entries(modules)
    .filter(([chemin]) => chemin.startsWith('/src/contenu/articles/'))
    .map(([chemin, module]) => ({ slug: chemin.replace('/src/contenu/articles/', '').replace(/\.md$/, ''), module }));
}
