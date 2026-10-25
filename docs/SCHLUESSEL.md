# Schlüssel und Secrets setzen

Alle Befehle für das Terminal in VS Code (PowerShell), gestartet im Hauptordner des Projekts. Die `wrangler`-Befehle laufen im Ordner `apps/api`, weil dort die `wrangler.toml` liegt.

So läuft das Setzen ab: Der Befehl fragt nach dem Wert, du fügst ihn ein (Strg+V oder Rechtsklick) und drückst Enter. Beim Einfügen ist nichts zu sehen, das ist Absicht. Der Wert landet so weder im Verlauf des Terminals noch in einer Datei.

Gesetzte Secrets lassen sich bei Cloudflare und GitHub nicht mehr auslesen, nur überschreiben. Die einzige Kopie der Werte steht in `.env` im Hauptordner (nicht im Repository). Wenn du dort etwas änderst, auch die `.env` nachziehen.

## Überblick

| Name | Wo | Stand | Wofür |
|---|---|---|---|
| `APP_KEY` | Worker | gesetzt | Anmeldung in der App |
| `INGEST_KEY` | Worker und GitHub, gleicher Wert | gesetzt | Zugang der Pipeline zur Datenbank |
| `API_URL` | GitHub | gesetzt | Adresse des Workers für die Pipeline |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | GitHub, der öffentliche zusätzlich in `wrangler.toml` | gesetzt | Push-Benachrichtigungen |
| `DEEPSEEK_API_KEY` | GitHub | offen | KI beim Einsammeln |
| `LLM_API_KEY` | Worker | offen | KI für Brücken-Vorschläge in der App |
| `GITHUB_TOKEN` | Worker | offen | Knopf „Jetzt einsammeln“, sofortige Probeläufe |
| `BRAVE_API_KEY` | GitHub | optional | Websuche für die Erkundung |
| `CRAWLER_CONTACT`, `VAPID_SUBJECT` | GitHub | vorerst leer | Kontaktadresse |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AUTO_DEPLOY` | GitHub | optional | automatisch veröffentlichen |

Änderungen an Worker-Secrets wirken sofort, ohne neues Veröffentlichen. GitHub-Secrets gelten ab dem nächsten Lauf.

## Vorher: angemeldet?

```powershell
gh auth status
cd apps/api
npx wrangler whoami
cd ../..
```

Meldet `wrangler`, dass die Anmeldung abgelaufen ist: im Ordner `apps/api` `npx wrangler login` ausführen und im Browser auf „Allow“ klicken.

## Der App-Schlüssel (`APP_KEY`)

Ist schon gesetzt, du musst ihn nur eingeben. Der Wert steht in `.env` in der Zeile `APP_KEY=` (alles nach dem Gleichheitszeichen).

Eingeben musst du ihn einmal pro Gerät und Browser. Bequemer als Abtippen: einmal diese Adresse öffnen, mit dem Wert hinten angehängt:

```text
https://stellenbuechlein.philipp-thuering.workers.dev/#key=HIER_DEN_APP_KEY
```

Die App übernimmt den Schlüssel und entfernt ihn sofort aus der Adresse. Den Link nicht als Lesezeichen speichern und nicht weitergeben, denn wer ihn hat, kommt in die App.

## DeepSeek (KI)

Schlüssel anlegen unter https://platform.deepseek.com/api_keys. DeepSeek rechnet nach Verbrauch ab, dafür vorher Guthaben aufladen. Derselbe Schlüssel kommt an zwei Stellen hin:

```powershell
gh secret set DEEPSEEK_API_KEY -R Pthuering/stellenbuechlein
cd apps/api
npx wrangler secret put LLM_API_KEY
cd ../..
```

## GitHub-Token für „Jetzt einsammeln“

Mit dem Token darf der Worker zwei Abläufe in deinem Repository starten: das Einsammeln und den Probelauf neuer Quellen. Er kann sonst nichts lesen oder ändern.

1. https://github.com/settings/personal-access-tokens/new öffnen (*Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*).
2. **Token name:** zum Beispiel `Stellenbüchlein Jetzt einsammeln`.
3. **Resource owner:** `Pthuering`.
4. **Expiration:** zum Beispiel ein Jahr. Das Ablaufdatum in den Kalender eintragen; danach geht der Knopf nicht mehr, bis ein neuer Token gesetzt ist.
5. **Repository access:** *Only select repositories*, dann `Pthuering/stellenbuechlein` auswählen.
6. **Permissions → Repository permissions → Actions:** *Read and write*. In der neueren Ansicht heißt das *Add permissions → Actions*, dann den Zugriff auf *Read and write* stellen. *Metadata: Read-only* kommt automatisch dazu, mehr braucht es nicht.
7. *Generate token* und den Token (beginnt mit `github_pat_`) sofort kopieren. GitHub zeigt ihn nur dieses eine Mal.
8. In den Worker:

   ```powershell
   cd apps/api
   npx wrangler secret put GITHUB_TOKEN
   cd ../..
   ```

9. Prüfen: App neu laden, *Ich → Einsammeln*. Dort steht jetzt der Knopf **Jetzt**.

Ist der Token abgelaufen: Schritte 1 bis 8 wiederholen. Der neue Token ersetzt den alten.

## Optional: Websuche und Kontaktadresse

```powershell
gh secret set BRAVE_API_KEY -R Pthuering/stellenbuechlein
```

Die Kontaktadresse ist nicht geheim, deshalb geht sie direkt im Befehl mit. Die Adresse im ersten Befehl sehen alle Websites, die die Pipeline abruft, die im zweiten die Push-Dienste von Google und Apple:

```powershell
gh secret set CRAWLER_CONTACT -R Pthuering/stellenbuechlein --body "deine@adresse.de"
gh secret set VAPID_SUBJECT -R Pthuering/stellenbuechlein --body "mailto:deine@adresse.de"
```

Danach in der App den Punkt „Kontaktadresse“ der Checkliste von Hand abhaken.

## Optional: automatisch veröffentlichen

Dann lädt jeder Push auf `main` App und Worker selbst zu Cloudflare hoch.

1. Unter https://dash.cloudflare.com/profile/api-tokens *Create Token* wählen, Vorlage **Edit Cloudflare Workers**.
2. Eine Berechtigung ergänzen: *Account → D1 → Edit*. Bei den Konto-Ressourcen dein Konto wählen, dann *Continue to summary → Create Token* und den Token kopieren.
3. Die Account-ID steht in der Ausgabe von `npx wrangler whoami` (im Ordner `apps/api`).

```powershell
gh secret set CLOUDFLARE_API_TOKEN -R Pthuering/stellenbuechlein
gh secret set CLOUDFLARE_ACCOUNT_ID -R Pthuering/stellenbuechlein --body "DEINE_ACCOUNT_ID"
gh variable set AUTO_DEPLOY -R Pthuering/stellenbuechlein --body "true"
```

## Einen Schlüssel wechseln

Einen neuen Zufallswert erzeugen:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **`APP_KEY`:** im Ordner `apps/api` `npx wrangler secret put APP_KEY`, in `.env` eintragen. Danach auf jedem Gerät in der App *Ich → Abmelden* und den neuen Schlüssel eingeben.
- **`INGEST_KEY`:** muss an beiden Stellen gleich sein, sonst bricht die Pipeline mit 401 ab:

  ```powershell
  gh secret set INGEST_KEY -R Pthuering/stellenbuechlein
  cd apps/api
  npx wrangler secret put INGEST_KEY
  cd ../..
  ```

- **Push-Schlüssel:** `npx web-push generate-vapid-keys`, den öffentlichen in `apps/api/wrangler.toml` bei `VAPID_PUBLIC_KEY` eintragen und `npm run deploy`, beide mit `gh secret set VAPID_PUBLIC_KEY …` und `gh secret set VAPID_PRIVATE_KEY …` nach GitHub. Danach auf jedem Gerät *Ich → Fristen-Erinnerungen* neu einschalten.

## Nachsehen, was gesetzt ist

Zeigt nur die Namen, keine Werte:

```powershell
gh secret list -R Pthuering/stellenbuechlein
cd apps/api
npx wrangler secret list
cd ../..
```

## Einen Lauf von Hand starten

```powershell
gh workflow run einsammeln.yml -R Pthuering/stellenbuechlein
gh run watch -R Pthuering/stellenbuechlein
```
