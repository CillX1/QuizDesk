# QuizDesk

Alle deine Lernquizze in einer App. Quizze werden auf deinem Computer gespeichert und funktionieren auch **ohne Internet**. Unter **Entdecken** findest du Quizze, die andere geteilt haben.

## Herunterladen

Unter [Releases](https://github.com/CillX1/QuizDesk/releases/latest):

| System | Datei |
| --- | --- |
| Windows | `QuizDesk-…-win-x64.exe` |
| macOS (Apple Silicon) | `QuizDesk-…-mac-arm64.dmg` |
| macOS (Intel) | `QuizDesk-…-mac-x64.dmg` |
| Linux | `.AppImage` oder `.deb` |

Die App ist nicht von Microsoft oder Apple signiert:
- **Windows:** Bei „Der Computer wurde durch Windows geschützt“ auf *Weitere Informationen* → *Trotzdem ausführen* klicken.
- **macOS:** Beim ersten Start Rechtsklick auf QuizDesk → *Öffnen*.

## So funktioniert es

- **Meine Quizze:** alles, was auf deinem Computer gespeichert ist. Starten, exportieren (als .html-Datei zum Weitergeben) oder entfernen.
- **Entdecken:** die gemeinsame Sammlung aus diesem Repository (`quizzes/`). Ein Klick auf *Herunterladen*, und das Quiz ist offline verfügbar. Gibt es eine neue Version, zeigt QuizDesk *Update laden* an.
- **+ Quiz aus Datei:** eine Quiz-Datei (.html) hinzufügen, z. B. ein Quiz, das du mit Claude erstellt hast.

## Eigenes Quiz teilen

1. Quiz mit **+ Quiz aus Datei** hinzufügen.
2. Auf der Karte **Einreichen** klicken. QuizDesk legt eine `.quiz.txt`-Kopie in deinen Downloads ab und öffnet das Formular [Quiz einreichen](https://github.com/CillX1/QuizDesk/issues/new?template=quiz.yml).
3. Datei ins Feld *Quiz-Datei* ziehen und absenden (ein kostenloses GitHub-Konto ist nötig).

Nach der Freigabe erscheint es für alle unter **Entdecken**.

### Für die Freigabe (Maintainer)

Quiz-Issue anschauen und das Quiz testen. Passt alles, das Label **`freigegeben`** setzen. Die Action *Add approved quiz* fügt die Datei zu `quizzes/` hinzu, trägt sie in `quizzes/catalog.json` ein und schliesst das Issue. Klappt etwas nicht, schreibt sie einen Kommentar ins Issue.

## Sicherheit

Jedes Quiz läuft in einem abgeschotteten Fenster ohne Zugriff auf deine Dateien, Kamera oder Mikrofon. Links öffnen sich im normalen Browser.

## Entwickeln

```
npm install
npm start
```

Ein Tag `vX.Y.Z` pushen baut die Installer für Windows, macOS und Linux und hängt sie an das Release.

Lizenz: GPL-3.0
