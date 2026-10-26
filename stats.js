/* ==============================================================================================================
   stats.js : mesure d'audience « maison » (sans cookie, sans service tiers)

   PRINCIPE
   À chaque page affichée, à chaque vidéo lancée, le site demande une toute petite image transparente
   (https://MaptDiff.b-cdn.net/_mapt/v.gif?e=...&n=...). Bunny enregistre la demande dans ses journaux, et le script
   stats-bunny.py (sur ton Mac) les récupère, fait les totaux et fabrique un rapport PRIVÉ.

   CE QUI EST COMPTÉ
     • page    : chaque page / sous-page affichée (ex. galeries/galerie-courtes-realisations)
     • video   : une vidéo lancée par le visiteur (avec le son, ou ouverte en plein écran) ; les vignettes
                 muettes et la vidéo d'accueil ne comptent pas ; une reprise après pause non plus (une vidéo n'est
                 comptée qu'une fois par chargement, et de nouveau si elle a été vue jusqu'au bout puis relancée)
     • tool    : ouverture de l'explication « ? » d'un outil
   Aucune donnée personnelle n'est envoyée : ni cookie, ni identifiant, ni stockage dans le navigateur.

   RESPECT DU VISITEUR
     • Si le navigateur demande « ne pas me suivre » (Do Not Track), rien n'est envoyé.
     • Pour ne PAS te compter toi-même, ouvre une fois le site avec  ?stats=off  à la fin de l'adresse
       (ex. https://lamachineaprendreletemps.pixelsenscene.fr/?stats=off). Pour réactiver :  ?stats=on
     • Rien n'est envoyé depuis un site de test (localhost, 127.0.0.1, fichier local).

   SÉCURITÉ : ce fichier est indépendant de script.js et ne modifie rien du site. S'il est absent ou en erreur,
   le site fonctionne exactement comme avant. Le seul « branchement » est la ligne
       <script src="stats.js" defer></script>
   à la fin de index.html.
   ============================================================================================================== */
(function () {
    'use strict';
    if (window.MPTStats) return;

    // Adresse de la petite image sur Bunny (le fichier v.gif doit être dans le dossier _mapt de ton Storage)
    var BEACON = 'https://MaptDiff.b-cdn.net/_mapt/v.gif';

    // ---------------------------------------------------------------- faut-il envoyer quelque chose ?
    var OWN_HOST = location.hostname;
    var TEST_SITE = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(OWN_HOST);

    // ?stats=off / ?stats=on : choix mémorisé uniquement pour NE PAS compter ses propres visites
    try {
        var m = /[?&]stats=(on|off)\b/.exec(location.search);
        if (m) {
            if (m[1] === 'off') localStorage.setItem('mapt-stats-off', '1');
            else localStorage.removeItem('mapt-stats-off');
        }
    } catch (e) { /* stockage indisponible : sans importance */ }

    function enabled() {
        if (TEST_SITE) return false;
        if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return false;
        try { if (localStorage.getItem('mapt-stats-off') === '1') return false; } catch (e) { /* ignoré */ }
        return true;
    }

    // ---------------------------------------------------------------- envoi d'un évènement
    function send(type, name, extra) {
        try {
            if (!enabled() || !name) return;
            var url = BEACON + '?e=' + type +
                '&n=' + encodeURIComponent(String(name).slice(0, 120)) +
                (extra || '') +
                '&r=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); // évite que le navigateur réutilise une réponse
            var img = new Image();
            img.src = url;
        } catch (e) { /* jamais d'erreur visible */ }
    }

    // ---------------------------------------------------------------- pages
    // Le site change d'adresse (#/galeries/...) sans recharger la page : on surveille ces changements.
    var lastRoute = null;
    var timer = null;
    var firstView = true;

    function currentRoute() {
        var r = (location.hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
        return r || 'accueil';
    }

    function referrerParam() {
        try {
            if (!document.referrer) return '';
            var host = new URL(document.referrer).hostname;
            if (!host || host === OWN_HOST) return '';
            return '&ref=' + encodeURIComponent(host.replace(/^www\./, ''));
        } catch (e) { return ''; }
    }

    // On attend un instant : quand le site passe d'une adresse à une autre en quelques millisecondes
    // (ex. « outils » devient « outils/simulateur »), seule la dernière est comptée.
    function scheduleView() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            var route = currentRoute();
            if (route === lastRoute) return;
            lastRoute = route;
            var extra = '';
            if (firstView) { firstView = false; extra = '&s=1' + referrerParam(); } // s=1 : début de visite
            send('page', route, extra);
        }, 700);
    }

    ['pushState', 'replaceState'].forEach(function (method) {
        try {
            var original = history[method];
            if (typeof original !== 'function') return;
            history[method] = function () {
                var result = original.apply(this, arguments);
                try { scheduleView(); } catch (e) { /* ignoré */ }
                return result;
            };
        } catch (e) { /* ignoré */ }
    });
    window.addEventListener('popstate', scheduleView);
    window.addEventListener('hashchange', scheduleView);
    scheduleView(); // page de départ

    // ---------------------------------------------------------------- vidéos
    // Une vidéo n'est comptée qu'UNE fois par chargement : une pause puis une reprise ne comptent pas.
    // Elle peut être recomptée quand une autre vidéo est chargée dans le lecteur, ou quand elle est allée jusqu'au bout
    // (le visiteur la relance alors depuis le début).
    var counted = (typeof WeakMap === 'function') ? new WeakMap() : null; // lecteur -> adresse de la vidéo déjà comptée

    function forget(e) {
        try { if (counted && e.target && e.target.tagName === 'VIDEO') counted['delete'](e.target); } catch (err) { /* ignoré */ }
    }
    document.addEventListener('emptied', forget, true); // le lecteur est vidé (fermeture, rechargement)
    document.addEventListener('ended', forget, true);   // la vidéo est allée jusqu'au bout

    // Les évènements « play » ne remontent pas jusqu'au document : on les écoute en phase de capture.
    document.addEventListener('play', function (e) {
        try {
            var v = e.target;
            if (!v || v.tagName !== 'VIDEO') return;
            var wanted = !v.muted || (v.closest && v.closest('.vr-carousel-container.fullscreen-mode'));
            if (!wanted) return;                // vignettes, vidéo d'accueil : lecture automatique et muette
            var src = v.currentSrc || v.src || '';
            if (counted) { if (counted.get(v) === src) return; counted.set(v, src); } // déjà comptée : c'est une reprise
            var file = decodeURIComponent(src.split('#')[0].split('?')[0].split('/').pop() || '');
            if (!file) return;
            send('video', file.replace(/\.[a-z0-9]{2,4}$/i, ''));
        } catch (err) { /* ignoré */ }
    }, true);

    // ---------------------------------------------------------------- explication « ? » des outils
    document.addEventListener('click', function (e) {
        try {
            var b = e.target && e.target.closest ? e.target.closest('.toolHelpBtn') : null;
            if (b && b.getAttribute('aria-expanded') !== 'true') send('tool', 'aide:' + currentRoute());
        } catch (err) { /* ignoré */ }
    }, true);

    // Pour d'autres évènements plus tard :  MPTStats.event('tool', 'chrono-demarre')
    window.MPTStats = { event: function (type, name) { send(type, name, ''); } };
})();
