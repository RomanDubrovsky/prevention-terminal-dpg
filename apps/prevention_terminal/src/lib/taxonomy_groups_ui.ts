/** Collapsible taxonomy groups - remember expand/collapse preference. */

export type TaxonomyGroupsMode = "expanded" | "collapsed";

const STORAGE_KEY = "terminal.taxonomy.groupsMode";

export function readTaxonomyGroupsMode(): TaxonomyGroupsMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "collapsed" || raw === "expanded") return raw;
  } catch {
    /* ignore */
  }
  return "expanded";
}

export function writeTaxonomyGroupsMode(mode: TaxonomyGroupsMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

