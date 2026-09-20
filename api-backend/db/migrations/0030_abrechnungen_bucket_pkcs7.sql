-- §302-Echtbetrieb, Schritt 1.9 (f) — der Bucket nimmt die signierte Datei gar nicht an.
--
-- BEFUND. Der Bucket `abrechnungen` wurde fuer DTA (octet-stream), Begleitzettel
-- (text/html) und PDF angelegt:
--   allowed_mime_types = {application/octet-stream, text/html, application/pdf}
--   file_size_limit    = 10 MB
--
-- `POST /abrechnung/:id/upload-signed` laedt aber mit
-- `contentType: 'application/pkcs7-mime'` hoch. Dieser Typ steht nicht auf der
-- Liste — der Upload scheitert. Nicht still (die Route antwortet mit 500), aber
-- unverstaendlich: der Anwender hat gerade seine PIN eingegeben, die Signatur
-- im Browser ist gelungen, und das Ergebnis ist ein Serverfehler ohne Bezug.
--
-- DREI GRENZEN, DIE NICHT ZUSAMMENPASSTEN (und das ist der eigentliche Fund):
--   express.json  15 MB   (api-backend/server.js:99)
--   Route         20 MB   (abrechnung.routes.js, 413 bei Ueberschreitung)
--   Bucket        10 MB
-- Eine Datei zwischen 10 und 15 MB kam also durch zwei Tore und scheiterte am
-- dritten. Die kleinste Grenze gewinnt immer — sie sollte deshalb die sein, die
-- der Anwender als Fehlermeldung sieht, nicht die letzte in der Kette.
-- Hier wird der Bucket auf 20 MB gezogen, damit die Route (die eine
-- verstaendliche Meldung liefert) die engste Stelle ist.
-- ⚠️ `express.json` bleibt bei 15 MB — das ist eine ANDERE Groesse (base64
--    blaeht um ~33 % auf), und sie anzufassen beruehrt jede Route des Servers.
--    Damit ist der Base64-Umweg faktisch bei ~11 MB Nutzlast gedeckelt. Fuer
--    §302-Dateien ist das weit weg: die groesste bisher erzeugte Datei liegt
--    im einstelligen Kilobytebereich.
--
-- WARUM ZWEI TYPEN. `application/pkcs7-mime` ist der Typ, den der Code heute
-- setzt. `application/x-pkcs7-mime` ist die aeltere Schreibweise, die manche
-- Browser/Bibliotheken automatisch vergeben — beide zuzulassen kostet nichts
-- und erspart denselben 500er ein zweites Mal.
-- Fuer Schritt 1.3 (CMS EnvelopedData) wird spaeter `application/cms` bzw.
-- `application/pkcs7-mime` gebraucht — bewusst NICHT vorab eingetragen:
-- die Verschluesselung ist noch nicht entschieden (GGT Anlage 16 fehlt).
--
-- ZAEHLER: 0 Tabellen, 0 Policies, 0 Funktionen, 0 Trigger, 0 Indizes.
--          Die BUCKET-ANZAHL bleibt 5 — es wird nur eine bestehende Zeile
--          geaendert, keine angelegt. Counter-neutral.

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'application/octet-stream',
         'text/html',
         'application/pdf',
         'application/pkcs7-mime',
         'application/x-pkcs7-mime'
       ]::text[],
       file_size_limit = 20971520          -- 20 MB, = Grenze der Route
 WHERE id = 'abrechnungen';
