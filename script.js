// --- GESTION DE LA VIDÉO D'ACCUEIL BUNNY.NET (15s -> 45s) ET DU CHARGEMENT ---
window.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
        heroSection.classList.add('video-loaded'); // Force l'affichage immédiat
    }

    const heroVideo = document.getElementById('hero-video');
    if (heroVideo) {
        // Tente de lancer explicitement la lecture via JavaScript (contourne les sécurités strictes du navigateur)
        heroVideo.play().catch(error => {
            console.log("Lecture automatique bloquée par le navigateur : ", error);
        });

        // Gestion de la boucle (15s à 45s)
        heroVideo.addEventListener('timeupdate', function () {
            if (this.currentTime >= 45 || this.currentTime < 15) {
                this.currentTime = 15;
            }
        });
    }

    loadPageContent('accueil');
    currentActivePage = 'accueil';
});

// --- CHARGEMENT DYNAMIQUE DES COMPOSANTS ---
const body = document.body;
const allNavLinks = document.querySelectorAll('#main-header nav a');
const pageContainer = document.getElementById('page-content');
let currentActivePage = '';

async function loadPageContent(pageName) {
    if (!pageContainer) return;

    pageContainer.style.opacity = '0';

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) {
            throw new Error(`Page pages/${pageName}.html introuvable.`);
        }
        const htmlContent = await response.text();

        setTimeout(() => {
            pageContainer.innerHTML = htmlContent;
            pageContainer.style.opacity = '1';

            // Relance l'analyseur d'Instagram si besoin sur les anciennes pages
            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process();
            }
        }, 200);

    } catch (error) {
        console.error(error);
        setTimeout(() => {
            pageContainer.innerHTML = `<h2>Contenu en cours de création</h2><p>Le composant <code>pages/${pageName}.html</code> n'a pas encore été créé.</p>`;
            pageContainer.style.opacity = '1';
        }, 200);
    }
}

// Navigation et clics sur les menus
allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');

        if (!targetPage) return;

        if (targetPage === currentActivePage && !body.classList.contains('page-mode') && body.classList.contains('home-mode')) {
            return;
        }

        allNavLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const parentLi = link.closest('.has-submenu');
        if (parentLi) {
            const parentLink = parentLi.querySelector('a');
            if (parentLink) parentLink.classList.add('active');
        }

        if (targetPage === 'accueil') {
            body.classList.remove('page-mode', 'scrolled-mode');
            body.classList.add('home-mode');
        } else {
            body.classList.remove('home-mode', 'scrolled-mode');
            body.classList.add('page-mode');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        loadPageContent(targetPage);
        currentActivePage = targetPage;
    });
});

// --- NAVIGATION PAR IMPULSION ENGAGÉE (5 BLOCS) ---
let isAnimatingScroll = false;

window.addEventListener('wheel', (e) => {
    if (!body.classList.contains('home-mode') || body.classList.contains('page-mode')) return;

    // Empêche tout autre ordre de scroll si une transition est déjà en cours
    if (isAnimatingScroll) {
        e.preventDefault();
        return;
    }

    // Seuil très léger pour détecter l'intention de mouvement
    if (Math.abs(e.deltaY) < 10) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const mainContainer = document.getElementById('main-container');

    if (!mainContainer) return;

    const blocks = Array.from(mainContainer.querySelectorAll('.content-block'));
    if (blocks.length === 0) return;

    e.preventDefault(); // On neutralise le scroll natif brutal dès l'impulsion
    isAnimatingScroll = true;

    // 1. Si on est dans la zone de la vidéo d'accueil
    if (scrollY < windowHeight / 2) {
        if (e.deltaY > 0) {
            // Impulsion vers le bas : on active le mode scroll et on cible le 1er bloc
            body.classList.add('scrolled-mode');
            const firstBlock = blocks[0];
            const targetScroll = window.scrollY + firstBlock.getBoundingClientRect().top - 120; // 120px sous le bandeau

            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            // Remontée vers la vidéo
            body.classList.remove('scrolled-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        setTimeout(() => { isAnimatingScroll = false; }, 800);
        return;
    }

    // 2. À l'intérieur des 5 blocs de contenu
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

    if (e.deltaY > 0) {
        // Descente engagée : on passe au bloc suivant (jusqu'au 5ème)
        if (currentIndex < blocks.length - 1) {
            const nextBlock = blocks[currentIndex + 1];
            const targetScroll = window.scrollY + nextBlock.getBoundingClientRect().top - 120;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            isAnimatingScroll = false;
            return;
        }
    } else {
        // Remontée engagée : on retourne au bloc précédent
        if (currentIndex > 0) {
            const prevBlock = blocks[currentIndex - 1];
            const targetScroll = window.scrollY + prevBlock.getBoundingClientRect().top - 120;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            // Si on est au premier bloc et qu'on remonte, on libère l'accès vers la vidéo
            body.classList.remove('scrolled-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Libération du verrou après la fin de l'animation de glissement
    setTimeout(() => {
        isAnimatingScroll = false;
    }, 800);

}, { passive: false });