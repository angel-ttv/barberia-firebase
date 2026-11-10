// ═══════════════════════════════════════════════════════════
// Nivara Barber Shop System — Configuración de Firebase
// ═══════════════════════════════════════════════════════════
// 1. Ve a https://console.firebase.google.com/ → crea un proyecto
// 2. Agrega una app Web (ícono </>)
// 3. Copia el objeto firebaseConfig que te da la consola y pégalo abajo
// 4. Activa en la consola: Authentication → Sign-in method → Email/Password
// 5. Activa: Firestore Database → Crear base de datos (modo producción)
// 6. Copia las reglas de /firestore.rules.txt a Firestore → Reglas

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvjCAN6oVujAD6xoD3jnwK-rsED9I5hNs",
  authDomain: "barber-saas-91626.firebaseapp.com",
  projectId: "barber-saas-91626",
  storageBucket: "barber-saas-91626.firebasestorage.app",
  messagingSenderId: "1070990388105",
  appId: "1:1070990388105:web:f6573b75020db59d110f58",
  measurementId: "G-18RP19JH8G",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);