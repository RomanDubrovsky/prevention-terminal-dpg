import { useMemo, useState } from "react";

import {
  getRegistrySecurityGuide,
  tagLabel,
  type PasswordManagerOption,
} from "../content/registry_security.ts";

interface RegistrySecurityGuideProps {
  defaultOpen?: boolean;
  compact?: boolean;
  commercial?: boolean;
}

function PasswordManagerCard(props: { pm: PasswordManagerOption }) {
  const { pm } = props;
  return (
    <article className="registry-pm-card">
      <header>
        <h4>
          <a href={pm.url} target="_blank" rel="noopener noreferrer">
            {pm.name}
          </a>
        </h4>
        <div className="registry-pm-tags">
          {pm.tags.map((t) => (
            <span key={t} className="registry-pm-tag">
              {tagLabel(t)}
            </span>
          ))}
        </div>
      </header>
      <p>{pm.description}</p>
      <p className="muted tiny">
        <strong>Как сохранить ключ:</strong> {pm.howTo}
      </p>
    </article>
  );
}

export default function RegistrySecurityGuide(props: RegistrySecurityGuideProps) {
  const { defaultOpen = false, compact = false, commercial = false } = props;
  const [open, setOpen] = useState(defaultOpen);
  const guide = useMemo(() => getRegistrySecurityGuide(commercial), [commercial]);
  const isRu = guide.edition === "ru";

  if (compact) {
    return (
      <div className="registry-guide compact">
        <button type="button" className="registry-guide-toggle" onClick={() => setOpen(!open)}>
          {open
            ? isRu
              ? "Скрыть инструкцию"
              : "Hide guide"
            : isRu
              ? "Подробная инструкция: реестр, резервная копия, менеджеры паролей"
              : "Full guide: registry, backup, password managers"}
        </button>
        {open && <RegistrySecurityGuide defaultOpen commercial={commercial} />}
      </div>
    );
  }

  return (
    <div className="registry-guide">
      <header className="registry-guide-header">
        <h3>{guide.title}</h3>
        <p className="muted">{guide.intro}</p>
      </header>

      {guide.sections.map((section) => (
        <details key={section.id} className="registry-guide-section" open={section.id === "who-needs-this"}>
          <summary>{section.title}</summary>
          <div className="registry-guide-body">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      ))}

      <section className="registry-guide-block">
        <h4>{isRu ? "Куда сохранить ключ (сервисы для России)" : "Where to store the recovery key"}</h4>
        <p className="muted tiny">
          {guide.pmIntegratorNote}
        </p>
        <div className="registry-pm-grid">
          {guide.passwordManagers.map((pm) => (
            <PasswordManagerCard key={pm.id} pm={pm} />
          ))}
        </div>
      </section>

      <section className="registry-guide-block">
        <h4>{isRu ? "Пошагово: резервная копия" : "Backup checklist"}</h4>
        <ol className="registry-backup-steps">
          {guide.backupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="registry-guide-block">
        <h4>FAQ</h4>
        <dl className="registry-faq">
          {guide.supportFaq.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="muted tiny registry-legal">{guide.legalNote}</p>
    </div>
  );
}
