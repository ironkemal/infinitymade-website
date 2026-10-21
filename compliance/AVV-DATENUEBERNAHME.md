# Vereinbarung „Datenübernahme-Paket"

**Leistungsbeschreibung (Dienstvertrag, § 611 BGB) · Auftragsverarbeitung (Art. 28 DSGVO) · Verpflichtung zur Verschwiegenheit (§ 203 StGB)**

> **ENTWURF legal-de, 21.10.2026 — abschließend geprüft 21.10.2026 (Werkzeug TeamViewer, Praxura-Lizenz); vor dem ersten verkauften Paket von Kemal freizugeben.**
> Grundlage: `compliance/LEGAL_DECISIONS.md` Eintrag 20.10.2026 „Datenübernahme-Paket",
> `LEGAL_ONPREM_REQUIREMENTS.md` §5 (E3), Playbook K10 (Ausnahme 20.10.2026).
> Diese Vereinbarung gilt **nur** für die begleitete Sitzung. Sie ersetzt nicht den
> Nutzungsvertrag „Praxura Lokal"; für den laufenden Betrieb der Box ist Praxura weder
> Verantwortlicher noch Auftragsverarbeiter von Patientendaten.
> Die bestehende SaaS-AVV (`compliance/AVV.md`, `dpa.html`) ist hierfür **nicht** zu verwenden.
> Interne Hinweise in `>`-Blöcken vor Versand an die Praxis entfernen.

| | |
|---|---|
| **Version** | 1.0 (Entwurf) |
| **Stand** | 2026-10-21 |
| **Anlagen** | Anlage 1 — Sitzungsprotokoll (`compliance/vorlagen/SITZUNGSPROTOKOLL-DATENUEBERNAHME.md`) |

---

## Vertragsparteien

**Auftraggeber (Verantwortlicher i. S. d. Art. 4 Nr. 7 DSGVO; Berufsgeheimnisträger i. S. d. § 203 Abs. 1 StGB):**

Praxis: ___________________________________
Inhaber/in bzw. vertreten durch: ___________________________________
Anschrift: ___________________________________
E-Mail / Telefon: ___________________________________
(nachfolgend **„Praxis"**)

**Auftragnehmer (Auftragsverarbeiter i. S. d. Art. 4 Nr. 8 DSGVO; mitwirkende Person i. S. d. § 203 Abs. 3 S. 2 StGB):**

Yavuz Kemal Demir – InfinityMade
Industriestraße 33
53721 Siegburg
E-Mail: kontakt@praxura.de
(nachfolgend **„Praxura"**)

---

## Teil A — Leistungsbeschreibung

### § 1 Gegenstand der Leistung

(1) Praxura begleitet die Praxis in **einer** Online-Sitzung per Bildschirmfreigabe bei der Übernahme von Daten aus ihrer bisherigen Praxissoftware in ihre Praxura-Installation (CSV-/Excel-Import). Die Praxis bedient dabei ihre Systeme selbst; Praxura erläutert die Schritte und beantwortet Fragen zur Bedienung von Praxura.

(2) Übernommen werden können, soweit die bisherige Software einen entsprechenden Export bietet:

a) **Patientenstamm** (Name, Geburtsdatum, Anschrift, Kontakt, Krankenkasse und IK, Versichertennummer, Versichertenstatus, Zuzahlungsbefreiung);

b) **offene Verordnungen**, auf die noch keine Einheit erbracht wurde, sowie Verordnungen, die im bisherigen System **teilweise erbracht, aber noch nicht abgerechnet** sind — mit den Verordnungsangaben (u. a. Ausstellungsdatum, verordnende/r Ärztin/Arzt mit LANR/BSNR, ICD-10-Code und Diagnose, Diagnosegruppe, Leitsymptomatik, Heilmittel, Anzahl, Frequenz, Hausbesuch, Therapiebericht; in der Podologie zusätzlich betroffener Nagel und Wagner-Grad);

