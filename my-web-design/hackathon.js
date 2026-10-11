import * as THREE from "three";

// ==========================================
// 1. ГЛОБАЛНИ ПРОМЕНЛИВИ И СОВЕСТ
// ==========================================
let isPlanetView = true;
const introScreen = document.getElementById('intro-screen');
const mainApp = document.getElementById('main-app');
const canvasContainer = document.getElementById('canvas-container');

// ==========================================
// 2. ПОМОШНИ ФУНКЦИИ ЗА 3D (FRESNEL & STARS)
// ==========================================
function getFresnelMat({rimHex = 0x0088ff, facingHex = 0x000000} = {}) {
    const uniforms = {
        color1: { value: new THREE.Color(rimHex) },
        color2: { value: new THREE.Color(facingHex) },
        fresnelBias: { value: 0.1 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 4.0 },
    };
    const vs = `
        uniform float fresnelBias; uniform float fresnelScale; uniform float fresnelPower;
        varying float vReflectionFactor;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
            vec3 I = worldPosition.xyz - cameraPosition;
            vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
            gl_Position = projectionMatrix * mvPosition;
        }
    `;
    const fs = `
        uniform vec3 color1; uniform vec3 color2;
        varying float vReflectionFactor;
        void main() {
            float f = clamp( vReflectionFactor, 0.0, 1.0 );
            gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
        }
    `;
    return new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, blending: THREE.AdditiveBlending });
}

function getStarfield({ numStars = 800 } = {}) {
    const verts = [];
    const colors = [];
    for (let i = 0; i < numStars; i++) {
        const radius = Math.random() * 25 + 25;
        const u = Math.random(); const v = Math.random();
        const theta = 2 * Math.PI * u; const phi = Math.acos(2 * v - 1);
        verts.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
        const col = new THREE.Color().setHSL(0.6, 0.2, Math.random());
        colors.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, map: new THREE.TextureLoader().load("images for warning/circle.png") });
    return new THREE.Points(geo, mat);
}

// ==========================================
// 3. THREE.JS - ПОСТАВУВАЊЕ НА ПЛАНЕТАТА
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 360 / 740, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(360, 740);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
canvasContainer.appendChild(renderer.domElement);

const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
scene.add(earthGroup);

const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(2, 12);

// Слој 1: Површина
const earthMesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
    map: loader.load("images for warning/00_earthmap1k.jpg"),
    specularMap: loader.load("images for warning/02_earthspec1k.jpg"),
    bumpMap: loader.load("images for warning/01_earthbump1k.jpg"),
    bumpScale: 0.04,
}));
earthGroup.add(earthMesh);

// Слој 2: Светла
const lightsMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: loader.load("images for warning/03_earthlights1k.jpg"),
    blending: THREE.AdditiveBlending,
}));
earthGroup.add(lightsMesh);

// Слој 3: Облаци
const cloudsMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: loader.load("images for warning/04_earthcloudmap.jpg"),
    transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
    alphaMap: loader.load('images for warning/05_earthcloudmaptrans.jpg'),
}));
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

// Слој 4: Сјај
const glowMesh = new THREE.Mesh(geometry, getFresnelMat());
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

const stars = getStarfield({numStars: 2000});
scene.add(stars);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

camera.position.z = 7;

function animatePlanet() {
    if (isPlanetView) {
        earthMesh.rotation.y += 0.002;
        lightsMesh.rotation.y += 0.002;
        cloudsMesh.rotation.y += 0.0023;
        glowMesh.rotation.y += 0.002;
        stars.rotation.y -= 0.0002;
        renderer.render(scene, camera);
    }
    requestAnimationFrame(animatePlanet);
}
animatePlanet();

// ==========================================
// 4. ТРАНЗИЦИИ И ИНТЕРАКЦИЈА
// ==========================================

// Зумирање за влез во мапа
introScreen.addEventListener('wheel', (event) => {
    if (isPlanetView) {
        camera.position.z += event.deltaY * 0.005;
        if (camera.position.z > 10) camera.position.z = 10;
        if (camera.position.z < 2.3) showMap();
    }

// Променете го овој дел во hackathon.js
// introScreen.addEventListener('wheel', (event) => {
//     if (isPlanetView) {
//         // Зголемена вредност од 0.005 на 0.05 за побрз зум
//         camera.position.z += event.deltaY * 0.05;
//
//         if (camera.position.z > 10) camera.position.z = 10;
//
//         // Повисок праг за активирање (пр. 4 наместо 2.5)
//         // за мапата да се вклучи порано додека планетата уште се движи
//         if (camera.position.z < 4) {
//             showMap();
//         }
//     }
});

// window.showMap = function() {
//     if (!isPlanetView) return;
//     isPlanetView = false;
//     mainApp.style.display = 'block';
//     setTimeout(() => {
//         introScreen.style.opacity = '0';
//         mainApp.style.opacity = '1';
//         map.invalidateSize();
//     }, 50);
// };
function showMap() {
    if (!isPlanetView) return;
    isPlanetView = false;

    // Веднаш прикажете го контејнерот на апликацијата
    mainApp.style.display = 'block';

    // Форсирајте ја Leaflet мапата да ги вчита плочките (tiles) веднаш
    map.invalidateSize();

    // Направете транзицијата на opacity да биде побрза (пр. 0.3s во CSS)
    introScreen.style.transition = "opacity 0.4s ease-out";
    mainApp.style.transition = "opacity 0.4s ease-in";

    introScreen.style.opacity = '0';
    mainApp.style.opacity = '1';

    // Тргнете ги настаните од планетата веднаш
    introScreen.style.pointerEvents = 'none';
}

window.showPlanet = function() {
    if (isPlanetView) return;
    isPlanetView = true;
    introScreen.style.opacity = '1';
    mainApp.style.opacity = '0';
    camera.position.z = 5;
    setTimeout(() => { mainApp.style.display = 'none'; }, 1000);
};

// ==========================================
// 5. LEAFLET МАПА
// ==========================================
var map = L.map('map', { zoomControl: false, minZoom: 3 }).setView([41.6086, 21.7453], 7.5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

map.on('zoomend', () => { if (map.getZoom() <= 3) showPlanet(); });

// ==========================================
// 6. UI ЕЛЕМЕНТИ (Алерти, Модали)
// ==========================================
window.openAlerts = () => document.getElementById('alerts-panel').classList.add('active');
window.closeAlerts = () => document.getElementById('alerts-panel').classList.remove('active');

window.focusLocation = (lat, lng) => {
    map.flyTo([lat, lng], 12, { duration: 1.5 });
    closeAlerts();
    L.circle([lat, lng], { color: '#ff4d4d', radius: 1500 }).addTo(map);
};

const riskBtn = document.getElementById('risk-btn');
if (riskBtn) riskBtn.onclick = () => document.getElementById('risk-modal').style.display = 'flex';
window.closeRiskModal = () => document.getElementById('risk-modal').style.display = 'none';