const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let lines = [];
// Create a grid for the 3D surface
// Adjust density based on screen width
const isMobile = window.innerWidth <= 768;
const gridResolutionX = isMobile ? 35 : 55; // Much more dense for rounder, smoother curves on desktop
const gridResolutionZ = isMobile ? 35 : 55;
const numParticles = gridResolutionX * gridResolutionZ;

// Mouse interaction for subtle parallax
const mouse = {
    x: null,
    y: null,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0
};

// 3D camera properties
const camera = {
    z: 800,
    fov: 400
};

window.addEventListener('mousemove', (e) => {
    // Normalize mouse coords to -1 to 1 based on center of screen
    mouse.targetX = (e.clientX - width / 2) / (width / 2);
    mouse.targetY = -(e.clientY - height / 2) / (height / 2);

    // For original repulsion logic (though we'll use it less now)
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mouseout', () => {
    mouse.targetX = 0;
    mouse.targetY = 0;
    mouse.x = null;
    mouse.y = null;
});

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initParticles();
}

window.addEventListener('resize', resizeCanvas);

// Color map "magma"
const magmaColors = [
    '#000004', '#140e36', '#3b0f70', '#641a80',
    '#8c2981', '#b73779', '#de4968', '#f7705c',
    '#fe9f6d', '#fecf92', '#fcfdbf'
];

