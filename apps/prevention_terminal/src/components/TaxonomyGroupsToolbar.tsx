import { t } from "../lib/i18n.ts";

interface TaxonomyGroupsToolbarProps {
  mode: "expanded" | "collapsed";
  onExpandAll: () => void;
  onCollapseAll: () => void;
  disabled?: boolean;
}

export default function TaxonomyGroupsToolbar(props: TaxonomyGroupsToolbarProps) {
  const { mode, onExpandAll, onCollapseAll, disabled } = props;
  return (
    <div className="taxonomy-groups-toolbar" role="group" aria-label={t("Группы классификатора", "Taxonomy groups")}>
      <button
        type="button"
        className={`ob-btn secondary tiny${mode === "expanded" ? " is-active" : ""}`}
        disabled={disabled}
        onClick={onExpandAll}
      >
        {t("Все открыть", "Expand all")}
      </button>
      <button
        type="button"
        className={`ob-btn secondary tiny${mode === "collapsed" ? " is-active" : ""}`}
        disabled={disabled}
        onClick={onCollapseAll}
      >
        {t("Все закрыть", "Collapse all")}
      </button>
    </div>
  );
}