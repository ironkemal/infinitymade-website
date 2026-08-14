// Typ-Hilfen für die Editor-Prüfung (checkJs). Wird NICHT ausgeliefert.

// Das Projekt hängt an Modul-URLs einen Cache-Buster: './signal.js?v=20260813'.
// Der Browser versteht das, die TypeScript-Auflösung nicht — sie sucht nach
// einer Datei, die wörtlich '?v=...' heißt. Ohne diese Deklaration meldet jeder
// interne Import "Cannot find module".
//
// Preis: solche Importe sind für den Editor `any`, verlieren also ihre Typen.
// Wer volle Typen im Editor will, importiert modul-zu-modul OHNE '?v=' und
// setzt den Cache-Buster nur dort, wo HTML das Einstiegsmodul lädt.
declare module '*?v=*';

// Sentry kommt per CDN-Loader ins Fenster, nicht als npm-Paket.
interface Window {
  Sentry?: {
    captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
    captureMessage?: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}
