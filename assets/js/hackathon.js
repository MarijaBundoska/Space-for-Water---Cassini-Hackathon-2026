let map;
let currentMarker;
let currentLocation = {lat: 41.9981, lng: 21.4254};
let isPlanetView = true;
const introScreen = document.getElementById('intro-screen');
const mainApp = document.getElementById('main-app');
const canvasContainer = document.getElementById('canvas-container');

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

function getStarfield({ numStars = 1200 } = {}) {
    const verts = [];
    const colors = [];
    for (let i = 0; i < numStars; i++) {
        const radius = Math.random() * 25 + 25;
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        verts.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
        const col = new THREE.Color().setHSL(0.6, 0.2, Math.random());
        colors.push(col.r, col.g, col.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, map: new THREE.TextureLoader().load('/static/images/circle.png'), transparent: true });
    return new THREE.Points(geo, mat);
}

const planetScene = new THREE.Scene();
const planetCamera = new THREE.PerspectiveCamera(75, 360 / 740, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
canvasContainer.appendChild(renderer.domElement);

const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
planetScene.add(earthGroup);

const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(2, 12);

const earthMesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
    map: loader.load('/static/images/00_earthmap1k.jpg'),
    specularMap: loader.load('/static/images/02_earthspec1k.jpg'),
    bumpMap: loader.load('/static/images/01_earthbump1k.jpg'),
    bumpScale: 0.04,
}));
earthGroup.add(earthMesh);

const lightsMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: loader.load('/static/images/03_earthlights1k.jpg'),
    blending: THREE.AdditiveBlending,
}));
earthGroup.add(lightsMesh);

const cloudsMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: loader.load('/static/images/04_earthcloudmap.jpg'),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    alphaMap: loader.load('/static/images/05_earthcloudmaptrans.jpg'),
}));
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

const glowMesh = new THREE.Mesh(geometry, getFresnelMat());
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

const stars = getStarfield({ numStars: 1500 });
planetScene.add(stars);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(-2, 0.5, 1.5);
planetScene.add(sunLight);
planetCamera.position.z = 7;

function animatePlanet() {
    if (isPlanetView) {
        earthMesh.rotation.y += 0.002;
        lightsMesh.rotation.y += 0.002;
        cloudsMesh.rotation.y += 0.0023;
        glowMesh.rotation.y += 0.002;
        stars.rotation.y -= 0.0002;
        renderer.render(planetScene, planetCamera);
    }
    requestAnimationFrame(animatePlanet);
}
animatePlanet();

introScreen.addEventListener('wheel', (event) => {
    if (isPlanetView) {
        planetCamera.position.z += event.deltaY * 0.005;
        if (planetCamera.position.z > 10) planetCamera.position.z = 10;
        if (planetCamera.position.z < 4) {
            showMap();
        }
    }
});

function showMap() {
    if (!isPlanetView) return;
    isPlanetView = false;
    mainApp.style.display = 'block';
    introScreen.style.transition = 'opacity 0.4s ease-out';
    mainApp.style.transition = 'opacity 0.4s ease-in';
    introScreen.style.opacity = '0';
    mainApp.style.opacity = '1';
    setTimeout(() => {
        introScreen.style.display = 'none';
    }, 450);
    if (!map) {
        initMap();
    } else {
        map.invalidateSize();
    }
    loadMLPrediction(currentLocation.lat, currentLocation.lng);
}

function startApp() {
    showMap();
}

function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([41.6086, 21.7453], 7.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    currentMarker = L.circle([41.9981, 21.4254], {
        color: '#00d2ff',
        fillColor: '#00d2ff',
        fillOpacity: 0.5,
        radius: 2000
    }).addTo(map);

    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        currentLocation = {lat, lng};

        if (currentMarker) {
            map.removeLayer(currentMarker);
        }

        currentMarker = L.circle([lat, lng], {
            color: '#00d2ff',
            fillColor: '#00d2ff',
            fillOpacity: 0.5,
            radius: 2000
        }).addTo(map);

        document.getElementById('loc-name').textContent = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        loadMLPrediction(lat, lng);
    });

    setTimeout(() => { map.invalidateSize(); }, 500);
}

