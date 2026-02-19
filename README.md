# AI Email Manager

Eine KI-gestützte Desktop-E-Mail-Anwendung für macOS, gebaut mit Electron, React und TypeScript.

---

## Aktueller Stand

Die App ist voll funktionsfähig und produktionsreif für den persönlichen Einsatz. Alle geplanten Core-Features sind implementiert. Die App läuft lokal auf dem Desktop, speichert alle Daten in einer lokalen SQLite-Datenbank und kommuniziert direkt per IMAP/SMTP mit E-Mail-Servern – keine Daten verlassen das Gerät (außer an die KI-API deiner Wahl).

---

## Features

### E-Mail-Verwaltung
- **IMAP-Sync** – Synchronisiert mehrere Konten und Postfächer, inkrementell (nur neue E-Mails)
- **SMTP-Versand** – E-Mails direkt aus der App senden, mit CC/BCC-Unterstützung
- **Anhänge anzeigen** – Anhänge werden beim Öffnen einer E-Mail erkannt und können per Klick geöffnet werden (Dateigröße wird angezeigt)
- **Anhänge versenden** – Datei-Picker zum Hinzufügen von Anhängen beim Verfassen
- **Gesendete Mails speichern** – Nach dem Versand wird die E-Mail automatisch per IMAP APPEND in den Sent-Ordner geschrieben
- **E-Mails verschieben** – Per Kontextmenü in beliebige IMAP-Ordner verschieben oder in den Papierkorb
- **Löschen** – Lokal und per Shortcut (D)
- **Gelesen/Ungelesen markieren** – Synchronisiert die `\Seen`-Flag mit dem IMAP-Server

### Posteingang & Navigation
- **Resizable Panels** – Sidebar, E-Mail-Liste, Detail-Ansicht und KI-Assistent sind frei in der Breite anpassbar
- **Tastaturkürzel** – J/K oder Pfeiltasten zum Navigieren, N (neu), R (antworten), F (weiterleiten), D (löschen), / (Suche)
- **Flag/Stern-System** – E-Mails mit einem Stern markieren (sichtbar in Liste und Detail, persistiert in DB)
- **Bulk-Aktionen** – Mehrfachauswahl per Checkbox (Hover), Toolbar mit Gelesen/Ungelesen/Löschen und "Alle auswählen"
- **Kontextmenü** – Rechtsklick auf E-Mail: Gelesen markieren, Verschieben, Papierkorb, Löschen, KI-Analyse
- **Anhang-Indikator** – 📎 Symbol in der E-Mail-Liste bei E-Mails mit Anhängen

### Verfassen
- **Compose Modal** – Vollständiges Verfassen-Fenster mit Von/An/CC/BCC/Betreff/Body
- **E-Mail-Signatur** – In Einstellungen konfigurierbar, wird automatisch in neue E-Mails eingefügt
- **Entwürfe auto-speichern** – Beim Tippen automatisch als Entwurf im `localStorage` gespeichert, wird beim nächsten Öffnen wiederhergestellt
- **Kontakt-Autocomplete** – Dropdown mit Vorschlägen aus Absender-Historie beim Tippen in An/CC/BCC
- **Tastaturkürzel im Compose** – `Ctrl+Enter` zum Senden, `Esc` zum Schließen
- **Anhänge hinzufügen** – Datei-Picker-Button, mehrere Dateien wählbar, per ✕ wieder entfernbar

### Suche
- **Volltextsuche** – FTS5-indizierte Suche über Betreff und Body, mit LIKE-Fallback für Absender/Empfänger
- **Erweiterte Suche** – Filter nach Absender, Empfänger, Betreff, Datum, Lesestatus, Kategorie
- **KI-Semantiksuche** – Natürlichsprachliche Suchanfragen (z. B. "Rechnungen von letztem Monat"), powered by Claude/GPT/Gemini

### KI-Features
- **Automatische Kategorisierung** – E-Mails werden KI-basiert in Kategorien einsortiert (Newsletter, Wichtig, Arbeit usw.)
- **KI-Smart-Reply** – Kurze Antwortvorschläge und eine ausführliche Antwort per Klick generiert
- **Abmelde-Automatisierung** – "Abmelden"-Button bei Newsletter-E-Mails: nutzt `List-Unsubscribe` Header oder öffnet den Link
- **KI-Assistent (Chat)** – Seitenleiste mit einem KI-Assistenten, der Kontext über den Posteingang hat; kann einzelne E-Mails analysieren
- **Inbox-Briefing** – Tagesbriefing mit Zusammenfassung ungelesener E-Mails, Fristen und Prioritäten

### Thread-Ansicht
- **Konversations-Gruppierung** – Verwandte E-Mails werden in einer Konversations-Leiste unterhalb der Detail-Ansicht angezeigt (gruppiert nach `In-Reply-To`, Thread-ID oder Betreff)
- **Schnellnavigation** – Klick auf eine Nachricht in der Konversation wechselt direkt dorthin

