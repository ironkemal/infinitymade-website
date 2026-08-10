# Regeln für den Ordner `fortschritte/`

## Die Regel

**Eine Datei pro Tag. Jede an einem Tag erledigte Aufgabe wird in die Datei
dieses Tages eingetragen — es wird keine zweite Datei für denselben Tag angelegt.**

Dateiname: `JJJJ-MM-TT.md`, also z. B. `2026-08-10.md`.

Existiert die Datei für heute bereits, wird sie **ergänzt**, nicht ersetzt und
nicht überschrieben. Neue Einträge kommen unten dazu.

## Warum

Der Ordner beantwortet die Frage „was ist an dem Tag passiert und warum". Wenn
zu einem Tag mehrere Dateien entstehen, muss man alle finden, um die Antwort zu
bekommen — dann trägt der Ordner nichts mehr.

## Für Claude Code

Beim Abarbeiten einer Aufgabenliste oder eines Auftrags gilt:

1. Datum bestimmen (das heutige, nicht das eines Commits).
2. `fortschritte/JJJJ-MM-TT.md` lesen. Existiert sie → ergänzen. Existiert sie
   nicht → neu anlegen, nach dem Aufbau unten.
3. Eintragen, **was** gemacht wurde, **warum**, **welche Dateien** betroffen sind
   und **was offen bleibt**.
4. Offen Gebliebenes und Blockaden gehören genauso hinein wie Erledigtes. Ein
   Fortschrittsbericht, der nur Erfolge nennt, ist beim Nachlesen wertlos.
5. Was nicht geprüft wurde, wird als ungeprüft gekennzeichnet. Nicht „getestet"
   schreiben, wenn nur der Code gelesen wurde.

## Aufbau einer Tagesdatei

```markdown
# JJJJ-MM-TT

## Woran gearbeitet wurde
Ein bis zwei Sätze Einordnung: welcher Auftrag, welche Liste.

## Erledigt
Pro Punkt: was, warum, welche Dateien.

## Offen / blockiert
Was nicht ging und woran es liegt.

## Was noch getan werden muss
Konkrete nächste Schritte, mit Adressat wenn es eine menschliche Aufgabe ist.

## Commits
Kurzliste.
```

## Abgrenzung zu anderen Ablagen

| Wohin | Wofür |
|---|---|
| `fortschritte/` | Was an einem bestimmten Tag passiert ist — Verlauf |
| Ops-Dashboard → Aufgaben | Was noch zu tun ist — die offene Liste |
| `konsey/KARARLAR.md` | Getroffene Entscheidungen — kapanmış karar yeniden açılmaz |
| `compliance/LEGAL_DECISIONS.md` | Abgeschlossene rechtliche Klärungen |

Der Fortschrittsordner ersetzt das Ops-Dashboard **nicht**. Neue offene Aufgaben
gehören weiterhin dorthin; hier steht nur, dass und warum sie entstanden sind.
