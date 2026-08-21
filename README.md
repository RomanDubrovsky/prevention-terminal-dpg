# Prevention AI Terminals & CRM — Digital Public Good (DPG)

## Overview
This repository contains the official open-source client interfaces, specialist terminals, and local CRM infrastructure for **Prevention AI** — an AI-native educational and prevention ecosystem designed for schools, educational psychologists, and specialists worldwide.

As part of our commitment to transparency and the **Digital Public Good (DPG)** initiative, this source code is made publicly available. Any educational institution in the world can deploy these interfaces and manage electronic records (IPP/ИРПП, Case Profiles, FBA & BIP Behavior Intervention Plans, and Manifestation Determination Reviews) at **zero software cost**.

## Privacy-by-Design Architecture & International Compliance
Designed from the ground up to meet and exceed the stringent data protection requirements of **UNESCO**, **UNICEF**, **ISO 27001**, and **GDPR**:

- 🔒 **Zero-Knowledge PII Storage**: Raw Personally Identifiable Information (PII) such as student names and birthdates never leaves the specialist's local device. All records are processed locally (via SQLite/SQLCipher) or completely anonymized before interacting with the platform API.
- 🛡️ **GUID-Based Tokenization**: Students and cases are represented internally via mathematically irreversible GUIDs. When interacting with the AI Co-Pilot, the engine analyzes behavioral vectors and situational dynamics without ever receiving student identities.
- 📜 **Ethical & Professional Boundaries**: The interface enforces strict professional workflows, ensuring that AI suggestions act purely as a cognitive co-pilot augmenting human accountability rather than replacing professional clinical judgment.

## Repository Structure
- `apps/prevention_terminal/` — Native desktop terminal application (Tauri + React/Vite + Rust + SQLite/SQLCipher) for school psychologists and specialists. Includes local offline inbox, electronic journal, and assessment tools.
- `apps/specialist_web/` — Web-based PWA edition of the specialist terminal optimized for Cloudflare Pages and modern browsers.
- `apps/teenology_app/` — Student and family-facing PWA interface (Teenology Navigator) for primary and secondary prevention support.
- `sites/prevention-school/` — Official static platform web portal and documentation (featuring the `/prevention-ai/` specialist toolkit specifications).
- `shared/web/` — Shared frontend UI component library, design tokens, and assessment forms.

## Getting Started
### Desktop Terminal Build (Windows / macOS / Linux)
Prerequisites: Node.js >= 18, Rust >= 1.70, OpenSSL.
```bash
cd apps/prevention_terminal
npm install
npm run tauri:build
```
The compiled installer (`.exe`, `.msi`, or `.dmg`) will be generated in `src-tauri/target/release/bundle/`.

### Web Terminal Development
```bash
cd apps/specialist_web
npm install
npm run dev
```

## License
Released under the Digital Public Good Open License for Educational and Humanitarian Institutions.
