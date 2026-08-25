# Prompt für Claude in Chrome — Kalender-Prüfung

> Alles ab der Trennlinie kopieren und in Chrome an Claude geben.
> **Vorher sicherstellen:** die Seite zeigt den NEUEN Code (Preview-Deployment,
> nicht `app.praxura.de`). Sonst wird die alte Fassung geprüft.

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

## H — Dunkles Design und schmaler Bildschirm

32. Stell das Design auf **dunkel** (Schalter in den Einstellungen oder oben).
    Wiederhole kurz **A** (Wochenansicht) und **E13** (Rechtsklick-Menü):
    Ist alles lesbar? Gibt es weiße Kästen im dunklen Design oder Text, der
    fast unsichtbar ist? Screenshot vom Menü im dunklen Design.
33. Mach das Browserfenster **schmal** (Tablet-Breite, ca. 900 px). Schau die
    Wochenansicht an: überlappt etwas, läuft etwas seitlich aus dem Bild?

## I — Konsole

34. Schau in die Konsole. Gab es während der ganzen Prüfung **rote Fehler**?
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
H  Dunkel + schmal .......... OK / FEHLER
I  Konsolenfehler ........... keine / Wortlaut
```

Dazu:
- **Was mich am meisten stört** — eine Sache, die dir beim Bedienen negativ
  aufgefallen ist, auch wenn sie in keinem Test stand.
- **Was ich nicht prüfen konnte** und warum.
- Die Screenshots.

Erfinde nichts. Wenn ein Schritt nicht ging, schreib „nicht prüfbar, weil …".
