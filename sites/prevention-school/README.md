# prevention.school — marketing site

Static marketing site for the Prevention AI Platform.

| Domain | Cloudflare Pages project | Roles |
|--------|--------------------------|-------|
| https://prevention.school | `prevention-school` | A) intl platform · B) app landings · C) `/tilda/ru/` staging |
| https://www.prevention.school | `prevention-school` | same |
| https://ru.prevention.school | `ru-prevention-school` | RU mirror + dashboard (from tilda/ru + ru-prevention-school) |

**Full map:** `docs/PREVENTION_SCHOOL_SITES.md`

## Structure

```
sites/prevention-school/
  index.html              — home (intl platform)
  teenology/              — Teenology EN → teenology.care
  platform/ science/ partners/ author/ ida/ …
  tilda/ru/               — RU staging for irpp-edu.ru (Tilda copy source)
    profilaktika/ teenology/ terminal/
  assets/
```

## Build & deploy (from repo root)

```powershell
npm run prevention-school:publish    # → prevention.school (incl. /tilda/ru/)
npm run ru-prevention-school:publish # → ru.prevention.school (mirror RU pages)
```

Related: specialist workspace → `web.prevention.school` · Teenology PWA → `teenology.care`
