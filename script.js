// script.js — enhanced finale: bigger/thicker rings + final mega-shot (long laser, multiple auras, screen shake)
// + perfect-score victory: ship volleys, finisher shot, ogre explosion

// ======= QUESTIONS =======
const questions = [
    { question: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], answer: "Paris" },
    { question: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], answer: "Mars" },
    { question: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondrion", "Chloroplast"], answer: "Mitochondrion" },
    { question: "Who wrote 'Romeo and Juliet'?", options: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], answer: "William Shakespeare" },
    { question: "What is the largest mammal in the world?", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"], answer: "Blue Whale" },
    { question: "Which gas do plants absorb from the atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], answer: "Carbon Dioxide" },
    { question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], answer: "Diamond" },
    { question: "In which country is the Great Pyramid of Giza located?", options: ["Mexico", "Egypt", "India", "Peru"], answer: "Egypt" },
    { question: "What is the fastest land animal?", options: ["Cheetah", "Horse", "Ostrich", "Leopard"], answer: "Cheetah" },
    { question: "Which is the smallest prime number?", options: ["0", "1", "2", "3"], answer: "2" },
    { question: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: "7" },
    { question: "What is the boiling point of water at sea level in Celsius?", options: ["90°C", "100°C", "120°C", "80°C"], answer: "100°C" },
    { question: "Who painted the Mona Lisa?", options: ["Leonardo da Vinci", "Vincent van Gogh", "Pablo Picasso", "Claude Monet"], answer: "Leonardo da Vinci" },
    { question: "Which element has the chemical symbol 'O'?", options: ["Oxygen", "Gold", "Osmium", "Oxide"], answer: "Oxygen" },
    { question: "Which ocean is the largest?", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"], answer: "Pacific Ocean" }
];


// ======= GAME STATE =======
let currentQuestionIndex = 0;
let score = 0;

const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const scoreText = document.getElementById('score-text');
const progressBar = document.getElementById('progress-bar');
const quizContent = document.getElementById('quiz-content');
const resultsContainer = document.getElementById('results-container');
const finalScore = document.getElementById('final-score');
const startMenu = document.getElementById('start-menu');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');
const bgMusic = document.getElementById('space-music');

const ogreMaxHealth = questions.length;
let ogreHealth = ogreMaxHealth;

// audio (update paths if needed)
const hitSound = new Audio('sounds/hitHurt.wav');
const missSound = new Audio('sounds/wrong.mp3');
const shootSound = new Audio('sounds/shoot.mp3');
const beamSound = new Audio('sounds/laserShoot.wav');
beamSound.volume = 0.95;
// newly added files
const powerUpSound = new Audio('sounds/powerUp.wav');
powerUpSound.volume = 0.9;
const explosionSound = new Audio('sounds/explosion.wav');
explosionSound.volume = 0.9;

// small utility
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

let isAnimating = false;

// ================================
// Active projectile tracking
// ================================
let projectileIdCounter = 0;
const activeProjectiles = new Map();

let fireTimeout = null;
let shooterTimeout = null;
let postImpactTimeout = null;
let returnTransitionTimeout = null;
let transitionListener = null;

// ---------------------------
// Inject small CSS for ship hit + pixel-y visuals + aura
// ---------------------------
(function injectStyle() {
    if (document.getElementById('game-enhance-styles')) return;
    const s = document.createElement('style');
    s.id = 'game-enhance-styles';
    s.textContent = `
    .ship-hit { animation: ship-hit-anim 720ms cubic-bezier(.2,.6,.2,1); filter: drop-shadow(0 6px 8px rgba(0,0,0,0.6)) saturate(1.1); }
    @keyframes ship-hit-anim {
        0% { transform: translateY(0) rotate(0deg) scale(1); opacity:1; }
        20% { transform: translateY(-10px) rotate(-8deg) scale(1.06); opacity:1; }
        50% { transform: translateY(6px) rotate(10deg) scale(0.94); opacity:0.95; }
        80% { transform: translateY(-4px) rotate(-3deg) scale(1.02); opacity:0.98; }
        100% { transform: translateY(0) rotate(0deg) scale(1); opacity:1; }
    }

    .prebeam-flare { position: absolute; border-radius: 50%; pointer-events: none; z-index: 960; mix-blend-mode: screen; filter: blur(6px); }
    .ogre-inner.ogre-prepare { animation: ogre-prepare-breath 640ms ease-in-out; }
    @keyframes ogre-prepare-breath { 0%{transform:translateY(0) scale(1);} 40%{transform:translateY(-6px) scale(1.08);} 100%{transform:translateY(0) scale(1);} }

    /* aura sphere style */
    .ogre-aura { position: absolute; border-radius: 50%; pointer-events: none; z-index: 962; mix-blend-mode: screen; }
    `;
    document.head.appendChild(s);
})();

// ==================================================================
// Utility: create a projectile element styled like your #projectile
// ==================================================================
function createProjectileElement() {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.width = '4px';
    p.style.height = '24px';
    p.style.background = 'linear-gradient(to top, #ffe066 60%, #fff700 100%)';
    p.style.borderRadius = '2px';
    p.style.boxShadow = '0 0 8px 2px #ffe066';
    p.style.pointerEvents = 'none';
    p.style.zIndex = '999';
    p.style.display = 'block';
    p.style.transform = 'translate(-50%, -50%)';
    return p;
}

// ==================================================================
// Cleanup: cancel & remove active projectiles, timeouts, listeners
// ==================================================================
function cleanupProjectile() {
    for (const [id, entry] of activeProjectiles.entries()) {
        try { entry.anim.cancel(); } catch (e) {}
        try { if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el); } catch(e) {}
    }
    activeProjectiles.clear();

    if (fireTimeout) { clearTimeout(fireTimeout); fireTimeout = null; }
    if (shooterTimeout) { clearTimeout(shooterTimeout); shooterTimeout = null; }
    if (postImpactTimeout) { clearTimeout(postImpactTimeout); postImpactTimeout = null; }
    if (returnTransitionTimeout) { clearTimeout(returnTransitionTimeout); returnTransitionTimeout = null; }

    const ogre = document.getElementById('ogre-character');
    if (transitionListener && ogre) { ogre.removeEventListener('transitionend', transitionListener); transitionListener = null; }

    if (ogre) {
        ogre.style.transition = '';
        ogre.classList.remove('ogre-dodge-right', 'ogre-hit', 'ogre-red', 'ogre-prepare');
    }

    isAnimating = false;
    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = false);
}