c) zu teilweise erbrachten Verordnungen die **bereits erbrachten Behandlungstage** (Datum und Leistung) mit dem Kennzeichen „aus Altsystem übernommen" sowie ein **Vermerk über bereits kassierte Zuzahlungen** (Betrag, Datum, Beleg-Nr. des bisherigen Systems);

d) die **Vorgeschichte** je Patient/in, soweit für Fristen- und Einmaligkeitsregeln erforderlich (Datum früherer Leistungen, ggf. betroffener Nagel).

> Fachbereich: b)–d) heute nur Podologie (`module/verordnung-import.js`, `module/podo-vorgeschichte.js`). Für Physio/Ergo/Logo bis zur Freigabe des jeweiligen Fachbereichs nur a).
> Wagner-Grad (21.10.2026 ergänzt): `verordnung-import.js` liest die Spalte (`wagner_grad`); in der VVT stand sie schon, in § 1 fehlte sie. Einzelnes Indikationsmerkmal der Verordnung, keine Befunddokumentation — Abs. 3 bleibt unberührt.

(3) **Nicht** Gegenstand sind: Befunde, Behandlungsnotizen und sonstige Behandlungsdokumentation über die in Abs. 2 genannten Angaben hinaus, Bilder/Dokumente, Rechnungen, Mahnungen, Kassenbuch und Buchhaltung sowie bereits abgerechnete Verordnungen. Diese verbleiben im bisherigen System der Praxis.

(4) Praxura erbringt **keine** Abrechnungs-, Steuer- oder Rechtsberatung. Ob eine Verordnung übernommen wird, ob sie gültig, vollständig und abrechenbar ist, ob Arztstempel und Unterschrift vorliegen und welche Behandlungstage und Zuzahlungsbeträge einzutragen sind, entscheidet und bestätigt **ausschließlich die Praxis**. Bestätigungen in der Software (z. B. „Jede dieser Verordnungen trägt Arztstempel und Unterschrift") gibt die Praxis selbst ab. Die Abrechnung nach § 302 SGB V erfolgt durch die Praxis unter ihrem eigenen IK.

### § 2 Vertragstyp, Dauer, Vergütung

(1) Die Leistung ist ein **Dienstvertrag** (§ 611 BGB). Geschuldet ist die fachkundige Begleitung während der gebuchten Sitzung, **kein bestimmter Erfolg** — insbesondere nicht die vollständige oder fehlerfreie Übernahme, die von Umfang und Qualität des Exports der bisherigen Software abhängt.

(2) Die Sitzung ist auf die **gebuchte Dauer** von ____ Stunden am __________ (Termin) begrenzt. Eine Verlängerung oder ein Folgetermin bedarf einer neuen Vereinbarung in Textform; für jede weitere Sitzung gilt diese Vereinbarung entsprechend und wird ein eigenes Sitzungsprotokoll erstellt.

(3) Die Vergütung ergibt sich aus dem Angebot von Praxura (Festpreis). Sie wird nach Durchführung der Sitzung in Rechnung gestellt.

### § 3 Mitwirkung der Praxis

Die Praxis

a) stellt vor der Sitzung den Export aus der bisherigen Software und eine lauffähige Praxura-Installation bereit;

b) startet das von Praxura benannte Verbindungsprogramm selbst (bei TeamViewer: „QuickSupport", ohne Installation und ohne dauerhaften Zugang) und teilt Praxura die Sitzungs-ID und das einmalige Kennwort erst zu Beginn der Sitzung mit; eine Verbindung kommt nur mit diesen Angaben der Praxis zustande. Freigegeben wird **nur die Ansicht** — keine Fernsteuerung, keine Dateiübertragung, keine Zwischenablage;

c) sorgt dafür, dass während der Sitzung nur die für die Übernahme nötigen Fenster sichtbar sind, und schließt andere Anwendungen mit Patientendaten nach Möglichkeit;

d) ist während der gesamten Sitzung mit mindestens einer verantwortlichen Person anwesend und bedient Maus und Tastatur selbst;

