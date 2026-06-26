import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApLXRqDQTYuHbxPuVAt7UMn8S3K2W91m0",
  authDomain: "bloquera-b8717.firebaseapp.com",
  projectId: "bloquera-b8717",
  storageBucket: "bloquera-b8717.firebasestorage.app",
  messagingSenderId: "727421527675",
  appId: "1:727421527675:web:4f6abe06f9ce410be424de"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

window.login = function () {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || !password) { alert("⚠️ Ingrese correo y contraseña"); return; }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => { window.location.href = "dashboard.html"; })
    .catch(err => {
      let msg = "Correo o contraseña incorrectos.";
      if (err.code === "auth/too-many-requests") msg = "Demasiados intentos. Intente más tarde.";
      alert("❌ " + msg);
    });
};

window.crearUsuario = async function () {
  const email    = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPassword").value;
  if (!email || !password) { alert("⚠️ Ingrese correo y contraseña"); return; }
  if (password.length < 6) { alert("⚠️ La contraseña debe tener mínimo 6 caracteres"); return; }

  try {
    const snap = await getDocs(collection(db, "usuarios"));
    if (snap.size >= 3) { alert("⚠️ Límite de usuarios alcanzado."); return; }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await addDoc(collection(db, "usuarios"), {
      uid: cred.user.uid, email, creadoEn: new Date().toISOString()
    });

    alert("✅ Usuario creado: " + email);
    document.getElementById("newEmail").value    = "";
    document.getElementById("newPassword").value = "";
    toggleCrear();
  } catch (err) {
    let msg = err.message;
    if (err.code === "auth/email-already-in-use") msg = "Ese correo ya está registrado.";
    alert("❌ Error: " + msg);
  }
};

window.toggleCrear = function () {
  const box = document.getElementById("createUserBox");
  if (!box) return;
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
};

export { app, auth, db };
