// Süreli fetch — dış API asılı kalırsa AbortController ile keser, böylece
// event-loop slot'u süresiz tutulmaz (eşzamanlı yük altında kritik).
//
// Aus server.js herausgelöst (04.09.2026), damit auch eigenständige Skripte
// außerhalb des Express-Prozesses (z. B. preise_pruefen.mjs) dieselbe Funktion
// verwenden können, ohne server.js zu importieren (das würde den ganzen
// Express-Server samt DB-Clients mit hochziehen).
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}
