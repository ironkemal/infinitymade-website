// Einmalig (Kemal 25.11.2026): Black Week (11-26, 11-27) + Cyber Week (11-28, 11-29) statt normaler Inhalte.
// Schreibt die vier Videos als _muster/F31–F34. Einplanen: umplanen-2026-11-26.mjs.
// Preise = Website (index.html, Aktionskarten). Ausnahme von A3 „kein Preis": Kemal-Anweisung für die Aktion.
import { writeFileSync } from 'node:fs';
const FUSS = 'Aktionspreise für Verträge mit Abschluss bis 31.12.2026, garantiert für die ersten 12 Monate. Zzgl. einmaliger Einrichtung und Serverkosten. Angebot nur für Praxen und Unternehmer (§ 14 BGB). Endpreise, gemäß § 19 UStG keine Umsatzsteuer.';
const ENDE = (sprecher) => ({ typ: 'outro', dauer: 3.4, premium: true, klang: [{ art: 'ding', bei: 0.15 }], cta: 'Alle Preise auf praxura.de', sprecher, nachlauf: 1 });

const out = {
  'F31-black-week': {
    art: 'video', musik: 'episch', stimme: 'Laomedeia', tempo: 1.08, coverBei: 1.2,
    sprechweise: 'Natürliche, sympathische Frauenstimme. Am Anfang mit einem Augenzwinkern wie ein Kinotrailer, dann warm, nahbar und direkt. Normales Sprechtempo, nicht übertrieben.',
    caption: `Black Week. Alle rennen los. Sie nicht. 🖤\n\nPraxura gibt es jetzt zum Aktionspreis: Solo 49 € statt 59 €, Praxis 119 € statt 149 €, Team 199 € statt 249 € im Monat. Ab 11 Behandler:innen erstellen wir Ihnen ein individuelles Angebot. Die Einrichtung wird bis zu 200 € günstiger.\n\nSchicken Sie das der Kollegin, die gerade über neue Praxissoftware nachdenkt.\n\nAlle Preise auf praxura.de\n\n${FUSS}\n\n(Bilder und Stimme KI-generiert)\n\n#BlackWeek #Praxissoftware #Heilmittel #Therapiepraxis #Praxisinhaber`,
    szenen: [
      { typ: 'foto', dauer: 3.2, bild: 'foto/aktion/bf1.jpg', kicker: 'Black Week', titel: 'Alle rennen <em>los.</em>', effekt: ['kino'], sprecher: 'Black Week. Alle rennen los. Fernseher, Sneaker, Kaffeemaschinen.' },
      { typ: 'foto', dauer: 2.8, bild: 'foto/aktion/bf2.jpg', uebergang: 'schnitt', titel: 'Und Sie? <em>Ganz entspannt.</em>', sprecher: 'Und Sie? Bleiben ganz entspannt. Ihr Angebot kommt zu Ihnen.' },
      { typ: 'zaehler', ton: 'dunkel', dauer: 3.8, kicker: 'Solo · 1 Behandler:in', praefix: '€ / Monat', von: 59, bis: 49, text: 'statt 59 €. 12 Monate garantiert.', quelle: 'Verträge bis 31.12.2026 · zzgl. Einrichtung', sprecher: 'Wenn Sie allein behandeln: neunundvierzig Euro im Monat.', nachlauf: 0.5 },
      { typ: 'countdown', ton: 'dunkel', dauer: 4.6, kicker: 'Alle Pakete · pro Monat', punkte: ['Praxis <em>119 €</em> statt 149 €', 'Team <em>199 €</em> statt 249 €', 'Ab 11 Behandler:innen: <em>Angebot</em>'], sprecher: 'Für zwei bis fünf Behandler hundertneunzehn, bis zehn Behandler hundertneunundneunzig Euro. Bis zu zwanzig Prozent günstiger.' },
      { typ: 'foto', dauer: 2.8, bild: 'foto/aktion/bf3.jpg', kicker: 'Black Week', titel: 'Einrichtung bis zu <em>200 € günstiger.</em>', sprecher: 'Und die Einrichtung wird bis zu zweihundert Euro günstiger.' },
      { ...ENDE('Praxura. Ruhe im Praxisalltag, zum Aktionspreis.'), kicker: 'Black Week bei Praxura', titel: 'Ruhe. <em>Zum Aktionspreis.</em>' }
    ]
  },
  'F32-black-friday': {
    art: 'video', musik: 'warm', stimme: 'Gacrux', tempo: 1.05,
    sprechweise: 'Natürliche, warme und vertrauenswürdige Frauenstimme wie in einem hochwertigen Werbespot. Ruhig, klar, mit einem leichten Lächeln. Normales Sprechtempo.',
    caption: `Black Friday, 17 Uhr. Alle shoppen. Sie sitzen über der Abrechnung.\n\nPraxura bereitet Ihre Abrechnung vor, zum festen Monatspreis statt Prozenten vom Umsatz. Zum Black Friday: Solo 49 €, Praxis 119 €, Team 199 € im Monat (statt 59 / 149 / 249 €). Ab 11 Behandler:innen gibt es ein individuelles Angebot.\n\nWann machen Sie freitags Feierabend? Schreiben Sie es in die Kommentare.\n\nAlle Preise auf praxura.de\n\n${FUSS}\n\n(Bilder und Stimme KI-generiert)\n\n#BlackFriday #Heilmittel #Abrechnung #Praxisalltag #Therapeutenleben`,
    szenen: [
      { typ: 'foto', dauer: 3.4, bild: 'foto/aktion/fr1.jpg', kicker: 'Black Friday, 17:00 Uhr', titel: 'Alle shoppen. <em>Sie rechnen ab.</em>', sprecher: 'Black Friday, siebzehn Uhr. Alle shoppen. Und Sie sitzen über der Abrechnung.' },
      { typ: 'aussage', ton: 'dunkel', dauer: 3, uebergang: 'schnitt', titel: 'Manche zahlen dafür <em>Prozente vom Umsatz.</em>', sprecher: 'Und manche geben dafür auch noch Prozente vom Umsatz ab.' },
      { typ: 'geraet', buehne: true, dauer: 4.4, kicker: 'Mit Praxura', titel: 'Abrechnung <em>vorbereitet.</em>', kopf: 'Abrechnung', schritte: ['Verordnungen geprüft', 'Zuzahlungen erfasst', 'Abrechnung vorbereitet'], sprecher: 'Praxura bereitet Ihre Abrechnung vor. Ohne Prozente.' },
      { typ: 'vergleich', ton: 'dunkel', dauer: 5, titel: 'Ihre <em>Black-Friday-Rechnung</em>', links: { label: 'Prozent-Modell', text: 'Gebühr wächst mit dem Umsatz', weg: true }, rechts: { label: 'Praxura · Praxis', text: '119 € im Monat. Fest.' }, sprecher: 'Statt Prozenten ein fester Preis: für zwei bis fünf Behandler hundertneunzehn Euro im Monat.' },
      { typ: 'foto', dauer: 2.6, bild: 'foto/aktion/fr2.jpg', titel: '17:30 Uhr. <em>Feierabend.</em>', sprecher: 'Und um halb sechs: Feierabend.' },
      { ...ENDE('Praxura. Fester Preis, ab neunundvierzig Euro im Monat.'), kicker: 'Black Friday bei Praxura', titel: 'Fester Preis. <em>Ab 49 € im Monat.</em>' }
    ]
  },
  'F33-cyber-week': {
    art: 'video', musik: 'episch', stimme: 'Laomedeia', tempo: 1.08, coverBei: 1.2,
    sprechweise: 'Natürliche, sympathische Frauenstimme. Am Anfang feierlich wie ein Science-Fiction-Trailer, beim zweiten Satz trocken und mit Humor, danach warm und direkt. Normales Sprechtempo.',
    caption: `Cyber Week. Die Zukunft ist da. Naja. Fast. 🤖\n\nEchte Digitalisierung für Ihre Praxis: Termine, Akte und Abrechnungsvorbereitung an einem Ort. Zur Cyber Week bis zu −20 % auf alle Pakete, Einrichtung bis zu 200 € günstiger, und bei jährlicher Zahlung zusätzlich −10 % auf die Lizenz.\n\nMarkieren Sie, wer in Ihrer Praxis für Technik zuständig ist.\n\nAlle Preise auf praxura.de\n\n${FUSS}\n\n(Bilder und Stimme KI-generiert)\n\n#CyberWeek #Praxissoftware #Digitalisierung #Physiotherapie #Heilmittel`,
    szenen: [
      { typ: 'foto', dauer: 3, bild: 'foto/aktion/cy1.jpg', kicker: 'Cyber Week', titel: 'Die Zukunft <em>ist da.</em>', effekt: ['kino'], sprecher: 'Cyber Week. Die Zukunft ist da.' },
      { typ: 'foto', dauer: 2.4, bild: 'foto/aktion/cy2.jpg', uebergang: 'schnitt', titel: 'Naja. <em>Fast.</em>', sprecher: 'Naja. Fast.' },
      { typ: 'geraet', buehne: true, dauer: 4.4, kicker: 'Echte Digitalisierung', titel: 'Ihre Praxis. <em>Digital.</em>', kopf: 'Heute', schritte: ['Termine und Serien', 'Patientenakte', 'Abrechnung vorbereitet'], sprecher: 'Echte Digitalisierung sieht so aus: Termine, Akte und Abrechnung an einem Ort.' },
      { typ: 'zaehler', ton: 'dunkel', dauer: 3.8, kicker: 'Solo · 1 Behandler:in', praefix: '€ / Monat', von: 59, bis: 49, text: 'statt 59 €. 12 Monate garantiert.', quelle: 'Verträge bis 31.12.2026 · zzgl. Einrichtung', sprecher: 'Wenn Sie allein behandeln: neunundvierzig Euro im Monat.', nachlauf: 0.5 },
      { typ: 'countdown', ton: 'dunkel', dauer: 5, kicker: 'Cyber Week', punkte: ['Bis zu <em>−20 %</em> auf alle Pakete', 'Einrichtung bis zu <em>200 € günstiger</em>', 'Jährlich zahlen: <em>noch −10 %</em>'], sprecher: 'Bis zu zwanzig Prozent auf alle Pakete. Die Einrichtung günstiger. Und wer jährlich zahlt, spart noch zehn Prozent.' },
      { ...ENDE('Praxura. Digital, ganz ohne Roboter.'), kicker: 'Cyber Week bei Praxura', titel: 'Digital. <em>Ganz ohne Roboter.</em>' }
    ]
  },
  'F34-cyber-sonntag': {
    art: 'video', musik: 'ruhig', stimme: 'Gacrux', tempo: 1.05,
    sprechweise: 'Natürliche, warme und vertrauenswürdige Frauenstimme, ruhig wie an einem Sonntagabend, klar und nahbar. Normales Sprechtempo.',
    caption: `Sonntagabend. Und Sie denken schon an Montag.\n\nWas Praxura kostet, steht offen auf unserer Seite. Zur Cyber Week im Monat: Solo 49 € statt 59 €, Praxis 119 € statt 149 €, Team 199 € statt 249 €. Ab 11 Behandler:innen gibt es ein individuelles Angebot. Und 60 Tage Geld zurück auf die Lizenzgebühr.\n\nSpeichern Sie das für die nächste Teambesprechung.\n\nAlle Preise auf praxura.de\n\n${FUSS} Geld zurück: Kündigung innerhalb von 60 Tagen ab Übergabe, Einrichtung und Serverkosten ausgenommen.\n\n(Bilder und Stimme KI-generiert)\n\n#CyberWeek #Praxisinhaber #Therapiepraxis #Heilmittel #Praxissoftware`,
    szenen: [
      { typ: 'foto', dauer: 3.2, bild: 'foto/aktion/cy3.jpg', kicker: 'Sonntag, 20:00 Uhr', titel: 'Sie denken <em>schon an Montag.</em>', sprecher: 'Sonntagabend. Und Sie denken schon an Montag.' },
      { typ: 'frage', ton: 'dunkel', dauer: 4.6, kicker: 'Cyber Week', titel: 'Was kostet Praxura, wenn Sie <em>allein behandeln?</em>', antwort: '49 € im Monat', antwortLabel: 'Solo · statt 59 €', sprecher: 'Was kostet Praxura, wenn Sie allein behandeln? Neunundvierzig Euro im Monat.' },
      { typ: 'countdown', ton: 'dunkel', dauer: 5, kicker: 'Mit Team · pro Monat', punkte: ['Praxis <em>119 €</em> statt 149 €', 'Team <em>199 €</em> statt 249 €', 'Ab 11 Behandler:innen: <em>Angebot</em>'], sprecher: 'Mit Team: 119 Euro oder 199 Euro im Monat. Größere Praxen bekommen ein eigenes Angebot.' },
      { typ: 'aussage', ton: 'dunkel', dauer: 3.2, kicker: 'Ohne Risiko', titel: '60 Tage <em>Geld zurück.</em>', text: 'auf die Lizenzgebühr', sprecher: 'Und wenn es nicht passt: sechzig Tage Geld zurück auf die Lizenz.' },
      { typ: 'foto', dauer: 2.6, bild: 'foto/aktion/cy4.jpg', titel: 'Montag. <em>Entspannt.</em>', sprecher: 'Und der Montag beginnt entspannt.' },
      { ...ENDE('Praxura. Aktionspreise für Verträge bis Jahresende.'), kicker: 'Cyber Week bei Praxura', titel: 'Aktionspreise <em>bis 31.12.</em>' }
    ]
  }
};
for (const [k, v] of Object.entries(out)) writeFileSync(new URL(`./_muster/${k}.json`, import.meta.url), JSON.stringify(v, null, 2) + '\n');
console.log('geschrieben:', Object.keys(out).join(', '));
