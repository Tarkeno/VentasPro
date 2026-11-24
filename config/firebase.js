const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

// Ruta de las credenciales en Render
const rutaRender = "/etc/secrets/firebase-service-account.json";

// Ruta de las credenciales en localhost
const rutaLocal = path.join(
    __dirname,
    "../firebase-service-account.json"
);

// Seleccionar la ruta disponible
const rutaCredenciales = fs.existsSync(rutaRender)
    ? rutaRender
    : rutaLocal;

const serviceAccount = JSON.parse(
    fs.readFileSync(rutaCredenciales, "utf8")
);

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

module.exports = db;