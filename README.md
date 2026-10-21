# QuizDesk

Alle deine Lernquizze in einer App. Quizze werden auf deinem Computer gespeichert und funktionieren auch **ohne Internet**. Unter **Entdecken** findest du Quizze, die andere geteilt haben.

## Die App auf einen Blick

- **Eine Bibliothek für alle Quizze:** Jedes Quiz ist eine Karteikarte mit Fach-Reiter. Suchen, nach Fach filtern, mit einem Klick starten.
- **Offline lernen:** Heruntergeladene Quizze liegen auf deinem Computer und laufen ohne Internet. Die vier Quizze unten sind schon beim ersten Start dabei.
- **Gemeinsame Sammlung:** Unter *Entdecken* stehen alle freigegebenen Quizze aus diesem Repository. Neue Versionen erkennt QuizDesk automatisch.
- **Eigene Quizze:** Jede Quiz-Datei (.html), z. B. eins, das du mit Claude erstellt hast, lässt sich hinzufügen, exportieren und für alle einreichen.
- **Sicher:** Jedes Quiz läuft in einem eigenen, abgeschotteten Fenster.
- **Für Windows, macOS und Linux**, kostenlos und Open Source (GPL-3.0).

## Die Quizze

| Quiz | Fach | Themen | Besonderes |
| --- | --- | --- | --- |
| **SQL-Abfragen-Quiz** | Datenbanken, M162 | 10 Themen von SELECT bis Normalisierung | Eingebaute SQLite-Testdatenbank zum Ausprobieren |
| **Mathe-Prüfungstraining** | Mathe | 8 Themen von Runden bis Gleichungssysteme | Rechenaufgaben mit Eingabe |
| **Netzwerkgrundlagen-Quiz** | Telematik | 6 Bereiche, 29 Lernziele | Fortschritt pro Lernziel, Rechenaufgaben immer neu |
| **HTTP Quizshow** | Telematik, HTTP | 36 Fragen | Quizshow mit Zeitlimit und Punkten wie bei Kahoot |

### SQL-Abfragen-Quiz (M162)

Übt SQL-Abfragen lesen und schreiben, mit Beispielen aus dem Lehrbetrieb (Lernende, Kurse, Bestellungen, Mitarbeitende). Jede Frage gibt es in mehreren Varianten, darum sieht jede Runde anders aus.

- **Themen:** SELECT-Grundlagen · DISTINCT & ALL · AS & Verketten · Berechnungen & Funktionen · ORDER BY · WHERE & Vergleiche · AND, OR, NOT, BETWEEN · LIKE & Platzhalter · NULL & leere Werte · Normalisierung (1. bis 3. NF)
- **Einstellungen:** Schwierigkeit (Leicht, Mittel, Schwer), Aufgabentyp (Multiple Choice oder selbst eingeben), Themen, Anzahl Fragen
- **Extra:** eine SQLite-Testdatenbank, in der du eigene Abfragen ausführen kannst; am Ende eine Auswertung nach Thema und eine Liste zum Wiederholen

### Mathe-Prüfungstraining

Aufgaben zur Vorbereitung auf die Mathe-Prüfung, als Multiple Choice oder mit eigener Eingabe (Tausender mit oder ohne Apostroph, Dezimalpunkt oder Komma).

- **Themen:** Runden · Einheiten (z. B. km/h, m/s, Fr.) · Potenzen · Verhältnisse & Kehrwert · Prozent & Promille · Wachstumsfaktor · Gleichungssysteme · Vorsätze (kilo, milli …)
- **Einstellungen:** Schwierigkeit, Aufgabentyp, Themen, Anzahl Fragen
- **Extra:** Auswertung nach Thema und eine Liste der Fehler zum Wiederholen

### Netzwerkgrundlagen-Quiz (Telematik)

Deckt das Telematik-Lehrmittel kapitelweise ab. Rechenaufgaben (Zahlensysteme, Subnetting) werden jedes Mal neu erzeugt.

- **Grundlagen & Zahlensysteme:** Kommunikation & Netzausdehnung, Bits, Bytes & Präfixe, Zahlensysteme umrechnen, Bool’sche Operationen
- **IP-Adressierung & Subnetting:** CIDR-Analyse, Präfix ↔ Netzmaske, Anzahl Subnetze, Broadcast, spezielle Adressen, Maskenregeln & Supernetting, DHCP, Subnetze planen
- **Netzwerkkomponenten & Topologien:** NIC, Hub, Switch, Router, AP, Firewall & DMZ, Topologien & Ausfallsicherheit, NAT
- **Referenzmodelle & Protokolle:** OSI- und TCP/IP-Modell, TCP vs. UDP, DNS, DHCP, ICMP, ARP, Kapselung, Ports & Sockets
- **Hardware-Adressierung & Medien:** MAC vs. IP vs. Port, `ipconfig /all`, Übertragungsmedien
- **WLAN, Netzplan & Werkzeuge:** WLAN-Standards, Performance & Sicherheit, Netzplan, Kommandozeile & Wireshark
- **Extra:** Trefferquote pro Lernziel wird gespeichert; falsche Antworten kommen in eine Wiederholungsliste, bis sie sitzen

### HTTP Quizshow (Telematik)

36 Fragen zum Moodle-Buch «HTTP» im Stil einer Quizshow: vier farbige Antworten, Zeitbalken, mehr Punkte für schnelle Antworten und Bonus für Serien.

- **Themen:** Client & Server, zustandslos, Header & Body, Anfragemethoden (GET, POST, HEAD, PUT, PATCH, DELETE), Wireshark-Praxis, Statuszeile und Response-Header
- **Einstellungen:** 10, 15 oder alle Fragen; 20 bis 90 Sekunden pro Frage
- **Extra:** Am Ende siehst du die Fragen, die du nochmals anschauen solltest

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
