# Prompt für Claude in Chrome — Praxura-Prüfung (Kalender, Leistungen, Menü)

> Alles ab der Trennlinie kopieren und in Chrome an Claude geben.
>
> **Vorher sicherstellen: die Seite zeigt den NEUEN Code.** Auf `app.praxura.de`
> läuft der alte Stand — dort prüft man nichts von dem hier Beschriebenen.
>
> Zwei Wege zum neuen Stand:
> 1. **Lokal** (kein Fremdzugang nötig): `.env.local` anlegen mit
>    `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` — beide Werte
>    stehen im Browser unter `https://app.praxura.de/api/config`. Dann
>    `node dev_server.cjs` und `http://localhost:8081/login.html` öffnen.
> 2. **Vercel-Preview** des Branches `kalender-ux`.
>
> **Gegenprobe, dass es der neue Stand ist:** Kalender → Woche. Die Uhrzeit-Leiste
> links muss genauso weit nach unten laufen wie die Tagesspalten. Läuft sie weit
> darüber hinaus, ist es der alte Code.

---

Du prüfst den Terminkalender einer Praxissoftware. Ich habe daran gerade
geändert und will wissen, ob es wirklich funktioniert. Ich brauche **Befunde,
keine Bestätigung** — schreib hin, was du siehst, auch wenn es langweilig ist.

## Grundregeln — bitte genau einhalten

1. **Keine Patientendaten wiedergeben.** In dieser Anwendung stehen echte
   Gesundheitsdaten. Nenne in deinem Bericht keine Namen, Geburtsdaten,
   Diagnosen oder Telefonnummern. Schreib „ein Termin", „der Patient", nicht
   den Namen. Wenn du einen Screenshot beschreibst, beschreibe Layout und
   Position, nicht den Inhalt.
2. **Nichts löschen.** Der Menüpunkt **„Absagen / stornieren"** löscht den
   Termin unwiderruflich. Du darfst das Menü öffnen und den Eintrag ansehen —
   **klicke ihn nicht an.**
3. **Nichts speichern, was du nicht wieder wegräumst.** Wenn du einen Termin
   anlegst, um etwas zu testen: brich den Dialog mit „Abbrechen" ab. Speichere
   nur, wenn ein Test es ausdrücklich verlangt — und sag mir dann, was
   entstanden ist, damit ich es entfernen kann.
   **Genau ein Abschnitt verlangt es: M (Blocker).** Dort steht auch, wie du
   hinterher aufräumst.
4. **Einstellungen unverändert lassen**, mit einer Ausnahme (Test G), und die
   danach zurückstellen.
5. Wenn etwas nicht geht wie beschrieben: **weitermachen** und es notieren.
   Nicht abbrechen.

## Vorbereitung

