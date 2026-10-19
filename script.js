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
const validPages = new Set(
    Array.from(allNavLinks).map(l => l.dataset.page).filter(Boolean)
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
            src: "https://MaptDiff.b-cdn.net/Montages%20compil%C3%A9s/LeFilduTemps%20-%20Hiver1-SiteWeb%20MPEG-4.mp4",
            customLoop: true,
            startTime: 16,
            endTime: 106
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
function showHeroVideo(index) {
    if (isTransitioning) return;
    isTransitioning = true;

    const heroVideo = document.getElementById('hero-video');
    const heroSource = document.getElementById('hero-source');
    const data = CONFIG.videos[index];

    heroVideo.style.opacity = '0';

    setTimeout(() => {
        const done = () => {
            setTimeout(() => {
                isTransitioning = false;
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
    showHeroVideo((currentHeroIndex + 1) % CONFIG.videos.length);
}
window.switchHeroVideo = switchHeroVideo;

// Clic sur le titre : retour à la 1ère vidéo ("Le fil du temps"), depuis son début
function restartHeroVideo(e) {
    if (e) e.stopPropagation(); // ne déclenche pas aussi le changement de vidéo du hero
    showHeroVideo(0);
}
window.restartHeroVideo = restartHeroVideo;

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
                if (entry.intersectionRatio < 0.5) {
                    heroVideo.pause();
                } else if (!body.classList.contains('page-mode')) {
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

async function loadSubPage(subPageName) {
    const subContainer = document.getElementById('sub-page-content');
    if (!subContainer) return;

    const requestId = ++subRequestId;
    subContainer.style.opacity = '0';

    // Le chargement et le fondu au noir se font en parallèle
    const [html] = await Promise.all([fetchHTML(`pages/${subPageName}.html`), wait(FADE_MS)]);

    // Un clic plus récent a pris le relais (ou la page a changé) : on abandonne
    if (requestId !== subRequestId || !subContainer.isConnected) return;

    injectHTML(subContainer, html);
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

    if (window.pendingSubPage) {
        const subToLoad = window.pendingSubPage;
        window.pendingSubPage = '';
        loadSubPage(subToLoad);
    }
}


// ---------------------------------------------------------------------
// 5. NAVIGATION
// ---------------------------------------------------------------------
function navigate(page, sub = '', { push = true } = {}) {
    if (!validPages.has(page)) { page = 'accueil'; sub = ''; }

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
    setMode(page === 'accueil' ? 'home' : 'page');
    loadPageContent(page);
    currentActivePage = page;
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

    let currentIndex = 0;
    let minDistance = Infinity;

    blocks.forEach((block, index) => {
        const rect = block.getBoundingClientRect();
        const distance = Math.abs(rect.top - 120);
        if (distance < minDistance) {
            minDistance = distance;
            currentIndex = index;
        }
    });

    if (currentIndex < blocks.length - 1) {
        scrollToBlockCentered(blocks[currentIndex + 1]);
    } else {
        isAnimatingScroll = false;
        return;
    }

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