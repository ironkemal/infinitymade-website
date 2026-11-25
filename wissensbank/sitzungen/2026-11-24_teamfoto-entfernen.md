# Profilfoto im Team-Detail und in „Mein Profil“ entfernen

Beide Ansichten entfernen zuerst die Datei im öffentlichen Bucket `avatars`. Erst nach erfolgreicher Storage-Antwort leeren sie `profiles.avatar_url`. Der gemeinsame Helfer berücksichtigt `<uid>/profilfoto.jpg` und das aktuell referenzierte Zeitstempelfoto im selben Ordner. Für Letzteres prüft er Dateiformat und öffentliche Adresse des aktiven Buckets.

Der SaaS-Schemaexport vom 23.11.2026 dokumentiert in `db/SCHEMA-RLS.sql` für `avatars_own_delete` den eigenen Ordner und die Ordner der über `profiles.owner_id` zugeordneten Mitarbeiter. Bereits früher ersetzte, heute nicht mehr referenzierte Zeitstempeldateien sind durch diesen Ablauf nicht auffindbar.

Lokal im isolierten Worktree geprüft, einschließlich Cache-Busting, Typprüfung und Browser-Probe. Ein Zwischenlauf scheiterte im bestehenden Merkez-Registrierungstest bei der Teilstringsuche nach einem kurzen synthetischen Passwort. Der vollständige Wiederholungslauf war grün.

Die öffentliche App lieferte beim Vorabcheck `20261124r1` aus. Nach Freigabe und Auslieferung durch die Hauptsession bleibt der Test mit einem synthetischen Teamfoto offen. Vorher den Originalzustand sichern, anschließend die öffentliche URL mit frischer Cache-Abfrage auf HTTP 400/404 prüfen und den Ausgangszustand wiederherstellen.
