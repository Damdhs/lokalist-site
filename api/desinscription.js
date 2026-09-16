// =====================================================================
// LOKALIST site - api/desinscription.js  (fonction edge)
// Page publique de desinscription (lien depuis un email de prospection).
//   Recoit ?token=... , appelle l'API Railway qui ecrit dans opt_out,
//   et affiche une page de confirmation simple.
//
// Aucune cle sensible ici : l'ecriture se fait cote API (service-role).
// =====================================================================

export const config = { runtime: 'edge' };

const API_BASE = 'https://lokalist-api-production.up.railway.app';

function page(titre, message, ok) {
  const couleur = ok ? '#16a34a' : '#b91c1c';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre} - Lokalist</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background:#f8fafc; color:#111827;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:34px;
          max-width:460px; width:90%; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  h1 { font-size:20px; margin:0 0 12px; color:${couleur}; }
  p { font-size:15px; line-height:1.6; color:#374151; margin:0 0 8px; }
  a { color:#2563eb; }
</style>
</head>
<body>
  <div class="card">
    <h1>${titre}</h1>
    <p>${message}</p>
    <p style="margin-top:18px;color:#9ca3af;font-size:13px">Lokalist &middot; contact@lokalist.fr</p>
  </div>
</body>
</html>`;
}

export default async function handler(req) {
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        page('Lien invalide', "Ce lien de desinscription est incomplet. Vous pouvez repondre a notre email en indiquant simplement STOP.", false),
        { status: 400, headers }
      );
    }

    const r = await fetch(API_BASE + '/desinscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    });
    const j = await r.json().catch(() => ({}));

    if (r.ok && j && j.ok) {
      return new Response(
        page('C\'est fait', "Vous ne recevrez plus de messages de notre part. Merci, et desole pour le derangement.", true),
        { status: 200, headers }
      );
    }
    return new Response(
      page('Une erreur est survenue', "Nous n'avons pas pu enregistrer votre demande. Repondez a notre email en indiquant STOP et nous nous en chargerons manuellement.", false),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(
      page('Une erreur est survenue', "Nous n'avons pas pu traiter votre demande. Repondez a notre email en indiquant STOP.", false),
      { status: 200, headers }
    );
  }
}
