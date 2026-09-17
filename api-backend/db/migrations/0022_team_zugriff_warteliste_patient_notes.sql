-- Ops-Karte #253 — Team-Zugriff auf `warteliste` und `patient_notes`.
-- Rechtsgrundlage und vollstaendige Begruendung: compliance/LEGAL_DECISIONS.md,
-- Eintrag vom 17.09.2026 ("Team-Zugriff: warteliste und patient_notes
-- freigegeben, fußstatus gegenstandslos (A-06 geschlossen)"). Fortsetzung des
-- Eintrags vom 03.09.2026, der `podologie_behandlungen` und
-- `prescription_documents` freigegeben hatte.
--
-- Kurz: Art. 9 Abs. 2 lit. h i. V. m. Abs. 3 DSGVO, § 22 Abs. 1 Nr. 1 lit. b
-- BDSG (Behandlung/Behandlungsorganisation) + § 203 Abs. 3 S. 1 StGB
-- (berufsmaessig taetiger Gehilfe). Die Mandantengrenze bleibt unberuehrt —
-- das hier ist eine Grenze INNERHALB eines Verantwortlichen.
--
-- ⚠️ MANDANTENBEZUG STRIKT UEBER `profiles.owner_id`, NIE ueber `business_id`.
--   `business_id` ist eine Standort-Spalte, keine Mandantenzusicherung: ein
--   Owner ohne `businesses`-Zeile (der Normalfall bei Einzelpraxen, siehe
--   CLAUDE.md) haette darueber gar keinen Bezug. Alle vier Policies unten
--   tragen denselben EXISTS-Ausdruck gegen `profiles.owner_id`.
--
-- ⚠️ ADDITIV. Die bestehenden Owner-Policies (`owner_only` auf patient_notes,
--   `Owner zugriff auf warteliste`) werden NICHT angefasst. PERMISSIVE
--   Policies werden ODER-verknuepft; es wird niemandem etwas entzogen.
--
-- `fußstatus` bekommt BEWUSST nichts (dritte Tabelle aus A-06): die Tabelle
--   ist veraltet, niemand liest oder schreibt sie mehr, sie steht nur noch in
--   der Loeschreihenfolge (api/dsgvo.js). Der Menuepunkt "Fußbefund"
--   (Panel-Id `fussstatus`) liest `pat_fussbefund` — und die traegt mit
--   `pat_fussbefund_owner_access [ALL]` laengst vollen Team-Zugriff. Reine
--   Namensverwechslung, keine Rechtsfrage.

-- --- patient_notes: NUR LESEN ----------------------------------------
-- Kein INSERT/UPDATE/DELETE fuers Team, und das ist der Kern der
-- Entscheidung, nicht eine Vorsichtsmassnahme:
--   (a) die Tabelle fuehrt KEINE Verfasserspalte;
--   (b) sie wird pro Patient als GENAU EINE Zeile gefuehrt und an Ort und
--       Stelle ueberschrieben (dashboard.js:13825-13828 `.maybeSingle()` +
--       UPDATE, `ai_summary` in :13856; UNIQUE (owner_id, lead_id)).
-- Ein Team-Schreibrecht hiesse heute: jeder Kollege ueberschreibt die Notiz
-- des Inhabers spurlos. Soweit die Notiz ueberhaupt Behandlungsdokumentation
-- ist, verlangt § 630f Abs. 1 S. 2 BGB, dass Berichtigungen UND der
-- urspruengliche Inhalt erkennbar bleiben.
-- Das Schreibrecht wird ohne neue Grundsatzentscheidung nachgezogen, sobald
-- Verfasserspalte + Versionierung existieren — das Muster liegt mit
-- `pat_fussbefund` (eintrag_id/version/ist_aktuell) fertig vor.
-- Bis dahin gilt: Freigabe ist trotzdem richtig, weil die Alternative das
-- groessere Risiko ist — der Angestellte behandelt, ohne den Hinweis zu
-- kennen, den der Inhaber notiert hat (module/termin-panel-patient.js:169
-- zeigt ihm heute stillschweigend ein leeres Notizfeld).

DROP POLICY IF EXISTS "Employees can view team patient_notes" ON public.patient_notes;
CREATE POLICY "Employees can view team patient_notes"
  ON public.patient_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = patient_notes.owner_id
    )
  );

-- --- warteliste: LESEN, ANLEGEN, AENDERN ------------------------------
-- Inhalt sind Kontaktdaten und Wunschzeiten, kein Befund. Schreibrecht wird
-- hier — anders als am 03.09. bei den Verordnungen — mitentschieden, weil die
-- damaligen Gegengruende alle entfallen: wer einen Termin absagt, muss den
-- frei werdenden Platz auch nachbesetzen duerfen; ein Wartelisteneintrag ist
-- keine Dokumentation nach § 630f BGB, sondern eine Organisationsnotiz; und
-- es gibt keine Statusmaschine, an der ein Direktschreiben vorbeiliefe.
--
-- ⛔ KEIN DELETE — bleibt beim Inhaber (Art. 5 Abs. 1 lit. d): ein fremder
--   Wunsch soll nicht unbemerkt verschwinden. Stornieren geschieht ueber
--   `status` ('cancelled', CHECK-Constraint waiting|matched|cancelled),
--   nicht ueber das Loeschen der Zeile.
--
-- Der EXISTS-Ausdruck im WITH CHECK ist die eigentliche Mandantensperre:
-- ohne ihn koennte ein Angestellter Zeilen unter fremder `owner_id` anlegen
-- bzw. eine Zeile aus dem Mandanten herausschreiben. Deshalb steht er beim
-- UPDATE in USING *und* WITH CHECK.
-- Passt zum Frontend: `getOwnerId()` (dashboard.js:860) liefert fuer
-- Angestellte `currentProfile.owner_id`, das INSERT-Payload traegt also
-- bereits die richtige owner_id.

DROP POLICY IF EXISTS "Employees can view team warteliste" ON public.warteliste;
CREATE POLICY "Employees can view team warteliste"
  ON public.warteliste
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = warteliste.owner_id
    )
  );

DROP POLICY IF EXISTS "Employees can insert team warteliste" ON public.warteliste;
CREATE POLICY "Employees can insert team warteliste"
  ON public.warteliste
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = warteliste.owner_id
    )
  );

DROP POLICY IF EXISTS "Employees can update team warteliste" ON public.warteliste;
CREATE POLICY "Employees can update team warteliste"
  ON public.warteliste
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = warteliste.owner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.owner_id = warteliste.owner_id
    )
  );