// Helper to get rgba string with opacity
function getMagmaColorRGBA(value, alpha = 1) {
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    const index = Math.floor(value * (magmaColors.length - 1));
    const hex = magmaColors[index];

    // Convert hex to rgb
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

class Particle {
    constructor(gridX, gridZ) {
        // Spread the grid out significantly to fill space
        // With higher density, slightly reduce spread to keep scale manageable but still large
        const spreadX = 45;
        const spreadZ = 45;
        this.baseX = (gridX - gridResolutionX / 2) * spreadX;
        this.baseZ = (gridZ - gridResolutionZ / 2) * spreadZ;

        // Amplitude and frequency for the center ripples
        // Increased amplitude and decreased frequency to make ripples physically bigger
        this.amplitude = 300;
        this.freq = 0.0075; // Lower frequency means wider rings

        // Organic noise: a fixed offset for each particle based on its position
        // Reduced from 1.5 to 0.2 to prevent breaking the cohesive rings while retaining a subtle natural wobble
        this.noiseOffset = (Math.sin(this.baseX * 0.05) * Math.cos(this.baseZ * 0.05)) * 0.2;

        // Current 3D position 
        this.x3d = this.baseX;
        this.y3d = 0; // will be calculated in update
        this.z3d = this.baseZ;

        // This will be calculated in update() so it can move with mouse
        this.distance = 0;

        // Visual properties
        // Randomize the sizes of the points for a more varied, natural feel (0.5 to 6.0 as requested)
        this.size = 0.5 + Math.random() * 5.5;

        this.colorVal = 0;
        this.color = getMagmaColorRGBA(0);

        // 2D projection coordinates
        this.x2d = 0;
        this.y2d = 0;
        this.scale = 0;

        // Grid indices for line drawing
        this.i = gridX;
        this.j = gridZ;
    }

    update(time) {
        // Subtle mouse parallax effect
        const maxRotationX = 0.2; // radians
        const maxRotationY = 0.2;

        mouse.currentX += (mouse.targetX - mouse.currentX) * 0.05;
        mouse.currentY += (mouse.targetY - mouse.currentY) * 0.05;

        // Origin of the ripple follows the mouse slightly
        const rippleCenterX = mouse.currentX * 500;
        const rippleCenterZ = mouse.currentY * 500;

        // Update the distance to the dynamic center
        const dx = this.baseX - rippleCenterX;
        const dz = this.baseZ - rippleCenterZ;
        this.distance = Math.sqrt(dx * dx + dz * dz);

        // Water ripple animation moving outwards from the center
        const timeOffset = time * 0.0015;

        // 1. Increasing spacing outwards: 
        // We use Math.pow to stretch the wave out at the edges, but toned down from 0.85 to 0.93 
        // so the rings remain distinctly cohesive and readable as a water ripple.
        const stretchedDistance = Math.pow(this.distance, 0.93) * 1.5;

        // 2. Strong fading of amplitude outwards
        // We want tight, tall peaks in the center that fade quickly into the background plane
        // Expand decay radius since the ripple is bigger now
        const decay = Math.max(0, 1 - Math.pow(this.distance / 1600, 1.5));

        // 3. Mathematical Ripple with Noise
        // sin(stretchedDistance * freq - time + noise) * amplitude * decay
        this.y3d = Math.sin(stretchedDistance * this.freq - timeOffset + this.noiseOffset) * this.amplitude * decay;

        // Update color based on ripple height AND decay.
        // As it decays outwards, it will flatten out and the color will merge with the dark background.
        // Normalize y3d from [-amplitude, amplitude] to [0.2, 0.9], but scale back to 0.1 at edges
        let normalizedHeight = (this.y3d + this.amplitude) / (this.amplitude * 2);

        // 4. Fade color outwards to merge with background (which is dark magma / black)
        // By multiplying by decay, the colorVal drops towards 0 (dark purple/black) at the edges
        this.colorVal = Math.max(0, Math.min(1, normalizedHeight * (0.3 + 0.7 * decay)));

        // Look down to see the ripple surface
        let rotX = mouse.currentY * maxRotationX;
        let rotX_base = 1.05; // Look more top down to hide back edges behind depth fog
        rotX += rotX_base;

        let rotY = mouse.currentX * maxRotationY;

        let y1 = this.y3d * Math.cos(rotX) - this.baseZ * Math.sin(rotX);
        let z1 = this.y3d * Math.sin(rotX) + this.baseZ * Math.cos(rotX);

        let x2 = this.baseX * Math.cos(rotY) + z1 * Math.sin(rotY);
        let z2 = -this.baseX * Math.sin(rotY) + z1 * Math.cos(rotY);
        let y2 = y1;

        // 3D to 2D Projection
        const sceneZOffset = 800; // pushed further back
        const finalZ = z2 + sceneZOffset;

        this.scale = camera.fov / (camera.fov + finalZ);
        this.x2d = x2 * this.scale + width / 2;
        // Shifted further up to match the newly raised `.content` hero text
        this.y2d = y2 * this.scale + height / 2 + 10;

        // Update color alpha based on depth AND distance to center (hides rectangular grid bounds)
        const depthAlpha = Math.max(0, Math.min(1, this.scale * 1.5));
        const finalAlpha = depthAlpha * decay;
        this.color = getMagmaColorRGBA(this.colorVal, finalAlpha);
    }

    draw() {
        if (this.scale > 0 && this.x2d > -100 && this.x2d < width + 100 && this.y2d > -100 && this.y2d < height + 100) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x2d, this.y2d, this.size * this.scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function initParticles() {
    particles = [];

    // Create a 2D array to easily form grid lines
    let grid = [];

    for (let i = 0; i < gridResolutionX; i++) {
        let row = [];
        for (let j = 0; j < gridResolutionZ; j++) {
            let p = new Particle(i, j);
            particles.push(p);
            row.push(p);
        }
        grid.push(row);
    }

    // Generate line connections (horizontal and vertical)
    lines = [];
    for (let i = 0; i < gridResolutionX; i++) {
        for (let j = 0; j < gridResolutionZ; j++) {
            // Since we reduced the grid size, connect all immediate neighbors

            // Connect to right neighbor
            if (i < gridResolutionX - 1) {
                lines.push([grid[i][j], grid[i + 1][j]]);
            }
            // Connect to bottom neighbor
            if (j < gridResolutionZ - 1) {
                lines.push([grid[i][j], grid[i][j + 1]]);
            }
        }
    }
}

function animate(time) {
    ctx.clearRect(0, 0, width, height);

    // Update all particles
    particles.forEach(p => p.update(time));

    // Draw lines first so they are underneath points
    ctx.lineWidth = 1.2; // Slightly thicker lines for the scarce grid
    lines.forEach(pair => {
        const p1 = pair[0];
        const p2 = pair[1];

        // Only draw if both points are somewhat visible and in front of camera
        if (p1.scale > 0 && p2.scale > 0) {
            // Distance check 
            const dx = p1.x2d - p2.x2d;
            const dy = p1.y2d - p2.y2d;
            const distSq = dx * dx + dy * dy;

            if (distSq < 45000) {
                ctx.beginPath();
                ctx.moveTo(p1.x2d, p1.y2d);

                // Create a beautiful drape curve
                const ctrlX = (p1.x2d + p2.x2d) / 2;
                const ctrlY = (p1.y2d + p2.y2d) / 2 + 35 * Math.min(p1.scale, p2.scale);

                ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x2d, p2.y2d);

                const avgColorVal = (p1.colorVal + p2.colorVal) / 2;

                // Fade out edges smoothly
                const lineDecay = Math.max(0, 1 - (Math.max(p1.distance, p2.distance) / 1200));
                const alpha = Math.max(0, avgColorVal * 0.9 * Math.min(p1.scale, p2.scale) * lineDecay);
                ctx.strokeStyle = getMagmaColorRGBA(avgColorVal * 0.9, alpha);
                ctx.stroke();
            }
        }
    });

    // Draw points on top
    particles.forEach(p => p.draw());

    requestAnimationFrame(animate);
}

resizeCanvas();
requestAnimationFrame(animate);

// --- Mobile Navigation Toggle ---
const mobileBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
        mobileBtn.classList.toggle('open');
        navLinks.classList.toggle('active');
    });
}