// ==================================================================
// Load question
// ==================================================================
function loadQuestion() {
    cleanupProjectile();

    if (currentQuestionIndex >= questions.length) {
        if (score < questions.length) {
            runOgreFinale().then(() => showResults()).catch(e => { console.error(e); showResults(); });
        } else {
            // PERFECT SCORE → victory sequence
            runOgreDefeat().then(() => showResults()).catch(e => { console.error(e); showResults(); });
        }
        return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    questionText.textContent = currentQuestion.question;
    optionsContainer.innerHTML = '';

    currentQuestion.options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => { if (isAnimating) return; checkAnswer(option); });
        optionsContainer.appendChild(button);
    });
    updateOgreHealthBar();
}

// ==================================================================
// Check answer -> animate projectile (unchanged)
// ==================================================================
function checkAnswer(selectedOption) {
    const correctAnswer = questions[currentQuestionIndex].answer;
    animateProjectile(selectedOption, correctAnswer);
}

function animateProjectile(selectedOption, correctAnswer) {
    if (isAnimating) return;
    isAnimating = true;

    cleanupProjectile();

    const projectileEl = createProjectileElement();
    quizContent.appendChild(projectileEl);

    const ogre = document.getElementById('ogre-character');
    const shooter = document.getElementById('shooter-ship');

    if (!projectileEl || !ogre || !shooter || !quizContent) {
        console.warn('Missing DOM elements for animation; finishing answer.');
        finishAnswer(selectedOption, correctAnswer);
        return;
    }

    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = true);

    const shooterRect = shooter.getBoundingClientRect();
    const ogreRectBefore = ogre.getBoundingClientRect();
    const containerRect = quizContent.getBoundingClientRect();

    const startX = shooterRect.left + shooterRect.width / 2 - containerRect.left;
    const startY = shooterRect.top + shooterRect.height / 2 - containerRect.top;

    const endX = ogreRectBefore.left + ogreRectBefore.width / 2 - containerRect.left;
    const endY = ogreRectBefore.top + ogreRectBefore.height - containerRect.top;

    projectileEl.style.left = `${startX}px`;
    projectileEl.style.top = `${startY}px`;

    const shooterFireClassCleanup = () => {
        const ship = document.getElementById('shooter-ship');
        if (ship) ship.classList.remove('shooting');
    };

    const ship = document.getElementById('shooter-ship');
    if (ship) {
        ship.classList.add('shooting');
        shooterTimeout = setTimeout(() => { shooterFireClassCleanup(); shooterTimeout = null; }, 180);
    }

    const willDodge = (selectedOption !== correctAnswer);

    const returnTransition = 260;
    const dodgeDuration = 220;
    if (willDodge) {
        ogre.style.transition = `transform ${returnTransition}ms cubic-bezier(.68,-0.55,.27,1.55)`;
        ogre.classList.add('ogre-dodge-right');
    } else {
        ogre.classList.remove('ogre-dodge-right');
    }

    try { shootSound.currentTime = 0; shootSound.play().catch(()=>{}); } catch(e){}

    const projectileDuration = 300;
    const postImpactHold = 160;

    const id = ++projectileIdCounter;
    const dx = Math.round(endX - startX);
    const dy = Math.round(endY - startY);

    const keyframes = [
        { transform: 'translate(-50%, -50%)' },
        { transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%)` }
    ];

    const fireDelay = willDodge ? dodgeDuration : 0;

    fireTimeout = setTimeout(() => {
        fireTimeout = null;
        const anim = projectileEl.animate(keyframes, { duration: projectileDuration, easing: 'linear', fill: 'forwards' });
        activeProjectiles.set(id, { anim, el: projectileEl });

        anim.onfinish = () => {
            if (!activeProjectiles.has(id)) return;
            try { if (projectileEl.parentNode) projectileEl.parentNode.removeChild(projectileEl); } catch(e){}
            activeProjectiles.delete(id);

            const isCurrentlyDodging = ogre.classList.contains('ogre-dodge-right');

            if (!willDodge && !isCurrentlyDodging) {
                try { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); } catch(e){}
                ogre.classList.add('ogre-hit', 'ogre-red');

                postImpactTimeout = setTimeout(() => {
                    postImpactTimeout = null;
                    ogre.classList.remove('ogre-hit', 'ogre-red');
                    ogre.style.transition = '';
                    finishAnswer(selectedOption, correctAnswer);
                    isAnimating = false;
                }, postImpactHold);

            } else {
                try { missSound.currentTime = 0; missSound.play().catch(()=>{}); } catch(e){}
                setTimeout(() => {
                    let finished = false;
                    transitionListener = (ev) => {
                        if (ev.propertyName === 'transform') {
                            finished = true;
                            const og = document.getElementById('ogre-character');
                            if (og && transitionListener) { og.removeEventListener('transitionend', transitionListener); transitionListener = null; }
                            if (og) og.style.transition = '';
                            finishAnswer(selectedOption, correctAnswer);
                            isAnimating = false;
                        }
                    };
                    const og = document.getElementById('ogre-character');
                    if (og) og.addEventListener('transitionend', transitionListener);

                    returnTransitionTimeout = setTimeout(() => {
                        if (!finished) {
                            const og2 = document.getElementById('ogre-character');
                            if (og2 && transitionListener) { og2.removeEventListener('transitionend', transitionListener); transitionListener = null; }
                            if (og2) og2.style.transition = '';
                            finishAnswer(selectedOption, correctAnswer);
                            isAnimating = false;
                        }
                        returnTransitionTimeout = null;
                    }, returnTransition + 120);

                    ogre.classList.remove('ogre-dodge-right');
                }, 80);
            }
        };

        anim.oncancel = () => {
            if (activeProjectiles.has(id)) {
                const entry = activeProjectiles.get(id);
                try { if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el); } catch(e){}
                activeProjectiles.delete(id);
            }
            isAnimating = false;
            optionsContainer.querySelectorAll('button').forEach(b => b.disabled = false);
        };
    }, fireDelay);
}

// ==================================================================
// Finish answer -> update score & load next
// ==================================================================
function finishAnswer(selectedOption, correctAnswer) {
    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = false);

    if (selectedOption === correctAnswer) {
        score++;
        ogreHealth = Math.max(0, ogreHealth - 1);
        updateOgreHealthBar();
    }
    currentQuestionIndex++;
    scoreText.textContent = `Score: ${score}`;
    cleanupProjectile();
    loadQuestion();
}

function updateOgreHealthBar() {
    const healthPercentage = Math.max(0, Math.min(100, (ogreHealth / ogreMaxHealth) * 100));
    progressBar.style.width = `${healthPercentage}%`;
}

function showResults() {
    cleanupProjectile();
    quizContent.style.display = 'none';
    resultsContainer.style.display = 'flex';
    finalScore.textContent = `Your final score is ${score} out of ${questions.length}.`;
    const endTitle = document.getElementById('end-title');
    if (score < questions.length) {
        endTitle.textContent = "Game Over";
        endTitle.style.color = "#d33";
    } else {
        endTitle.textContent = "You Win!";
        endTitle.style.color = "#3fa34d";
    }
}

// =======================
// OGRE FINALE SEQUENCE (with big thicker circles + final mega-shot)
// =======================

async function runOgreFinale() {
    isAnimating = true;
    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    cleanupProjectile();

    const ogre = document.getElementById('ogre-character');
    const containerRect = quizContent.getBoundingClientRect();
    const ogreRect = ogre.getBoundingClientRect();
    const ogreCenterX = ogreRect.left + ogreRect.width / 2 - containerRect.left;
    const ogreCenterY = ogreRect.top + ogreRect.height / 2 - containerRect.top;

    function spamAudioClones(baseAudio, count = 6, spacing = 100, volume = 1.0, loopHum = false) {
        const timers = [];
        let hum = null;
        if (loopHum) {
            try { hum = baseAudio.cloneNode(); hum.loop = true; hum.volume = Math.min(0.5, volume * 0.35); hum.play().catch(()=>{}); } catch(e){ hum = null; }
        }
        for (let i = 0; i < count; i++) {
            const id = setTimeout(() => {
                try { const a = baseAudio.cloneNode(); a.volume = volume; a.currentTime = 0; a.play().catch(()=>{}); } catch(e){}
            }, i * spacing);
            timers.push(id);
        }
        return { cancel: () => { timers.forEach(t => clearTimeout(t)); if (hum) try{ hum.pause(); }catch(e){} } };
    }

    // CHARGE: bigger, thicker rings + inner pulses + outer particles
    async function chargeAndPlayPowerUpBIGGER(duration = 900, particleCount = 30) {
        return new Promise((resolve) => {
            const wrap = document.createElement('div');
            wrap.style.position = 'absolute';
            wrap.style.left = '0'; wrap.style.top = '0'; wrap.style.width = '100%'; wrap.style.height = '100%';
            wrap.style.pointerEvents = 'none'; wrap.style.zIndex = '980';
            quizContent.appendChild(wrap);

            // Outer absorb particles
            const particles = [];
            const radius = 160; // bigger radius
            for (let i = 0; i < particleCount; i++) {
                const p = document.createElement('div');
                const size = 8 + Math.random() * 12;
                p.style.position = 'absolute';
                const angle = Math.random() * Math.PI * 2;
                const sx = ogreCenterX + Math.cos(angle) * (radius + Math.random() * 80);
                const sy = ogreCenterY + Math.sin(angle) * (radius + Math.random() * 80);
                p.style.left = `${sx}px`;
                p.style.top = `${sy}px`;
                p.style.width = `${size}px`;
                p.style.height = `${size}px`;
                p.style.borderRadius = '50%';
                p.style.background = ['#fff8e1','#ffd88a','#ffb36b','#fff0b8'][Math.floor(Math.random()*4)];
                p.style.opacity = '0';
                p.style.transform = 'translate(-50%,-50%) scale(0.6)';
                p.style.filter = 'blur(0.3px)';
                wrap.appendChild(p);
                particles.push(p);
            }

            // BIG thicker rings (3 rings) — more visible
            const rings = [];
            const ringSizes = [120, 200, 320]; // much larger
            const ringThicknesses = [8, 12, 18]; // thick borders
            for (let i = 0; i < ringSizes.length; i++) {
                const ring = document.createElement('div');
                ring.style.position = 'absolute';
                ring.style.left = `${ogreCenterX}px`;
                ring.style.top = `${ogreCenterY}px`;
                ring.style.width = `${ringSizes[i]}px`;
                ring.style.height = `${ringSizes[i]}px`;
                ring.style.borderRadius = '50%';
                ring.style.border = `${ringThicknesses[i]}px solid rgba(255,255,255,${0.95 - i*0.22})`;
                ring.style.boxSizing = 'border-box';
                ring.style.pointerEvents = 'none';
                ring.style.transform = 'translate(-50%,-50%) scale(0.25)';
                ring.style.opacity = '0';
                ring.style.zIndex = '985';
                wrap.appendChild(ring);
                rings.push(ring);
            }

            // Aura spheres
            const auras = [];
            for (let a = 0; a < 4; a++) {
                const aura = document.createElement('div');
                aura.className = 'ogre-aura';
                const s = 160 + a * 40 + Math.random()*40;
                aura.style.left = `${ogreCenterX}px`;
                aura.style.top = `${ogreCenterY}px`;
                aura.style.width = `${s}px`;
                aura.style.height = `${s}px`;
                aura.style.background = `radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,200,120,0.06))`;
                aura.style.opacity = '0';
                aura.style.transform = 'translate(-50%,-50%) scale(0.3)';
                wrap.appendChild(aura);
                auras.push(aura);
            }

            // add ogre inner prep
            const ogreInner = ogre.querySelector('.ogre-inner');
            if (ogreInner) ogreInner.classList.add('ogre-prepare');

            // spam powerup (heavy)
            const clones = spamAudioClones(powerUpSound, Math.max(6, Math.round(duration/100)), Math.max(60, Math.round(duration/12)), 1.0, true);

            // animate particles → inward
            const particleAnims = particles.map((el, idx) => {
                const delayMs = Math.round((idx / particles.length) * (duration * 0.7)) + Math.round(Math.random()*120 - 60);
                const tx = ogreCenterX + (Math.random()*12 - 6);
                const ty = ogreCenterY + (Math.random()*12 - 6);
                const anim = el.animate([
                    { opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' },
                    { opacity: 1, transform: `translate(${tx - parseFloat(el.style.left)}px, ${ty - parseFloat(el.style.top)}px) scale(1.2)` },
                    { opacity: 0.95, transform: `translate(${tx - parseFloat(el.style.left)}px, ${ty - parseFloat(el.style.top)}px) scale(0.18)` }
                ], { duration: Math.max(260, duration - delayMs*0.4), easing: 'cubic-bezier(.16,.9,.2,1)', delay: Math.max(0, delayMs), fill: 'forwards' });
                return new Promise(res => { anim.onfinish = anim.oncancel = res; });
            });

            // animate rings
            const ringPromises = rings.map((ring, idx) => {
                const startDelay = idx * Math.round(duration * 0.06) + Math.random()*120;
                const anim = ring.animate([
                    { transform: 'translate(-50%,-50%) scale(0.25)', opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0.98 },
                    { transform: 'translate(-50%,-50%) scale(0.7)', opacity: 0 }
                ], { duration: Math.max(320, duration - idx*60), easing: 'cubic-bezier(.22,.9,.2,1)', delay: startDelay, fill: 'forwards' });
                return new Promise(res => { anim.onfinish = anim.oncancel = res; });
            });

            // aura animations
            const auraPromises = auras.map((aura, idx) => {
                const startDelay = idx * 60 + Math.random()*80;
                const anim = aura.animate([
                    { transform: 'translate(-50%,-50%) scale(0.32)', opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0.9 },
                    { transform: 'translate(-50%,-50%) scale(0.85)', opacity: 0.0 }
                ], { duration: Math.max(420, duration - idx*40), easing: 'cubic-bezier(.2,.9,.2,1)', delay: startDelay, fill: 'forwards' });
                return new Promise(res => { anim.onfinish = anim.oncancel = res; });
            });

            Promise.all([...particleAnims, ...ringPromises, ...auraPromises]).then(() => {
                try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch(e){}
                if (ogreInner) ogreInner.classList.remove('ogre-prepare');
                clones.cancel();
                resolve();
            }).catch(() => {
                try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch(e){}
                if (ogreInner) ogreInner.classList.remove('ogre-prepare');
                clones.cancel(); resolve();
            });
        });
    }

    // pre-beam flourish + main vertical beam (keeps earlier behavior)
    async function fireBeam({duration = 360, thickness = 10, color = '#ff4444', intensity = 1.0} = {}) {
        const flare = document.createElement('div');
        flare.className = 'prebeam-flare';
        const flareSize = 36 + Math.random()*18;
        flare.style.left = `${ogreCenterX}px`;
        flare.style.top = `${ogreCenterY}px`;
        flare.style.width = `${flareSize}px`;
        flare.style.height = `${flareSize}px`;
        flare.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.98), rgba(255,220,130,0.18))`;
        quizContent.appendChild(flare);

        const pf = flare.animate([
            { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 1 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.72 }
        ], { duration: Math.max(140, duration * 0.28), easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });

        try { const tiny = powerUpSound.cloneNode(); tiny.volume = 0.24; tiny.currentTime = 0; tiny.play().catch(()=>{}); } catch(e){}

        await new Promise(res => { pf.onfinish = pf.oncancel = res; });
        try { if (flare.parentNode) flare.parentNode.removeChild(flare); } catch(e){}

        return new Promise((resolve) => {
            const beam = document.createElement('div');
            beam.className = 'ogre-beam';
            beam.style.position = 'absolute';
            beam.style.left = `${ogreCenterX - thickness/2}px`;
            beam.style.top = '0';
            beam.style.width = `${thickness}px`;
            beam.style.height = `100%`;
            beam.style.pointerEvents = 'none';
            beam.style.zIndex = '950';
            beam.style.transformOrigin = `50% 0%`;
            beam.style.transform = 'scaleY(0)';
            beam.style.opacity = '0.0';
            beam.style.background = `linear-gradient(to bottom, ${color}, ${lighten(color, 0.25)})`;
            beam.style.boxShadow = `0 0 ${12 * intensity}px ${4 * intensity}px ${color}`;
            beam.style.borderRadius = `${thickness/2}px`;

            quizContent.appendChild(beam);
            ogre.classList.add('ogre-red');

            try { beamSound.currentTime = 0; beamSound.play().catch(()=>{}); } catch(e) { try { missSound.currentTime = 0; missSound.play().catch(()=>{}); } catch(e){} }

            const anim = beam.animate([
                { transform: 'scaleY(0)', opacity: 0 },
                { transform: 'scaleY(1)', opacity: 1 },
                { transform: 'scaleY(1)', opacity: 0.9 },
                { transform: 'scaleY(0)', opacity: 0 }
            ], { duration: duration, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });

            anim.onfinish = async () => {
                // hit detection & ship hit visuals
                try {
                    const ship = document.getElementById('shooter-ship');
                    if (ship) {
                        const shipRect = ship.getBoundingClientRect();
                        const shipCenterX = shipRect.left + shipRect.width/2 - containerRect.left;
                        const dist = Math.abs(shipCenterX - ogreCenterX);
                        const hitThreshold = Math.max(shipRect.width/2, thickness * 1.1);
                        if (dist <= hitThreshold) {
                            try { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); } catch(e){}
                            ship.classList.add('ship-hit');
                            createShipSparks(shipRect, 20 + Math.round(Math.random()*20));
                            setTimeout(() => ship.classList.remove('ship-hit'), 900);
                        } else {
                            try { missSound.currentTime = 0; missSound.play().catch(()=>{}); } catch(e){}
                        }
                    }
                } catch(e){}
                try { if (beam.parentNode) beam.parentNode.removeChild(beam); } catch(e){}
                ogre.classList.remove('ogre-red');
                resolve();
            };
            anim.oncancel = () => { try { if (beam.parentNode) beam.parentNode.removeChild(beam); } catch(e){}; ogre.classList.remove('ogre-red'); resolve(); };
        });
    }

    // Helper: create ship sparks (bigger)
    function createShipSparks(shipRect, sparkCount = 10) {
        const sparksWrap = document.createElement('div');
        sparksWrap.style.position = 'absolute';
        sparksWrap.style.left = '0'; sparksWrap.style.top = '0';
        sparksWrap.style.width = '100%'; sparksWrap.style.height = '100%';
        sparksWrap.style.pointerEvents = 'none'; sparksWrap.style.zIndex = '1005';
        document.body.appendChild(sparksWrap);

        const shipCenterX = shipRect.left + shipRect.width/2;
        const shipCenterY = shipRect.top + shipRect.height/2;

        const promises = [];
        for (let i = 0; i < sparkCount; i++) {
            const s = document.createElement('div');
            const size = 2 + Math.random()*6;
            s.style.position = 'absolute';
            s.style.left = `${shipCenterX + (Math.random()*40 - 20)}px`;
            s.style.top = `${shipCenterY + (Math.random()*40 - 20)}px`;
            s.style.width = `${size}px`; s.style.height = `${size}px`;
            s.style.background = ['#fff6d0','#ffd28a','#fff5f0'][Math.floor(Math.random()*3)];
            s.style.borderRadius = '1px'; s.style.zIndex = '1006'; s.style.pointerEvents = 'none';
            sparksWrap.appendChild(s);

            promises.push(new Promise(res => {
                const angle = Math.random() * Math.PI * 2;
                const speed = 80 + Math.random()*320;
                const dx = Math.cos(angle) * speed;
                const dy = Math.sin(angle) * speed;
                const rot = Math.random()*720 - 360;
                const dur = 600 + Math.random()*900;
                const a = s.animate([
                    { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
                    { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
                ], { duration: dur, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'forwards' });
                a.onfinish = a.oncancel = () => { try{ s.remove(); }catch(e){}; res(); };
            }));
        }
        Promise.all(promises).then(() => { try{ sparksWrap.remove(); }catch(e){} });
    }

    function lighten(hex, amt=0.2) {
        try {
            hex = hex.replace('#','');
            const r = Math.min(255, Math.round(parseInt(hex.substring(0,2),16) + 255*amt));
            const g = Math.min(255, Math.round(parseInt(hex.substring(2,4),16) + 255*amt));
            const b = Math.min(255, Math.round(parseInt(hex.substring(4,6),16) + 255*amt));
            return `rgb(${r},${g},${b})`;
        } catch(e) { return '#fff'; }
    }

    // FINAL MEGA BLAST: (kept but not used at the very end here)
    async function finalMegaBlast() {
        // (kept for reference if you re-enable it)
    }

    // Sequence of multiple ogre shots, then big charge & screenwide flash/explosion
    await chargeAndPlayPowerUpBIGGER(560, 20);
    await fireBeam({duration: 520, thickness: 12, color: '#ff5544', intensity: 1.3});
    await delay(420);

    await chargeAndPlayPowerUpBIGGER(520, 18);
    await fireBeam({duration: 520, thickness: 12, color: '#ff5544', intensity: 1.3});
    await delay(380);

    await chargeAndPlayPowerUpBIGGER(320, 14);
    await fireBeam({duration: 260, thickness: 10, color: '#ff6666', intensity: 1.0});
    await delay(160);

    await chargeAndPlayPowerUpBIGGER(280, 12);
    await fireBeam({duration: 220, thickness: 10, color: '#ff6666', intensity: 1.1});
    await delay(140);

    await chargeAndPlayPowerUpBIGGER(240, 10);
    await fireBeam({duration: 200, thickness: 10, color: '#ff7777', intensity: 1.2});
    await delay(260);

    // Keep the big charge and auras by calling only the charge function:
    await chargeAndPlayPowerUpBIGGER(1400, 60);

    // final flash + pixel explosion (explosion sound is played inside flashAndExplode)
    await flashAndExplode();
}

// Create a full-screen white flash and pixel explosion (unchanged but called after mega-blast)
async function flashAndExplode() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.left = '0'; flash.style.top = '0';
    flash.style.width = '100vw'; flash.style.height = '100vh';
    flash.style.zIndex = '1200';
    flash.style.background = '#fff'; flash.style.opacity = '0'; flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);

    try { explosionSound.currentTime = 0; explosionSound.play().catch(()=>{}); } catch(e){}

    await new Promise(res => {
        const anim = flash.animate([{opacity:0},{opacity:1}], { duration: 180, easing: 'ease-out', fill:'forwards' });
        anim.onfinish = res; anim.oncancel = res;
    });

    const pxCount = Math.min(1200, Math.floor((window.innerWidth * window.innerHeight) / 800));
    const pixels = document.createElement('div');
    pixels.style.position = 'fixed'; pixels.style.left = '0'; pixels.style.top = '0';
    pixels.style.width = '100vw'; pixels.style.height = '100vh'; pixels.style.zIndex = '1250'; pixels.style.pointerEvents = 'none';
    document.body.appendChild(pixels);

    const centerX = window.innerWidth/2, centerY = window.innerHeight/2;
    const fragments = [];
    for (let i = 0; i < pxCount; i++) {
        const size = 2 + Math.random() * 8;
        const d = document.createElement('div');
        d.style.position = 'absolute';
        d.style.left = `${centerX + (Math.random()*120 - 60)}px`;
        d.style.top = `${centerY + (Math.random()*120 - 60)}px`;
        d.style.width = `${size}px`; d.style.height = `${size}px`;
        d.style.background = randomExplosionColor();
        d.style.opacity = '1'; d.style.borderRadius = '1px'; d.style.filter='blur(0.2px)';
        pixels.appendChild(d); fragments.push(d);
    }

    const promises = fragments.map(el => new Promise(res => {
        const angle = Math.random()*Math.PI*2;
        const speed = 120 + Math.random()*920;
        const dx = Math.cos(angle)*speed, dy = Math.sin(angle)*speed;
        const rot = Math.random()*720 - 360;
        const duration = 700 + Math.random()*1200;
        const anim = el.animate([
            { transform:'translate(0,0) rotate(0deg)', opacity:1 },
            { transform:`translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity:0 }
        ], { duration, easing:'cubic-bezier(.2,.6,.2,1)', fill:'forwards' });
        anim.onfinish = anim.oncancel = res;
    }));

    setTimeout(() => {
        try { flash.style.transition = 'opacity 420ms ease-out'; flash.style.opacity = '0'; } catch(e){}
        setTimeout(() => { try { if (flash.parentNode) flash.parentNode.removeChild(flash); } catch(e){} }, 520);
    }, 220);

    await Promise.all(promises);
    try { if (pixels.parentNode) pixels.parentNode.removeChild(pixels); } catch(e){}
    await delay(240);

    isAnimating = false;
    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = false);
}

function randomExplosionColor() {
    const colors = ['#fff0b8', '#ffd88a', '#ffb36b', '#ff7a66', '#ffaaff', '#fff3f0', '#ffd4c4', '#fff7e6'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// =======================
// PERFECT-SCORE VICTORY: ship volleys + finisher + ogre explosion
// =======================
async function runOgreDefeat() {
    isAnimating = true;
    optionsContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    cleanupProjectile();

    const ogre = document.getElementById('ogre-character');
    const ship = document.getElementById('shooter-ship');
    if (!ogre || !ship || !quizContent) { isAnimating = false; return; }

    const containerRect = quizContent.getBoundingClientRect();
    const ogreRect = ogre.getBoundingClientRect();
    const shipRect = ship.getBoundingClientRect();

    const ogreCenterX = ogreRect.left + ogreRect.width / 2 - containerRect.left;
    const ogreCenterY = ogreRect.top + ogreRect.height / 2 - containerRect.top;
    const shipCenterX = shipRect.left + shipRect.width / 2 - containerRect.left;
    const shipCenterY = shipRect.top + shipRect.height / 2 - containerRect.top;

    const volleyCount = Math.max(3, Math.min(6, questions.length)); // 3–6 hits
    const shots = [];

    // Small muzzle flash helper
    function muzzleFlash(x, y) {
        const flare = document.createElement('div');
        flare.style.position = 'absolute';
        flare.style.left = `${x}px`;
        flare.style.top = `${y}px`;
        flare.style.width = '26px';
        flare.style.height = '26px';
        flare.style.borderRadius = '50%';
        flare.style.background = 'radial-gradient(circle, rgba(255,255,200,1), rgba(255,200,80,0.2))';
        flare.style.mixBlendMode = 'screen';
        flare.style.pointerEvents = 'none';
        flare.style.zIndex = '1002';
        quizContent.appendChild(flare);
        const a = flare.animate([
            { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1 },
            { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 }
        ], { duration: 220, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });
        a.onfinish = a.oncancel = () => { try { flare.remove(); } catch(e){} };
    }

    // Volley of quick shots
    for (let i = 0; i < volleyCount; i++) {
        await delay(120 + Math.random()*120);

        const p = createProjectileElement();
        p.style.left = `${shipCenterX}px`;
        p.style.top = `${shipCenterY}px`;
        quizContent.appendChild(p);

        // slight spread around ogre center
        const spread = 22;
        const tx = ogreCenterX + (Math.random()*spread - spread/2);
        const ty = ogreCenterY + (Math.random()*spread - spread/2);

        try { shootSound.currentTime = 0; shootSound.play().catch(()=>{}); } catch(e){}
        muzzleFlash(shipCenterX, shipCenterY);
        ship.classList.add('shooting');
        setTimeout(() => ship.classList.remove('shooting'), 120);

        const anim = p.animate([
            { transform: 'translate(-50%, -50%)' },
            { transform: `translate(${tx - shipCenterX}px, ${ty - shipCenterY}px) translate(-50%, -50%)` }
        ], { duration: 260, easing: 'linear', fill: 'forwards' });

        shots.push(new Promise(res => {
            anim.onfinish = () => {
                try { p.remove(); } catch(e){}
                // Ogre hit flash + sparks
                ogre.classList.add('ogre-red','ogre-hit');
                try { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); } catch(e){}
                createOgreSparks(ogreRect, 10 + Math.round(Math.random()*8), containerRect);
                setTimeout(() => ogre.classList.remove('ogre-red','ogre-hit'), 120);
                res();
            };
            anim.oncancel = () => { try { p.remove(); } catch(e){}; res(); };
        }));
    }

    await Promise.all(shots);
    await delay(240);

    // Finisher: thicker projectile that detonates
    const fin = document.createElement('div');
    fin.style.position = 'absolute';
    fin.style.left = `${shipCenterX}px`;
    fin.style.top = `${shipCenterY}px`;
    fin.style.width = '10px';
    fin.style.height = '34px';
    fin.style.borderRadius = '5px';
    fin.style.background = 'linear-gradient(to top, #fff2a0, #ffe066)';
    fin.style.boxShadow = '0 0 16px 6px rgba(255,230,100,0.9)';
    fin.style.transform = 'translate(-50%,-50%)';
    fin.style.zIndex = '1003';
    quizContent.appendChild(fin);

    try { shootSound.currentTime = 0; shootSound.play().catch(()=>{}); } catch(e){}
    const finAnim = fin.animate([
        { transform: 'translate(-50%, -50%) scale(1)' },
        { transform: `translate(${ogreCenterX - shipCenterX}px, ${ogreCenterY - shipCenterY}px) translate(-50%, -50%) scale(1.1)` }
    ], { duration: 300, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });

    await new Promise(res => { finAnim.onfinish = finAnim.oncancel = res; });
    try { fin.remove(); } catch(e){}

    // Big hit + explosion at ogre
    try { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); } catch(e){}
    ogre.classList.add('ogre-red','ogre-hit');

    await ogreDeathExplosionAt(ogreCenterX, ogreCenterY, containerRect);

    // REMOVE this line so ogre stays visible:
    // try { ogre.remove(); } catch(e){}

    // Instead, show the white flash and pixel explosion (same as ogre finale)
    await flashAndExplode();

    isAnimating = false;
}

// small helper: sparks at ogre on hit
function createOgreSparks(ogreRect, count = 12, containerRect = null) {
    const wrap = document.createElement('div');
    wrap.style.position = 'absolute';
    wrap.style.left = '0'; wrap.style.top = '0';
    wrap.style.width = '100%'; wrap.style.height = '100%';
    wrap.style.pointerEvents = 'none'; wrap.style.zIndex = '1004';
    quizContent.appendChild(wrap);

    const cx = (ogreRect.left + ogreRect.width/2) - (containerRect ? containerRect.left : quizContent.getBoundingClientRect().left);
    const cy = (ogreRect.top + ogreRect.height/2) - (containerRect ? containerRect.top : quizContent.getBoundingClientRect().top);

    const proms = [];
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        const size = 2 + Math.random()*4;
        s.style.position = 'absolute';
        s.style.left = `${cx + (Math.random()*24 - 12)}px`;
        s.style.top = `${cy + (Math.random()*24 - 12)}px`;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        s.style.background = ['#fff6d0','#ffd28a','#fff5f0'][Math.floor(Math.random()*3)];
        s.style.borderRadius = '1px';
        s.style.pointerEvents = 'none';
        wrap.appendChild(s);

        proms.push(new Promise(res => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random()*200;
            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed;
            const dur = 480 + Math.random()*520;
            const a = s.animate([
                { transform: 'translate(0,0)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }
            ], { duration: dur, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'forwards' });
            a.onfinish = a.oncancel = () => { try { s.remove(); } catch(e){}; res(); };
        }));
    }
    Promise.all(proms).then(() => { try { wrap.remove(); } catch(e){}; });
}

// localized ogre death explosion (with shake)
async function ogreDeathExplosionAt(x, y, containerRect) {
    // screen shake
    try {
        const anim = quizContent.animate(
            [{ transform:'translate(0,0)' },{ transform:'translate(10px,-10px)' },{ transform:'translate(-8px,6px)' },{ transform:'translate(0,0)' }],
            { duration: 500, easing: 'cubic-bezier(.25,.5,.25,1)' }
        );
        anim.onfinish = anim.oncancel = () => {};
    } catch(e){}

    // flash ring
    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.width = `40px`;
    ring.style.height = `40px`;
    ring.style.borderRadius = '50%';
    ring.style.background = 'radial-gradient(circle, rgba(255,255,255,0.98), rgba(255,160,60,0.4), rgba(255,160,60,0.0))';
    ring.style.transform = 'translate(-50%,-50%) scale(0.2)';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = '1100';
    quizContent.appendChild(ring);

    try { explosionSound.currentTime = 0; explosionSound.play().catch(()=>{}); } catch(e){}

    const rAnim = ring.animate([
        { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(3.2)', opacity: 0 }
    ], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    rAnim.onfinish = rAnim.oncancel = () => { try { ring.remove(); } catch(e){} };

    // debris pixels
    const debrisWrap = document.createElement('div');
    debrisWrap.style.position = 'absolute';
    debrisWrap.style.left = '0'; debrisWrap.style.top = '0';
    debrisWrap.style.width = '100%'; debrisWrap.style.height = '100%';
    debrisWrap.style.pointerEvents = 'none';
    debrisWrap.style.zIndex = '1110';
    quizContent.appendChild(debrisWrap);

    const count = 180;
    const frags = [];
    for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        const size = 2 + Math.random()*5;
        d.style.position = 'absolute';
        d.style.left = `${x + (Math.random()*20 - 10)}px`;
        d.style.top = `${y + (Math.random()*20 - 10)}px`;
        d.style.width = `${size}px`;
        d.style.height = `${size}px`;
        d.style.background = randomExplosionColor();
        d.style.borderRadius = '1px';
        d.style.pointerEvents = 'none';
        d.style.transform = 'translate(-50%,-50%)';
        debrisWrap.appendChild(d);
        frags.push(d);
    }

    const promises = frags.map(el => new Promise(res => {
        const angle = Math.random()*Math.PI*2;
        const speed = 120 + Math.random()*520;
        const dx = Math.cos(angle)*speed, dy = Math.sin(angle)*speed;
        const rot = Math.random()*720 - 360;
        const duration = 600 + Math.random()*900;
        const a = el.animate([
            { transform:'translate(-50%,-50%) rotate(0deg)', opacity:1 },
            { transform:`translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity:0 }
        ], { duration, easing:'cubic-bezier(.2,.6,.2,1)', fill:'forwards' });
        a.onfinish = a.oncancel = () => { try { el.remove(); } catch(e){}; res(); };
    }));

    await Promise.all(promises);
    try { debrisWrap.remove(); } catch(e){}
    await delay(200);
}

