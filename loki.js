/* ============================================================
   LOKI — Widget flottant contextuel Lokalist  🦊
   Un seul fichier, déposé sur toutes les pages.
   Détecte la page via le nom de fichier et adapte le discours.
   Chaque contexte a PLUSIEURS scénarios de démo, tirés au hasard.
   Usage : <script src="loki.js" defer></script> avant </body>
   ============================================================ */
(function () {
  "use strict";

  /* ----- 1. Contenus par contexte -----
     Chaque contexte = des accroches (bulles) + PLUSIEURS mini-conversations.
     'u' = message habitant/utilisateur, 'l' = réponse de LOKI.
     À chaque ouverture, un scénario est choisi au hasard parmi 'chats'. */
  var CONTENTS = {
    user: {
      label: "habitants",
      bubbles: [
        "Cherche un resto ? Une sortie ? Demande-moi 🍽️",
        "Un bon plan près de chez toi ? Je connais 😉",
        "Une idée pour ce week-end ? Clique sur moi 🦊",
        "Une idée cadeau ? J'ai ce qu'il te faut 🎁",
        "Besoin d'un artisan en urgence ? Je cherche pour toi 🔧"
      ],
      chats: [
        [
          ["u", "Une idée de sortie ce week-end ?"],
          ["l", "Le marché de producteurs samedi matin, et une expo photo à la médiathèque 📸"],
          ["l", "Les deux sont à moins de 10 min de chez toi. Je t'y guide ?"]
        ],
        [
          ["u", "Je cherche un bon restaurant ce soir"],
          ["l", "Le Bistrot du Port est ouvert et à 600 m de toi 🍽️ Note de 4,7/5"],
          ["l", "Tu y gagnes aussi des points Lokalist. Je te montre le chemin ?"]
        ],
        [
          ["u", "Il me faut un plombier rapidement"],
          ["l", "J'en ai un certifié à 1,2 km, dispo aujourd'hui 🔧"],
          ["l", "Je t'affiche ses coordonnées et ses avis ?"]
        ],
        [
          ["u", "Comment je gagne des points exactement ?"],
          ["l", "En scannant chez les commerçants, en laissant des avis et en parrainant des amis 🎯"],
          ["l", "À 200 points, tu débloques déjà un bon de 5 €. On regarde ton solde ?"]
        ],
        [
          ["u", "Une idée cadeau pour ma mère qui adore jardiner ?"],
          ["l", "Une jardinerie partenaire à 2 km propose -15 % cette semaine 🌿"],
          ["l", "Sinon, un fleuriste juste à côté fait de jolies compositions. Je t'y emmène ?"]
        ],
        [
          ["u", "Il y a des promos en ce moment ?"],
          ["l", "Oui ! -20 % chez le torréfacteur du centre et une offre 2=3 à la boulangerie ☕"],
          ["l", "Toutes à moins de 5 min de toi. Je te liste les autres ?"]
        ]
      ]
    },
    commercant: {
      label: "commerçants",
      bubbles: [
        "Je peux écrire ton offre du jour en 10 sec 📝",
        "Tes avis clients ? Je t'aide à y répondre 💬",
        "Je rédige ton annonce qui donne envie 🦊",
        "Envie de voir tes stats de la semaine ? 📊"
      ],
      chats: [
        [
          ["u", "Aide-moi à rédiger mon offre du jour"],
          ["l", "« 🥐 Offre du matin : 1 viennoiserie offerte dès 3 achetées, jusqu'à 11h ! »"],
          ["l", "Je la publie sur ta fiche et je la pousse aux habitants proches ?"]
        ],
        [
          ["u", "Combien de scans cette semaine ?"],
          ["l", "47 scans, +18 % vs la semaine dernière, et 12 nouveaux clients 📊"],
          ["l", "Ta note moyenne reste à 4,8/5. Je te fais le détail ?"]
        ],
        [
          ["u", "Un client m'a laissé un avis, je réponds quoi ?"],
          ["l", "Propose : « Merci beaucoup, ravi que ça vous ait plu ! À très vite chez nous 😊 »"],
          ["l", "Je l'enregistre comme réponse publique ?"]
        ]
      ]
    },
    artisan: {
      label: "artisans",
      bubbles: [
        "Je mets ta fiche en valeur auprès des habitants 🔧",
        "Un client cherche ton métier près d'ici ? Je te place",
        "Je t'aide à gérer tes avis et ta visibilité 🦊"
      ],
      chats: [
        [
          ["u", "Comment je gagne en visibilité ?"],
          ["l", "Ta fiche apparaît quand un habitant cherche ton métier près de chez lui 🔧"],
          ["l", "Avec tes badges (assurance, RGE), tu inspires plus confiance. Je t'aide à les activer ?"]
        ],
        [
          ["u", "J'ai une dispo de dernière minute cette semaine"],
          ["l", "Active le mode Urgence : ta fiche passe en avant pendant 3 jours ⚡"],
          ["l", "Les habitants qui cherchent en urgence te voient en premier. Je l'active ?"]
        ],
        [
          ["u", "Un client veut un devis"],
          ["l", "Je note sa demande dans ton suivi et je te préviens 🔔"],
          ["l", "Tu pourras le relancer en un clic. Je te montre ton pipeline ?"]
        ]
      ]
    },
    agence: {
      label: "agences",
      bubbles: [
        "Je qualifie tes leads pendant que tu vends 🏠",
        "Un acheteur sérieux dans le secteur ? Je le repère",
        "Je te mets en relation avec les bons profils 🦊"
      ],
      chats: [
        [
          ["u", "Nouveau contact sur le T3 centre-ville"],
          ["l", "Lead qualifié : budget 240k€, achat sous 3 mois, financement OK. Du sérieux 👍"],
          ["l", "Je te le transmets et je propose un courtier proche ?"]
        ],
        [
          ["u", "J'ai une nouvelle annonce à diffuser"],
          ["l", "Je la mets en ligne et je la signale aux acheteurs qui correspondent 🏠"],
          ["l", "Tu veux que je la booste auprès des profils du secteur ?"]
        ],
        [
          ["u", "Qui sont mes contacts les plus chauds ?"],
          ["l", "3 acheteurs prêts à visiter cette semaine, tous financés 🔥"],
          ["l", "Je te les classe par priorité ?"]
        ]
      ]
    },
    courtier: {
      label: "courtiers",
      bubbles: [
        "Je t'envoie des emprunteurs du secteur 💶",
        "Un acheteur cherche un financement ? C'est toi que je propose",
        "Je qualifie tes demandes de prêt 🦊"
      ],
      chats: [
        [
          ["u", "Tu as des demandes de financement par ici ?"],
          ["l", "Oui ! Un acheteur sur un T3 à 240k€ cherche un courtier proche. Apport 15 %, profil solide 💶"],
          ["l", "Je te le mets en relation maintenant ?"]
        ],
        [
          ["u", "Quel type de profils tu m'envoies ?"],
          ["l", "Des acheteurs déjà engagés sur un bien, avec apport et besoin de financement 💶"],
          ["l", "Cette semaine, 2 dossiers solides t'attendent. Je te les présente ?"]
        ]
      ]
    },
    mairie: {
      label: "mairie",
      bubbles: [
        "Je rédige tes alertes citoyens en un clic 📣",
        "Un événement à annoncer ? Je m'en charge",
        "Je synthétise les signalements des habitants 🦊"
      ],
      chats: [
        [
          ["u", "Coupure d'eau rue des Lilas demain 8h-12h"],
          ["l", "« 💧 Info travaux : coupure d'eau rue des Lilas demain de 8h à 12h. Pensez à remplir vos réserves. »"],
          ["l", "Je l'envoie aux habitants concernés par géolocalisation ?"]
        ],
        [
          ["u", "On organise un vide-grenier samedi prochain"],
          ["l", "Je crée l'événement dans l'agenda : « 🎪 Vide-grenier samedi, place du marché, 8h-18h »"],
          ["l", "Je préviens les habitants et j'ouvre les inscriptions ?"]
        ],
        [
          ["u", "Combien de signalements cette semaine ?"],
          ["l", "9 signalements : surtout de la voirie et 2 dépôts sauvages 🗺️"],
          ["l", "Je te les regroupe par quartier pour ton équipe ?"]
        ]
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

  /* Rabattage : capture de lead -> preinscriptions_pros (dashboard) */
  var LEAD_URL = 'https://lokalist-api-production.up.railway.app/preinscription-pro';
  var PRO_CTX = { commercant:1, artisan:1, agence:1, courtier:1, mairie:1 };
  var isPro = !!PRO_CTX[CTX];

  /* Choisit un scénario de chat au hasard parmi ceux du contexte. */
  function pickChat() {
    var list = DATA.chats || [];
    if (!list.length) return [];
    return list[Math.floor(Math.random() * list.length)];
  }

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
    + '.loki-hint{font-size:12.5px;color:#5C6B64;text-align:center;padding:0 18px 16px;'
    + 'line-height:1.45;opacity:0;transition:opacity .5s;}.loki-hint.in{opacity:1;}'
    + '.loki-intro{position:absolute;inset:0;z-index:5;background:linear-gradient(160deg,#12241D,#0F6E56);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;}'
    + '.loki-intro .fx{font-size:58px;filter:drop-shadow(0 10px 26px rgba(239,159,39,.55));animation:lkiFox .75s cubic-bezier(.2,.9,.25,1.3) both;}'
    + '.loki-intro .nm{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-weight:800;font-size:24px;letter-spacing:-.5px;opacity:0;transform:translateY(8px);animation:lkiUp .5s ease .38s forwards;}'
    + '.loki-intro .tg{font-size:12.5px;color:#BFE6D6;opacity:0;transform:translateY(8px);animation:lkiUp .5s ease .58s forwards;}'
    + '.loki-intro.out{animation:lkiOut .45s ease forwards;}'
    + '@keyframes lkiFox{0%{transform:scale(.3) rotate(-16deg);opacity:0}60%{transform:scale(1.16) rotate(6deg)}100%{transform:scale(1) rotate(0);opacity:1}}'
    + '@keyframes lkiUp{to{opacity:1;transform:translateY(0)}}'
    + '@keyframes lkiOut{to{opacity:0;visibility:hidden}}'
    + '.loki-lead{padding:2px 16px 16px;}'
    + '.loki-lead .t{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-weight:700;font-size:14px;color:#14211C;margin-bottom:6px;}'
    + '.loki-lead .d{font-size:12.5px;color:#5C6B64;line-height:1.45;margin-bottom:10px;}'
    + '.loki-lead input{width:100%;border:1px solid #d7e0db;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13.5px;outline:none;margin-bottom:8px;}'
    + '.loki-lead input:focus{border-color:#1D9E75;}'
    + '.loki-lead button{width:100%;background:linear-gradient(135deg,#EF9F27,#e08a10);color:#3a2606;border:none;border-radius:10px;padding:11px;font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-weight:800;font-size:14px;cursor:pointer;}'
    + '.loki-lead button:disabled{opacity:.6;cursor:default;}'
    + '.loki-lead .note{font-size:11px;color:#8A988F;text-align:center;margin-top:7px;}'
    + '.loki-lead .ok{background:#EAF7F1;border:1px solid #BFE6D6;color:#0F6E56;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;text-align:center;}'
    + '.loki-lead .err{color:#C0392B;font-size:12px;margin-top:6px;text-align:center;}'
    + '@media(prefers-reduced-motion:reduce){.loki-fab{animation:none!important}.loki-intro .fx,.loki-intro .nm,.loki-intro .tg{animation:none!important;opacity:1;transform:none}}';

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
    + '<div class="loki-hint" id="lokiHint">🦊 Le vrai LOKI répond à toutes vos questions en langage naturel, dans l\'app Lokalist.</div>'
    + '<div class="loki-lead" id="lokiLead"></div>'
    + '<div class="loki-intro" id="lokiIntro"><div class="fx">\uD83E\uDD8A</div>'
    + '<div class="nm"><span style="color:#38C793">Lokal</span><span style="color:#F2C230">ist</span></div>'
    + '<div class="tg">votre assistant local, toujours dispo</div></div>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  var chatEl  = panel.querySelector("#lokiChat");
  var introEl = panel.querySelector("#lokiIntro");
  var leadEl  = panel.querySelector("#lokiLead");
  var hintEl  = panel.querySelector("#lokiHint");

  /* ----- 5. Logique d'animation -----  */
  function playChat() {
    chatEl.innerHTML = "";
    hintEl.classList.remove("in");
    var seq = pickChat(), i = 0; // scénario tiré au hasard à chaque lecture
    (function step() {
      if (i >= seq.length) {
        // Fin de la demo : on revele la phrase "texte libre dans l'app"
        setTimeout(function () { if (isPro) showLead(); else hintEl.classList.add("in"); }, 350);
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

  /* ----- Rabattage : formulaire + envoi vers preinscriptions_pros ----- */
  function showLead() {
    if (!leadEl) return;
    leadEl.innerHTML =
        '<div class="t">Envie de \u00e7a pour votre activit\u00e9 ?</div>'
      + '<div class="d">Laissez vos coordonn\u00e9es \u2014 on vous rappelle. Juste un SMS pour caler un RDV, sans engagement.</div>'
      + '<input id="lk-nom" placeholder="Votre pr\u00e9nom" autocomplete="given-name">'
      + '<input id="lk-tel" placeholder="Votre num\u00e9ro" inputmode="tel" autocomplete="tel">'
      + '<input id="lk-email" placeholder="Votre email" inputmode="email" autocomplete="email">'
      + '<button id="lk-go">R\u00e9server ma place</button>'
      + '<div class="note">Sans engagement \u00b7 vos infos ne sont jamais revendues.</div>'
      + '<div class="err" id="lk-err" style="display:none"></div>';
    leadEl.querySelector('#lk-go').addEventListener('click', submitLead);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  async function submitLead() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var nom = g('lk-nom'), tel = g('lk-tel'), email = g('lk-email');
    var err = document.getElementById('lk-err');
    function fail(msg){ if(err){ err.textContent = msg; err.style.display = 'block'; } }
    if (!nom || !tel) { fail('Votre pr\u00e9nom et votre num\u00e9ro, au minimum.'); return; }
    var btn = document.getElementById('lk-go');
    btn.disabled = true; btn.textContent = 'Envoi\u2026'; if (err) err.style.display = 'none';
    try {
      var res = await fetch(LEAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profil_type: CTX, nom: nom, prenom: nom, email: email, telephone: tel,
          ville: '', code_postal: '', message: 'Inscrit via Loki (widget) \u2014 ' + location.pathname,
          veut_rappel: true, consentement: true, source: 'loki-widget'
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
      leadEl.innerHTML = '<div class="ok"></div>';
      leadEl.querySelector('.ok').textContent = '\u2705 C\u2019est not\u00e9 ' + nom + ' ! On vous rappelle tr\u00e8s vite. \u00c0 tout de suite \uD83E\uDD8A';
    } catch (e) {
      btn.disabled = false; btn.textContent = 'R\u00e9server ma place';
      fail('L\u2019envoi n\u2019a pas abouti. R\u00e9essayez dans un instant.');
    }
  }

  var opened = false;
  function openPanel() {
    bubble.classList.remove("in");
    fab.classList.remove("ring");
    panel.classList.add("in");
    if (!opened) {
      opened = true;
      if (introEl) {
        introEl.classList.remove("out");
        introEl.style.display = "flex";
        setTimeout(function () { introEl.classList.add("out"); playChat(); }, 1300);
      } else { playChat(); }
    } else { playChat(); }
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

  /* ----- 6. Apparition différée (effet surprise) -----  */
  setTimeout(function () { fab.classList.add("in", "ring"); }, 2200);
  setTimeout(function () { bubble.classList.add("in"); }, 3400);
  // La bulle se referme seule au bout d'un moment si pas cliquée
  setTimeout(function () { if (!opened) bubble.classList.remove("in"); }, 12000);

})();
