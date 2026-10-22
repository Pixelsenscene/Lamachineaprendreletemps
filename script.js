// =====================================================================
// SCRIPT.JS : le chef d'orchestre
//   1. Références globales
//   2. Carrousel vidéo du Hero
//   3. Modes (home / page), menu actif, URL (hash)
//   4. Chargement des pages et sous-pages
//   5. Navigation (clics, historique)
//   6. Accueil : médias, blocs, molette, scroll
//   7. Carrousels vidéo des galeries
// =====================================================================

// ---------------------------------------------------------------------
// 1. RÉFÉRENCES GLOBALES
// ---------------------------------------------------------------------
const body = document.body;
const allNavLinks = document.querySelectorAll('#main-header nav a');
const pageContainer = document.getElementById('page-content');
const footerLinks = document.querySelectorAll('#site-footer a[data-page]'); // pied de page (mentions légales)
const validPages = new Set(
    [...Array.from(allNavLinks), ...Array.from(footerLinks)].map(l => l.dataset.page).filter(Boolean)
);

const FADE_MS = 200; // durée du fondu au noir des pages / sous-pages

let currentActivePage = '';
let currentMode = 'home';
let pageRequestId = 0; // pour ignorer les réponses obsolètes (clics rapides)
let subRequestId = 0;

// Le navigateur ne doit pas restaurer lui-même la position de scroll
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// ---------------------------------------------------------------------
// 2. CARROUSEL VIDÉO DU HERO
// ---------------------------------------------------------------------
const CONFIG = {
    transitionDuration: 200,
    videos: [
        {
            // "Le fil du temps" : fichier allégé (49 Mo), déjà découpé aux bornes de la boucle et sans son.
            // Il boucle seul (attribut "loop" du <video>) : plus besoin de startTime / endTime.
            // (L'ancien fichier de 201 Mo reste sur Bunny sous le nom "...Hiver1-SiteWeb MPEG-4.mp4".)
            src: "https://MaptDiff.b-cdn.net/Montages%20compil%C3%A9s/LeFilduTemps%20-%20Hiver1-SiteWebok.mp4",
            customLoop: false
        },
        {
            src: "https://MaptDiff.b-cdn.net/Vid%C3%A9os%20Format%20Insta%20Verti/phare%20StMathieu1%20PL%20web-SiteWeb%20MPEG-4.mp4",
            customLoop: false
        },
        {
            src: "https://MaptDiff.b-cdn.net/Vid%C3%A9os%20Format%20Insta%20Verti/Envole%CC%81e%20dansante-SiteWeb%20MPEG-4.mp4",
            customLoop: false
        },
        {
            src: "https://MaptDiff.b-cdn.net/RALENTIS%20VR%20paysage/Baie%20Mont%20Saint%20Michel%20-%20VR-SiteWeb%20MPEG-4.mp4",
            customLoop: false
        }
    ]
};

let currentHeroIndex = 0;
let isTransitioning = false;
let heroInView = true; // le hero est-il à l'écran ? (mis à jour par l'observateur ci-dessous)

// Onglet masqué ou oublié : on met en pause les vidéos MUETTES (hero, blocs, carrousels).
// Une vidéo qui tourne en boucle dans un onglet en arrière-plan continue sinon de télécharger.
// Les vidéos avec son (lecteur agrandi, vidéo d'actualité) ne sont pas touchées.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        document.querySelectorAll('video').forEach(v => {
            if (v.muted && !v.paused) v.pause();
        });
    } else if (heroInView && !body.classList.contains('page-mode')) {
        const heroVideo = document.getElementById('hero-video');
        const p = heroVideo && heroVideo.play();
        if (p && typeof p.catch === 'function') p.catch(() => { });
    }
});

function loadAndPlayVideo(videoEl, sourceEl, videoData, callback) {
    sourceEl.src = videoData.src;
    videoEl.load();

    const startPos = videoData.customLoop ? videoData.startTime : 0;
    videoEl.currentTime = startPos;

    const handleReady = () => {
        videoEl.currentTime = startPos;

        // Si on est déjà sur une autre page (lien direct), on ne lance pas la lecture :
        // elle démarrera au retour à l'accueil (voir setMode).
        if (body.classList.contains('page-mode')) {
            videoEl.style.opacity = '1';
            if (typeof callback === 'function') callback();
            return;
        }

        videoEl.play().then(() => {
            setTimeout(() => {
                videoEl.style.opacity = '1';
                if (typeof callback === 'function') callback();
            }, 50);
        }).catch(error => {
            console.log("Lecture automatique bloquée : ", error);
            if (typeof callback === 'function') callback();
        });
    };

    videoEl.addEventListener('canplay', handleReady, { once: true });
}