e) prüft die übernommenen Daten nach der Sitzung stichprobenartig gegen das bisherige System.

### § 4 Haftung

(1) Praxura haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz.

(2) Bei leichter Fahrlässigkeit haftet Praxura nur bei Verletzung einer wesentlichen Vertragspflicht (deren Erfüllung die ordnungsgemäße Durchführung des Vertrags erst ermöglicht und auf deren Einhaltung die Praxis regelmäßig vertrauen darf), begrenzt auf den vertragstypischen, vorhersehbaren Schaden.

(3) Die Haftung gegenüber betroffenen Personen nach Art. 82 DSGVO bleibt unberührt.

> Hinweis intern: § 4 ist eine Standard-B2B-Klausel (§§ 307, 310 Abs. 1 BGB). Keine Betragsgrenze gewählt, weil der Festpreis noch nicht feststeht und eine zu niedrige Summengrenze in AGB unwirksam sein kann — Anwaltsfrage 2.

---

## Teil B — Auftragsverarbeitung nach Art. 28 DSGVO

### § 5 Gegenstand, Dauer, Art und Zweck (Art. 28 Abs. 3 S. 1 DSGVO)

(1) **Gegenstand:** Einsichtnahme durch Praxura in den von der Praxis freigegebenen Bildschirminhalt während der Sitzung nach § 1. Art der Verarbeitung: **ausschließlich Abfragen/Einsehen** (Art. 4 Nr. 2 DSGVO) in Echtzeit. Praxura erhebt, speichert, kopiert, überträgt, ändert oder löscht keine Daten der Praxis.

(2) **Dauer:** vom Aufbau bis zum Ende der Bildschirmfreigabe, höchstens für die gebuchte Dauer (§ 2 Abs. 2). Die Pflichten aus §§ 8, 10 und Teil C gelten über das Sitzungsende hinaus fort.

(3) **Zweck:** Unterstützung der Praxis bei der Übernahme der in § 1 Abs. 2 genannten Daten.

(4) **Kategorien betroffener Personen:** Patientinnen und Patienten der Praxis; verordnende Ärztinnen und Ärzte; Beschäftigte der Praxis, soweit am Bildschirm sichtbar.

(5) **Art der Daten:** die in § 1 Abs. 2 genannten Angaben. Darunter sind **Gesundheitsdaten** (Art. 9 Abs. 1 DSGVO), insbesondere ICD-10-Code, Diagnose, Diagnosegruppe, Leitsymptomatik, Heilmittel, Behandlungstage, Vorgeschichte, Zuzahlungsbefreiung. Daten, die beiläufig in der bisherigen Software sichtbar werden, unterliegen denselben Pflichten.

### § 6 Pflichten von Praxura

(1) **Weisungsbindung (lit. a):** Praxura handelt nur auf dokumentierte Weisung der Praxis; diese Vereinbarung und das Sitzungsprotokoll sind die Weisung. Hält Praxura eine Weisung für rechtswidrig, weist sie die Praxis unverzüglich darauf hin (Art. 28 Abs. 3 UAbs. 2 DSGVO).

(2) **Vertraulichkeit (lit. b):** An der Sitzung nehmen auf Seiten von Praxura nur Personen teil, die im Sitzungsprotokoll benannt und vor der Sitzung schriftlich zur Vertraulichkeit sowie nach § 203 Abs. 4 S. 2 Nr. 2 StGB zur Verschwiegenheit verpflichtet sind.

(3) **Technische und organisatorische Maßnahmen (lit. c, Art. 32 DSGVO):**

