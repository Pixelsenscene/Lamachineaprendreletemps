/* ==============================================================================================================
   aide-outils.js : bouton rond "?" à droite du titre des outils + fenêtre d'explication

   FONCTIONNEMENT
   Chaque page d'outil (pages/outils-*.html) contient elle-même :
     • son TEXTE d'explication, dans un bloc  <template class="toolHelpContent"> ... </template>
     • l'attribut  data-help-title  sur son (ou ses) titre(s) : c'est là que le bouton "?" est placé
     • un petit script qui charge ce fichier (une seule fois) puis appelle  MPTAide.attach(section)

   DANS LE TEXTE, un mot peut ouvrir une vidéo :
       <button type="button" class="helpLink" data-video="https://.../video.mp4" data-loop>mot</button>
   data-loop = la vidéo tourne en boucle (sans data-loop, elle se joue une seule fois).
   Un clic sur la vidéo ramène à l'explication. Un clic sur le "?" (ou la touche Échap) ramène à l'outil.

   SÉCURITÉ : ce fichier est indépendant de script.js. S'il est absent ou en erreur, seul le bouton "?" manque :
   le menu et les outils ne sont pas touchés. Le style est dans aide-outils.css.
   ============================================================================================================== */
(function () {
    'use strict';
    if (window.MPTAide) return; // déjà chargé

    // Le style est chargé avec ce fichier
    if (!document.getElementById('aide-outils-css')) {
        var link = document.createElement('link');
        link.id = 'aide-outils-css';
        link.rel = 'stylesheet';
        link.href = 'aide-outils.css';
        document.head.appendChild(link);
    }

    var helps = []; // une entrée par outil (nettoyée quand l'outil disparaît de la page)

    function closeAll() {
        for (var i = helps.length - 1; i >= 0; i--) {
            if (!helps[i].isConnected()) helps.splice(i, 1);
            else helps[i].close();
        }
    }

    function attach(section) {
        if (!section || !section.isConnected || section.dataset.aideReady) return;
        var tpl = section.querySelector('template.toolHelpContent');
        var titles = Array.prototype.slice.call(section.querySelectorAll('[data-help-title]'));
        var holder = section.parentElement; // le conteneur de l'outil (créé par le site, sans style propre)
        if (!tpl || titles.length === 0 || !holder) return;
        section.dataset.aideReady = '1';

        holder.classList.add('hasToolHelp');

        var overlay = document.createElement('div');
        overlay.className = 'toolHelp';
        overlay.setAttribute('role', 'region');
        overlay.setAttribute('aria-label', 'Explication de l\'outil');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = '<div class="toolHelpPanel"><div class="toolHelpText"></div><div class="toolHelpMedia" hidden></div></div>';
        overlay.querySelector('.toolHelpText').innerHTML = tpl.innerHTML;
        holder.appendChild(overlay);

        var textBox = overlay.querySelector('.toolHelpText');
        var mediaBox = overlay.querySelector('.toolHelpMedia');
        var buttons = [];
        var video = null;
        var activeTitle = titles[0];
        var isOpen = false;

        // La fenêtre commence juste sous le titre (le titre et le "?" restent visibles) et couvre tout l'outil
        function place() {
            var hb = holder.getBoundingClientRect();
            var tb = activeTitle.getBoundingClientRect();
            var top = Math.max(0, tb.bottom - hb.top + 8);
            overlay.style.top = top + 'px';
            overlay.style.minHeight = Math.max(160, holder.offsetHeight - top) + 'px';
            fitPanel();
            fitVideo();
        }

        // La fenêtre ne dépasse jamais le bas de l'écran : si le texte est plus long, il se déroule DANS la fenêtre
        function fitPanel() {
            var panel = overlay.querySelector('.toolHelpPanel');
            var top = Math.max(panel.getBoundingClientRect().top, 70); // 70 px : le bandeau du site
            panel.style.maxHeight = Math.max(200, window.innerHeight - top - 24) + 'px';
        }

        // La vidéo ne dépasse pas le bas de l'écran (pour que la consigne en dessous reste visible)
        function fitVideo() {
            if (!video) return;
            var panelTop = Math.max(overlay.querySelector('.toolHelpPanel').getBoundingClientRect().top, 70);
            video.style.maxHeight = Math.max(220, Math.min(620, window.innerHeight - panelTop - 130)) + 'px';
        }

        function stopVideo() {
            if (!video) return;
            video.pause();
            video.removeAttribute('src'); // coupe aussi le téléchargement
            video.load();
            video = null;
            mediaBox.textContent = '';
        }

        function showText() {
            stopVideo();
            mediaBox.hidden = true;
            textBox.hidden = false;
            place();
        }

        function showVideo(url, loop) {
            if (!url) return;
            stopVideo();
            textBox.hidden = true;
            mediaBox.hidden = false;
            mediaBox.innerHTML = '<video class="toolHelpVideo" playsinline></video>' +
                '<p class="toolHelpHint">Cliquer sur la vidéo pour revenir à l\'explication</p>';
            video = mediaBox.querySelector('video');
            video.loop = loop;
            video.addEventListener('click', showText);
            video.src = url;
            var p = video.play(); // le clic sur le mot autorise la lecture, avec le son
            if (p && typeof p.catch === 'function') p.catch(function () { });
            place();
        }

        function open(title) {
            activeTitle = title;
            isOpen = true;
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            buttons.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
            showText();
        }

        function close() {
            if (!isOpen) return;
            isOpen = false;
            stopVideo();
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
            buttons.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        }

        titles.forEach(function (title) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toolHelpBtn';
            btn.textContent = '?';
            btn.title = 'Explication de cet outil';
            btn.setAttribute('aria-label', 'Explication de cet outil');
            btn.setAttribute('aria-expanded', 'false');
            // Le titre peut lui-même être cliquable (réinitialisation, vue Timer) : le "?" ne doit rien déclencher d'autre
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (isOpen) close(); else open(title);
            });
            btn.addEventListener('keydown', function (e) { e.stopPropagation(); });
            title.appendChild(btn);
            buttons.push(btn);
        });

        overlay.addEventListener('click', function (e) {
            var l = e.target.closest ? e.target.closest('.helpLink') : null;
            if (l) showVideo(l.getAttribute('data-video'), l.hasAttribute('data-loop'));
        });

        // Quand on change d'outil, le site cache cet outil (sans le supprimer) : on referme l'explication et on arrête la vidéo
        if (window.MutationObserver) {
            new MutationObserver(function () { if (holder.hidden) close(); })
                .observe(holder, { attributes: true, attributeFilter: ['hidden'] });
        }

        helps.push({
            close: close,
            reposition: function () { if (isOpen) place(); },
            refit: function () { if (isOpen) fitPanel(); },
            isConnected: function () { return overlay.isConnected; }
        });
    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    window.addEventListener('resize', function () { helps.forEach(function (h) { h.reposition(); }); });
    // Défilement de la page (le site défile dans un conteneur interne : on écoute en phase de capture, et on
    // ignore le défilement à l'intérieur de la fenêtre d'explication elle-même)
    var refitQueued = false;
    document.addEventListener('scroll', function (e) {
        if (refitQueued || (e.target && e.target.closest && e.target.closest('.toolHelpPanel'))) return;
        refitQueued = true;
        requestAnimationFrame(function () {
            refitQueued = false;
            helps.forEach(function (h) { h.refit(); });
        });
    }, true);

    window.MPTAide = { attach: attach };
})();