// --- Points indicateurs (un par vidéo du hero, le point plein = vidéo en cours) ---
function buildHeroDots(heroSection) {
    const wrapper = document.createElement('div');
    wrapper.className = 'hero-dots';

    CONFIG.videos.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'hero-dot';
        dot.dataset.index = String(i);
        dot.setAttribute('aria-label', `Vidéo ${i + 1} sur ${CONFIG.videos.length}`);
        wrapper.appendChild(dot);
    });

    // Un clic sur un point affiche cette vidéo (sans déclencher le clic du hero)
    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const dot = e.target.closest('.hero-dot');
        if (!dot) return;
        const index = Number(dot.dataset.index);
        if (index !== currentHeroIndex) showHeroVideo(index);
    });

    // Les points s'insèrent à la fin du titre, comme des points de suspension.
    // Le dernier mot du titre et les points sont solidaires (jamais de points seuls
    // à la ligne si le titre passe sur deux lignes sur mobile).
    const title = heroSection.querySelector('.hero-title');
    if (title) {
        const text = title.textContent.trim();
        const cut = text.lastIndexOf(' ') + 1;
        const tail = document.createElement('span');
        tail.className = 'hero-title-tail';
        tail.textContent = text.slice(cut);
        tail.appendChild(wrapper);
        title.textContent = text.slice(0, cut);
        title.appendChild(tail);
    } else {
        heroSection.appendChild(wrapper);
    }
    updateHeroDots();
}