a) Nur-Ansicht-Modus, auf Seiten von Praxura im Werkzeug fest eingestellt; Praxura fordert keine Fernsteuerung an und nimmt sie nicht an; kein unbeaufsichtigter oder dauerhafter Zugang, das Gerät der Praxis wird im Werkzeug nicht gespeichert;
b) keine Aufzeichnung (Video, Ton, Bildschirmfoto, Fotografie des Monitors), keine Dateiübertragung, keine geteilte Zwischenablage, keine Mitschrift von Patientendaten (auch nicht in Sitzungskommentaren des Werkzeugs); KI-Zusatzfunktionen des Werkzeugs sind ausgeschaltet;
c) Endgerät von Praxura: Festplattenverschlüsselung, aktuelle Updates, automatische Bildschirmsperre, Benachrichtigungen/Bildschirmspiegelung aus, keine Hintergrund-Aufzeichnungs- oder Cloud-Screenshot-Funktion;
d) Sitzung aus einem geschlossenen Raum ohne Dritte, Ton über Kopfhörer;
e) Werkzeug ohne Klartextzugriff des Anbieters (Ende-zu-Ende-verschlüsselt), Anbieter mit Sitz in der EU, der personenbezogene Daten nur unter den Voraussetzungen der Art. 44 ff. DSGVO in Drittländer übermittelt; keine US-Konferenzdienste;
f) Beendigung der Freigabe durch die Praxis jederzeit; Praxura beendet die Sitzung von sich aus, sobald ihr eine Steuerung oder Datei angeboten wird oder Unbefugte im Raum sind.

(4) **Unterauftragsverarbeiter (lit. d):** Praxura setzt keine Unterauftragsverarbeiter mit Zugriff auf Inhalte ein. Verwendet die Sitzung das Fernwartungswerkzeug der Praxis, ist dessen Anbieter Dienstleister der Praxis. Stellt Praxura das Werkzeug über eine eigene Lizenz bereit, ist der Anbieter Unterauftragsverarbeiter ausschließlich für Verbindungsdaten (Geräte-IDs, IP-Adressen, Zeitpunkte und Dauer der Verbindung, Konto des Praxura-Teilnehmers):

| Anbieter | Zweck | Sitz / Verarbeitungsort | Inhaltszugriff |
|---|---|---|---|
| TeamViewer Germany GmbH, Bahnhofsplatz 2, 73033 Göppingen, Deutschland (Lizenz von Praxura) | Vermittlung des Verbindungsaufbaus der Bildschirmfreigabe | Sitz: Deutschland. Verbindungsdaten: Rechenzentren und Vermittlungsserver des Anbieters; Übermittlung in Drittländer nur unter den Voraussetzungen der Art. 44 ff. DSGVO (Auftragsverarbeitungsvertrag des Anbieters, Ziff. 2.13, 3.3). Weitere Unterauftragsverarbeiter: Liste des Anbieters (Anlage 3 zu dessen Auftragsverarbeitungsvertrag), auf Anfrage | nein — Sitzungsinhalte Ende-zu-Ende verschlüsselt (RSA 4096 / AES 256); Vermittlungsserver können sie nach Angabe des Anbieters nicht entschlüsseln |