// --- Elegant Typewriter Effect ---
const typewriterTextElement = document.getElementById('typewriter-text');
const fullText = "The next generation AI companion<br>for X-ray absorption spectroscopy.";

// Parse text to handle HTML tags like <br> natively
const typeArray = [];
let inTag = false;
let currentTagStr = "";

for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    if (char === '<') {
        inTag = true;
        currentTagStr = '<';
    } else if (inTag) {
        currentTagStr += char;
        if (char === '>') {
            inTag = false;
            typeArray.push(currentTagStr);
            currentTagStr = "";
        }
    } else {
        typeArray.push(char);
    }
}

let currentTypeIndex = 0;
function typeWriterEffect() {
    if (currentTypeIndex < typeArray.length) {
        typewriterTextElement.innerHTML += typeArray[currentTypeIndex];
        currentTypeIndex++;

        // Typing speed: 0 delay for tags, fast random delay for chars to feel organic
        const delay = typeArray[currentTypeIndex - 1].startsWith('<') ? 0 : 20 + Math.random() * 30;
        setTimeout(typeWriterEffect, delay);
    }
}

// Start the typing effect shortly after the logo fades in
setTimeout(typeWriterEffect, 600);

// --- Scroll Spy & Video Autoplay ---
const dotNav = document.querySelector('.dot-nav');
const dotItems = document.querySelectorAll('.dot-item');
const demoSections = document.querySelectorAll('.demo-section');
const demoVideos = document.querySelectorAll('.demo-video');
const mobileVideoQuery = window.matchMedia('(max-width: 900px)');

function syncVideoSources() {
    demoVideos.forEach(video => {
        const source = video.querySelector('source');
        if (!source) return;

        if (!video.dataset.desktopSrc) {
            video.dataset.desktopSrc = source.getAttribute('src') || '';
        }

        if (!video.dataset.desktopPoster) {
            video.dataset.desktopPoster = video.getAttribute('poster') || '';
        }

        const targetSrc = mobileVideoQuery.matches && video.dataset.mobileSrc
            ? video.dataset.mobileSrc
            : video.dataset.desktopSrc;
        const targetPoster = mobileVideoQuery.matches && video.dataset.mobilePoster
            ? video.dataset.mobilePoster
            : video.dataset.desktopPoster;

        if (targetPoster) {
            video.setAttribute('poster', targetPoster);
        }

        if (targetSrc && source.getAttribute('src') !== targetSrc) {
            source.setAttribute('src', targetSrc);
            video.load();
        }
    });
}

function attemptVideoPlayback(video) {
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise
            .then(() => {
                video.controls = false;
            })
            .catch((error) => {
                console.log('Auto-play prevented', error);
                video.controls = true;
            });
    }
}

function replayVisibleVideos() {
    demoSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;

        if (isVisible) {
            attemptVideoPlayback(section.querySelector('video'));
        }
    });
}

syncVideoSources();
demoVideos.forEach(video => {
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
});

window.addEventListener('touchstart', replayVisibleVideos, { passive: true });
window.addEventListener('pointerdown', replayVisibleVideos, { passive: true });
const handleVideoViewportChange = () => {
    syncVideoSources();
    replayVisibleVideos();
};

if (typeof mobileVideoQuery.addEventListener === 'function') {
    mobileVideoQuery.addEventListener('change', handleVideoViewportChange);
} else if (typeof mobileVideoQuery.addListener === 'function') {
    mobileVideoQuery.addListener(handleVideoViewportChange);
}

if (dotNav && dotItems.length > 0 && demoSections.length > 0) {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Trigger when 50% of the section is visible
    };

    let visibleSectionsCount = 0;

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const correspondingDot = document.querySelector(`.dot-item[data-target="${id}"]`);
            const video = entry.target.querySelector('video');

            if (entry.isIntersecting) {
                visibleSectionsCount++;

                // Update dots
                dotItems.forEach(dot => dot.classList.remove('active'));
                if (correspondingDot) {
                    correspondingDot.classList.add('active');
                }

                // Play video in view
                if (video) {
                    attemptVideoPlayback(video);
                }
            } else {
                if (visibleSectionsCount > 0) visibleSectionsCount--;

                // Pause video out of view to save resources
                if (video) {
                    video.pause();
                }
            }
        });

        // Toggle overall dot navigation visibility
        if (visibleSectionsCount > 0) {
            dotNav.classList.add('is-visible');
        } else {
            dotNav.classList.remove('is-visible');
        }

    }, observerOptions);

    demoSections.forEach(section => {
        sectionObserver.observe(section);
    });
}