### Statistik
- **Zeitverlauf-Diagramm** – SVG-Balkendiagramm der letzten 30 Tage (E-Mails pro Tag)
- **Zusammenfassungs-Kacheln** – Gesamt, Ungelesen, Markiert (Stern), Mit Anhang
- **Kategorie-Auswertung** – Alle Kategorien mit Anzahl, Mini-Balken (Anteil) und Top-5-Absendern
- **Schnellfilter** – Klick auf eine Kategorie filtert direkt den Posteingang

### Einstellungen & Darstellung
- **Mehrere Konten** – Beliebig viele IMAP/SMTP-Konten (IMAP + SMTP konfigurierbar)
- **Sync-Intervall** – Manuell oder automatisch (5/15/30/60 Minuten)
- **Theme** – Hell/Dunkel (System-Dark-Mode wird respektiert)
- **Schriftgröße** – Klein / Mittel / Groß
- **Schriftart** – System / Sans-serif / Serif / Monospace
- **Sidebar-Farbe** – 6 Farboptionen für die Navigationsleiste
- **E-Mail-Dichte** – Kompakt / Komfortabel / Geräumig
- **Kategorien verwalten** – Eigene Kategorien mit Name, Farbe und Beschreibung erstellen, bearbeiten, löschen
- **KI-Provider** – OpenAI, Anthropic (Claude) oder Google Gemini (OAuth)

---

## Technischer Stack

| Schicht | Technologie |
|---------|-------------|
| Desktop | Electron 40 |
| Build | electron-vite 5 |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Routing | React Router |
| Backend DB | SQLite (better-sqlite3), FTS5 |
| IMAP | imapflow (Connection Pool pro Konto) |
| SMTP | nodemailer |
| E-Mail-Parsing | mailparser (simpleParser) |
| KI | Anthropic Claude / OpenAI / Google Gemini |

---

## Architektur

```
src/
├── main/                  # Electron Main Process
│   ├── index.ts           # App-Einstiegspunkt, Window-Setup
│   ├── ipc.ts             # Alle IPC-Handler (Brücke Main ↔ Renderer)
│   ├── db/                # SQLite DAOs
│   │   ├── database.ts    # Schema, Migrationen
│   │   ├── emailDao.ts    # E-Mail CRUD, Suche, Bulk-Ops, Stern, Anhänge
│   │   ├── accountDao.ts  # Konto-Verwaltung
│   │   ├── categoryDao.ts # Kategorie-Verwaltung
│   │   └── settingsDao.ts # App-Einstellungen (Key-Value)
│   ├── email/             # IMAP/SMTP
│   │   ├── imapClient.ts  # IMAP-Operationen (sync, fetch, move, append, ...)
│   │   ├── imapPool.ts    # Persistente IMAP-Verbindung pro Konto (Mutex + Idle-Timeout)
│   │   ├── smtpClient.ts  # SMTP-Versand + Raw-Message für IMAP APPEND
│   │   ├── syncService.ts # Sync-Logik (inkrementell, Seen-Flag-Abgleich)
│   │   ├── prefetchService.ts # Hintergrund-Body-Prefetch mit Push-Event
│   │   └── syncScheduler.ts   # Automatischer Sync-Timer
│   └── ai/                # KI-Services
│       ├── assistantService.ts  # Chat, Analyse, Briefing
│       ├── classifyService.ts   # E-Mail-Kategorisierung
│       ├── replyService.ts      # Smart-Reply-Generierung
│       ├── searchService.ts     # Semantische Suche
│       ├── unsubscribeService.ts # Newsletter-Abmeldung
│       └── modelService.ts      # KI-Modell-Listing
├── preload/
│   └── index.ts           # contextBridge – exponiert electronAPI ans Renderer
├── renderer/              # React-App
│   ├── App.tsx            # Router, Theme, Body-Push-Events
│   ├── pages/             # Inbox, Statistics, Accounts, Settings
│   ├── components/        # EmailList, EmailDetail, ComposeModal, AiAssistant, ...
│   └── stores/            # Zustand Stores (email, account, category, settings, ...)
└── shared/
    └── types.ts           # Gemeinsame TypeScript-Typen (Email, Account, ElectronAPI, ...)
```

---

## Setup & Entwicklung

### Voraussetzungen
- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
npm install
```

### Entwicklung

```bash
npm run dev
```

> **Hinweis:** Wenn die App innerhalb von Claude Code gestartet wird, muss die Umgebungsvariable `ELECTRON_RUN_AS_NODE` entfernt werden. Das `dev`-Script in `package.json` ist bereits entsprechend konfiguriert (`env -u ELECTRON_RUN_AS_NODE electron-vite dev`).

### Build

```bash
npm run build
```

---

## Konfiguration

Beim ersten Start:
1. **Einstellungen → Konto hinzufügen** – IMAP/SMTP-Daten eingeben und Verbindung testen
2. **Einstellungen → KI-Konfiguration** – API-Schlüssel für OpenAI oder Anthropic eingeben (oder Google OAuth einrichten)
3. **Sync** – Ersten Sync starten (Sync-Button oben rechts)

---

## Lizenz

Privates Projekt – kein öffentliches Lizenzmodell.