// =======================
// UI events & rest
// =======================
playBtn.addEventListener('click', () => {
    startMenu.style.display = 'none'; quizContent.style.display = 'block'; resultsContainer.style.display = 'none';
    currentQuestionIndex = 0; score = 0; ogreHealth = ogreMaxHealth;
    scoreText.textContent = `Score: 0`; updateOgreHealthBar(); loadQuestion();
    if (bgMusic) { bgMusic.volume = 0.22; bgMusic.loop = true; bgMusic.currentTime = 0; bgMusic.play().catch(()=>{}); }
});

retryBtn.addEventListener('click', () => {
    startMenu.style.display = 'none'; quizContent.style.display = 'block'; resultsContainer.style.display = 'none';
    currentQuestionIndex = 0; score = 0; ogreHealth = ogreMaxHealth;
    scoreText.textContent = `Score: 0`; updateOgreHealthBar(); loadQuestion();
});

if (bgMusic) { bgMusic.volume = 0.22; bgMusic.loop = true; bgMusic.play().catch(()=>{}); }

// Space ambiance (unchanged)
function createSpaceAmbiance() {
    const bg = document.getElementById('space-bg');
    if (!bg) return;
    bg.innerHTML = '';

    for (let i = 0; i < 12; i++) {
        const asteroid = document.createElement('img');
        asteroid.src = 'asteroids.png';
        asteroid.style.position = 'absolute';
        asteroid.style.width = `${48 + Math.random()*64}px`;
        asteroid.style.height = 'auto';
        asteroid.style.top = `${Math.random()*90}vh`;
        asteroid.style.left = `${Math.random()*100}vw`;
        asteroid.style.opacity = `${0.12 + Math.random()*0.18}`;
        asteroid.style.filter = 'blur(0.5px) drop-shadow(0 0 12px #222)';
        asteroid.style.zIndex = '0';
        asteroid.style.pointerEvents = 'none';
        asteroid.style.transition = 'transform 2s linear';
        bg.appendChild(asteroid);

        let angle = Math.random()*360;
        setInterval(() => {
            angle += Math.random()*30-15;
            asteroid.style.transform = `translateY(${Math.random()*60-30}px) translateX(${Math.random()*60-30}px) rotate(${angle}deg)`;
        }, 3000 + Math.random()*2000);
    }

    for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.style.position = 'absolute';
        star.style.width = `${1 + Math.random()*3}px`;
        star.style.height = star.style.width;
        star.style.borderRadius = '50%';
        star.style.background = `rgba(255,255,255,${0.15 + Math.random()*0.5})`;
        star.style.top = `${Math.random()*100}vh`;
        star.style.left = `${Math.random()*100}vw`;
        star.style.zIndex = '0';
        star.style.pointerEvents = 'none';
        bg.appendChild(star);

        setInterval(() => {
            star.style.opacity = `${0.15 + Math.random()*0.7}`;
            let driftX = Math.random()*2-1;
            let driftY = Math.random()*2-1;
            star.style.top = `calc(${star.style.top} + ${driftY}px)`;
            star.style.left = `calc(${star.style.left} + ${driftX}px)`;
        }, 2000 + Math.random()*2000);
    }

    setInterval(() => {
        const shootingStar = document.createElement('div');
        shootingStar.style.position = 'absolute';
        shootingStar.style.width = '2px';
        shootingStar.style.height = '80px';
        shootingStar.style.background = 'linear-gradient(180deg, #fff 0%, #fff0 100%)';
        shootingStar.style.top = `${Math.random()*80}vh`;
        shootingStar.style.left = `${Math.random()*100}vw`;
        shootingStar.style.opacity = '0.7';
        shootingStar.style.zIndex = '0';
        shootingStar.style.transform = 'rotate(-20deg)';
        shootingStar.style.pointerEvents = 'none';
        bg.appendChild(shootingStar);

        shootingStar.animate([
            { opacity: 0.7, top: shootingStar.style.top, left: shootingStar.style.left },
            { opacity: 0, top: `${parseFloat(shootingStar.style.top)+30}vh`, left: `${parseFloat(shootingStar.style.left)+10}vw` }
        ], {
            duration: 1200,
            easing: 'ease-out'
        });

        setTimeout(() => bg.removeChild(shootingStar), 1200);
    }, 4000 + Math.random()*4000);
}
createSpaceAmbiance();

// initial load
loadQuestion();