Öffne die Entwicklerkonsole (F12 → Reiter „Console") und lass sie offen.
Rote Fehlermeldungen sind Teil des Befunds. Notiere sie mit dem Wortlaut.

Geh dann links im Menü auf **Terminkalender**. Oben gibt es drei Reiter:
**Tag / Woche / Monat**.

---

## A — Wochenansicht: stimmt die Zeitleiste? (wichtigster Punkt)

Wechsle auf **Woche**.

1. Läuft die Uhrzeit-Leiste am linken Rand (08:00 … 19:30) **genauso weit nach
   unten** wie die sieben Tagesspalten daneben? Oder ist die Leiste deutlich
   länger und die Spalten enden weit darüber?
   → Das ist der Kernpunkt. Mach hier einen Screenshot der ganzen Ansicht.
2. Such einen Termin, der zu einer vollen oder halben Stunde beginnt.
   Liegt seine **Oberkante genau auf der Linie** der zugehörigen Uhrzeit?
   Oder sitzt er sichtbar zu tief / zu hoch? Screenshot, herangezoomt.
3. Steht im Terminblock links eine Uhrzeit, und stimmt die mit der Position
   überein?

## B — Termin anlegen per Doppelklick (Woche)

4. **Doppelklick auf eine leere Fläche**, z. B. Mittwoch 14:30.
   Erwartung: ein Dialog „Neuer Termin" geht auf, im Feld **„Von"** steht
   genau dieses Datum und **14:30**.
   Stimmt Datum und Uhrzeit? Screenshot des Dialogs.
5. Schließe mit **Abbrechen**.
6. Oberhalb des Kalenders gibt es Mitarbeiter-Auswahlfelder („Alle" und
   Namen). Wähle **„Alle"** und mach wieder einen Doppelklick auf eine leere
   Fläche. Erwartung: das Feld **„Mitarbeiter"** im Dialog ist **leer**.
   Abbrechen.
7. Wähle jetzt **einen einzelnen Mitarbeiter** und mach denselben Doppelklick.
   Erwartung: das Mitarbeiterfeld ist **mit diesem Namen vorbelegt**.
   Abbrechen.
8. Markiert der Doppelklick versehentlich Text (blau hinterlegte Uhrzeit)?

## C — Termin anklicken (Woche)

9. **Einfachklick auf einen Terminblock.** Erwartung: rechts geht ein
   Seitenbereich auf und zeigt diesen Termin.
   Passiert etwas? Ist es der richtige Termin (Uhrzeit vergleichen, **keinen
   Namen nennen**)? Schließe den Bereich wieder.

## D — Monatsansicht

Wechsle auf **Monat**.

10. **Einfachklick auf einen Tag** (freie Fläche der Kachel). Erwartung: nach
    einer kurzen Verzögerung (~¼ Sekunde) springt die Ansicht in die
    Tagesansicht dieses Tages. Passiert das? Fühlt sich die Verzögerung
    störend an?
11. Zurück auf **Monat**. **Doppelklick auf einen Tag.** Erwartung: der
    Termin-Dialog geht auf mit diesem Datum und **09:00** — und die Ansicht
    springt **nicht** zusätzlich in den Tag. Abbrechen.
12. Klick auf eine der farbigen **Termin-Pillen** in einer Kachel. Erwartung:
    der Seitenbereich rechts geht auf. Erwartung: es springt **nicht** in die
    Tagesansicht.

## E — Rechtsklick-Menü (neu)

Mach das in **allen drei** Ansichten: Tag, Woche, Monat.

13. **Rechtsklick auf einen Termin.** Erwartung: ein kleines Menü mit
    fünf Einträgen erscheint an der Mausposition:
    Termin wahrgenommen · Patient nicht erschienen · Verschieben · (Trennlinie)
    · Termin öffnen · Absagen / stornieren (rot).
    Screenshot. Erscheint es in allen drei Ansichten?
14. Sind einzelne Einträge **ausgegraut**? Falls ja: bei welchem Termin und
    welche? (Bei bereits erledigten Terminen sollen die oberen drei ausgegraut
    sein.)
15. **Pfeiltasten ↑ ↓** — wandert die Markierung durch die Einträge?
16. **Escape** — schließt es?
17. **Klick daneben** — schließt es?
18. **Scrollen bei offenem Menü** — schließt es?
19. **Rechtsklick ganz unten rechts** auf einen Termin nahe am Bildschirmrand.
    Erwartung: das Menü klappt nach innen und ist **vollständig sichtbar**,
    nicht halb außerhalb.
20. **Rechtsklick auf eine leere Kalenderfläche** (kein Termin). Erwartung:
    das **normale Chrome-Menü** erscheint, nicht meins.
21. Klick auf **„Termin öffnen"**. Erwartung: der Seitenbereich rechts geht
    auf, mit demselben Termin.
22. Klick auf **„Verschieben"**. Erwartung: oben erscheint ein Hinweisbalken
    („Zielzeit anklicken…"). Klicke **nicht** auf eine Zielzeit — brich mit
    dem Knopf **„Verschieben abbrechen"** ab. Ging das?
23. **„Absagen / stornieren" nur ansehen, nicht anklicken.**
24. Ist der Eintrag „Patient nicht erschienen" **anklickbar** (nicht
    ausgegraut), auch wenn du den Seitenbereich rechts vorher nie geöffnet
    hattest? — Nur ansehen, **nicht klicken**.

## F — Verschieben in der Wochenansicht

25. Wechsle auf **Woche**, öffne einen Termin (Klick), im Seitenbereich rechts
    gibt es „Verschieben". Klicke das an.
    Erwartung: die Ansicht bleibt in der **Woche** und springt nicht in die
    Tagesansicht.
26. Bewege die Maus über eine freie Zeit und klicke einmal. Erwartung: eine
    gestrichelte Vorschau erscheint. Ist sie **ungefähr so hoch wie der
    Termin**, oder auffällig zu hoch? Screenshot.
27. **Brich ab** („Verschieben abbrechen"). Nichts wirklich verschieben.

## G — Kompaktmodus (bekannter Fehler, nur bestätigen)

28. Geh in **Einstellungen** und suche den Schalter **Kompaktmodus**. Merk dir,
    ob er an oder aus war. Schalte ihn **an**.
29. Zurück zum Kalender, **Tagesansicht**. Erwartung laut meiner Analyse: die
    Termine sitzen jetzt **deutlich unterhalb** ihrer Uhrzeit, das Raster ist
    enger als die Blöcke. Bestätigt sich das? Screenshot.
30. Schau auch in die **Woche**. Gleicher Effekt?
31. **Schalte den Kompaktmodus wieder auf den ursprünglichen Stand zurück.**

## J — Kopfleiste des Kalenders (neu umgebaut)

Der Kopfbereich hatte drei Ebenen übereinander, jetzt sind es zwei.

32. Schau dir den Bereich über dem Kalender an. Erwartung:
    - **Eine Leiste**: links die Pfeile ‹ › mit dem Datum, direkt daneben die
      Tabs Tag/Woche/Monat, ganz rechts ein Knopf **„Buchungslink"** mit
      Kopier-Symbol.
    - **Darunter eine zweite Leiste**: die Mitarbeiter-Auswahl und rechts
      **„Abwesenheit eintragen"**.
    - Oben rechts nur noch **„+ Termin"**, unauffällig statt farbig.
    Screenshot der ganzen Kopfzeile.
33. Sind Datum/Pfeile und die Tabs **nebeneinander** oder immer noch an den
    gegenüberliegenden Rändern auseinandergezogen?
34. Gibt es **irgendwo noch die ausgeschriebene URL** `https://app.praxura.de/...`
    als eigene Zeile? Die soll weg sein.
35. Fahr mit der Maus über den Knopf „Buchungslink": erscheint die vollständige
    URL als Tooltip? Klick ihn an — kommt die Meldung „Kopiert"? Füge den
    Inhalt der Zwischenablage irgendwo ein und prüfe, ob es ein Link ist.
36. Hat die Praxis **mehrere Mitarbeiter**? Dann: scroll die Mitarbeiter-Leiste
    waagerecht. Erwartung: der Knopf „Abwesenheit eintragen" bleibt rechts
    stehen und **scrollt nicht mit**.
37. Klick „Abwesenheit eintragen" — geht der Dialog auf wie vorher? Abbrechen.

## K — Farben nach Leistung (neu)

Bisher hatten alle Termine die Farbe des Mitarbeiters. Jetzt gilt:
**Fläche = Leistung, linker Rand = Mitarbeiter.**

38. Geh ins Menü auf **Leistungen** (steht jetzt unter „Abrechnung", siehe N).
    Öffne eine Leistung zum Bearbeiten. Erwartung: ein Feld **„Farbe im
    Kalender"** mit acht Farbfeldern und einem Farbwähler daneben.
    Screenshot.
39. Wähle eine deutlich andere Farbe (z. B. Rot) und **speichere**.
    Erwartung: in der Leistungsübersicht hat die Kachel jetzt einen farbigen
    Punkt vor dem Namen.
40. Öffne dieselbe Leistung erneut. Erwartung: die gewählte Farbe ist markiert —
    sie wurde also wirklich gespeichert und nicht nur angezeigt.
41. Geh in den Kalender. Ein Termin mit dieser Leistung soll jetzt in der neuen
    Farbe erscheinen — in **Tages-, Wochen- und Monatsansicht**, und auch im
    Tagesplan auf der Startseite. Screenshots von mindestens zwei Ansichten.
42. Hat der Terminblock zusätzlich einen **andersfarbigen linken Rand**
    (die Mitarbeiterfarbe)? Bei nur einem Mitarbeiter kann er gleich aussehen —
    dann notier das einfach.
43. Gibt es Termine, deren Fläche **gar keine Farbe** hat oder die unsichtbar
    wirken? Das wäre ein Fehler.
44. Setz die Farbe wieder auf den ursprünglichen Wert zurück, wenn du magst.

## L — Terminmaske (verschlankt)

45. Öffne den Termin-Dialog (Doppelklick auf freie Fläche). Erwartung: er ist
    **kürzer als früher**. Notizen und Serientermin stecken unten hinter einem
    aufklappbaren **„Mehr Optionen"**. Screenshot.
46. Klapp „Mehr Optionen" auf und wieder zu — geht das, auch mit der Tastatur
    (Tab bis dorthin, dann Enter/Leertaste)?
47. Hat die Praxis **nur einen Mitarbeiter**? Dann soll das Feld „Mitarbeiter"
    **gar nicht mehr erscheinen**. Bei mehreren muss es da sein.
48. Wirken die Abstände enger als vorher, oder klebt jetzt etwas aneinander?
49. Abbrechen.

## M — Blocker: Pause, Privat, Fortbildung (neu — SCHREIBT DATEN)

⚠️ **Dieser Abschnitt legt echte Daten an.** Bitte genau so vorgehen:

50. Öffne den Termin-Dialog per Doppelklick auf eine freie Fläche **weit in der
    Zukunft** (z. B. in drei Monaten), damit nichts im laufenden Betrieb stört.
51. Ganz oben im Dialog sollen drei Knöpfe stehen: **⏸ Pause · 🔒 Privat ·
    🎓 Fortbildung**. Screenshot.
52. Klick **„Pause"**. Erwartung:
    - Der Knopf wird hervorgehoben.
    - Die Felder **Kunde**, **Telefon** und der Verordnungsbereich
      **verschwinden**.
    - Rechts erscheint ein Knopf **„↩ Patiententermin"**.
53. Klick **„↩ Patiententermin"** — kommen die Felder zurück? Dann wieder auf
    „Pause".
54. **Speichern.** Erwartung: der Blocker erscheint im Kalender, **grau und
    schraffiert**, ohne Patientennamen. Screenshot.
55. **Wichtigster Test:** versuch jetzt, über dieselbe Zeit einen **normalen
    Termin** zu legen. Erwartung: das wird **abgelehnt**, mit einer
    verständlichen deutschen Meldung — nicht mit einer Datenbank-Fehlermeldung
    wie `23P01` oder englischem Text. Was steht genau da? Screenshot.
56. **Aufräumen — Ausnahme zur Regel 2:** den selbst angelegten Blocker darfst
    und sollst du wieder löschen (Rechtsklick → Absagen, oder im Seitenbereich).
    Er ist kein Patiententermin. Bestätige, dass er verschwunden ist.
57. Zur Information, kein Test: durch diesen Ablauf sind in der Leistungsliste
    drei neue interne Einträge entstanden (Pause, Privat, Fortbildung). Das ist
    so gewollt. Schau kurz nach, ob sie dort auftauchen — sie sollen in der
    Auswahl für **Patiententermine** aber **nicht** erscheinen. Prüf das: neuen
    Termin öffnen, Dienstleistungs-Liste aufklappen — steht „Pause" darin?
    (Sie soll **nicht** drinstehen.)

## N — Menüstruktur

58. Schau in die linke Seitenleiste. Erwartung: **„Leistungen"** steht jetzt in
    der Gruppe **„Abrechnung"** und **nicht mehr** unter „Team".
    Screenshot der aufgeklappten Seitenleiste.
59. Klick darauf — öffnet sich die Leistungsübersicht wie erwartet?


## O — Leistungsübersicht als Tabelle (neu)

Die Seite **Leistungen** (jetzt unter „Abrechnung") war eine Kachelwand — an
zwei Stellen: der GKV-Katalog oben und die eigenen Leistungen darunter. Beides
sind jetzt Tabellen.

60. Öffne **Leistungen**. Erwartung: **keine Kacheln mehr**, sondern Tabellen mit
    Kopfzeile. Screenshot der ganzen Seite.
61. Oben der **GKV-Standardkatalog**: eine Tabelle mit Leistung · Position ·
    Kürzel · Dauer · Vergütung und rechts je Zeile „+ Einrichten" oder
    „Bearbeiten". Bereits eingerichtete Zeilen haben ein **✓** hinter dem Namen.
    Stimmt das?
62. Stehen unter einzelnen Katalogzeilen **Hinweistexte** (Abrechnungsregeln)?
    Die sollen auch bei bereits eingerichteten Leistungen sichtbar bleiben.
63. Darunter die **eigenen Leistungen**, gruppiert. Welche Gruppen siehst du?
    Erwartet sind je nach Praxis: GKV · Privat · Selbstzahler · BG · Intern.
    **Leere Gruppen sollen gar nicht erscheinen.**
64. Steht die Gruppe **Intern** da, und enthält sie Pause/Privat/Fortbildung
    (falls du Abschnitt M schon gemacht hast)?
65. Klick auf eine **Tabellenzeile** (nicht auf das ✕) — öffnet sich die
    Bearbeitung darunter?
66. Geht das auch **mit der Tastatur**? Tab bis zur Zeile, dann Enter.
67. Klick auf das **✕** am Zeilenende — kommt die Rückfrage „Dienstleistung
    löschen"? **Brich sie ab, lösche nichts.**
68. Mach das Fenster **schmal**. Erwartung: die Tabelle scrollt in ihrem eigenen
    Kasten waagerecht — die ganze Seite darf **nicht** seitlich verrutschen.
69. Öffne eine **GKV-Leistung** zum Bearbeiten. Erwartung: auch dort gibt es
    jetzt ein Feld **„Farbe im Kalender"**.
70. Gibt es in der Leistungsmaske ein Feld **„Abrechnungsart"**?
    - **Erscheint es nicht**, ist das **kein Fehler**: die zugehörige
      Datenbankspalte ist noch nicht angelegt, und das Feld blendet sich dann
      absichtlich aus. Schreib mir einfach, ob es da war oder nicht.
    - Erscheint es: stell eine Leistung auf **Selbstzahler**, speichere, und
      prüfe, ob sie danach in der Gruppe „Selbstzahler" steht.
71. **Wichtig, unabhängig davon:** ändere an einer beliebigen Leistung etwas
    Kleines (z. B. den Namen) und **speichere**. Erwartung: es wird gespeichert,
    ohne Fehlermeldung. Screenshot bei Fehler.

## P — Mehrere Termine auf einmal („Anzahl")

72. Öffne den Termin-Dialog. Erwartung: neben **„Von"** steht ein kleines Feld
    **„Anzahl"** mit dem Wert 1.
73. Schau dir die **Reihenfolge der Felder** an. Erwartung: **Patient zuerst**,
    danach Leistung, dann Zeit. Ist etwas durcheinandergeraten, überlappt etwas,
    fehlt ein Feld? Screenshot des ganzen Dialogs — das ist hier der wichtigste
    Punkt.
74. Setz **Anzahl auf 3**. Erwartung: unter dem Feld erscheint ein Hinweis
    („3 Termine — …"), und unter **„Mehr Optionen"** ist der Serientermin jetzt
    angehakt mit Anzahl 3.
75. Setz es zurück auf **1** — verschwindet der Hinweis, ist der Serientermin
    wieder abgewählt?
76. Optional, **legt Daten an**: mit Anzahl 3 und einem Testpatienten weit in der
    Zukunft speichern. Erwartung: **drei** Termine im Kalender. Danach bitte alle
    drei wieder löschen und mir sagen, dass du es getan hast.
77. **Abbrechen**, falls du 80 nicht gemacht hast.

## H — Dunkles Design und schmaler Bildschirm

78. Stell das Design auf **dunkel** (Schalter in den Einstellungen oder oben).
    Wiederhole kurz **A** (Wochenansicht), **E13** (Rechtsklick-Menü), **J32**
    (Kopfleiste) und **M51** (Blocker-Knöpfe). Ist alles lesbar? Gibt es weiße
    Kästen im dunklen Design oder Text, der fast unsichtbar ist? Screenshots vom
    Menü und von der Kopfleiste im dunklen Design.
79. Mach das Browserfenster **schmal** (Tablet-Breite, ca. 900 px). Prüf zwei
    Dinge: bricht die neue **Kopfleiste** um und schiebt den Kalender nach
    unten? Und überlappt in der **Wochenansicht** etwas oder läuft seitlich aus
    dem Bild?
80. Auf einem **Tablet** (falls vorhanden): funktioniert **langes Drücken** auf
    eine freie Fläche (= Termin anlegen) und auf einen Termin (= Kontextmenü)?

## I — Konsole

81. Schau in die Konsole. Gab es während der ganzen Prüfung **rote Fehler**?
    Gib sie im Wortlaut wieder (die Zeile mit `Uncaught`, `TypeError`,
    `RangeError` o. ä.).

---

## Dein Bericht

Bitte in dieser Form, kurz:

```
A  Wochen-Zeitleiste ........ OK / FEHLER + was genau
B  Doppelklick Woche ........ OK / FEHLER
C  Klick auf Termin ......... OK / FEHLER
D  Monatsansicht ............ OK / FEHLER
E  Rechtsklick-Menü ......... OK / FEHLER (je Unterpunkt 13–24)
F  Verschieben in Woche ..... OK / FEHLER
G  Kompaktmodus ............. bestätigt / nicht bestätigt
J  Kopfleiste ............... OK / FEHLER
K  Leistungsfarben .......... OK / FEHLER
L  Terminmaske .............. OK / FEHLER
M  Blocker .................. OK / FEHLER  (55 Doppelbuchung: Meldung im Wortlaut)
N  Menüstruktur ............. OK / FEHLER
O  Leistungstabelle ......... OK / FEHLER  (70: Feld "Abrechnungsart" da? ja/nein)
P  Anzahl / Reihenfolge ..... OK / FEHLER  (73: Reihenfolge der Felder!)
H  Dunkel + schmal + Tablet . OK / FEHLER
I  Konsolenfehler ........... keine / Wortlaut
```

Dazu:
- **Was mich am meisten stört** — eine Sache, die dir beim Bedienen negativ
  aufgefallen ist, auch wenn sie in keinem Test stand.
- **Was ich nicht prüfen konnte** und warum.
- Die Screenshots.

Erfinde nichts. Wenn ein Schritt nicht ging, schreib „nicht prüfbar, weil …".
