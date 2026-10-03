/* =====================================================================
   LOKALIST - popup.js (site public)
   Deux pop-ups pilotees depuis le dashboard (table Supabase site_popup) :
     - "arrivee" : s'affiche apres un delai
     - "sortie"  : s'affiche quand le visiteur s'apprete a quitter
   Chaque pop-up a sa liste de pages (colonne pages). '*' = toutes.
   Une seule fois par visiteur et par version (updated_at).
   ===================================================================== */
(function () {
  "use strict";

  var SB_URL = "https://kukathominhssogthplc.supabase.co";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg";
  var KEYS = { arrivee: "lokalist_popup_seen", sortie: "lokalist_popup_seen_sortie" };

  function pageKey() {
    var p = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.html$/i, "");
    if (p === "" || p === "index") return "accueil";
    return p.split("/")[0];
  }

  function safeUrl(u) { u = String(u || ""); return /^https?:\/\//i.test(u) ? u : ("https://" + u); }
  function txt(s) { return String(s == null ? "" : s); }

  function injectStyle() {
    if (document.getElementById("lkl-pop-style")) return;
    var st = document.createElement("style");
    st.id = "lkl-pop-style";
    st.textContent =
      "#lkl-pop-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;opacity:0;transition:opacity .25s ease;}" +
      "#lkl-pop-ov.on{opacity:1;}" +
      "#lkl-pop-card{background:#fff;max-width:440px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35);transform:translateY(14px) scale(.98);transition:transform .25s ease;position:relative;font-family:inherit;}" +
      "#lkl-pop-ov.on #lkl-pop-card{transform:none;}" +
      "#lkl-pop-bar{height:8px;background:linear-gradient(90deg,#1D9E75,#0F6E56);}" +
      "#lkl-pop-x{position:absolute;top:12px;right:14px;border:none;background:rgba(0,0,0,.05);color:#6B7280;width:32px;height:32px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer;}" +
      "#lkl-pop-x:hover{background:rgba(0,0,0,.1);}" +
      "#lkl-pop-body{padding:28px 26px 26px;text-align:center;}" +
      "#lkl-pop-logo{font-size:29px;font-weight:800;letter-spacing:-.5px;line-height:1;}" +
      "#lkl-pop-logo .g{color:#1D9E75;}#lkl-pop-logo .y{color:#F5A623;}" +
      "#lkl-pop-eco{font-size:12px;font-weight:700;color:#0F6E56;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;}" +
      "#lkl-pop-title{font-size:21px;font-weight:800;color:#0F6E56;line-height:1.25;margin-top:16px;}" +
      "#lkl-pop-msg{font-size:15px;color:#4B5563;line-height:1.6;margin:12px 0 22px;white-space:pre-line;}" +
      "#lkl-pop-cta{display:inline-block;background:#1D9E75;color:#fff;padding:13px 30px;border-radius:11px;font-weight:800;font-size:16px;text-decoration:none;box-shadow:0 6px 16px rgba(29,158,117,.35);}" +
      "#lkl-pop-cta:hover{background:#0F6E56;}" +
      "#lkl-pop-note{font-size:12px;color:#9CA3AF;margin-top:14px;}" +
      "@media(max-width:480px){#lkl-pop-title{font-size:19px;}#lkl-pop-logo{font-size:26px;}#lkl-pop-body{padding:24px 20px 22px;}}";
    document.head.appendChild(st);
  }

  function markSeen(type, stamp) { try { localStorage.setItem(KEYS[type], stamp); } catch (e) {} }
  function alreadySeen(type, stamp) { try { return localStorage.getItem(KEYS[type]) === stamp; } catch (e) { return false; } }

  function show(p, type, stamp) {
    if (document.getElementById("lkl-pop-ov")) return;
    injectStyle();
    var ov = document.createElement("div"); ov.id = "lkl-pop-ov";
    var card = document.createElement("div"); card.id = "lkl-pop-card";
    var bar = document.createElement("div"); bar.id = "lkl-pop-bar"; card.appendChild(bar);
    var x = document.createElement("button"); x.id = "lkl-pop-x"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = "&times;"; card.appendChild(x);
    var body = document.createElement("div"); body.id = "lkl-pop-body";
    var logo = document.createElement("div"); logo.id = "lkl-pop-logo"; logo.innerHTML = "<span class=\"g\">lokal</span><span class=\"y\">ist</span>"; body.appendChild(logo);
    var eco = document.createElement("div"); eco.id = "lkl-pop-eco"; eco.textContent = "Rejoignez l'écosystème"; body.appendChild(eco);
    var h = document.createElement("div"); h.id = "lkl-pop-title"; h.textContent = txt(p.titre); body.appendChild(h);
    var m = document.createElement("div"); m.id = "lkl-pop-msg"; m.textContent = txt(p.message); body.appendChild(m);
    var a = document.createElement("a"); a.id = "lkl-pop-cta"; a.href = safeUrl(p.cta_url); a.textContent = txt(p.cta_label) || "En savoir plus"; body.appendChild(a);
    var n = document.createElement("div"); n.id = "lkl-pop-note"; n.textContent = "Sans engagement"; body.appendChild(n);
    card.appendChild(body); ov.appendChild(card); document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });
    function close() {
      markSeen(type, stamp);
      ov.classList.remove("on");
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    x.addEventListener("click", close);
    a.addEventListener("click", function () { markSeen(type, stamp); });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", onKey);
  }

  function concerned(row, key) {
    var pages = row.pages;
    if (!pages || !pages.length) pages = ["accueil"]; /* ancien comportement */
    return pages.indexOf("*") !== -1 || pages.indexOf(key) !== -1;
  }

  function rowType(row) { return row.type === "sortie" ? "sortie" : "arrivee"; }

  /* ---- pop-up d'arrivee ---- */
  function startArrival(row) {
    var stamp = String(row.updated_at || "");
    if (alreadySeen("arrivee", stamp)) return;
    var d = Math.max(0, (parseInt(row.delai_secondes, 10) || 0)) * 1000;
    setTimeout(function () { show(row, "arrivee", stamp); }, d);
  }

  /* ---- pop-up de sortie ---- */
  function startExit(row) {
    var stamp = String(row.updated_at || "");
    if (alreadySeen("sortie", stamp)) return;
    var armed = false, fired = false;
    function fire() {
      if (fired || !armed) return;
      if (document.getElementById("lkl-pop-ov")) return; /* une pop-up deja ouverte */
      fired = true;
      show(row, "sortie", stamp);
    }
    /* on laisse 4 s au visiteur avant d'armer la pop-up */
    setTimeout(function () { armed = true; }, 4000);

    var tactile = false;
    try { tactile = window.matchMedia("(pointer:coarse)").matches; } catch (e) {}

    if (!tactile) {
      /* ordinateur : la souris sort par le haut de la fenetre */
      document.addEventListener("mouseout", function (e) {
        if (!e.relatedTarget && e.clientY <= 0) fire();
      });
    } else {
      /* mobile : bouton retour. L'entree d'historique doit etre creee apres un geste */
      var pushed = false;
      function arm() {
        if (pushed) return; pushed = true;
        try { history.pushState({ lklExit: 1 }, ""); } catch (e) {}
        window.removeEventListener("touchstart", arm);
        window.removeEventListener("scroll", arm);
      }
      window.addEventListener("touchstart", arm, { passive: true });
      window.addEventListener("scroll", arm, { passive: true });
      window.addEventListener("popstate", function () { if (pushed) fire(); });
    }
  }

  function start() {
    var key = pageKey();
    var url = SB_URL + "/rest/v1/site_popup?actif=eq.true&select=*&order=id.asc";
    fetch(url, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        var arr = null, sor = null;
        rows.forEach(function (r) {
          if (!r || !r.actif || !concerned(r, key)) return;
          if (rowType(r) === "sortie") { if (!sor) sor = r; }
          else { if (!arr) arr = r; }
        });
        if (arr) startArrival(arr);
        if (sor) startExit(sor);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