// 6. Panel controls
const alertsPanel = document.getElementById('alerts-panel');
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(button => {
    button.addEventListener('click', function() {
        if (this.innerText === 'FLOOD ALERTS') {
            alertsPanel.classList.add('active');
            navItems.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            showFloodAlerts();
        } else if (this.innerText === 'DROUGHT ALERTS') {
            alertsPanel.classList.add('active');
            navItems.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            showDroughtAlerts();
        }
    });
});

function closeAlerts() {
    alertsPanel.classList.remove('active');
    navItems.forEach(btn => btn.classList.remove('active'));
    navItems[0].classList.add('active'); // Return to NEAREST
}

// 7. Fly to location
function focusLocation(lat, lng) {
    currentLocation = {lat, lng};
    map.flyTo([lat, lng], 12, { duration: 1.5 });
    closeAlerts();

    // Update marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    currentMarker = L.circle([lat, lng], {
        color: '#ff4d4d',
        fillColor: '#ff4d4d',
        fillOpacity: 0.2,
        radius: 1500
    }).addTo(map);

    document.getElementById('loc-name').textContent = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    loadMLPrediction(lat, lng);
}

// Load ML prediction for location
function loadMLPrediction(lat, lng) {
    // First get weather data
    fetch(`/forecast?lat=${lat}&lon=${lng}&days=1`)
        .then(response => response.json())
        .then(data => {
            if (data.forecast && data.forecast[0]) {
                const today = data.forecast[0];

                // Get ML prediction
                return fetch('/predict/flood', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        lat: lat,
                        lon: lng,
                        precipitation: today.precipitation_sum_mm,
                        probability: today.precipitation_probability_max
                    })
                }).then(res => {
                    if (res.status === 503) {
                        // ML not available, use weather-based calculation
                        return { ml_prediction: calculateWeatherRisk(today) };
                    }
                    return res.json();
                });
            }
        })
        .then(mlData => {
            if (mlData && mlData.ml_prediction !== undefined) {
                const mlRisk = mlData.ml_prediction;
                const riskLevel = document.getElementById('risk-level');

                if (mlRisk > 75) {
                    riskLevel.textContent = `CRITICAL (${mlRisk}%)`;
                    riskLevel.style.color = '#ff4d4d';
                } else if (mlRisk > 40) {
                    riskLevel.textContent = `HIGH (${mlRisk}%)`;
                    riskLevel.style.color = '#ff8c00';
                } else {
                    riskLevel.textContent = `MODERATE (${mlRisk}%)`;
                    riskLevel.style.color = '#00d2ff';
                }
            }
        })
        .catch(err => console.error('Prediction error:', err));
}

// Fallback risk calculation when ML is not available
function calculateWeatherRisk(today) {
    const threshold = 50.0;
    const risk = ((today.precipitation_sum_mm / threshold) * 70) + (today.precipitation_probability_max * 0.3);
    return Math.min(Math.round(risk * 10) / 10, 100);
}

