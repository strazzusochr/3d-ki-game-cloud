/**
 * 🚀 Cloud 3D Engine - main.js
 * Optimiert für Cloudflare Pages & GitHub Codespaces
 */

const CLOUD_CONFIG = {
    // Diese URLs müssen nach dem Cloudflare-Deployment angepasst werden
    assetsBase: "./assets/", 
    modelUrl: "https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json" // Beispiel-Cloud-KI
};

async function initCloudGame() {
    const statusEl = document.getElementById('cloud-status');
    
    // 1. Three.js Initialisierung (Client-Rendering via Cloud-CDN)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 10, 50);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('gameCanvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Licht
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const light = new THREE.DirectionalLight(0x00ffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    // 2. KI-Modell aus Shared-Cloud-Storage laden
    statusEl.textContent = "Lade KI-Agenten aus Cloud-Storage...";
    try {
        const model = await tf.loadLayersModel(CLOUD_CONFIG.modelUrl);
        statusEl.textContent = "KI-Modell AKTIV (Cloud-Ready)";
    } catch (e) {
        console.warn("Cloud-KI Fallback aktiv:", e.message);
        statusEl.textContent = "KI-Simulation (WebWorker Modus)";
    }

    // Agenten-Visualisierung (Instancing für Performance)
    const geometry = new THREE.IcosahedronGeometry(0.3, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ffff, wireframe: true });
    const agents = [];

    for(let i = 0; i < 50; i++) {
        const agent = new THREE.Mesh(geometry, material);
        agent.position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
        scene.add(agent);
        agents.push(agent);
    }

    camera.position.z = 15;
    camera.position.y = 5;
    camera.lookAt(0, 0, 0);

    // 3. Web Worker für Cloud-basierte Berechnungen
    const aiWorker = new Worker('aiWorker.js');
    aiWorker.postMessage({ type: 'init', modelConfig: CLOUD_CONFIG });

    // Haupt-Game-Loop
    function animate() {
        requestAnimationFrame(animate);
        
        // Simuliere Cloud-Latenz/Bewegung
        agents.forEach((agent, i) => {
            agent.rotation.y += 0.01;
            agent.position.y = Math.sin(Date.now() * 0.001 + i) * 0.5;
        });

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

// Startvorgang
window.onload = initCloudGame;
