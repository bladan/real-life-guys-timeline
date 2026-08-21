![The Real Life Guys YouTube Zeitstrahl](doc/front_page_title.jpg)

# The Real Life Guys YouTube Zeitstrahl

In diesem Projekt werden die Youtube-Videos aus den Kanälen der Real Life Guys abgefragt und eine Website generiert mit allen Videos in einem Zeitstrahl. Die Website ist hier:

https://bladan.github.io/real-life-guys-timeline/

## Entwickler Info

Es handelt sich um ein Node-Projekt welches anhand Astro eine statische Website generiert. Die Video-Metadaten werden von der YouTube Data API abgefragt und in JSON-Files abgelegt in  `site/data/videos/`. Für das Deployment werden die Files nach `site/public/videos/` kopiert.

## Projektstruktur

Das Node/Astro-Projekt liegt in `site/`. Alle Befehle werden aus diesem Ordner ausgeführt.

```
site/
  data/videos/     # Quell-Metadaten von der YouTube Data API (eingecheckt)
  public/videos/   # generierte Kopie für den Browser (nicht in Git)
  scripts/         # Skripte zum Abrufen + Synchronisieren der Daten
  src/             # Astro-Seiten und Styles
```

## Voraussetzungen

- Node.js 22 oder neuer (siehe `site/.nvmrc`)
- npm
- YouTube Data API v3 Google Cloud Key zum Aktualisieren der Videodaten
- Idealerweise wird VS Code mit dem bereitgestellten Devcontainer-File verwendet

## Einrichtung

```sh
cd site
npm install
```

Lokale Umgebungsvariablen aus der Beispieldatei erstellen:

```sh
cp .env.example .env
```

Setze `YOUTUBE_API_KEY` und `YOUTUBE_CHANNELS` in `site/.env` oder in deiner Shell-Umgebung. Echte API-Keys nicht einchecken.

Optional kannst du Google Analytics 4 aktivieren, indem du `PUBLIC_GA_MEASUREMENT_ID` setzt (z.B. `G-XXXXXXXXXX`).
Wenn die Variable leer bleibt, wird kein Analytics-Script geladen.
Wenn die Variable gesetzt ist, erscheint ein Consent-Banner und Analytics wird erst nach Zustimmung geladen.

## Kanäle konfigurieren

Kanäle werden über `YOUTUBE_CHANNELS` mit komma-separierten Kanal-IDs konfiguriert:

```sh
YOUTUBE_CHANNELS=UCn0ITRHWS64_zRz5WWeQBkQ,UCKQTX-NQmyOV_Uo-xFvlhcQ
```

Die Reihenfolge der IDs bestimmt die Anzeigereihenfolge für Kanalfarben und Filter.

## Skripte

Diese Befehle werden aus `site/` ausgeführt:

```sh
npm run fetch-videos  # data/videos/ von der YouTube Data API aktualisieren

npm run dev           # Daten synchronisieren und Astro-Dev-Server starten

npm run build         # Daten synchronisieren und statische Seite bauen

npm run preview       # Produktions-Build in der Vorschau ansehen

npm run lint          # Code mit ESLint prüfen
npm run format        # Code mit Prettier formatieren
```

## Datenfluss

1. `npm run fetch-videos` liest die Kanäle aus `YOUTUBE_CHANNELS`.
2. Es schreibt paginierte Metadaten nach `data/videos/<channel-id>/`.
3. `npm run dev` und `npm run build` kopieren `data/videos/` nach `site/public/videos/`.
4. Die Astro-Seite lädt die JSON-Dateien im Browser bei Bedarf nach.

## Lizenz

MIT
