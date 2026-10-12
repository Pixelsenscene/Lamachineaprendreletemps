// --- CHARGEMENT DYNAMIQUE DES COMPOSANTS ET INITIALISATION ---
window.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
        heroSection.classList.add('video-loaded');
    }

    loadPageContent('accueil');
    currentActivePage = 'accueil';
});

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

            // --- EXÉCUTION AUTOMATIQUE DES SCRIPTS DU COMPOSANT ---
            const scripts = pageContainer.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

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

        // Clic sur Accueil alors qu'on est déjà sur Accueil
        if (targetPage === 'accueil' && currentActivePage === 'accueil') {
            body.classList.remove('page-mode', 'scrolled-mode');
            body.classList.add('home-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

// --- NAVIGATION PAR IMPULSION ENGAGÉE (5 BLOCS D'ACCUEIL) ---
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

    e.preventDefault();
    isAnimatingScroll = true;

    // Seuil de sensibilité à -20 (très sensible pour le retour haut)
    if (e.deltaY < -20 && scrollY > windowHeight / 2) {
        body.classList.remove('scrolled-mode');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { isAnimatingScroll = false; }, 800);
        return;
    }

    if (scrollY < windowHeight / 2) {
        if (e.deltaY > 0) {
            body.classList.add('scrolled-mode');
            const firstBlock = blocks[0];
            const targetScroll = window.scrollY + firstBlock.getBoundingClientRect().top - 120;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            body.classList.remove('scrolled-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (e.deltaY > 0) {
        if (currentIndex < blocks.length - 1) {
            const nextBlock = blocks[currentIndex + 1];
            const targetScroll = window.scrollY + nextBlock.getBoundingClientRect().top - 120;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            isAnimatingScroll = false;
            return;
        }
    } else {
        if (currentIndex > 0) {
            const prevBlock = blocks[currentIndex - 1];
            const targetScroll = window.scrollY + prevBlock.getBoundingClientRect().top - 120;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } else {
            body.classList.remove('scrolled-mode');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    setTimeout(() => {
        isAnimatingScroll = false;
    }, 800);

}, { passive: false });