// Kutu-Namen (K2b.2, Kemal + legal-de 05.10.2026): Sertifikatsregister (CT) sind öffentlich
// und dauerhaft — der Name darf deshalb nichts über Praxis oder Person verraten.
// Merkez würfelt ihn selbst aus einer kuratierten Wortliste: wort-wort-NN (NN = 1–99).
//
// legal-de 05.10.2026: 43 Wörter entfernt (medizinisch, politisch, vulgär, beleidigend,
// marken-/vornamenähnlich). Akzeptiertes Restrisiko: Allerweltswörter, die auch Nachnamen sind
// (fuchs, stein, berg, keller, winter …) — sie zeigen auf keine bestimmte Praxis.
// Auswahlregeln für WOERTER: klein, nur a–z (kein Umlaut, kein ß), 3–7 Zeichen, einfach
// zu diktieren, nichts Medizinisches, Beleidigendes, Markenähnliches, keine Orts-/Personennamen.
// Wer die Liste ändert: Test (namen.test.js) prüft Format, Eindeutigkeit und Sperrliste.
import crypto from 'node:crypto';

export const WOERTER = `
sonne mond stern wolke regen schnee nebel wind donner tau frost eis bach fluss see meer teich
quelle welle insel strand sand stein fels berg tal wald wiese feld acker garten hecke busch baum
ast blatt wurzel moos farn gras klee tulpe nelke lilie mohn efeu birke eiche buche tanne ahorn
weide erle esche ulme hase igel fuchs reh hirsch dachs otter biber maus katze hund pferd ente
taube spatz amsel meise fink lerche storch kranich eule schwan fisch forelle karpfen hecht aal
schnecke biene ameise falter libelle tisch stuhl bank lampe kerze uhr glocke turm steg weg pfad
tor dach haus hof mauer zaun leiter seil korb kiste fass krug tasse schale kanne kamm faden wolle
stoff hut mantel schal schuh ring kette perle fenster treppe flur stube kammer keller boden wand
brot brezel kuchen torte honig butter kaese milch sahne mehl salz pfeffer nuss mandel birne
kirsche beere traube erbse bohne kohl salat mais hafer roggen weizen gerste tee saft suppe reis
rot blau gelb weiss grau klein gross leise laut hell dunkel warm kalt weich fest sanft frisch klar
still mild zart lied ton klang note harfe geige trommel morgen abend nacht tag woche jahr herbst
winter sommer dorf stadt markt platz gasse allee park hafen pfeil bogen kreis punkt linie ecke
kante brett balken sage beil spaten harke eimer wanne sieb trichter glas tuete paket brief karte
buch heft stift blei feder tinte papier segel mast anker ruder boot kahn floss wiege bett kissen
decke tuch kerbe wimpel laterne docht funke glut rauch dampf kamin herd pfanne topf deckel
`.split(/\s+/).filter((w) => w && !/\d/.test(w));

// Zusätzliche Sicherung gegen unglückliche Treffer (Teilstring-Prüfung auf das fertige Wort).
export const SPERRLISTE = ['tod', 'sarg', 'krank', 'blut', 'arzt', 'herz', 'nazi', 'sex', 'porn', 'dumm', 'hass', 'krieg', 'gift'];

// Kombinationen (legal-de 05.10.2026): Teilstrings werden über die Wortgrenze hinweg geprüft
// (name ohne Bindestriche), dazu unglückliche Paare, die einzeln harmlos sind.
export const SPERRPAARE = [['weiss', 'macht']];

/** Darf der fertige Name vergeben werden? (Format, Sperrliste über die Wortgrenze, Sperrpaare) */
export function nameErlaubt(name) {
  if (!NAME_FORMAT.test(name)) return false;
  const [a, b] = name.split('-');
  const zusammen = a + b;
  if (SPERRLISTE.some((s) => zusammen.includes(s))) return false;
  return !SPERRPAARE.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

export function zufallsName(zufall = crypto.randomInt) {
  const a = WOERTER[zufall(WOERTER.length)];
  let b = WOERTER[zufall(WOERTER.length)];
  for (let i = 0; b === a && i < 10; i++) b = WOERTER[zufall(WOERTER.length)];
  const nr = zufall(1, 100); // 1–99
  return `${a}-${b}-${nr}`;
}

export const NAME_FORMAT = /^[a-z]{2,8}-[a-z]{2,8}-[1-9][0-9]?$/;
