/* Lokalist — widget Loki (renard) : ouvre l'expérience Loki en plein écran, sur toutes les pages. */
(function () {
  "use strict";

  var MAQUETTE = "/loki-demo/loki-site-live.html";

  /* Accroches par page (juste la bulle d'attention) */
  var BUBBLES = {
    user:       ["Une idée pour ce week-end ? Clique sur moi 🦊", "Un bon plan près de chez toi ? Je connais 😉", "Découvre Lokalist en 30 sec 🦊"],
    commercant: ["Ton commerce mérite mieux. Je te montre ? 🦊", "En 30 sec, vois ce que Lokalist t'apporte 🏪"],
    artisan:    ["Des chantiers du coin, sans commission. Regarde 🔧", "En 30 sec, je te montre 🦊"],
    agence:     ["Des leads locaux en direct. Je te montre ? 🏠", "En 30 sec, vois ce que ça change 🦊"],
    courtier:   ["Pile devant l'acheteur au bon moment 💶", "En 30 sec, je te montre 🦊"],
    mairie:     ["Votre commune, plus attractive. En 30 sec 🏛️", "0 € à l'activation. Je vous montre ? 🦊"]
  };
  var ROUTES = [["commercant","commercant"],["artisan","artisan"],["courtier","courtier"],
    ["agence","agence"],["immo","agence"],["mairie","mairie"],
    ["loisir","user"],["idees-sorties","user"],["sortie","user"],["tarif","commercant"],["index","user"]];
  function ctx(){ var p=(location.pathname||"").toLowerCase(); if(p==="/"||p==="")return "user";
    for(var i=0;i<ROUTES.length;i++){ if(p.indexOf(ROUTES[i][0])!==-1) return ROUTES[i][1]; } return "user"; }
  var CTX = ctx();
  var HOOKS = BUBBLES[CTX] || BUBBLES.user;

  /* Styles */
  var css = ""
    + ".loki-fab{position:fixed;right:22px;bottom:22px;z-index:9998;width:60px;height:60px;border-radius:50%;"
    + "background:linear-gradient(135deg,#EF9F27,#e08a10);display:flex;align-items:center;justify-content:center;"
    + "font-size:31px;cursor:pointer;border:none;box-shadow:0 8px 22px rgba(239,159,39,.45);"
    + "opacity:0;transform:translateY(20px) scale(.7);transition:opacity .5s,transform .5s cubic-bezier(.2,1.4,.4,1);"
    + "animation:lokiFloat 3.2s ease-in-out infinite;}"
    + ".loki-fab.in{opacity:1;transform:translateY(0) scale(1);}"
    + ".loki-fab.ring{animation:lokiFloat 3.2s ease-in-out infinite, lokiRing 2.2s infinite;}"
    + "@keyframes lokiFloat{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -7px;rotate:-4deg}}"
    + "@keyframes lokiRing{0%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 0 rgba(239,159,39,.5)}"
    + "70%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 16px rgba(239,159,39,0)}"
    + "100%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 0 rgba(239,159,39,0)}}"
    + ".loki-bubble{position:fixed;right:92px;bottom:34px;z-index:9998;max-width:250px;"
    + "background:#fff;color:#14211C;border:1px solid rgba(15,110,86,.12);border-radius:16px;border-bottom-right-radius:5px;"
    + "padding:12px 15px;font-family:'DM Sans',system-ui,sans-serif;font-size:13.5px;line-height:1.45;"
    + "box-shadow:0 10px 30px rgba(0,0,0,.12);opacity:0;transform:translateY(10px);transition:opacity .4s,transform .4s;"
    + "cursor:pointer;}"
    + ".loki-bubble.in{opacity:1;transform:translateY(0);}"
    + ".loki-bubble .x{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:#fff;"
    + "border:1px solid rgba(0,0,0,.1);font-size:13px;line-height:20px;text-align:center;cursor:pointer;color:#5C6B64;}"
    + ".loki-ov{position:fixed;inset:0;z-index:99999;background:rgba(8,20,15,.74);backdrop-filter:blur(4px);"
    + "-webkit-backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;opacity:0;"
    + "transition:opacity .3s;}"
    + ".loki-ov.in{display:flex;opacity:1;}"
    + ".loki-ov iframe{width:min(1000px,96vw);height:min(730px,94vh);border:none;border-radius:18px;"
    + "box-shadow:0 30px 90px rgba(0,0,0,.55);background:#0C1A15;}"
    + ".loki-ov .close{position:fixed;top:16px;right:18px;width:42px;height:42px;border-radius:50%;background:#fff;"
    + "border:none;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:100001;"
    + "color:#14211C;}"
    + "@media(max-width:640px){.loki-ov iframe{width:100vw;height:100vh;border-radius:0;}}"
    + "@media(prefers-reduced-motion:reduce){.loki-fab{animation:none!important}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* FAB + bulle */
  var fab = document.createElement("button");
  fab.className = "loki-fab"; fab.setAttribute("aria-label","Ouvrir LOKI"); fab.textContent = "🦊";

  var bubble = document.createElement("div");
  bubble.className = "loki-bubble";
  bubble.innerHTML = '<span class="x" aria-label="Fermer">✕</span>' + HOOKS[Math.floor(Math.random()*HOOKS.length)];

  document.body.appendChild(bubble);
  document.body.appendChild(fab);

  /* Overlay (iframe créé à la 1re ouverture) */
  var ov = null;
  function openOverlay(){
    bubble.classList.remove("in"); fab.classList.remove("ring");
    if (!ov){
      ov = document.createElement("div"); ov.className = "loki-ov";
      var frame = document.createElement("iframe");
      frame.setAttribute("title","LOKI — Lokalist");
      frame.setAttribute("loading","lazy");
      frame.src = MAQUETTE;
      var close = document.createElement("button");
      close.className = "close"; close.setAttribute("aria-label","Fermer"); close.textContent = "✕";
      close.addEventListener("click", closeOverlay);
      ov.appendChild(frame); ov.appendChild(close);
      ov.addEventListener("click", function(e){ if(e.target === ov) closeOverlay(); });
      document.body.appendChild(ov);
    }
    requestAnimationFrame(function(){ ov.classList.add("in"); });
    document.documentElement.style.overflow = "hidden";
  }
  function closeOverlay(){
    if (ov) ov.classList.remove("in");
    document.documentElement.style.overflow = "";
  }

  fab.addEventListener("click", openOverlay);
  bubble.addEventListener("click", openOverlay);
  bubble.querySelector(".x").addEventListener("click", function(e){ e.stopPropagation(); bubble.classList.remove("in"); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeOverlay(); });

  /* Apparition différée (effet surprise) */
  setTimeout(function(){ fab.classList.add("in","ring"); }, 2000);
  setTimeout(function(){ bubble.classList.add("in"); }, 3200);
  setTimeout(function(){ bubble.classList.remove("in"); }, 12000);
})();
