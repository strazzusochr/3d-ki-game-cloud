// 🧠 Cloud-optimierter KI-Worker
// Läuft asynchron zum Haupt-Thread um 60 FPS zu garantieren

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js');

self.onmessage = async (e) => {
    if (e.data.type === 'init') {
        try {
            // Lade KI-Modell direkt aus globalem Cloud Storage (CDN)
            self.model = await tf.loadLayersModel(e.data.modelConfig.modelUrl);
            self.postMessage({ type: 'ready' });
            console.log("☁️ AI Worker: Cloud Model Ready");
        } catch (err) {
            console.warn("AI Worker: Using procedural logic (Cloud Model inaccessible)");
            self.postMessage({ type: 'ready', fallback: true });
        }
    }
    
    if (e.data.type === 'predict') {
        // KI-Berechnung innerhalb der Sandbox
        if (self.model) {
            const input = tf.tensor(e.data.input);
            const prediction = self.model.predict(input);
            self.postMessage({ 
                type: 'prediction', 
                result: await prediction.array() 
            });
        } else {
            // Fallback: Einfache prozedurale KI
            self.postMessage({ 
                type: 'prediction', 
                result: [Math.sin(Date.now() * 0.01)] 
            });
        }
    }
};
