/* ============================================================
   LOKI — Widget flottant contextuel Lokalist  🦊
   Un seul fichier, déposé sur toutes les pages.
   Détecte la page via le nom de fichier et adapte le discours.
   Usage : <script src="loki.js" defer></script> avant </body>
   ============================================================ */
(function () {
  "use strict";

  /* ----- 0. CONFIG APP -----
     Le bouton "app" est en STAND-BY (visible mais non cliquable).
     Le jour ou les stores sont en ligne :
       - mets APP_READY = true
       - renseigne APP_LINK avec l'URL du store (ou une page de tel.) */
  var APP_READY = false;
  var APP_LINK  = "#"; // ex futur : "https://play.google.com/store/apps/details?id=..."
  var APP_LABEL_READY   = "Télécharger l'app 🦊";
  var APP_LABEL_PENDING = "App bientôt disponible 🦊";

  /* ----- 1. Contenus par contexte -----
     Chaque contexte = une accroche (bulle) + une mini-conversation démo.
     'u' = message habitant/utilisateur, 'l' = réponse de LOKI. */
  var CONTENTS = {
    user: {
      label: "habitants",
      bubbles: [
        "Cherche un resto ? Une sortie ? Demande-moi 🍽️",
        "Un bon plan près de chez toi ? Je connais 😉",
        "Une idée pour ce week-end ? Clique sur moi 🦊"
      ],
      chat: [
        ["u", "Une idée de sortie ce week-end ?"],
        ["l", "Le marché de producteurs samedi matin, et une expo photo à la médiathèque 📸"],
        ["l", "Les deux sont à moins de 10 min de chez toi. Je t'y guide ?"]
      ]
    },
    commercant: {
      label: "commerçants",
      bubbles: [
        "Je peux écrire ton offre du jour en 10 sec 📝",
        "Envie de voir comment je t'amène des clients ?",
        "Une promo à lancer ? Je m'en occupe 🦊"
      ],
      chat: [
        ["u", "Écris-moi une promo pour mes croissants"],
        ["l", "« Petit-déj malin ☕ : 2 croissants + 1 café à 4,50€ ce matin. Cumulez vos points Lokalist ! »"],
        ["l", "Je la publie et je préviens les habitants du quartier ?"]
      ]
    },
    artisan: {
      label: "artisans",
      bubbles: [
        "Je te trouve des chantiers près de chez toi 🔧",
        "Un créneau libre ? J'active ton mode urgence 🚨",
        "Je rédige tes devis pendant que tu bosses 🦊"
      ],
      chat: [
        ["u", "J'ai un créneau libre demain après-midi"],
        ["l", "Top ! J'active ton mode urgence : je pousse ta dispo aux habitants du secteur 🚨"],
        ["l", "Tu as déjà 2 demandes de plomberie en attente. Je te les montre ?"]
      ]
    },
    agence: {
      label: "agences",
      bubbles: [
        "Je qualifie tes leads pendant que tu vends 🏠",
        "Un acheteur sérieux dans le secteur ? Je le repère",
        "Je rédige ton annonce qui donne envie 🦊"
      ],
      chat: [
        ["u", "Nouveau contact sur le T3 centre-ville"],
        ["l", "Lead qualifié : budget 240k€, achat sous 3 mois, financement OK. Du sérieux 👍"],
        ["l", "Je te le transmets et je propose un courtier proche ?"]
      ]
    },
    courtier: {
      label: "courtiers",
      bubbles: [
        "Je t'envoie des emprunteurs du secteur 💶",
        "Un acheteur cherche un financement ? C'est toi que je propose",
        "Je qualifie tes demandes de prêt 🦊"
      ],
      chat: [
        ["u", "Tu as des demandes de financement par ici ?"],
        ["l", "Oui ! Un acheteur sur un T3 à 240k€ cherche un courtier proche. Apport 15%, profil solide 💶"],
        ["l", "Je te le mets en relation maintenant ?"]
      ]
    },
    mairie: {
      label: "mairie",
      bubbles: [
        "Je rédige tes alertes citoyens en un clic 📣",
        "Un événement à annoncer ? Je m'en charge",
        "Je synthétise les signalements des habitants 🦊"
      ],
      chat: [
        ["u", "Coupure d'eau rue des Lilas demain 8h-12h"],
        ["l", "« 💧 Info travaux : coupure d'eau rue des Lilas demain de 8h à 12h. Pensez à remplir vos réserves. »"],
        ["l", "Je l'envoie aux habitants concernés par géolocalisation ?"]
      ]
    }
  };

  /* ----- 2. Détection de la page -----
     Mappe un mot-clé du nom de fichier vers un contexte.
     Calé sur les VRAIS fichiers du site Lokalist. */
  var ROUTES = [
    ["commercant",    "commercant"],
    ["artisan",       "artisan"],
    ["courtier",      "courtier"],
    ["agence",        "agence"],
    ["immo",          "agence"],
    ["mairie",        "mairie"],
    ["loisir",        "user"],
    ["idees-sorties", "user"],
    ["sortie",        "user"],
    ["tarif",         "commercant"],
    ["index",         "user"]
  ];

  function detectContext() {
    var path = (location.pathname || "").toLowerCase();
    if (path === "/" || path === "") return "user";
    for (var i = 0; i < ROUTES.length; i++) {
      if (path.indexOf(ROUTES[i][0]) !== -1) return ROUTES[i][1];
    }
    return "user"; // défaut (ex : contact.html)
  }

  var CTX = detectContext();
  var DATA = CONTENTS[CTX] || CONTENTS.user;

  /* ----- 3. Styles injectés -----  */
  var css = ''
    + '.loki-fab{position:fixed;right:22px;bottom:22px;z-index:9998;width:60px;height:60px;border-radius:50%;'
    + 'background:linear-gradient(135deg,#EF9F27,#e08a10);display:flex;align-items:center;justify-content:center;'
    + 'font-size:31px;cursor:pointer;border:none;box-shadow:0 8px 22px rgba(239,159,39,.45);'
    + 'opacity:0;transform:translateY(20px) scale(.7);transition:opacity .5s,transform .5s cubic-bezier(.2,1.4,.4,1);'
    + 'animation:lokiFloat 3.2s ease-in-out infinite;}'
    + '.loki-fab.in{opacity:1;transform:translateY(0) scale(1);}'
    + '.loki-fab.ring{animation:lokiFloat 3.2s ease-in-out infinite, lokiRing 2.2s infinite;}'
    + '@keyframes lokiFloat{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -7px;rotate:-4deg}}'
    + '@keyframes lokiRing{0%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 0 rgba(239,159,39,.5)}'
    + '70%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 16px rgba(239,159,39,0)}'
    + '100%{box-shadow:0 8px 22px rgba(239,159,39,.45),0 0 0 0 rgba(239,159,39,0)}}'
    + '.loki-bubble{position:fixed;right:92px;bottom:34px;z-index:9998;max-width:248px;'
    + 'background:#fff;color:#14211C;border:1px solid rgba(15,110,86,.12);border-radius:16px;'
    + 'border-bottom-right-radius:5px;padding:12px 15px;font-family:"DM Sans",system-ui,sans-serif;'
    + 'font-size:13.5px;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.12);'
    + 'opacity:0;transform:translateY(10px);transition:opacity .4s,transform .4s;pointer-events:none;}'
    + '.loki-bubble.in{opacity:1;transform:translateY(0);}'
    + '.loki-bubble .x{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;'
    + 'background:#fff;border:1px solid rgba(0,0,0,.1);font-size:13px;line-height:20px;text-align:center;'
    + 'cursor:pointer;color:#5C6B64;pointer-events:auto;}'
    + '.loki-panel{position:fixed;right:22px;bottom:22px;z-index:9999;width:330px;max-width:calc(100vw - 44px);'
    + 'background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.22);overflow:hidden;'
    + 'font-family:"DM Sans",system-ui,sans-serif;opacity:0;transform:translateY(20px) scale(.96);'
    + 'transform-origin:bottom right;transition:opacity .35s,transform .35s;pointer-events:none;}'
    + '.loki-panel.in{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}'
    + '.loki-panel__head{display:flex;align-items:center;gap:10px;padding:13px 16px;'
    + 'background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff;}'
    + '.loki-panel__head b{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-size:15px;}'
    + '.loki-panel__head .sub{font-size:11.5px;opacity:.85;}'
    + '.loki-panel__close{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:#fff;'
    + 'width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1;}'
    + '.loki-chat{padding:16px;display:flex;flex-direction:column;gap:10px;min-height:170px;max-height:300px;overflow-y:auto;}'
    + '.loki-msg{max-width:82%;padding:9px 13px;font-size:13.5px;line-height:1.45;border-radius:15px;}'
    + '.loki-msg.u{align-self:flex-end;background:#1D9E75;color:#fff;border-bottom-right-radius:5px;}'
    + '.loki-msg.l{align-self:flex-start;background:#F0F4F2;color:#14211C;border-bottom-left-radius:5px;}'
    + '.loki-typing{align-self:flex-start;padding:9px 14px;background:#F0F4F2;border-radius:15px;border-bottom-left-radius:5px;}'
    + '.loki-typing span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9BB0A8;margin:0 1px;animation:lokiDot 1.2s infinite;}'
    + '.loki-typing span:nth-child(2){animation-delay:.2s}.loki-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes lokiDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'
    + '.loki-cta{padding:0 16px 16px;}'
    + '.loki-cta a{display:block;text-align:center;padding:11px;border-radius:12px;text-decoration:none;'
    + 'background:linear-gradient(135deg,#EF9F27,#e08a10);color:#fff;font-weight:700;font-size:14px;}'
    + '.loki-input{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(15,110,86,.1);'
    + 'opacity:0;max-height:0;overflow:hidden;transition:opacity .4s,max-height .4s;}'
    + '.loki-input.in{opacity:1;max-height:80px;}'
    + '.loki-input input{flex:1;border:1px solid rgba(15,110,86,.2);border-radius:11px;padding:9px 12px;'
    + 'font-family:inherit;font-size:13.5px;outline:none;color:#14211C;}'
    + '.loki-input input:focus{border-color:#1D9E75;}'
    + '.loki-input button{flex:none;width:38px;border:none;border-radius:11px;cursor:pointer;'
    + 'background:#1D9E75;color:#fff;font-size:16px;line-height:1;}'
    + '.loki-hint{font-size:11.5px;color:#8a978f;text-align:center;padding:0 16px 12px;'
    + 'opacity:0;transition:opacity .4s;}.loki-hint.in{opacity:1;}'
    + '.loki-appbtn{display:inline-block;margin-top:4px;padding:9px 16px;border-radius:12px;'
    + 'font-weight:700;font-size:13px;text-decoration:none;}'
    + '.loki-appbtn.ready{background:linear-gradient(135deg,#EF9F27,#e08a10);color:#fff;cursor:pointer;}'
    + '.loki-appbtn.pending{background:#F0F4F2;color:#8a978f;cursor:default;border:1px dashed #c5d2cb;}'
    + '@media(prefers-reduced-motion:reduce){.loki-fab{animation:none!important}}';

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ----- 4. Construction du DOM -----  */
  var fab = document.createElement("button");
  fab.className = "loki-fab";
  fab.setAttribute("aria-label", "Ouvrir LOKI, l'assistant Lokalist");
  fab.textContent = "🦊";

  var bubble = document.createElement("div");
  bubble.className = "loki-bubble";
  var bubbleText = DATA.bubbles[Math.floor(Math.random() * DATA.bubbles.length)];
  bubble.innerHTML = '<span class="x" aria-label="Fermer">✕</span>' + bubbleText;

  var panel = document.createElement("div");
  panel.className = "loki-panel";
  panel.innerHTML =
      '<div class="loki-panel__head"><span style="font-size:22px">🦊</span>'
    + '<div><b>LOKI</b><div class="sub">votre assistant Lokalist</div></div>'
    + '<button class="loki-panel__close" aria-label="Fermer">✕</button></div>'
    + '<div class="loki-chat" id="lokiChat"></div>'
    + '<div class="loki-input" id="lokiInput">'
    + '<input type="text" id="lokiFree" placeholder="Écrivez à LOKI…" aria-label="Écrivez votre question à LOKI" />'
    + '<button id="lokiSend" aria-label="Envoyer">➤</button></div>'
    + '<div class="loki-hint" id="lokiHint">LOKI comprend vos questions en langage naturel 🦊</div>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  var chatEl  = panel.querySelector("#lokiChat");
  var inputEl = panel.querySelector("#lokiInput");
  var freeEl  = panel.querySelector("#lokiFree");
  var sendEl  = panel.querySelector("#lokiSend");
  var hintEl  = panel.querySelector("#lokiHint");

  /* ----- 5. Logique d'animation -----  */
  function playChat() {
    chatEl.innerHTML = "";
    inputEl.classList.remove("in");
    hintEl.classList.remove("in");
    var seq = DATA.chat, i = 0;
    (function step() {
      if (i >= seq.length) {
        // Fin de la demo : on revele le champ libre + la phrase explicative
        setTimeout(function () {
          inputEl.classList.add("in");
          hintEl.classList.add("in");
        }, 350);
        return;
      }
      var item = seq[i];
      if (item[0] === "l") {
        var t = document.createElement("div");
        t.className = "loki-typing";
        t.innerHTML = "<span></span><span></span><span></span>";
        chatEl.appendChild(t);
        chatEl.scrollTop = chatEl.scrollHeight;
        setTimeout(function () {
          chatEl.removeChild(t);
          addMsg(item[0], item[1]);
          i++; setTimeout(step, 600);
        }, 850);
      } else {
        addMsg(item[0], item[1]);
        i++; setTimeout(step, 700);
      }
    })();
  }
  function addMsg(who, text) {
    var m = document.createElement("div");
    m.className = "loki-msg " + who;
    m.textContent = (who === "l" ? "🦊 " : "") + text;
    chatEl.appendChild(m);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  /* ----- 5b. Envoi d'une vraie question (factice -> redirige vers l'app) ----- */
  function sendFree() {
    var v = freeEl.value.trim();
    if (!v) return;
    addMsg("u", v);
    freeEl.value = "";
    var t = document.createElement("div");
    t.className = "loki-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    chatEl.appendChild(t);
    chatEl.scrollTop = chatEl.scrollHeight;
    setTimeout(function () {
      chatEl.removeChild(t);
      addMsg("l", "Bonne question ! Pour une vraie réponse sur-mesure, retrouvez-moi dans l'application Lokalist 📲");
      // Bouton app (stand-by ou actif selon la config en haut du fichier)
      var w = document.createElement("div");
      w.style.display = "flex";
      w.style.justifyContent = "flex-start";
      if (APP_READY) {
        var a = document.createElement("a");
        a.className = "loki-appbtn ready";
        a.href = APP_LINK;
        a.textContent = APP_LABEL_READY;
        w.appendChild(a);
      } else {
        var span = document.createElement("span");
        span.className = "loki-appbtn pending";
        span.textContent = APP_LABEL_PENDING;
        w.appendChild(span);
      }
      chatEl.appendChild(w);
      chatEl.scrollTop = chatEl.scrollHeight;
    }, 850);
  }

  var opened = false;
  function openPanel() {
    bubble.classList.remove("in");
    fab.classList.remove("ring");
    panel.classList.add("in");
    if (!opened) { opened = true; playChat(); }
    else playChat();
  }
  function closePanel() { panel.classList.remove("in"); }

  fab.addEventListener("click", function () {
    if (panel.classList.contains("in")) closePanel(); else openPanel();
  });
  panel.querySelector(".loki-panel__close").addEventListener("click", closePanel);
  bubble.querySelector(".x").addEventListener("click", function (e) {
    e.stopPropagation(); bubble.classList.remove("in");
  });
  bubble.addEventListener("click", openPanel);

  sendEl.addEventListener("click", sendFree);
  freeEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendFree();
  });

  /* ----- 6. Apparition différée (effet surprise) -----  */
  setTimeout(function () { fab.classList.add("in", "ring"); }, 2200);
  setTimeout(function () { bubble.classList.add("in"); }, 3400);
  // La bulle se referme seule au bout d'un moment si pas cliquée
  setTimeout(function () { if (!opened) bubble.classList.remove("in"); }, 12000);

})();
