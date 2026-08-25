# Prompt für Claude in Chrome — Vercel prüfen

> Vorher: bei **vercel.com** eingeloggt sein und im Dashboard stehen.
> Dann alles ab der Trennlinie kopieren und an Claude geben.

---

Du schaust für mich im Vercel-Dashboard nach. Ich kenne mich dort nicht aus und
will drei Dinge wissen: ob mein Testbuild fertig ist, wie seine Adresse lautet,
und ob er sich überhaupt anmelden lassen kann.

## Regeln — bitte genau einhalten

1. **Nur lesen.** Ändere keine Einstellung, lösche nichts, starte und brich
   keinen Deployment ab. Wenn etwas geändert werden müsste: sag es mir, mach es
   nicht selbst.
2. **Keine Geheimnisse ausgeben.** In den Environment Variables stehen echte
   Schlüssel (Stripe, Supabase Service Role, SMTP-Passwort). Klick **niemals**
   auf ein Auge-Symbol oder „Reveal/Show Value", und schreib **keinen einzigen
   Wert** in deine Antwort — auch keinen Teil davon. Ich brauche nur, **ob** es
   eine Variable gibt und **für welche Umgebungen** sie gilt.
   Einzige Ausnahme: `NEXT_PUBLIC_URL` — das ist eine öffentliche Adresse, den
   Wert darfst du nennen.
3. Findest du etwas nicht, schreib „nicht gefunden" statt zu raten.

## Aufgabe 1 — Das richtige Projekt

Es kann mehrere Projekte im selben Konto geben (eins für die Praxissoftware,
eventuell eins für ein Ops-Dashboard).

1. Liste die Projektnamen auf.
2. Öffne das Projekt, dem die Domain **`app.praxura.de`** oder **`praxura.de`**
   zugeordnet ist (steht unter Settings → Domains, oder auf der Projektübersicht).
   Wie heißt es?

## Aufgabe 2 — Der Testbuild

Geh im Projekt auf **Deployments**.

3. Such das neueste Deployment zum Branch **`kalender-ux`** (nicht `main`).
4. Was ist sein **Status**? Ready / Building / Error / Canceled
5. Wie lautet die **vollständige Preview-URL**? (Etwas in der Art
   `...-git-kalender-ux-....vercel.app`.) Schreib sie mir vollständig auf.
6. Welcher **Commit** steckt drin? Erwartet: `c0c850e` mit dem Text
   „Prüfplan um Leistungsfarben, Kopfleiste, Maske, Blocker und Menü erweitert".
   Stimmt das, oder ist es ein älterer?
7. Steht der Status auf **Error**: öffne das Build-Log und gib mir die **letzten
   Fehlerzeilen im Wortlaut**.
8. Gibt es überhaupt Preview-Deployments für andere Branches als `main`? Falls
   in der Liste nur `main` auftaucht, sag mir das — dann sind Previews
   vielleicht abgeschaltet.

## Aufgabe 3 — Kann man sich dort einloggen? (der wichtigste Punkt)

Geh auf **Settings → Environment Variables**.

9. Such diese zwei Einträge:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Für jeden: **existiert er?** Und für welche Umgebungen ist er gesetzt —
   steht dort **Production**, **Preview**, **Development**, oder nur eines davon?
   **Nur die Umgebungen nennen, nicht die Werte.**
10. Dasselbe für `SUPABASE_SERVICE_ROLE_KEY` — existiert er, welche Umgebungen?
    (Wieder: kein Wert.)
11. Existiert `NEXT_PUBLIC_URL`? Welche Umgebungen — und welcher **Wert** steht
    dort? (Den darfst du nennen, es ist nur eine Adresse.)

**Warum das zählt:** fehlen die beiden Supabase-Einträge für **Preview**, kann
sich auf der Test-Adresse niemand anmelden. Die Seite lädt dann zwar, aber der
Login schlägt fehl.

## Aufgabe 4 — Funktionen zählen

12. Geh auf **Settings → Functions** oder schau im letzten Deployment unter
    „Functions". Wie viele Serverless Functions hat das Projekt?
    (Ich erwarte 12 — mehr erlaubt mein Tarif nicht.)

## Dein Bericht

```
Projekt ................ Name
Preview kalender-ux .... Status + vollständige URL
Commit ................. c0c850e ja/nein (sonst welcher)
SUPABASE_URL ........... vorhanden? Umgebungen: ...
SUPABASE_ANON_KEY ...... vorhanden? Umgebungen: ...
SERVICE_ROLE_KEY ....... vorhanden? Umgebungen: ...
NEXT_PUBLIC_URL ........ vorhanden? Umgebungen: ... Wert: ...
Functions .............. Anzahl
```

Dazu in einem Satz: **kann ich mich auf der Preview-URL anmelden, ja oder nein**
— und wenn nein, woran es liegt.

Falls dir dabei etwas auffällt, wonach ich nicht gefragt habe (fehlgeschlagene
Deployments, Warnungen, abgelaufene Domains), schreib es dazu.
