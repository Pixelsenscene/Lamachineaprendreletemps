
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

// --- GESTION DU CHARGEMENT DES SOUS-PAGES ---
async function loadSubPage(subPageName) {
    const subContainer = document.getElementById('sub-page-content');
    if (!subContainer) return;

    subContainer.style.opacity = '0';

    try {
        const response = await fetch(`pages/${subPageName}.html`);
        if (!response.ok) throw new Error(`Sous-page introuvable.`);
        const htmlContent = await response.text();

        setTimeout(() => {
            subContainer.innerHTML = htmlContent;
            subContainer.style.opacity = '1';

            const scripts = subContainer.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process();
            }

            document.querySelectorAll('.sub-btn').forEach(btn => {
                if (btn.getAttribute('data-subpage') === subPageName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }, 200);

    } catch (error) {
        console.error(error);
        setTimeout(() => {
            subContainer.innerHTML = `<h2>Contenu en cours de création</h2>`;
            subContainer.style.opacity = '1';
        }, 200);
    }
}
window.loadSubPage = loadSubPage;

async function loadPageContent(pageName) {
    if (!pageContainer) return;
    pageContainer.style.opacity = '0';

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Page introuvable.`);
        const htmlContent = await response.text();

        setTimeout(() => {
            pageContainer.innerHTML = htmlContent;
            pageContainer.style.opacity = '1';

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

            if (window.pendingSubPage) {
                const subToLoad = window.pendingSubPage;
                window.pendingSubPage = '';
                loadSubPage(subToLoad);
            }
        }, 200);

    } catch (error) {
        console.error(error);
        setTimeout(() => {
            pageContainer.innerHTML = `<h2>Contenu en cours de création</h2>`;
            pageContainer.style.opacity = '1';
        }, 200);
    }
}

// --- CLIC SUR LE TITRE MANUSCRIT (Retour en haut) ---
document.addEventListener('click', (e) => {
    const brandLink = e.target.closest('.header-brand-title');
    if (!brandLink) return;
    e.preventDefault();

    allNavLinks.forEach(l => l.classList.remove('active'));
    const accueilNavLink = document.querySelector('#main-header nav a[data-page="accueil"]');
    if (accueilNavLink) accueilNavLink.classList.add('active');

    body.classList.remove('page-mode', 'scrolled-mode');
    body.classList.add('home-mode');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (currentActivePage !== 'accueil') {
        loadPageContent('accueil');
        currentActivePage = 'accueil';
    }
});

// --- CLIC SUR LA FLÈCHE VERS LE BAS (Symbole ⏏︎) ---
document.addEventListener('click', (e) => {
    const arrowLink = e.target.closest('[data-action="scroll-down"]');
    if (!arrowLink) return;
    e.preventDefault();

    const heroSection = document.getElementById('hero-section');
    const firstBlock = document.querySelector('.content-block');

    if (heroSection) {
        // On scrolle exactement à la hauteur du Hero pour que le Bloc 1 vienne se caler sous le bandeau fixé en haut
        const targetY = heroSection.offsetHeight;
        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
    } else if (firstBlock) {
        firstBlock.scrollIntoView({ behavior: 'smooth' });
    }

});
// --- NAVIGATION ET CLICS SUR LES MENUS ---
allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');
        const targetSub = link.getAttribute('data-sub');

        if (!targetPage) return;

        window.pendingSubPage = targetSub || '';

        if (targetPage === 'accueil' && currentActivePage === 'accueil') {
            const scrollY = window.scrollY || window.pageYOffset;
            if (scrollY < 300) {
                const firstBlock = document.querySelector('.content-block');
                if (firstBlock) scrollToBlockCentered(firstBlock);
            } else {
                body.classList.remove('page-mode', 'scrolled-mode');
                body.classList.add('home-mode');
                window.scrollTo({ top: 0, behavior: 'auto' }); // Instantané
            }
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

        window.scrollTo({ top: 0, behavior: 'auto' }); // Instantané
        loadPageContent(targetPage);
        currentActivePage = targetPage;
    });
});

// --- GESTION INTERACTIVE DES MÉDIAS ---
function handleMediaClick(container) {
    const videoUrl = container.getAttribute('data-video');
    const imgSrc = container.getAttribute('data-img');
    const imgAlt = container.getAttribute('data-alt');
    const isVideo = container.querySelector('video');

    if (!isVideo) {
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
        container.innerHTML = `<img src="${imgSrc}" alt="${imgAlt}">`;
    }
}

// --- CENTRAGE VERTICAL ---
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

// --- CLIC SUR LE TEXTE D'UN BLOC ---
document.addEventListener('click', (e) => {
    const textSide = e.target.closest('.text-side');
    if (!textSide) return;

    const currentBlock = textSide.closest('.content-block');
    const blocks = Array.from(document.querySelectorAll('.content-block'));
    const index = blocks.indexOf(currentBlock);

    if (index === -1) return;

    // Si on est sur le dernier bloc, on boucle vers le Bloc 1 avec le calibrage exact
    if (index === blocks.length - 1) {
        const heroSection = document.getElementById('hero-section');
        if (heroSection) {
            body.classList.add('scrolled-mode');
            window.scrollTo({
                top: heroSection.offsetHeight,
                behavior: 'smooth'
            });
        } else {
            scrollToBlockCentered(blocks[0]);
        }
    } else {
        // Sinon, on passe au bloc suivant normalement en le centrant
        scrollToBlockCentered(blocks[index + 1]);
    }
});

// --- NAVIGATION PAR SCROLL (WHEEL) ---
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
            window.scrollTo({
                top: heroSection.offsetHeight,
                behavior: 'smooth'
            });
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

// --- SYNCHRONISATION FLUIDE : LE BANDOIRE ET LE BLOC 1 SONT LIÉS ---
window.addEventListener('scroll', () => {
    if (!body.classList.contains('home-mode') || body.classList.contains('page-mode')) return;

    const heroSection = document.getElementById('hero-section');
    const header = document.getElementById('main-header');
    if (!heroSection || !header) return;

    const heroHeight = heroSection.offsetHeight;
    const headerHeight = header.offsetHeight;

    // Seuil exact : au moment précis où le bandeau atteint le haut de l'écran
    const threshold = heroHeight - headerHeight;

    if (window.scrollY >= threshold) {
        body.classList.add('scrolled-mode');
    } else {
        body.classList.remove('scrolled-mode');
    }
});