// Load 7-day forecast graph with both flood and drought predictions
function load7DayGraph(lat, lng) {
    fetch(`/forecast?lat=${lat}&lon=${lng}&days=7`)
        .then(response => response.json())
        .then(data => {
            if (data.forecast) {
                // Create display with flood and drought tables
                let graphHtml = '<h4 style="color: #00d2ff;">7-Day Flood Risk Forecast</h4><div style="max-height: 250px; overflow-y: auto;">';

                // Process each day with ML predictions
                const processDays = data.forecast.map(day => {
                    return Promise.all([
                        fetch('/predict/flood', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                lat: lat,
                                lon: lng,
                                precipitation: day.precipitation_sum_mm,
                                probability: day.precipitation_probability_max
                            })
                        }).then(res => res.json()).catch(() => ({ml_prediction: null})),
                        fetch('/predict/drought', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                lat: lat,
                                lon: lng,
                                precipitation: day.precipitation_sum_mm,
                                probability: day.precipitation_probability_max
                            })
                        }).then(res => res.json()).catch(() => ({ml_prediction: null}))
                    ])
                    .then(([floodData, droughtData]) => ({
                        date: day.date,
                        floodRisk: floodData.ml_prediction || calculateWeatherRisk(day),
                        droughtRisk: droughtData.ml_prediction || 0
                    }));
                });

                Promise.all(processDays).then(dayResults => {
                    // Flood risk table
                    dayResults.forEach(dayData => {
                        const riskPercent = dayData.floodRisk;
                        let riskColor, riskLevel;
                        if (riskPercent > 75) {
                            riskColor = '#ff4d4d';
                            riskLevel = 'CRITICAL';
                        } else if (riskPercent > 40) {
                            riskColor = '#ff8c00';
                            riskLevel = 'HIGH';
                        } else {
                            riskColor = '#00d2ff';
                            riskLevel = 'MODERATE';
                        }
                        graphHtml += `
                            <div style="display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #333;">
                                <span style="color: #ffffff;">${dayData.date}</span>
                                <span style="color: ${riskColor}; font-weight: bold;">${riskPercent}% (${riskLevel})</span>
                            </div>
                        `;
                    });
                    graphHtml += '</div>';
                    
                    // Drought risk table
                    graphHtml += '<h4 style="color: rgb(229,188,13); margin-top: 15px;">7-Day Drought Risk Forecast</h4><div style="max-height: 250px; overflow-y: auto;">';
                    
                    dayResults.forEach(dayData => {
                        const droughtPercent = dayData.droughtRisk;
                        let droughtColor, droughtLevel;
                        if (droughtPercent > 75) {
                            droughtColor = '#ff4d4d';
                            droughtLevel = 'CRITICAL';
                        } else if (droughtPercent > 50) {
                            droughtColor = '#ff8c00';
                            droughtLevel = 'HIGH';
                        } else if (droughtPercent > 25) {
                            droughtColor = 'rgb(229,188,13)';
                            droughtLevel = 'MODERATE';
                        } else {
                            droughtColor = '#00d2ff';
                            droughtLevel = 'LOW';
                        }
                        graphHtml += `
                            <div style="display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #333;">
                                <span style="color: #ffffff;">${dayData.date}</span>
                                <span style="color: ${droughtColor}; font-weight: bold;">${droughtPercent}% (${droughtLevel})</span>
                            </div>
                        `;
                    });
                    graphHtml += '</div>';

                    // Show in alerts panel
                    const alertsList = document.querySelector('.alerts-list');
                    alertsList.innerHTML = graphHtml;
                });
            }
        })
        .catch(err => console.error('7-day forecast error:', err));
}

// Handle ACTIVE button click for 7-day graph
function show7DayGraph() {
    const {lat, lng} = currentLocation;
    load7DayGraph(lat, lng);
    alertsPanel.classList.add('active');
}

// Modal for risk details with percentages
function closeRiskModal() {
    document.getElementById('risk-modal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('risk-modal');
    if (event.target === modal) {
        closeRiskModal();
    }
});

// Handle RISK button click for modal
function showRiskModal() {
    const {lat, lng} = currentLocation;
    fetch(`/forecast?lat=${lat}&lon=${lng}&days=1`)
        .then(response => response.json())
        .then(data => {
            if (data.forecast && data.forecast[0]) {
                const today = data.forecast[0];
                const floodRisk = calculateWeatherRisk(today);

                document.getElementById('flood-level').textContent = `${today.precipitation_sum_mm}mm (${floodRisk}% risk)`;
                document.getElementById('drought-level').textContent = `${today.precipitation_probability_max}% probability`;
            }
            document.getElementById('risk-modal').style.display = 'flex';
        });
}

// Placeholder functions for bottom nav (can be implemented later)
function showNearest() {
    alert('Nearest locations functionality coming soon');
}

function showFloodAlerts() {
    document.getElementById('panel-title').textContent = 'FLOOD ALERTS';
    loadAlerts('flood');
}

function showDroughtAlerts() {
    document.getElementById('panel-title').textContent = 'DROUGHT ALERTS';
    loadAlerts('drought');
}

