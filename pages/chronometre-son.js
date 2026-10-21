/* ============================================================================================
   Son du Timer (outil Chronomètre) : clics de "bois" aux approches des temps intermédiaires.
   - Fichier SÉPARÉ de la page : s'il manque ou s'il a un problème, le chronomètre et le Timer fonctionnent quand même.
   - Il ne fait que LIRE l'état du compte à rebours (root.chTimer.state()), sans jamais le modifier.
   - À placer dans le dossier "pages", à côté de outils-chronometre.html.
   - Écrit dans une syntaxe volontairement très classique (var / function) pour fonctionner sur tous les navigateurs.
   ============================================================================================ */
window.chronoSonInit = function (root) {
    if (!root || root.chSonInit) { return; }
    root.chSonInit = true;

    function $(id) { return document.getElementById('ch-' + id); }

    var btn = $('sound');
    var volBar = $('vol');
    if (!btn || !volBar) { return; }

    var WARN_SECONDS = 10;     // un clic par seconde pendant les 10 s avant chaque temps, accent à la seconde 0
    var LOOKAHEAD_MS = 150;    // les clics sont programmés à l'avance sur l'horloge audio
    var POLL_MS = 25;

    var soundOn = false;       // haut-parleur barré à l'ouverture
    var volume = Number(volBar.value) || 70;
    var audioCtx = null;
    var master = null;
    var bus = null;
    var noiseBuf = null;
    var pollId = null;
    var lastBase = null;
    var lastStart = null;
    var done = {};             // clics déjà programmés (clé = valeur du décompte en ms)

    // iPhone / iPad : le Web Audio est coupé par le commutateur de sonnerie ; on le place sur le canal "média"
    var ua = navigator.userAgent || '';
    var IS_IOS = ua.indexOf('iPad') >= 0 || ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var silentAudio = null;
    var silentUrl = null;

    function unlockIOSAudio() {
        try {
            if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
        } catch (e1) { /* repli ci-dessous */ }
        if (!IS_IOS) { return; }
        try {
            if (!silentAudio) {
                var rate = 8000;
                var n = rate;
                var buf = new ArrayBuffer(44 + n);
                var dv = new DataView(buf);
                var writeText = function (o, s) {
                    for (var i = 0; i < s.length; i++) { dv.setUint8(o + i, s.charCodeAt(i)); }
                };
                writeText(0, 'RIFF'); dv.setUint32(4, 36 + n, true); writeText(8, 'WAVE'); writeText(12, 'fmt ');
                dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
                dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true);
                dv.setUint16(34, 8, true); writeText(36, 'data'); dv.setUint32(40, n, true);
                for (var j = 0; j < n; j++) { dv.setUint8(44 + j, 128); }
                silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
                silentAudio = new Audio(silentUrl);
                silentAudio.loop = true;
            }
            var p = silentAudio.play();
            if (p && typeof p.catch === 'function') { p.catch(function () { }); }
        } catch (e2) { /* sans conséquence */ }
    }

    function applyVolume() {
        if (master) { master.gain.value = Math.pow(volume / 100, 2); } // courbe plus naturelle qu'une droite
    }

    function ensureAudio() {
        unlockIOSAudio();
        if (!audioCtx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { return false; }
            audioCtx = new AC();
            master = audioCtx.createGain();
            master.connect(audioCtx.destination);
            noiseBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.05), audioCtx.sampleRate);
            var data = noiseBuf.getChannelData(0);
            for (var i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
            applyVolume();
        }
        if (audioCtx.state === 'suspended') { audioCtx.resume(); }
        return true;
    }

    function envelope(gainNode, t, peak, dur) {
        var g = gainNode.gain;
        g.setValueAtTime(0.0001, t);
        g.exponentialRampToValueAtTime(peak, t + 0.002);
        g.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    function tone(out, t, freq, peak, dur, freqEnd) {
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd) { osc.frequency.exponentialRampToValueAtTime(freqEnd, t + 0.03); }
        envelope(g, t, peak, dur);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    // Clic "bois" (même son que le métronome). À la seconde 0 : version plus aiguë, plus forte et plus longue.
    function woodClick(t, accent, out) {
        var level = accent ? 1.4 : 0.7;
        tone(out, t, accent ? 1700 : 1050, 0.9 * level, accent ? 0.1 : 0.06, accent ? 1100 : 700);

        var noise = audioCtx.createBufferSource();
        var filter = audioCtx.createBiquadFilter();
        var g = audioCtx.createGain();
        noise.buffer = noiseBuf;
        filter.type = 'bandpass';
        filter.frequency.value = accent ? 2200 : 1800;
        filter.Q.value = 3;
        envelope(g, t, 0.5 * level, 0.03);
        noise.connect(filter);
        filter.connect(g);
        g.connect(out);
        noise.start(t);
        noise.stop(t + 0.04);
    }

    function cutBus() {
        if (bus) {
            try { bus.disconnect(); } catch (e3) { /* déjà coupé */ }
            bus = null;
        }
    }

    function newTimeline(st) {
        cutBus();
        bus = audioCtx.createGain();
        bus.connect(master);
        done = {};
        lastBase = st.base;
        lastStart = st.start;
    }

    // Y a-t-il un autre temps strictement entre "low" et "high" ? (alors le décompte approche CE temps-là, pas "low")
    function hasTargetBetween(targets, low, high) {
        for (var i = 0; i < targets.length; i++) {
            if (targets[i] > low && targets[i] < high) { return true; }
        }
        return false;
    }

    // Programme à l'avance les clics des prochaines 150 ms : un par seconde pendant les 10 s qui précèdent
    // chaque temps, et le clic distinctif à la seconde 0.
    function schedule(st) {
        var nowMs = performance.now();
        var horizon = nowMs + LOOKAHEAD_MS;
        var accents = {};
        var k;
        for (k = 0; k < st.targets.length; k++) { accents[Math.round(st.targets[k])] = true; }

        for (k = 0; k < st.targets.length; k++) {
            for (var m = WARN_SECONDS; m >= 0; m--) {
                var point = st.targets[k] + m * 1000;               // valeur du décompte à laquelle on clique
                if (point >= st.base - 1) { continue; }             // déjà passé (ou point de départ) : pas de clic
                if (m > 0 && hasTargetBetween(st.targets, st.targets[k], point)) { continue; } // un point plus proche : c'est lui qu'on approche
                var eventMs = st.start + (st.base - point);         // instant où le décompte atteint cette valeur
                if (eventMs > horizon || eventMs < nowMs - 30) { continue; }
                var key = Math.round(point);
                if (done[key]) { continue; }                        // deux temps proches : un seul clic
                done[key] = true;
                woodClick(audioCtx.currentTime + Math.max(0, (eventMs - nowMs) / 1000), accents[key] === true, bus);
            }
        }
    }

    function shutdown() {
        clearTimeout(pollId);
        pollId = null;
        cutBus();
        if (audioCtx) {
            try { audioCtx.close(); } catch (e4) { /* déjà fermé */ }
            audioCtx = null;
            master = null;
        }
        if (silentAudio) {
            try { silentAudio.pause(); } catch (e5) { /* sans conséquence */ }
            silentAudio = null;
        }
        if (silentUrl) {
            URL.revokeObjectURL(silentUrl);
            silentUrl = null;
        }
    }

    // Surveille le compte à rebours toutes les 25 ms tant que le haut-parleur est actif
    function poll() {
        pollId = null;
        if (!root.isConnected) { shutdown(); return; }
        if (!soundOn || !audioCtx) { return; }

        var st = (root.chTimer && root.chTimer.state) ? root.chTimer.state() : null;
        if (st && st.running) {
            if (!bus || st.base !== lastBase || st.start !== lastStart) { newTimeline(st); } // nouveau lancement / nouveau temps
            schedule(st);
        } else if (bus && st && st.base > 0) {
            cutBus();            // pause ou remise au début : on coupe les clics déjà programmés
            lastBase = null;
            lastStart = null;
        }                        // (fin naturelle : base = 0, on laisse jouer le dernier clic)
        pollId = setTimeout(poll, POLL_MS);
    }

    // Haut-parleur : actif = clics ; barré = silence. Un petit clic confirme l'activation.
    function toggleSound() {
        soundOn = !soundOn;
        btn.setAttribute('aria-pressed', String(soundOn));
        if (soundOn) {
            if (!ensureAudio()) {
                soundOn = false;
                btn.setAttribute('aria-pressed', 'false');
                return;
            }
            woodClick(audioCtx.currentTime + 0.01, false, master);
            lastBase = null;
            lastStart = null;
            if (pollId === null) { poll(); }
        } else {
            clearTimeout(pollId);
            pollId = null;
            cutBus();
        }
    }

    btn.addEventListener('click', toggleSound);

    volBar.addEventListener('input', function () {
        volume = Number(volBar.value);
        applyVolume();
    });
    volBar.addEventListener('change', function () { // petit clic d'essai quand on relâche la barre
        if (soundOn && ensureAudio()) { woodClick(audioCtx.currentTime + 0.01, false, master); }
    });

    // Un clic sur "lancer" est un geste de l'utilisateur : on en profite pour réveiller l'audio s'il s'est endormi
    var tstart = $('tstart');
    if (tstart) {
        tstart.addEventListener('click', function () { if (soundOn) { ensureAudio(); } });
    }
};