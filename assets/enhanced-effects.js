/**
 * Enhanced Effects Module
 * Adds snowfall, galaxy, starfield, fireworks, and 3D particle text
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js';

function setGeometryAttribute(geometry, name, attribute) {
    if (geometry.setAttribute) {
        geometry.setAttribute(name, attribute);
    } else {
        geometry.addAttribute(name, attribute);
    }
}

// Initialize effects
setTimeout(() => {
    initStandaloneEffects();
}, 100);

let scene, camera, renderer;
let snowParticles, flakeParticlesArray = [], galaxy, staticStars;
let snowVelocities = [], flakeVelocities = [];
let fireworks = [];
let isInitialized = false;

// Fade in control
let effectsOpacity = 1;
let effectsStartTime = 0;
const EFFECTS_FADE_DURATION = 500;

// ==========================================
// Particle Text System (from countdown project)
// ==========================================
const isMobile = window.innerWidth < 768;
const isInAppBrowser = /Zalo|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(navigator.userAgent || '');

const TEXT_CONFIG = {
    particleCount: isInAppBrowser ? (isMobile ? 40000 : 60000) : (isMobile ? 80000 : 120000),
    particleSize: isMobile ? 0.12 : 0.15,
    explosionPower: 150.0,
    gatherSpeed: isMobile ? 0.08 : 0.05,
    depthThickness: isMobile ? 1 : 1.5,
    colorStart: '#ff1493',   // Hot pink (neon)
    colorEnd: '#ff69b4',     // Pink
};

let textParticleSystem, textGeometry;
const currentPositions = new Float32Array(TEXT_CONFIG.particleCount * 3);
const targetPositions = new Float32Array(TEXT_CONFIG.particleCount * 3);

let messageArray = [];
let textMsgIndex = 0;
let textChangeTimer = 0;
let textAllDone = false; // true khi đã hiển thị hết tất cả messages
let textExploding = false; // true khi đang bắn nổ particle
let textExplodeTime = 0;
const TEXT_DISPLAY_DURATION = isMobile ? 4000 : 3500;
let textSequenceComplete = false;

function finishTextSequence() {
    if (textSequenceComplete) return;
    textSequenceComplete = true;
    window.dispatchEvent(new CustomEvent('textMessagesComplete'));
    console.log('Particle explosion done - showing sphere');
}

function initStandaloneEffects() {
    if (isInitialized) return;
    isInitialized = true;

    // Create overlay canvas for additional effects
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'effects-overlay';
    overlayCanvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2;
    `;
    document.body.appendChild(overlayCanvas);

    // Setup Three.js for effects
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 25, 65);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        canvas: overlayCanvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Text là luồng chính: tạo trước để lỗi hiệu ứng nền không làm mất chữ tụ.
    createTextParticleSystem();

    // Load messages and start particle text
    loadMessages();

    // Create background effects
    try {
        createStarfield();
    } catch (err) {
        console.warn('Starfield effect skipped:', err);
    }
    try {
        createGalaxy();
    } catch (err) {
        console.warn('Galaxy effect skipped:', err);
    }
    try {
        createSnowfall();
    } catch (err) {
        console.warn('Snow effect skipped:', err);
    }

    // Reload messages khi API config loaded
    window.addEventListener('configLoaded', function () {
        loadMessages();
    });

    effectsStartTime = Date.now();
    setEffectsOpacity(1);

    // Start animation
    animateEffects();

    // Handle resize
    window.addEventListener('resize', onWindowResize);

    console.log('Enhanced effects initialized with particle text');
}

// ==========================================
// Particle Text Functions
// ==========================================

function loadMessages() {
    if (window.Heartlove && window.Heartlove.data && window.Heartlove.data.messages) {
        messageArray = window.Heartlove.data.messages;
    } else if (window.dataChristmasTree && window.dataChristmasTree.data && window.dataChristmasTree.data.messages) {
        messageArray = window.dataChristmasTree.data.messages;
    }

    if (!messageArray || messageArray.length === 0) {
        messageArray = ["Chúc Mừng 💖💕", "Ngày 1 Tháng 6 💝", "Bé Iu Của Anh 💖"];
    }

    textMsgIndex = 0;
    textAllDone = false;
    textExploding = false;
    textExplodeTime = 0;
    if (textParticleSystem) {
        textParticleSystem.visible = true;
        textParticleSystem.material.opacity = 1;
    }

    // Wait for Pacifico font to be ready before drawing text
    const startText = () => {
        changeTextVi(messageArray[0]);
        textChangeTimer = Date.now();
    };

    setTimeout(startText, 500);
    if (document.fonts && document.fonts.check('48px Pacifico')) {
        setTimeout(startText, 1500);
    } else if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => setTimeout(startText, 500));
    } else {
        setTimeout(startText, 2500); // Fallback delay for font loading
    }
}

function getConfiguredMessages() {
    if (window.Heartlove && window.Heartlove.data && window.Heartlove.data.messages) {
        return window.Heartlove.data.messages;
    }
    if (window.dataChristmasTree && window.dataChristmasTree.data && window.dataChristmasTree.data.messages) {
        return window.dataChristmasTree.data.messages;
    }
    return ["Chúc Mừng 💖💕", "Ngày 1 Tháng 6 💝", "Bé Iu Của Anh 💖"];
}

function createTextParticleSystem() {
    textGeometry = new THREE.BufferGeometry();
    const colors = new Float32Array(TEXT_CONFIG.particleCount * 3);

    for (let i = 0; i < TEXT_CONFIG.particleCount; i++) {
        currentPositions[i * 3] = (Math.random() - 0.5) * 300;
        currentPositions[i * 3 + 1] = (Math.random() - 0.5) * 300;
        currentPositions[i * 3 + 2] = (Math.random() - 0.5) * 300;
        targetPositions[i * 3] = currentPositions[i * 3];
        targetPositions[i * 3 + 1] = currentPositions[i * 3 + 1];
        targetPositions[i * 3 + 2] = currentPositions[i * 3 + 2];
    }

    setGeometryAttribute(textGeometry, 'position', new THREE.BufferAttribute(currentPositions, 3));
    setGeometryAttribute(textGeometry, 'color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: TEXT_CONFIG.particleSize,
        map: getCircleTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    textParticleSystem = new THREE.Points(textGeometry, material);
    // Position the text in the scene - centered, slightly above middle
    textParticleSystem.position.set(0, 8, 0);
    scene.add(textParticleSystem);
}

function getCircleTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    // Sharp solid core - crisp particle for readable text
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.7, 'rgba(255,200,220,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

// Vẽ text có letter-spacing lên canvas (canvas API không hỗ trợ letterSpacing trên mọi browser)
function drawTextWithSpacing(ctx, text, x, y, spacing, mode) {
    if (spacing <= 0) {
        if (mode === 'fill') ctx.fillText(text, x, y);
        else ctx.strokeText(text, x, y);
        return;
    }
    // Vẽ từng ký tự với khoảng cách tùy chỉnh
    const totalWidth = Array.from(text).reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
    let curX = x - totalWidth / 2;
    for (const ch of text) {
        const chW = ctx.measureText(ch).width;
        if (mode === 'fill') ctx.fillText(ch, curX + chW / 2, y);
        else ctx.strokeText(ch, curX + chW / 2, y);
        curX += chW + spacing;
    }
}

function calculateTextTargetsCanvas(text) {
    // Mobile: thu nhỏ canvas → text fit ngang viewport mà letter giữ nguyên size (scale 0.08)
    const cW = isMobile ? 600 : 1200;
    const cH = isMobile ? 500 : 500;
    let fontSize = isMobile ? 130 : 160;
    const depth = TEXT_CONFIG.depthThickness;
    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    // Font: Mali hỗ trợ tiếng Việt tốt, Pacifico cho Latin
    const fontFamily = '"Mali", "Pacifico", "Dancing Script", cursive';
    const letterSpacing = isMobile ? 2 : 4;
    const maxWidth = cW * 0.85;

    // Hàm wrap text theo fontSize hiện tại
    function wrapText(fs) {
        ctx.font = `${fs}px ${fontFamily}`;
        const result = [];
        const words = text.split(' ');
        let currentLine = words[0] || '';
        for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const estWidth = ctx.measureText(testLine).width + testLine.length * letterSpacing;
            if (estWidth > maxWidth) {
                result.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        result.push(currentLine);
        return result;
    }

    // Wrap → check nếu tràn thì giảm font → wrap lại, lặp cho đến khi vừa
    let lines = wrapText(fontSize);
    for (let attempt = 0; attempt < 5; attempt++) {
        const lh = fontSize * 1.6;
        const totalH = lines.length * lh;
        // Check tràn dọc
        if (totalH > cH * 0.85) {
            fontSize = Math.floor(fontSize * 0.85);
            lines = wrapText(fontSize);
            continue;
        }
        // Check tràn ngang từng dòng
        ctx.font = `${fontSize}px ${fontFamily}`;
        let tooWide = false;
        for (const line of lines) {
            if (ctx.measureText(line).width + line.length * letterSpacing > maxWidth) {
                tooWide = true;
                break;
            }
        }
        if (tooWide) {
            fontSize = Math.floor(fontSize * 0.85);
            lines = wrapText(fontSize);
            continue;
        }
        break; // Vừa vặn
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cW, cH);

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const actualLineHeight = fontSize * 1.6;
    const startY = cH / 2 - (lines.length - 1) * actualLineHeight / 2;

    // Chỉ 1 lớp duy nhất: stroke dày + fill đặc → chữ rõ ràng, không bị tản
    // Stroke nhẹ để bo tròn viền chữ cho dày hơn
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isMobile ? 6 : 8;
    for (let i = 0; i < lines.length; i++) {
        const y = startY + i * actualLineHeight;
        drawTextWithSpacing(ctx, lines[i], cW / 2, y, letterSpacing, 'stroke');
    }

    // Fill đặc - core chữ
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < lines.length; i++) {
        const y = startY + i * actualLineHeight;
        drawTextWithSpacing(ctx, lines[i], cW / 2, y, letterSpacing, 'fill');
    }

    const imageData = ctx.getImageData(0, 0, cW, cH);
    const pixels = imageData.data;
    const brightPixels = [];
    for (let y = 0; y < cH; y++) {
        for (let x = 0; x < cW; x++) {
            const brightness = pixels[(y * cW + x) * 4];
            if (brightness > 100) brightPixels.push({ x, y, b: brightness });
        }
    }

    // Scale to fit camera view
    const scaleX = isMobile ? 0.09 : 0.10;
    const scaleY = isMobile ? 0.09 : 0.10;
    const offsetX = -cW * scaleX / 2;
    const c1 = new THREE.Color(TEXT_CONFIG.colorStart); // Hot pink
    const c2 = new THREE.Color(TEXT_CONFIG.colorEnd);   // Pink
    const colorAttribute = textGeometry.attributes.color;

    for (let i = 0; i < TEXT_CONFIG.particleCount; i++) {
        if (brightPixels.length > 0) {
            const pixel = brightPixels[Math.floor(Math.random() * brightPixels.length)];
            targetPositions[i * 3] = pixel.x * scaleX + offsetX;
            targetPositions[i * 3 + 1] = -pixel.y * scaleY + cH * scaleY / 2;
            // Z gần phẳng - không tản ra phía trước/sau
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * depth;

            // Color: neon hot pink gradient
            const brightnessRatio = pixel.b / 255;
            const col = c1.clone().lerp(c2, 1 - brightnessRatio);
            col.r = Math.min(1, col.r * 1.15);
            colorAttribute.setXYZ(i, col.r, col.g, col.b);
        } else {
            targetPositions[i * 3] = (Math.random() - 0.5) * 40;
            targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
            colorAttribute.setXYZ(i, 1, 0.08, 0.58);
        }
    }
    colorAttribute.needsUpdate = true;
}

function changeTextVi(text) {
    for (let i = 0; i < TEXT_CONFIG.particleCount; i++) {
        const r = TEXT_CONFIG.explosionPower;
        currentPositions[i * 3] += (Math.random() - 0.5) * r;
        currentPositions[i * 3 + 1] += (Math.random() - 0.5) * r;
        currentPositions[i * 3 + 2] += (Math.random() - 0.5) * r;
    }
    calculateTextTargetsCanvas(text);
}

// ==========================================
// Original Effects
// ==========================================

function createStarfield() {
    const vertices = [];
    for (let i = 0; i < 8000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        vertices.push(x, y, z);
    }
    const geometry = new THREE.BufferGeometry();
    setGeometryAttribute(geometry, 'position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        transparent: true,
        opacity: 0.6
    });
    staticStars = new THREE.Points(geometry, material);
    scene.add(staticStars);
}

function createGalaxy() {
    const particleCount = 30000;
    const vertices = [];
    const colors = [];
    const maxRadius = 80;
    const spin = 1;

    const innerColor = new THREE.Color(0xfd9595);
    const midColor = new THREE.Color(0xffb8b8);
    const outerColor = new THREE.Color(0x9966cc);

    for (let i = 0; i < particleCount; i++) {
        const r = Math.pow(Math.random(), 1.5) * maxRadius;
        const angle = Math.random() * Math.PI * 2;
        const spinAngle = r * spin * 0.05;
        const x = Math.cos(angle + spinAngle) * r;
        const y = (Math.random() - 0.5) * 1.5;
        const z = Math.sin(angle + spinAngle) * r;
        vertices.push(x, y, z);

        const t = r / maxRadius;
        let color;
        if (t < 0.5) {
            color = innerColor.clone().lerp(midColor, t * 2);
        } else {
            color = midColor.clone().lerp(outerColor, (t - 0.5) * 2);
        }

        const variation = 0.1;
        color.r += (Math.random() - 0.5) * variation;
        color.g += (Math.random() - 0.5) * variation;
        color.b += (Math.random() - 0.5) * variation;

        colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    setGeometryAttribute(geometry, 'position', new THREE.Float32BufferAttribute(vertices, 3));
    setGeometryAttribute(geometry, 'color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.12,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    galaxy = new THREE.Points(geometry, material);
    galaxy.position.y = -20;
    scene.add(galaxy);
}

function createSnowfall() {
    const snowCount = isMobile ? 8000 : 8000;
    const snowVertices = [];
    snowVelocities = [];

    for (let i = 0; i < snowCount; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = Math.random() * 200 - 50;
        const z = (Math.random() - 0.5) * 200;
        snowVertices.push(x, y, z);
        snowVelocities.push({
            y: Math.random() * 0.02 + 0.01,
            swayX: (Math.random() - 0.5) * 0.1,
            swayZ: (Math.random() - 0.5) * 0.1,
            freq: Math.random() * 0.5 + 0.2
        });
    }

    const snowGeometry = new THREE.BufferGeometry();
    setGeometryAttribute(snowGeometry, 'position', new THREE.Float32BufferAttribute(snowVertices, 3));
    const snowMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    snowParticles = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snowParticles);

    createSnowflakes(isMobile);
}

function createSnowflakeTexture(seed) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const cx = 32;
    const cy = 32;
    const arms = 6;
    const radius = 24;

    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.3 + (seed % 3) * 0.2;
    ctx.lineCap = 'round';

    for (let i = 0; i < arms; i++) {
        const angle = (Math.PI * 2 * i) / arms;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();

        for (let b = 0; b < 2; b++) {
            const branchAt = 12 + b * 7 + (seed % 2);
            const bx = cx + Math.cos(angle) * branchAt;
            const by = cy + Math.sin(angle) * branchAt;
            const branchLen = 6 + b * 2;
            const sideAngle = angle + Math.PI / 5;
            const sideAngle2 = angle - Math.PI / 5;

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - Math.cos(sideAngle) * branchLen, by - Math.sin(sideAngle) * branchLen);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - Math.cos(sideAngle2) * branchLen, by - Math.sin(sideAngle2) * branchLen);
            ctx.stroke();
        }
    }

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
}

function createSnowflakes(isMobile) {
    const totalFlakeCount = isMobile ? 350 : 400;
    flakeParticlesArray = [];

    for (let i = 1; i <= 11; i++) {
        const texture = createSnowflakeTexture(i);

        const flakesForThisType = Math.floor(totalFlakeCount / 11);
        const flakeVertices = [];
        const flakeColors = [];

        for (let j = 0; j < flakesForThisType; j++) {
            const x = (Math.random() - 0.5) * 200;
            const y = Math.random() * 200 - 50;
            const z = (Math.random() - 0.5) * 200;
            flakeVertices.push(x, y, z);

            const color = new THREE.Color(0xffffff);
            if (Math.random() > 0.85) {
                color.setHSL(0.9, 0.3, 0.95);
            } else {
                color.setHSL(0, 0, 0.85 + Math.random() * 0.15);
            }
            flakeColors.push(color.r, color.g, color.b);

            flakeVelocities.push({
                y: Math.random() * 0.015 + 0.008,
                swayX: (Math.random() - 0.5) * 0.12,
                swayZ: (Math.random() - 0.5) * 0.12,
                freq: Math.random() * 0.4 + 0.1
            });
        }

        const flakeGeometry = new THREE.BufferGeometry();
        setGeometryAttribute(flakeGeometry, 'position', new THREE.Float32BufferAttribute(flakeVertices, 3));
        setGeometryAttribute(flakeGeometry, 'color', new THREE.Float32BufferAttribute(flakeColors, 3));

        const flakeMaterial = new THREE.PointsMaterial({
            size: 1.8,
            map: texture,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.75
        });

        const flakes = new THREE.Points(flakeGeometry, flakeMaterial);
        flakeParticlesArray.push(flakes);
        scene.add(flakes);
    }
}


class Firework {
    constructor(scene) {
        this.scene = scene;
        this.isDead = false;

        const startX = (Math.random() - 0.5) * 40;
        const startY = 20 + Math.random() * 30;
        const startZ = (Math.random() - 0.5) * 20;

        this.createExplosion(new THREE.Vector3(startX, startY, startZ));
    }

    createExplosion(position) {
        const particleCount = 80;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 0.9, 0.6);

        for (let i = 0; i < particleCount; i++) {
            positions.push(position.x, position.y, position.z);
            positions.push(position.x, position.y, position.z);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = 0.12 + Math.random() * 0.2;

            velocities.push({
                x: Math.sin(phi) * Math.cos(theta) * speed,
                y: Math.sin(phi) * Math.sin(theta) * speed,
                z: Math.cos(phi) * speed
            });
        }

        setGeometryAttribute(geometry, 'position', new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.LineSegments(geometry, material);
        this.mesh.userData = {
            velocities: velocities,
            life: 1.0,
            drag: 0.96
        };
        this.scene.add(this.mesh);
    }

    update() {
        if (this.isDead) return;

        const positions = this.mesh.geometry.attributes.position.array;
        const velocities = this.mesh.userData.velocities;
        const gravity = -0.005;
        const drag = this.mesh.userData.drag;

        this.mesh.userData.life -= 0.012;
        this.mesh.material.opacity = this.mesh.userData.life;

        for (let i = 0; i < velocities.length; i++) {
            velocities[i].x *= drag;
            velocities[i].y *= drag;
            velocities[i].z *= drag;
            velocities[i].y += gravity;

            const headIdx = i * 6;
            const tailIdx = i * 6 + 3;

            positions[tailIdx] += (positions[headIdx] - positions[tailIdx]) * 0.15;
            positions[tailIdx + 1] += (positions[headIdx + 1] - positions[tailIdx + 1]) * 0.15;
            positions[tailIdx + 2] += (positions[headIdx + 2] - positions[tailIdx + 2]) * 0.15;

            positions[headIdx] += velocities[i].x;
            positions[headIdx + 1] += velocities[i].y;
            positions[headIdx + 2] += velocities[i].z;
        }

        this.mesh.geometry.attributes.position.needsUpdate = true;

        if (this.mesh.userData.life <= 0) {
            this.isDead = true;
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}

function animateEffects() {
    requestAnimationFrame(animateEffects);

    const time = Date.now() * 0.0005;
    const now = Date.now();

    // Fade in effects
    if (effectsOpacity < 1 && effectsStartTime > 0) {
        const elapsed = now - effectsStartTime;
        effectsOpacity = Math.min(1, elapsed / EFFECTS_FADE_DURATION);
        setEffectsOpacity(effectsOpacity);
    }

    // ==========================================
    // Particle Text Animation - lerp toward targets + auto cycle messages
    // ==========================================
    if (textParticleSystem && messageArray.length > 0) {
        // Lerp particles toward targets (chậm hơn khi nổ)
        const speed = textExploding ? 0.008 : TEXT_CONFIG.gatherSpeed;
        for (let i = 0; i < TEXT_CONFIG.particleCount; i++) {
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
            currentPositions[ix] += (targetPositions[ix] - currentPositions[ix]) * speed;
            currentPositions[iy] += (targetPositions[iy] - currentPositions[iy]) * speed;
            currentPositions[iz] += (targetPositions[iz] - currentPositions[iz]) * speed;
        }
        textGeometry.attributes.position.needsUpdate = true;

        // Gentle float animation (dừng khi đang nổ)
        if (!textExploding) {
            textParticleSystem.position.y = 8 + Math.sin(time * 1.5) * 1.5;
            textParticleSystem.rotation.z = Math.sin(time * 0.8) * 0.03;
        }

        // Nổ chậm: 2s bay ra → 2s fade out → dispatch event
        if (textExploding && textExplodeTime > 0) {
            const explodeElapsed = now - textExplodeTime;
            // Fade out bắt đầu sau 2s
            if (explodeElapsed > 2000) {
                const fadeProgress = Math.min(1, (explodeElapsed - 2000) / 2000);
                textParticleSystem.material.opacity = 1 - fadeProgress;
            }
            // Sau 4s → ẩn particle, dispatch event
            if (explodeElapsed > 4000 && textExploding) {
                textExploding = false;
                textParticleSystem.visible = false;
                finishTextSequence();
            }
        }

        // Auto cycle messages - chạy hết 1 lượt rồi dừng, dispatch event
        if (textChangeTimer > 0 && !textAllDone && now - textChangeTimer > TEXT_DISPLAY_DURATION) {
            textMsgIndex++;
            if (textMsgIndex < messageArray.length) {
                changeTextVi(messageArray[textMsgIndex]);
                textChangeTimer = now;
            } else {
                // Đã hiển thị hết tất cả messages → bắn nổ particle
                textAllDone = true;
                textExploding = true;
                textExplodeTime = now;
                // Bắn particle ra xa từ từ
                for (let i = 0; i < TEXT_CONFIG.particleCount; i++) {
                    targetPositions[i * 3] = (Math.random() - 0.5) * 300;
                    targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 300;
                    targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 300;
                }
                console.log('All text messages displayed - exploding particles');
            }
        }
    }

    // Animate snow
    if (snowParticles) {
        const snowPositions = snowParticles.geometry.attributes.position.array;
        for (let i = 0; i < snowPositions.length; i += 3) {
            const idx = i / 3;
            if (snowVelocities[idx]) {
                const vel = snowVelocities[idx];
                snowPositions[i + 1] -= vel.y;
                snowPositions[i] += Math.sin(time * vel.freq + i) * vel.swayX * 0.1;
                snowPositions[i + 2] += Math.cos(time * vel.freq + i) * vel.swayZ * 0.1;
                if (snowPositions[i + 1] < -60) snowPositions[i + 1] = 100;
            }
        }
        snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate snowflakes
    let flakeVelocityIndex = 0;
    flakeParticlesArray.forEach(flakes => {
        if (!flakes || !flakes.geometry) return;
        const flakePositions = flakes.geometry.attributes.position.array;
        for (let i = 0; i < flakePositions.length; i += 3) {
            if (flakeVelocities[flakeVelocityIndex]) {
                const vel = flakeVelocities[flakeVelocityIndex];
                flakePositions[i + 1] -= vel.y;
                flakePositions[i] += Math.sin(time * vel.freq + i) * vel.swayX * 0.1;
                flakePositions[i + 2] += Math.cos(time * vel.freq + i) * vel.swayZ * 0.1;
                if (flakePositions[i + 1] < -60) flakePositions[i + 1] = 100;
            }
            flakeVelocityIndex++;
        }
        flakes.geometry.attributes.position.needsUpdate = true;
        flakes.rotation.y += 0.0005;
    });

    // Rotate galaxy
    if (galaxy) {
        galaxy.rotation.y += 0.0003;
    }

    // Spawn and update fireworks
    if (Math.random() < 0.025) {
        fireworks.push(new Firework(scene));
    }

    for (let i = fireworks.length - 1; i >= 0; i--) {
        fireworks[i].update();
        if (fireworks[i].isDead) {
            fireworks.splice(i, 1);
        }
    }

    // Render
    if (renderer) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function setEffectsOpacity(opacity) {
    if (snowParticles && snowParticles.material) {
        snowParticles.material.opacity = 0.7 * opacity;
    }
    if (staticStars && staticStars.material) {
        staticStars.material.opacity = 0.6 * opacity;
    }
    if (galaxy && galaxy.material) {
        galaxy.material.opacity = 0.35 * opacity;
    }
    flakeParticlesArray.forEach(flakes => {
        if (flakes && flakes.material) {
            flakes.material.opacity = 0.75 * opacity;
        }
    });
}

export { initStandaloneEffects };
