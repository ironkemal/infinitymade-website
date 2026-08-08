// Praxura Ops-Dashboard — yapılandırma
//
// Buradaki anon key gizli DEĞİLDİR: Supabase'in "publishable" anahtarıdır ve
// zaten her tarayıcıya gider. Güvenlik iki şeyden gelir:
//   1. RLS  → sadece ops_members'taki kullanıcı veri görür (schema.sql)
//   2. Supabase panelinde kayıt (signup) KAPALI → kimse kendini üye yapamaz
// Service-role anahtarı buraya ASLA yazılmaz.

export const SUPABASE_URL      = 'https://farkaejociddtgqkusvm.supabase.co';

// Yeni nesil "publishable" anahtar. Girişte 401 alırsak eski anon JWT'ye
// (Settings → API → Legacy keys) düşeriz — ikisi de aynı yetkiye sahip.
export const SUPABASE_ANON_KEY = 'sb_publishable_0GMmZtNiJvThgIGgsBHA7Q_hV7ZVwg6';

// Dateien sekmesi — GitHub'daki kod ağacı
export const GITHUB_REPO   = 'ironkemal5/website';   // owner/repo
export const GITHUB_BRANCH = 'main';

// Gitignore'lu paylaşılan belgelerin durduğu OneDrive klasörünün paylaşım linki.
// (legal/, toplantı notları, faturalar — kod ve .git ASLA buraya konmaz.)
export const ONEDRIVE_SHARE_URL = '';

// Bitmiş görevler kaç gün sonra arşive gizlensin
export const DONE_ARCHIVE_DAYS = 7;