function updateHeroDots() {
    document.querySelectorAll('.hero-dot').forEach((dot, i) => {
        const active = i === currentHeroIndex;
        dot.classList.toggle('active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
    });
}

// Affiche la vidéo n° "index" du hero, avec fondu au noir.
// Si c'est déjà la vidéo en cours, on la remet simplement au début (sans la recharger).
let heroPendingIndex = null; // vidéo demandée pendant un changement en cours : elle sera affichée ensuite
let heroTargetIndex = 0;     // dernière vidéo DEMANDÉE (même si elle n'est pas encore affichée) : base des gestes rapides
let heroTransitionToken = 0;

function showHeroVideo(index) {
    heroTargetIndex = index;
    if (isTransitioning) { heroPendingIndex = index; return; } // on se souvient de la demande au lieu de l'ignorer
    isTransitioning = true;
    const token = ++heroTransitionToken;

    // Sécurité : si la vidéo ne devient jamais lisible (réseau lent ou coupé), on ne reste pas bloqué
    setTimeout(() => {
        if (isTransitioning && token === heroTransitionToken) {
            isTransitioning = false;
            const pending = heroPendingIndex;
            heroPendingIndex = null;
            if (pending !== null && pending !== currentHeroIndex) showHeroVideo(pending);
        }
    }, 6000);

    const heroVideo = document.getElementById('hero-video');
    const heroSource = document.getElementById('hero-source');
    const data = CONFIG.videos[index];

    heroVideo.style.opacity = '0';

    setTimeout(() => {
        const done = () => {
            setTimeout(() => {
                if (token !== heroTransitionToken) return; // la sécurité a déjà pris le relais
                isTransitioning = false;
                // une autre vidéo a été demandée entre-temps (geste rapide) : on l'affiche maintenant
                const pending = heroPendingIndex;
                heroPendingIndex = null;
                if (pending !== null && pending !== currentHeroIndex) showHeroVideo(pending);
            }, CONFIG.transitionDuration);
        };

        if (index === currentHeroIndex) {
            heroVideo.currentTime = data.customLoop ? data.startTime : 0;
            const p = heroVideo.play();
            if (p && typeof p.catch === 'function') p.catch(() => { });
            setTimeout(() => {
                heroVideo.style.opacity = '1';
                done();
            }, 50);
        } else {
            currentHeroIndex = index;
            updateHeroDots();
            loadAndPlayVideo(heroVideo, heroSource, data, done);
        }
    }, CONFIG.transitionDuration);
}

// Clic sur le hero : vidéo suivante
function switchHeroVideo() {
    showHeroVideo((heroTargetIndex + 1) % CONFIG.videos.length);
}
window.switchHeroVideo = switchHeroVideo;

// Clic sur le titre : retour à la 1ère vidéo ("Le fil du temps"), depuis son début
function restartHeroVideo(e) {
    if (e) e.stopPropagation(); // ne déclenche pas aussi le changement de vidéo du hero
    showHeroVideo(0);
}
window.restartHeroVideo = restartHeroVideo;

// ---------------------------------------------------------------------
// GESTES HORIZONTAUX (pavé tactile à deux doigts, molette inclinable, Maj + molette)
//   • sur la vidéo d'accueil : à droite = vidéo suivante, à gauche = vidéo précédente ;
//   • partout ailleurs : à droite = menu suivant, à gauche = menu précédent
//     (Accueil [bloc "Éloge de la lenteur"] > Galeries > Évènements > Outils > Dossiers > Contact).
// Le défilement vertical de la page n'est pas touché.
// ---------------------------------------------------------------------

// Détecteur de geste. Il lit le flux d'événements de la molette / du pavé tactile en tenant compte de l'INERTIE
// (les mouvements qui continuent et s'éteignent après que les doigts ont quitté le pavé) :
//  • le sens du geste (horizontal ou vertical) est jugé sur les derniers mouvements seulement : un balayage un peu
//    en diagonale compte comme horizontal ;
//  • un changement est déclenché quand la distance cumulée dans un sens atteint le seuil (même en geste lent) ;
//  • après un changement, les mouvements qui s'éteignent sont de l'inertie : ils sont ignorés. Un NOUVEAU balayage
//    est reconnu dès que l'énergie REMONTE après être descendue (ou que le sens s'inverse), sans attendre un silence :
//    c'est ce qui permet d'enchaîner les balayages sans « s'y reprendre à plusieurs fois ».
// Renvoie true si l'événement fait partie d'un geste horizontal (il faut alors le retenir).
function makeSwipeDetector({ threshold, horizontal, refractoryMs, onSwipe }) {
    const SILENCE_MS = 70;   // silence : le geste précédent (et son inertie) est terminé
    const AXIS_MS = 120;     // fenêtre pour juger du sens
    const SUM_MS = 500;      // fenêtre de cumul de la distance
    const PUSH_MS = 100;     // fenêtre de mesure de la poussée (énergie)
    const RISE_REL = 1.6;    // une poussée = énergie > 1,6 x le creux + 8 px
    const RISE_ABS = 8;

    let hist = [];           // mouvements récents (jamais effacés en cours de geste)
    let accStart = -1e9;     // le cumul ne compte que les mouvements à partir de cet instant
    let lastT = -1e9, lastTrigger = -1e9, lastDir = 0;
    let locked = false, peak = 0, valley = Infinity, valleyT = 0;

    return function (now, dx, dy) {
        // Silence : on repart de zéro
        if (now - lastT > SILENCE_MS) { hist = []; locked = false; accStart = -1e9; }
        lastT = now;
        hist.push({ t: now, dx: dx, dy: dy });
        while (hist.length && now - hist[0].t > SUM_MS) hist.shift();

        // 1) Sens du geste, énergie et direction de la poussée récente
        let sx = 0, sy = 0, er = 0, sr = 0;
        for (const e of hist) {
            const age = now - e.t;
            if (age <= AXIS_MS) { sx += Math.abs(e.dx); sy += Math.abs(e.dy); }
            if (age <= PUSH_MS) { er += Math.abs(e.dx); sr += e.dx; }
        }
        if (sx + sy < 4) return Math.abs(dx) > Math.abs(dy);   // trop petit pour trancher
        if (sx < sy * horizontal) return false;                // geste vertical : la page défile normalement

        // 2) Après un changement : inertie à ignorer... sauf nouveau balayage (l'énergie remonte, ou le sens s'inverse)
        if (locked) {
            if (er > peak) { peak = er; valley = Infinity; }                           // le geste monte encore
            else if (er < peak * 0.85 && er < valley) { valley = er; valleyT = now; } // l'énergie descend : on suit le creux
            const pushed = valley !== Infinity && er > valley * RISE_REL + RISE_ABS;
            const reversed = lastDir !== 0 && Math.sign(sr) === -lastDir && Math.abs(sr) >= 30;
            if (!(pushed || reversed)) return true;
            locked = false;
            accStart = pushed ? valleyT : now - PUSH_MS;       // le cumul repart du creux
        }

        // 3) Cumul signé : assez de distance, dans un sens cohérent
        let s = 0, a = 0;
        for (const e of hist) if (e.t >= accStart) { s += e.dx; a += Math.abs(e.dx); }
        if (Math.abs(s) < threshold || Math.abs(s) < 0.6 * a) return true;
        if (now - lastTrigger < refractoryMs) return true;     // pas deux changements coup sur coup

        lastDir = s > 0 ? 1 : -1;
        lastTrigger = now;
        locked = true; peak = er; valley = Infinity;
        accStart = now + 0.001;
        onSwipe(lastDir);
        return true;
    };
}

// --- Vidéo d'accueil ---
const heroSwipe = makeSwipeDetector({
    threshold: 24,       // distance cumulée (px) qui déclenche le changement : plus petit = plus sensible
    horizontal: 0.75,    // un geste est horizontal si |x| >= 75 % de |y| (sur les derniers mouvements)
    refractoryMs: 220,   // délai de repos après un changement (les balayages rapides s'enchaînent ensuite)
    onSwipe: (dir) => showHeroVideo((heroTargetIndex + dir + CONFIG.videos.length) % CONFIG.videos.length)
});

function heroUnderPointer(e) {
    const hero = document.getElementById('hero-section');
    if (!hero) return false;
    const r = hero.getBoundingClientRect();
    return r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

// --- Menus : un changement de page est plus lourd qu'un changement de vidéo, le geste doit être plus net ---
const MENU_SWIPE_ORDER = ['accueil', 'galeries', 'evenements', 'outils', 'dossiers', 'contact'];

const menuSwipe = makeSwipeDetector({
    threshold: 40,       // distance cumulée (px) : plus petit = plus sensible
    horizontal: 1.3,     // geste nettement horizontal (|x| >= 130 % de |y|) : une diagonale ne change pas de page
    refractoryMs: 450,   // délai de repos : pas deux changements de page coup sur coup
    onSwipe: (dir) => {
        // (un changement demandé pendant le chargement d'une page est pris en compte : la dernière demande l'emporte)
        const i = MENU_SWIPE_ORDER.indexOf(currentActivePage);
        const next = i + dir;
        if (i < 0 || next < 0 || next >= MENU_SWIPE_ORDER.length) return; // page hors menu, ou bout de la liste : rien
        const target = MENU_SWIPE_ORDER[next];
        // "Accueil" = le premier bloc de la page d'accueil ("Éloge de la lenteur"), pas la vidéo d'accueil
        if (target === 'accueil') navigate('accueil', '', { block: true });
        else navigate(target);
    }
});

// Un élément qui défile horizontalement (barre de boutons sur petit écran...) garde TOUT le geste, même
// arrivé au bout : on ne change pas de page par accident en poussant trop loin. Idem pour les champs de saisie
// et le lecteur vidéo agrandi.
function keepsHorizontalGesture(target) {
    if (!target || !target.closest) return false;
    if (target.closest('input, textarea, select, [contenteditable="true"], #lb-overlay.open')) return true;
    for (let n = target; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
}

function onHorizontalWheel(e) {
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }              // Maj + molette = défilement horizontal
    if (e.deltaMode === 1) { dx *= 33; dy *= 33; }           // lignes -> pixels
    else if (e.deltaMode === 2) { dx *= 400; dy *= 400; }    // pages -> pixels

    const onHero = !body.classList.contains('page-mode') && heroUnderPointer(e);
    if (!onHero && keepsHorizontalGesture(e.target)) return;

    const claimed = (onHero ? heroSwipe : menuSwipe)(e.timeStamp, dx, dy);
    if (claimed) {
        // Ni retour arrière du navigateur, ni défilement de la page, ni double traitement par la molette de l'accueil
        if (e.cancelable) e.preventDefault(); // (les événements d'inertie ne sont pas annulables : inutile d'insister)
        e.stopPropagation();
    }
}

// En phase de capture : le geste est traité avant la molette de l'accueil (qui gère le défilement vertical)
document.addEventListener('wheel', onHorizontalWheel, { passive: false, capture: true });

function initHero() {
    const heroSection = document.getElementById('hero-section');
    const heroVideo = document.getElementById('hero-video');
    const heroSource = document.getElementById('hero-source');

    if (heroSection) {
        heroSection.classList.add('video-loaded');
        heroSection.addEventListener('click', switchHeroVideo);
        buildHeroDots(heroSection);

        const heroTitle = heroSection.querySelector('.hero-title');
        if (heroTitle) heroTitle.addEventListener('click', restartHeroVideo);

        // La vidéo du hero se met en pause quand la moitié a disparu à l'écran, et reprend
        // quand elle redevient à moitié visible : l'image figée est celle qu'on a vue en partant,
        // et la lecture repart au moment où on la revoit.
        if ('IntersectionObserver' in window && heroVideo) {
            new IntersectionObserver(([entry]) => {
                heroInView = entry.intersectionRatio >= 0.5;
                if (!heroInView) {
                    heroVideo.pause();
                } else if (!body.classList.contains('page-mode') && !document.hidden) {
                    const p = heroVideo.play();
                    if (p && typeof p.catch === 'function') p.catch(() => { });
                }
            }, { threshold: [0.5] }).observe(heroSection);
        }
    }
    if (!heroVideo || !heroSource) return;

    heroVideo.style.opacity = '0';
    loadAndPlayVideo(heroVideo, heroSource, CONFIG.videos[currentHeroIndex]);

    // Boucle personnalisée (ex : la 1ère vidéo tourne entre startTime et endTime)
    heroVideo.addEventListener('timeupdate', function () {
        const data = CONFIG.videos[currentHeroIndex];
        if (data.customLoop && this.currentTime >= data.endTime) {
            this.currentTime = data.startTime;
        }
    });
}


// ---------------------------------------------------------------------
// 3. MODES, MENU ACTIF, URL
// ---------------------------------------------------------------------

// Bascule home-mode / page-mode et met la vidéo du Hero en pause quand elle est cachée
function setMode(mode) {
    body.classList.remove('home-mode', 'page-mode', 'scrolled-mode');
    body.classList.add(mode === 'page' ? 'page-mode' : 'home-mode');

    if (mode === currentMode) return;
    currentMode = mode;

    const heroVideo = document.getElementById('hero-video');
    if (!heroVideo) return;
    if (mode === 'page') {
        heroVideo.pause();
    } else {
        const p = heroVideo.play();
        if (p && typeof p.catch === 'function') p.catch(() => { });
    }
}

// Met en surbrillance le lien du menu (et son parent pour les sous-menus)
function setActiveNav(page, sub) {
    allNavLinks.forEach(l => l.classList.remove('active'));

    let link = null;
    if (sub) {
        link = document.querySelector(`#main-header nav a[data-page="${page}"][data-sub="${sub}"]`);
    }
    if (!link) {
        link = document.querySelector(`#main-header nav a[data-page="${page}"]:not([data-sub])`);
    }
    if (!link) return;

    link.classList.add('active');
    const parentLi = link.closest('.has-submenu');
    if (parentLi) {
        const parentLink = parentLi.querySelector('a');
        if (parentLink) parentLink.classList.add('active');
    }
}

// Routage par hash : #/galeries/galerie-ralentis  ->  { page: 'galeries', sub: 'galerie-ralentis' }
function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { page: parts[0] || 'accueil', sub: parts[1] || '' };
}

function updateUrl(page, sub, replace = false) {
    const hash = page === 'accueil' ? '' : `#/${page}${sub ? '/' + sub : ''}`;
    if ((location.hash || '') === hash) return;
    const url = hash || (location.pathname + location.search);
    try {
        history[replace ? 'replaceState' : 'pushState'](null, '', url);
    } catch (e) {
        // Certains contextes (ex : file://) refusent l'API History : on ignore
    }
}


// ---------------------------------------------------------------------
// 4. CHARGEMENT DES PAGES ET SOUS-PAGES
// ---------------------------------------------------------------------
async function fetchHTML(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url} introuvable.`);
        return await response.text();
    } catch (error) {
        console.error(error);
        return `<h2>Contenu en cours de création</h2>`;
    }
}

// Injecte du HTML, ré-exécute les <script> qu'il contient et relance Instagram
function injectHTML(container, html) {
    container.innerHTML = html;

    container.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
    }

    initCarousels(container);
    initMediaObserver(container);
}

// Outils qui gardent leur affichage ET leur état (temps, réglages, chronomètre en marche...) quand on change d'outil :
// tous sauf le "Simulateur d'accélération" (vidéos lourdes : il est recréé à chaque visite).
// Tout est remis à zéro dès qu'on quitte le menu Outils : la page Outils est alors reconstruite.
const KEEP_ALIVE_TOOLS = new Set([
    'outils-preparation-tournage',
    'outils-convertir-le-temps',
    'outils-metronome',
    'outils-chronometre'
]);

async function loadSubPage(subPageName) {
    const subContainer = document.getElementById('sub-page-content');
    if (!subContainer) return;

    const requestId = ++subRequestId;
    const keep = currentActivePage === 'outils' && KEEP_ALIVE_TOOLS.has(subPageName);
    // Un outil déjà ouvert est simplement réaffiché, tel qu'on l'a laissé (pas de rechargement)
    const kept = keep ? Array.from(subContainer.children).find(c => c.dataset.keep === subPageName) : null;
    subContainer.style.opacity = '0';

    // Le chargement et le fondu au noir se font en parallèle
    const [html] = await Promise.all([kept ? '' : fetchHTML(`pages/${subPageName}.html`), wait(FADE_MS)]);

    // Un clic plus récent a pris le relais (ou la page a changé) : on abandonne
    if (requestId !== subRequestId || !subContainer.isConnected) return;

    // Ce qui n'est pas conservé (le simulateur) est supprimé ; les outils conservés restent en place, cachés
    Array.from(subContainer.children).forEach(c => { if (!c.dataset.keep) c.remove(); });
    Array.from(subContainer.children).forEach(c => { c.hidden = true; });

    let holder = kept;
    if (!holder) {
        holder = document.createElement('div');
        if (keep) holder.dataset.keep = subPageName;
        subContainer.appendChild(holder);
        injectHTML(holder, html);
    }
    holder.hidden = false;
    subContainer.style.opacity = '1';

    document.querySelectorAll('.sub-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subpage') === subPageName);
    });

    // Si la barre de boutons défile (petit écran), on centre le bouton actif
    const activeBtn = document.querySelector('.sub-btn.active');
    const bar = activeBtn && activeBtn.parentElement;
    if (bar && bar.scrollWidth > bar.clientWidth) {
        bar.scrollTo({
            left: activeBtn.offsetLeft - (bar.clientWidth - activeBtn.offsetWidth) / 2,
            behavior: 'smooth'
        });
    }

    // Garde l'URL et le menu synchronisés (sans ajouter d'entrée à l'historique)
    if (currentActivePage && currentActivePage !== 'accueil') {
        setActiveNav(currentActivePage, subPageName);
        updateUrl(currentActivePage, subPageName, true);
    }
}
window.loadSubPage = loadSubPage;

async function loadPageContent(pageName) {
    if (!pageContainer) return;

    const requestId = ++pageRequestId;
    subRequestId++; // toute sous-page en cours de chargement devient obsolète
    pageContainer.style.opacity = '0';

    const [html] = await Promise.all([fetchHTML(`pages/${pageName}.html`), wait(FADE_MS)]);
    if (requestId !== pageRequestId) return;

    injectHTML(pageContainer, html);
    pageContainer.style.opacity = '1';

    // Arrivée par un geste vers l'accueil : on se place sur le 1er bloc, maintenant que le contenu est là
    if (window.pendingHomeBlock) {
        window.pendingHomeBlock = false;
        showFirstHomeBlock();
    }

    if (window.pendingSubPage) {
        const subToLoad = window.pendingSubPage;
        window.pendingSubPage = '';
        loadSubPage(subToLoad);
    }
}


// ---------------------------------------------------------------------
// 5. NAVIGATION
// ---------------------------------------------------------------------
function navigate(page, sub = '', { push = true, block = false } = {}) {
    if (!validPages.has(page)) { page = 'accueil'; sub = ''; }

    // Déjà dans Outils et clic sur le menu "Outils" : on garde l'outil affiché, avec son état.
    // La remise à zéro n'a lieu qu'après être passé par un autre menu.
    if (!sub && page === 'outils' && page === currentActivePage && document.getElementById('sub-page-content')) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
    }

    setActiveNav(page, sub);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (push) updateUrl(page, sub);

    // Même page parent, autre sous-page : on ne recharge que la sous-page
    if (sub && page === currentActivePage && document.getElementById('sub-page-content')) {
        window.pendingSubPage = '';
        loadSubPage(sub);
        return;
    }

    window.pendingSubPage = sub;
    window.pendingHomeBlock = block && page === 'accueil';
    setMode(page === 'accueil' ? 'home' : 'page');
    if (window.pendingHomeBlock) showFirstHomeBlock(); // on ne repasse pas par la vidéo d'accueil
    loadPageContent(page);
    currentActivePage = page;
}

// Affiche le 1er bloc de l'accueil ("Éloge de la lenteur") : la page est descendue juste sous la vidéo d'accueil
function showFirstHomeBlock() {
    const hero = document.getElementById('hero-section');
    if (!hero) return;
    body.classList.add('scrolled-mode');
    window.scrollTo({ top: hero.offsetHeight, behavior: 'instant' });
}

// Retour à l'accueil (clic sur le titre manuscrit)
function goHome() {
    if (currentActivePage === 'accueil') {
        setActiveNav('accueil', '');
        setMode('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        navigate('accueil');
    }
}

// Clics sur le menu
allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        if (link.classList.contains('header-brand-title')) {
            goHome();
            return;
        }

        const targetPage = link.getAttribute('data-page');
        if (!targetPage) return; // ex : flèche "descendre", gérée plus bas

        navigate(targetPage, link.getAttribute('data-sub') || '');
    });
});

// Liens du pied de page (ex : "Mentions légales")
footerLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.getAttribute('data-page'), link.getAttribute('data-sub') || '');
    });
});

// Boutons précédent / suivant du navigateur (et hash modifié à la main)
window.addEventListener('popstate', () => {
    const { page, sub } = parseHash();

    if (page === 'accueil' && currentActivePage === 'accueil') {
        setMode('home');
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
    }
    navigate(page, sub, { push: false });
});

// Clic sur la flèche vers le bas (Symbole ⏏︎)
document.addEventListener('click', (e) => {
    const arrowLink = e.target.closest('[data-action="scroll-down"]');
    if (!arrowLink) return;
    e.preventDefault();

    const heroSection = document.getElementById('hero-section');
    const firstBlock = document.querySelector('.content-block');

    if (heroSection) {
        // On scrolle exactement à la hauteur du Hero pour que le Bloc 1 se cale sous le bandeau
        window.scrollTo({ top: heroSection.offsetHeight, behavior: 'smooth' });
    } else if (firstBlock) {
        firstBlock.scrollIntoView({ behavior: 'smooth' });
    }
});

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    initHero();
    const { page, sub } = parseHash();
    navigate(page, sub, { push: false });
});


// ---------------------------------------------------------------------
// 6. ACCUEIL : MÉDIAS, BLOCS, MOLETTE, SCROLL
// ---------------------------------------------------------------------

// Clic sur une image/vidéo d'un bloc : alterne image <-> vidéo
function handleMediaClick(container) {
    const videoUrl = container.getAttribute('data-video');
    const imgSrc = container.getAttribute('data-img');
    const imgAlt = container.getAttribute('data-alt');
    const isVideo = container.querySelector('video');

    if (!isVideo) {
        if (!videoUrl) return;
        const isTchin = videoUrl.includes('TchinTchin');
        container.innerHTML = `
            <video autoplay muted playsinline disablePictureInPicture controlsList="nodownload noremoteplayback nofullscreen" ${isTchin ? '' : 'loop'}>
                <source src="${videoUrl}" type="video/mp4">
            </video>
        `;
        const vid = container.querySelector('video');
        vid.currentTime = 0;

        if (isTchin) {
            vid.addEventListener('timeupdate', function () {
                if (this.currentTime >= 29) this.currentTime = 0;
            });
        }
    } else {
        resetMedia(container);
    }
}
window.handleMediaClick = handleMediaClick;

// Remet l'image à la place de la vidéo (arrête la lecture et libère la vidéo)
function resetMedia(container) {
    if (!container.querySelector('video')) return; // déjà sur l'image
    const imgSrc = container.getAttribute('data-img');
    const imgAlt = container.getAttribute('data-alt') || '';
    container.innerHTML = `<img src="${imgSrc}" alt="${imgAlt}">`;
}

// Quand un bloc sort de l'écran (moins de 10% visible), sa vidéo s'arrête et l'image revient :
// aucune vidéo ne tourne "dans le vide" hors de la zone affichée.
const MEDIA_MIN_VISIBLE = 0.1;
let mediaObserver = null;

function initMediaObserver(root) {
    if (!('IntersectionObserver' in window)) return;

    if (!mediaObserver) {
        mediaObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting || entry.intersectionRatio < MEDIA_MIN_VISIBLE) {
                    resetMedia(entry.target);
                }
            });
        }, { threshold: [0, MEDIA_MIN_VISIBLE] });
    }

    // Nouvelle page principale : on oublie les anciens blocs avant d'observer les nouveaux
    if (root === pageContainer) mediaObserver.disconnect();
    root.querySelectorAll('.media-container').forEach(c => mediaObserver.observe(c));
} // appelée par onclick="" dans accueil.html

// Centrage vertical d'un bloc dans l'espace sous le bandeau
function scrollToBlockCentered(targetBlock) {
    const header = document.getElementById('main-header');
    const headerHeight = header ? header.offsetHeight : 0;

    const rect = targetBlock.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const blockTopRelativeToPage = rect.top + scrollTop;

    const availableHeight = window.innerHeight - headerHeight;
    const targetScrollY = blockTopRelativeToPage - headerHeight - (availableHeight - rect.height) / 2;

    window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: 'smooth'
    });
}

// Clic sur le texte d'un bloc : passe au bloc suivant (boucle sur le Bloc 1 à la fin)
document.addEventListener('click', (e) => {
    const textSide = e.target.closest('.text-side');
    if (!textSide) return;

    const currentBlock = textSide.closest('.content-block');
    const blocks = Array.from(document.querySelectorAll('.content-block'));
    const index = blocks.indexOf(currentBlock);

    if (index === -1) return;

    if (index === blocks.length - 1) {
        const heroSection = document.getElementById('hero-section');
        if (heroSection) {
            body.classList.add('scrolled-mode');
            window.scrollTo({ top: heroSection.offsetHeight, behavior: 'smooth' });
        } else {
            scrollToBlockCentered(blocks[0]);
        }
    } else {
        scrollToBlockCentered(blocks[index + 1]);
    }
});

// Navigation par molette (accueil uniquement)
let isAnimatingScroll = false;

window.addEventListener('wheel', (e) => {
    if (!body.classList.contains('home-mode') || body.classList.contains('page-mode')) return;

    if (isAnimatingScroll) {
        e.preventDefault();
        return;
    }

    if (Math.abs(e.deltaY) < 10) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const mainContainer = document.getElementById('main-container');

    if (!mainContainer) return;
    const blocks = Array.from(mainContainer.querySelectorAll('.content-block'));
    if (blocks.length === 0) return;

    // Remontée
    if (e.deltaY < 0) {
        if (e.deltaY < -25 && scrollY > windowHeight / 2) {
            e.preventDefault();
            isAnimatingScroll = true;
            body.classList.remove('scrolled-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { isAnimatingScroll = false; }, 800);
            return;
        }
        return;
    }

    // Descente
    // On repère le bloc affiché. Sur le DERNIER bloc, on laisse le défilement natif descendre
    // jusqu'au pied de page (mentions légales) au lieu de bloquer la molette.
    let currentIndex = 0;
    if (scrollY >= windowHeight / 2) {
        let minDistance = Infinity;

        blocks.forEach((block, index) => {
            const rect = block.getBoundingClientRect();
            const distance = Math.abs(rect.top - 120);
            if (distance < minDistance) {
                minDistance = distance;
                currentIndex = index;
            }
        });

        if (currentIndex >= blocks.length - 1) return;
    }

    e.preventDefault();
    isAnimatingScroll = true;

    if (scrollY < windowHeight / 2) {
        const heroSection = document.getElementById('hero-section');
        if (heroSection) {
            window.scrollTo({ top: heroSection.offsetHeight, behavior: 'smooth' });
        } else {
            scrollToBlockCentered(blocks[0]);
        }
        setTimeout(() => { isAnimatingScroll = false; }, 800);
        return;
    }

    scrollToBlockCentered(blocks[currentIndex + 1]);
    setTimeout(() => { isAnimatingScroll = false; }, 800);

}, { passive: false });

// Synchronisation du bandeau : "scrolled-mode" dès que le bandeau atteint le haut de l'écran
window.addEventListener('scroll', () => {
    if (!body.classList.contains('home-mode') || body.classList.contains('page-mode')) return;

    const heroSection = document.getElementById('hero-section');
    const header = document.getElementById('main-header');
    if (!heroSection || !header) return;

    const threshold = heroSection.offsetHeight - header.offsetHeight;

    if (window.scrollY >= threshold) {
        body.classList.add('scrolled-mode');
    } else {
        body.classList.remove('scrolled-mode');
    }
}, { passive: true });


// ---------------------------------------------------------------------
// 7. CARROUSELS VIDÉO (partagés par toutes les galeries)
//    Le code vit ICI et non dans chaque sous-page : une seule définition,
//    plus de conflit de "const" quand on revisite une page, et les flèches
//    marchent quelle que soit la sous-page ouverte en premier.
//    Une seule slide est active à la fois (classe .is-active) ; le CSS donne à
//    la vidéo affichée son propre format. L'index actif est stocké sur le DOM
//    (track.dataset.index) : il repart à 0 à chaque injection de la page.
// ---------------------------------------------------------------------

// Lance la lecture et, si le navigateur l'interrompt (vidéo pas encore prête),
// réessaie dès qu'elle peut démarrer.
function playSafe(video) {
    if (!video) return;
    const p = video.play();
    if (p && typeof p.catch === 'function') {
        p.catch(() => {
            video.addEventListener('canplay', () => {
                const slide = video.closest('.carousel-slide');
                if (!slide || slide.classList.contains('is-active')) {
                    video.play().catch(() => { });
                }
            }, { once: true });
        });
    }
}

// --- Chargement économe : une vidéo n'est téléchargée que si elle est affichée ---
// Les vidéos sont en preload="none" (rien ne part au chargement de la page). Un carrousel ne
// charge et ne lit sa vidéo active que lorsqu'il est proche de l'écran, et la met en pause
// dès qu'il en est éloigné.
let carouselObserver = null;
const CAROUSEL_LOAD_MARGIN = '300px 0px'; // démarre un peu AVANT que le carrousel soit visible

function activeCarouselVideo(container) {
    return container.querySelector('.carousel-slide.is-active video');
}

// Après le démarrage de la vidéo active, on précharge seulement les métadonnées de la suivante
// (changement de slide plus rapide, sans télécharger toute la vidéo).
function prefetchNextSlide(container) {
    const track = container.querySelector('.carousel-track');
    if (!track) return;
    const slides = track.querySelectorAll('.carousel-slide');
    if (slides.length < 2) return;

    const next = slides[((Number(track.dataset.index) || 0) + 1) % slides.length];
    const v = next && next.querySelector('video');
    if (v && !v.dataset.prefetched && v.preload === 'none') {
        v.dataset.prefetched = '1';
        v.preload = 'metadata';
        v.load();
    }
}

function startActiveSlide(container) {
    const video = activeCarouselVideo(container);
    if (!video) return;
    playSafe(video);
    video.addEventListener('playing', () => prefetchNextSlide(container), { once: true });
}

// Appelée après chaque injection de page / sous-page
function initCarousels(root) {
    const containers = root.querySelectorAll('.vr-carousel-container');
    if (containers.length === 0) return;

    containers.forEach(container => {
        const track = container.querySelector('.carousel-track');
        if (!track) return;
        track.dataset.index = '0';
        track.querySelectorAll('.carousel-slide').forEach((slide, i) => {
            slide.classList.toggle('is-active', i === 0);
        });
    });

    if (!('IntersectionObserver' in window)) {
        containers.forEach(startActiveSlide); // repli : ancien comportement
        return;
    }

    if (!carouselObserver) {
        carouselObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const container = entry.target;
                if (entry.isIntersecting) {
                    startActiveSlide(container);
                } else if (!container.classList.contains('fullscreen-mode')) {
                    const video = activeCarouselVideo(container);
                    if (video) video.pause();
                }
            });
        }, { rootMargin: CAROUSEL_LOAD_MARGIN });
    }

    carouselObserver.disconnect(); // oublie les carrousels de la sous-page précédente
    containers.forEach(c => carouselObserver.observe(c));
}

// Clic sur une vidéo : bascule plein écran
function handleCarouselVideoClick(video, event) {
    if (event) event.stopPropagation();
    const container = video.closest('.vr-carousel-container');
    if (!container) return;

    if (!container.classList.contains('fullscreen-mode')) {
        container.classList.add('fullscreen-mode');
        playSafe(video);
    } else {
        container.classList.remove('fullscreen-mode');
    }
}

// Flèches : déplacement dans un carrousel précis (1, 2 ou 3)
function moveCarousel(carouselId, direction, event) {
    if (event) event.stopPropagation();

    const track = document.getElementById(`vrCarouselTrack${carouselId}`);
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('.carousel-slide'));
    if (slides.length === 0) return;

    let index = (Number(track.dataset.index) || 0) + direction;
    if (index < 0) index = slides.length - 1;
    else if (index >= slides.length) index = 0;
    track.dataset.index = String(index);

    // Pause de toutes les vidéos, puis on n'affiche que la slide active
    slides.forEach((slide, i) => {
        const v = slide.querySelector('video');
        if (v) v.pause();
        slide.classList.toggle('is-active', i === index);
    });

    startActiveSlide(track.closest('.vr-carousel-container'));
}

// Clavier en plein écran : Échap pour sortir, ← → pour naviguer
document.addEventListener('keydown', (e) => {
    const open = document.querySelector('.vr-carousel-container.fullscreen-mode');
    if (!open) return;

    if (e.key === 'Escape') {
        open.classList.remove('fullscreen-mode');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const id = open.id.replace('vrCarouselContainer', '');
        moveCarousel(id, e.key === 'ArrowLeft' ? -1 : 1);
    }
});

window.moveCarousel = moveCarousel;
window.handleCarouselVideoClick = handleCarouselVideoClick;