> Intern (Stand 21.10.2026, aus Primärquellen des Anbieters):
> - **Vertragspartner:** Webshop-Bestellung → TeamViewer Germany GmbH, Bahnhofsplatz 2, 73033 Göppingen (teamviewer.com/en/legal/contracting-entities). **Nur über den Webshop kaufen.** Bei Bestellung über ein Angebot/Reseller kann laut derselben Seite TeamViewer UK Ltd., TeamViewer US, Inc. oder 1E Limited Vertragspartner sein → dann ist die Zeile falsch und lit. e neu zu prüfen.
> - **DPA:** wird nicht gesondert unterschrieben. EULA A.4: „By using the Products, Customer accepts … that TeamViewer acts as its data processor under the DPA"; beim Download erscheint ein Fenster zum Anzeigen/Speichern von EULA und DPA. DPA-Version 02.02.2026; Annex 1 und 3 Stand 27.07.2026. Am Kauftag DPA + Annex 1–3 als PDF in `vertraege/` (Drive) ablegen = Nachweis nach Art. 28 Abs. 4.
> - **Warum nicht mehr „Verarbeitung in der EU":** Der Anbieter sagt nur, dass Server mit „sensitive data" in DE/AT stehen (Security Statement, Stand 29.05.2026). Einen Router-Standort sichert er nicht zu; eine Festlegung der Vermittlungsserver bietet er nur für die USA an (Tensor „US Regional Restricted Access"), nicht für die EU. DPA Ziff. 2.13/3.3 binden Drittlandübermittlungen an Art. 44 ff. Deshalb lit. e auf „Sitz EU + Art. 44 ff." umgestellt — haltbar, weil Inhalte E2E-verschlüsselt sind und nur Verbindungsdaten (keine Patientendaten) betroffen sein können.
> - **Annex 3 (Unterauftragsverarbeiter) selbst gelesen? Nein** — das PDF ließ sich hier nicht auslesen; Inhalt der Vorversion (17.03.2025) nur über Suchauszug: Hosting bei Anexia (AT), AWS (LU), Microsoft (IE), Google (IE), Schwarz IT (DE), Wartung/Entwicklung TeamViewer GR/PT/AT. Vor Ersteinsatz die aktuelle Fassung lesen; nennt sie eine Stelle mit Zugriff auf Sitzungsinhalte → Werkzeugentscheidung neu aufrollen.
> - **§ 203 StGB:** TeamViewer ist keine mitwirkende Person (kein Zugang zu Geheimnissen, nur Verbindungsdaten) → keine Verschwiegenheitsverpflichtung des Anbieters nötig.
> - **Lizenz:** Free-Version nur „personal and non-commercial" (EULA B.1.1.2) → unzulässig. „Remote Access" = nur bis 3 eigene Geräte → passt nicht. Mindestens **„Business"** (Verbindung zu beliebig vielen Geräten). Ob Richtlinien zentral über die Management Console verteilt werden können, hängt von der Stufe ab — sonst dieselben Einstellungen lokal im Client (Optionen) setzen. Preise stehen nicht in diesem Dokument.
> - **Einstellungen (Richtlinie/Optionen des Praxura-Clients):** Zugriffssteuerung ausgehende Verbindungen = „View and show" (bzw. Custom: Fernsteuerung, Dateiübertragung, Zwischenablage, Remote-Druck, VPN = verweigert); automatische Sitzungsaufzeichnung = aus; KI-/Sitzungsauswertungsfunktionen = aus (EULA B.7.2: KI-Inhalte können durch Dritte verarbeitet werden); Gerät nicht unter „Computer & Kontakte" speichern; nach der Sitzung Verbindungskommentar ohne Patientendaten oder leer.
> - Kein selbst gehostetes Jitsi auf dem Merkez-VPS (Entscheidung 20.10.2026).

(5) **Betroffenenrechte (lit. e):** Da Praxura keine Daten speichert, unterstützt sie die Praxis durch Auskunft über Ablauf und Inhalt der Sitzung anhand des Protokolls.

(6) **Unterstützung nach Art. 32–36 (lit. f):** Praxura unterrichtet die Praxis **unverzüglich, spätestens binnen 24 Stunden**, über jede Verletzung des Schutzes personenbezogener Daten im Zusammenhang mit der Sitzung, mit den Angaben nach Art. 33 Abs. 3 DSGVO, soweit bekannt.

(7) **Löschung/Rückgabe (lit. g):** Praxura erhält keine Daten; es gibt nichts zurückzugeben. Gelangt entgegen dieser Vereinbarung dennoch eine Datei oder Nachricht mit Patientendaten zu Praxura (z. B. per E-Mail), löscht Praxura sie unverzüglich ohne weitere Verwendung einschließlich Kopien in Papierkorb und Download-Ordner, unterrichtet die Praxis binnen 24 Stunden und vermerkt den Vorgang im Protokoll.

(8) **Nachweise und Kontrollen (lit. h):** Praxura stellt der Praxis das unterzeichnete Sitzungsprotokoll sowie auf Anfrage die Verpflichtungserklärungen der Teilnehmenden zur Verfügung und ermöglicht Überprüfungen nach vorheriger Abstimmung.

### § 7 Pflichten der Praxis

Die Praxis ist für die Rechtmäßigkeit der Verarbeitung, insbesondere die Rechtsgrundlage nach Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG, sowie für die Information der Betroffenen verantwortlich. Sie nimmt diese Tätigkeit in ihr eigenes Verzeichnis von Verarbeitungstätigkeiten auf.

### § 8 Sitzungsprotokoll

Zu jeder Sitzung wird das Protokoll nach Anlage 1 erstellt und von beiden Parteien unterzeichnet (auch elektronisch). Es enthält **keine Patientendaten**, nur Datenkategorien und Anzahlen. Beide Parteien bewahren es bis zum Ablauf von drei Jahren nach Ende des Jahres der Sitzung auf.

---

## Teil C — Verpflichtung zur Verschwiegenheit (§ 203 StGB)

### § 9 Hinweis und Verpflichtung

(1) Die Praxis weist darauf hin, dass die in der Sitzung sichtbaren Angaben fremde Geheimnisse i. S. d. § 203 Abs. 1 StGB sind, die ihr als Angehöriger eines Heilberufs anvertraut wurden. Sie macht sie Praxura nach § 203 Abs. 3 S. 2 StGB nur zugänglich, soweit dies für die Begleitung der Datenübernahme erforderlich ist.

(2) Praxura verpflichtet sich, über alle in der Sitzung bekannt gewordenen Geheimnisse Stillschweigen zu bewahren, sie nicht zu verwerten und sie Dritten nicht zu offenbaren. Die Verpflichtung gilt zeitlich unbegrenzt fort.

(3) Praxura ist darüber belehrt, dass sie sich als mitwirkende Person nach **§ 203 Abs. 4 S. 1 StGB** strafbar macht, wenn sie ein solches Geheimnis unbefugt offenbart (Freiheitsstrafe bis zu einem Jahr oder Geldstrafe), und dass dies auch gilt, wenn sie sich weiterer Personen bedient, ohne für deren Verpflichtung zur Geheimhaltung zu sorgen (§ 203 Abs. 4 S. 2 Nr. 2 StGB).

(4) Praxura zieht weitere Personen nur hinzu, wenn sie diese vorher in Textform zur Verschwiegenheit verpflichtet und über die Strafbarkeit belehrt hat; die Personen werden im Protokoll benannt.

### § 10 Schlussbestimmungen

(1) Änderungen bedürfen der Textform. Diese Vereinbarung kann elektronisch abgeschlossen werden (Art. 28 Abs. 9 DSGVO).

(2) Bei Widersprüchen geht Teil B dieser Vereinbarung anderen Vereinbarungen der Parteien vor, soweit es um den Schutz personenbezogener Daten geht.

(3) Es gilt deutsches Recht. Sollte eine Bestimmung unwirksam sein, bleibt der Rest wirksam.

---

## Unterschriften

**Praxis (Auftraggeber):**

Ort, Datum: ___________________________________

Name: ___________________________________

Unterschrift: ___________________________________

**Praxura (Auftragnehmer):**

Siegburg, den ___________________________________

Yavuz Kemal Demir – InfinityMade

Unterschrift: ___________________________________

---

> **Intern — offene Prüfpunkte für eine anwaltliche Durchsicht (ca. 1 Std., Gesamtpaket mit E1):**
> 1. Trägt die Konstruktion „nur Ansicht, Praxis bedient" die Einordnung als Auftragsverarbeitung mit dieser schmalen AVV, oder genügt bereits die Verschwiegenheitsverpflichtung (§ 203) mit Art.-28-Kurzklausel?
> 2. Ist die Haftungsklausel § 4 ohne Summenbegrenzung für einen Dienstvertrag dieses Umfangs angemessen, oder ist eine wirksame Höchstgrenze möglich?
> 3. Reicht die Abgrenzung in § 1 Abs. 4, damit die Begleitung beim Import teilweise erbrachter Verordnungen nicht als Mitwirkung an der Abrechnung (§ 302 SGB V) oder als Rechtsdienstleistung gewertet wird?