// Major cities in Macedonia with coordinates
const macedoniaCities = [
    {name: 'Skopje', lat: 41.9981, lon: 21.4254},
    {name: 'Tetovo', lat: 42.01, lon: 20.97},
    {name: 'Bitola', lat: 41.03, lon: 21.33},
    {name: 'Ohrid', lat: 41.12, lon: 20.80},
    {name: 'Strumica', lat: 41.44, lon: 22.64},
    {name: 'Gevgelija', lat: 41.14, lon: 22.50},
    {name: 'Prilep', lat: 41.36, lon: 21.53},
    {name: 'Kumanovo', lat: 42.13, lon: 21.71}
];

// Load flood or drought alerts for all major Macedonia cities
function loadAlerts(alertType) {
    const isFlood = alertType === 'flood';
    const title = isFlood ? 'FLOOD WARNINGS - HIGHEST RISK LOCATIONS' : 'DROUGHT WARNINGS - HIGHEST RISK LOCATIONS';
    const titleColor = isFlood ? '#00d2ff' : 'rgb(229,188,13)';
    
    let alertsHtml = `<h4 style="color: ${titleColor};">${title}</h4><div style="max-height: 400px; overflow-y: auto;">`;
    
    // Fetch weather data and predictions for all cities
    const allAlertsPromises = macedoniaCities.map(city => {
        return fetch(`/forecast?lat=${city.lat}&lon=${city.lon}&days=1`)
            .then(response => response.json())
            .then(data => {
                if (data.forecast && data.forecast[0]) {
                    const today = data.forecast[0];
                    
                    // Get drought and flood predictions
                    return Promise.all([
                        fetch('/predict/drought', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                lat: city.lat,
                                lon: city.lon,
                                precipitation: today.precipitation_sum_mm,
                                probability: today.precipitation_probability_max
                            })
                        }).then(res => res.json()).catch(() => ({ml_prediction: 0})),
                        fetch('/predict/flood', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                lat: city.lat,
                                lon: city.lon,
                                precipitation: today.precipitation_sum_mm,
                                probability: today.precipitation_probability_max
                            })
                        }).then(res => res.json()).catch(() => ({ml_prediction: 0}))
                    ])
                    .then(([droughtData, floodData]) => ({
                        name: city.name,
                        lat: city.lat,
                        lon: city.lon,
                        droughtRisk: droughtData.ml_prediction || 0,
                        floodRisk: floodData.ml_prediction || 0
                    }));
                }
                return {name: city.name, lat: city.lat, lon: city.lon, droughtRisk: 0, floodRisk: 0};
            })
            .catch(() => ({name: city.name, lat: city.lat, lon: city.lon, droughtRisk: 0, floodRisk: 0}));
    });
    
    Promise.all(allAlertsPromises).then(results => {
        // Sort by the requested alert type
        const sortedResults = [...results].sort((a, b) => {
            const riskA = isFlood ? a.floodRisk : a.droughtRisk;
            const riskB = isFlood ? b.floodRisk : b.droughtRisk;
            return riskB - riskA;
        });
        
        // Display top risk locations
        sortedResults.forEach(city => {
            const riskPercent = isFlood ? city.floodRisk : city.droughtRisk;
            let riskColor;
            if (isFlood) {
                if (riskPercent > 75) {
                    riskColor = '#ff4d4d';
                } else if (riskPercent > 40) {
                    riskColor = '#ff8c00';
                } else {
                    riskColor = '#00d2ff';
                }
            } else {
                if (riskPercent > 75) {
                    riskColor = '#ff4d4d';
                } else if (riskPercent > 50) {
                    riskColor = '#ff8c00';
                } else if (riskPercent > 25) {
                    riskColor = 'rgb(229,188,13)';
                } else {
                    riskColor = '#00d2ff';
                }
            }
            
            const riskType = isFlood ? 'Flood' : 'Drought';
            
            alertsHtml += `
                <div class="alert-card ${alertType}" onclick="focusLocation(${city.lat}, ${city.lon})" style="border-left: 4px solid ${riskColor}; cursor: pointer;">
                    <div class="alert-info">
                        <strong>${city.name}</strong>
                        <span style="color: ${riskColor}; font-weight: bold;">${riskPercent.toFixed(1)}% ${riskType} Risk</span>
                    </div>
                </div>
            `;
        });
        
        alertsHtml += '</div>';
        
        // Update alerts panel
        const alertsList = document.querySelector('.alerts-list');
        alertsList.innerHTML = alertsHtml;
    });
}

