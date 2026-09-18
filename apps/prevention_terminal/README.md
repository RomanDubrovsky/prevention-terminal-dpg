# Prevention Terminal (Open Source)

The Prevention Terminal is the open-source client application for the **Prevention.AI** ecosystem. Built as an offline-first, highly secure desktop application for school psychologists, social workers, and territorial managers.

## Architecture & Technology Stack

- **Framework**: [Tauri v2](https://tauri.app/) (Rust + Webview)
- **Frontend**: React + TypeScript + Vite
- **Database**: Local SQLite with **SQLCipher** (AES-256 encryption)
- **State Management**: React Hooks + Tauri IPC

### Why Local-First?
Mental health data and student records are extremely sensitive. To comply with strict privacy laws (like GDPR, HIPAA, and local equivalents), the Terminal operates on a **Local-First** paradigm:
1. **Zero-Knowledge Cloud**: Personally Identifiable Information (PII) such as names, phone numbers, and exact addresses **never leave the device**. They are stored exclusively in the encrypted local SQLCipher database.
2. **K-Anonymity Routing**: When a specialist asks the AI Consultant for advice, the Terminal locally strips all names and replaces them with anonymous markers (e.g. `[Student A]`, `[Parent]`). The AI only sees behavioral patterns and context, never the real identity.
3. **Aggregated Telemetry**: Regional managers (HQ) receive aggregated, k-anonymous dashboards for resource allocation and monitoring, without ever accessing individual student case files.

## Features

- **Consultation Journal**: Full case management, session tracking, and automatic time logging.
- **AI Academy**: Built-in interactive training for specialists using the offline knowledge base.
- **AI Consultant**: Seamless integration with the Prevention.AI brain (via secure headless API) to provide evidence-based intervention plans, functional behavior assessments (FBA), and risk analysis.
- **Role-based Workspaces**: Modular UI adapting to the user's role (School Psychologist, Principal, Territorial Manager).

## Building from Source

### Prerequisites
- Node.js >= 22
- Rust (latest stable)
- Tauri dependencies for your OS (see [Tauri Setup Guide](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation
1. Clone the repository and navigate to the terminal app:
   ```bash
   cd apps/prevention_terminal
   npm install
   ```

2. Sync the module manifest (required before building):
   ```bash
   npm run sync:manifest
   ```

3. Run in Development Mode:
   ```bash
   npm run tauri:dev
   ```

### Editions
The Terminal supports multiple editions (`intl` and `ru`). The default is `intl` (International / UNICEF).
To build for a specific edition, set the `VITE_TERMINAL_EDITION` environment variable:

```powershell
# Windows
$env:VITE_TERMINAL_EDITION="intl"
npm run tauri:build
```

```bash
# macOS / Linux
VITE_TERMINAL_EDITION=intl npm run tauri:build
```

## Security & Master Password

Upon first launch, the Terminal prompts the user to create an offline Master Password. This password generates the key used by SQLCipher to encrypt the local database. 
**Note:** There is no cloud recovery for the Master Password. If lost, the local data cannot be decrypted. In an enterprise setup, the organization administrator can issue a new pairing code to restore the user's access to the network, but historical local files will remain encrypted.

## Open Source vs Enterprise

This repository contains the Open-Source Terminal application. The AI models, knowledge base, secure routing layers, and federated analytical dashboards (the "Brain") are part of the proprietary **Prevention.AI Commercial Kit** and are hosted securely.

For information on deploying the full ecosystem, including the backend infrastructure, please refer to the official documentation or contact the Prevention.AI team.
