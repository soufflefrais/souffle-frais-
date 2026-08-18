// ============================================================
// PRODUITS — remplacez par vos vrais appareils / stock réel
// ============================================================
const PRODUCTS = [
  { id: 'clim-9k', category: 'clim', name: 'Climatiseur mobile 9000 BTU', price: 349, stock: 8, maxStock: 20, icon: '❄️' },
  { id: 'clim-12k-silence', category: 'clim', name: 'Climatiseur mobile 12000 BTU silencieux', price: 449, stock: 4, maxStock: 20, icon: '🧊' },
  { id: 'clim-split', category: 'clim', name: 'Climatiseur split Inverter 12000 BTU', price: 649, stock: 3, maxStock: 15, icon: '❄️' },
  { id: 'vent-pied', category: 'vent', name: 'Ventilateur sur pied 3 vitesses', price: 39, stock: 22, maxStock: 40, icon: '🌀' },
  { id: 'vent-brume', category: 'vent', name: 'Ventilateur brumisateur extérieur', price: 79, stock: 11, maxStock: 30, icon: '💦' },
  { id: 'vent-usb', category: 'vent', name: 'Mini ventilateur USB rechargeable', price: 19, stock: 35, maxStock: 50, icon: '🔌' },
];

// ============================================================
// FIREBASE — À REMPLACER par la configuration de votre projet
// (Console Firebase > Paramètres du projet > Vos applications)
// Tant que ce n'est pas fait, la connexion/inscription reste désactivée
// mais le reste du site (catalogue, réservation) fonctionne normalement.
// ============================================================
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

let auth = null;
let db = null;
let firebaseReady = false;

try {
  if (window.firebase && firebaseConfig.apiKey !== "VOTRE_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;
  }
} catch (e) {
  console.warn('Firebase non configuré :', e.message);
}

// ============================================================
// CINETPAY — À REMPLACER par les identifiants de votre compte
// (Tableau de bord CinetPay > Intégration)
// notify_url : idéalement une petite adresse serveur qui reçoit la
// confirmation de CinetPay ; sans ça, on se fie à waitResponse()
// ci-dessous, ce qui suffit pour démarrer.
// ============================================================
const cinetpayConfig = {
  apikey: 'VOTRE_APIKEY_CINETPAY',
  site_id: 'VOTRE_SITE_ID_CINETPAY',
  mode: 'PRODUCTION', // mettez 'SANDBOX' pour tester sans vrai paiement
  notify_url: 'https://votre-domaine.com/notify'
};

// ============================================================
// ÉTAT
// ============================================================
let cart = [];          // { productId, name, price }
let currentUser = null; // { firstName, lastName, email, phone, city, zip }

// ============================================================
// CATALOGUE
// ============================================================
function renderCatalogue() {
  document.querySelectorAll('.product-grid').forEach(grid => {
    const category = grid.dataset.category;
    grid.innerHTML = '';
    PRODUCTS.filter(p => p.category === category).forEach(product => {
      grid.appendChild(buildProductCard(product));
    });
  });
}

function buildProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';

  const visual = document.createElement('div');
  visual.className = 'product-visual';
  visual.textContent = product.icon;
  visual.setAttribute('aria-hidden', 'true');

  const name = document.createElement('h3');
  name.className = 'product-name';
  name.textContent = product.name;

  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = formatPrice(product.price);

  const gaugeLabel = document.createElement('div');
  gaugeLabel.className = 'gauge-label';
  const stockLeft = document.createElement('span');
  stockLeft.textContent = 'En stock';
  const stockRight = document.createElement('span');
  stockRight.className = 'gauge-count';
  stockRight.textContent = product.stock > 0 ? `${product.stock} restant${product.stock > 1 ? 's' : ''}` : 'Épuisé';
  gaugeLabel.append(stockLeft, stockRight);

  const gauge = document.createElement('div');
  gauge.className = 'gauge';
  const gaugeFill = document.createElement('div');
  gaugeFill.className = 'gauge-fill';
  const pct = Math.max(0, Math.min(100, Math.round((product.stock / product.maxStock) * 100)));
  gaugeFill.style.width = pct + '%';
  gauge.appendChild(gaugeFill);

  const btn = document.createElement('button');
  btn.className = 'add-btn';
  btn.type = 'button';
  btn.textContent = product.stock > 0 ? 'Réserver' : 'Rupture de stock';
  btn.disabled = product.stock <= 0;
  btn.addEventListener('click', () => reserveProduct(product));

  card.append(visual, name, price, gaugeLabel, gauge, btn);
  return card;
}

function formatPrice(value) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ============================================================
// RÉSERVATION / PANIER
// ============================================================
function reserveProduct(product) {
  if (product.stock <= 0) return;
  product.stock -= 1;
  cart.push({ productId: product.id, name: product.name, price: product.price });
  renderCatalogue();
  renderCart();
  openCart();
}

function removeFromCart(index) {
  const item = cart[index];
  const product = PRODUCTS.find(p => p.id === item.productId);
  if (product) product.stock += 1;
  cart.splice(index, 1);
  renderCatalogue();
  renderCart();
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  const proceedBtn = document.getElementById('proceedToCheckout');

  countEl.textContent = cart.length;

  if (cart.length === 0) {
    itemsEl.innerHTML = '';
    const empty = document.createElement('p');
    empty.className = 'cart-empty';
    empty.textContent = "Aucun appareil réservé pour l'instant.";
    itemsEl.appendChild(empty);
    proceedBtn.disabled = true;
  } else {
    itemsEl.innerHTML = '';
    cart.forEach((item, index) => {
      const line = document.createElement('div');
      line.className = 'cart-line';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cart-line-name';
      nameSpan.textContent = `${item.name} — ${formatPrice(item.price)}`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'cart-line-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Retirer';
      removeBtn.addEventListener('click', () => removeFromCart(index));
      line.append(nameSpan, removeBtn);
      itemsEl.appendChild(line);
    });
    proceedBtn.disabled = false;
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  totalEl.textContent = formatPrice(total);
}

// ============================================================
// PANNEAU RÉSERVATION
// ============================================================
function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('visible');
}
function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('visible');
}

// ============================================================
// CONNEXION / INSCRIPTION
// ============================================================
function openAuth() {
  document.getElementById('authModal').classList.add('open');
  document.getElementById('authOverlay').classList.add('visible');
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
  document.getElementById('authOverlay').classList.remove('visible');
}
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('signupForm').classList.toggle('active', tab === 'signup');
}

// ============================================================
// PAIEMENT
// ============================================================
function openCheckout() {
  const helloEl = document.getElementById('checkoutHello');
  helloEl.textContent = currentUser ? `Bonjour ${currentUser.firstName}, voici le récapitulatif de votre réservation.` : '';

  const summaryEl = document.getElementById('checkoutSummary');
  summaryEl.innerHTML = '';
  cart.forEach(item => {
    const line = document.createElement('div');
    line.className = 'checkout-line';
    const n = document.createElement('span');
    n.textContent = item.name;
    const p = document.createElement('span');
    p.textContent = formatPrice(item.price);
    line.append(n, p);
    summaryEl.appendChild(line);
  });

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('checkoutTotal').textContent = formatPrice(total);

  document.getElementById('checkoutModal').classList.add('open');
  document.getElementById('checkoutOverlay').classList.add('visible');
}
function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('open');
  document.getElementById('checkoutOverlay').classList.remove('visible');
}

function startCinetPayCheckout() {
  if (!window.CinetPay) {
    alert("Le module de paiement CinetPay ne s'est pas chargé. Vérifiez votre connexion.");
    return;
  }
  if (cinetpayConfig.apikey === 'VOTRE_APIKEY_CINETPAY') {
    alert('Paiement indisponible : configurez CinetPay (voir script.js).');
    return;
  }
  if (cart.length === 0 || !currentUser) return;

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const description = cart.map(item => item.name).join(', ').slice(0, 255);
  const transactionId = 'CMD' + Date.now();

  CinetPay.setConfig({
    apikey: cinetpayConfig.apikey,
    site_id: cinetpayConfig.site_id,
    mode: cinetpayConfig.mode,
    notify_url: cinetpayConfig.notify_url
  });

  CinetPay.getCheckout({
    transaction_id: transactionId,
    amount: total,
    // EUR est pris en charge par CinetPay, mais vérifiez que c'est bien
    // activé sur votre compte ; sinon, utilisez 'XOF' avec un montant converti.
    currency: 'EUR',
    channels: 'ALL',
    description: description || 'Réservation SouffleFrais',
    customer_name: currentUser.firstName,
    customer_surname: currentUser.lastName,
    customer_email: currentUser.email,
    customer_phone_number: currentUser.phone,
    customer_address: currentUser.city,
    customer_city: currentUser.city,
    customer_country: 'FR',
    customer_state: 'FR',
    customer_zip_code: currentUser.zip
  });

  CinetPay.waitResponse(function (data) {
    if (data.status === 'REFUSED') {
      alert('Le paiement a échoué. Réessayez.');
    } else if (data.status === 'ACCEPTED') {
      confirmReservation({ transactionId: transactionId });
    }
  });

  CinetPay.onError(function (data) {
    console.error('Erreur CinetPay :', data);
    alert("Le paiement n'a pas pu être finalisé. Réessayez.");
  });
}

async function confirmReservation(paymentDetails) {
  // En production : vérifiez et enregistrez la réservation côté serveur
  // (via notify_url) avant de la considérer comme définitivement payée.
  if (firebaseReady && db && currentUser) {
    try {
      await db.collection('reservations').add({
        userEmail: currentUser.email,
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0),
        cinetpayTransactionId: paymentDetails.transactionId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("Erreur d'enregistrement Firestore :", e);
    }
  }
  cart = [];
  renderCart();
  closeCheckoutModal();
  alert('Réservation confirmée ! Un email de confirmation vous a été envoyé.');
}

// ============================================================
// FENÊTRES MENTIONS LÉGALES / CONFIDENTIALITÉ
// ============================================================
function openLegalModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById('legalOverlay').classList.add('visible');
}
function closeLegalModals() {
  document.querySelectorAll('.modal-text').forEach(m => m.classList.remove('open'));
  document.getElementById('legalOverlay').classList.remove('visible');
}

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderCatalogue();
  renderCart();

  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  document.getElementById('closeAuth').addEventListener('click', closeAuthModal);
  document.getElementById('authOverlay').addEventListener('click', closeAuthModal);
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  document.getElementById('closeCheckout').addEventListener('click', closeCheckoutModal);
  document.getElementById('checkoutOverlay').addEventListener('click', closeCheckoutModal);
  document.getElementById('cinetpayPayBtn').addEventListener('click', startCinetPayCheckout);

  document.getElementById('proceedToCheckout').addEventListener('click', () => {
    if (cart.length === 0) return;
    closeCart();
    if (!currentUser) {
      openAuth();
    } else {
      openCheckout();
    }
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    if (!firebaseReady) {
      errorEl.textContent = 'Connexion indisponible : configurez Firebase (voir script.js).';
      return;
    }
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const profileDoc = await db.collection('users').doc(cred.user.uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      currentUser = { firstName: profile.firstName || '', lastName: profile.lastName || '', email, phone: profile.phone, city: profile.city, zip: profile.zip };
      closeAuthModal();
      openCheckout();
    } catch (err) {
      errorEl.textContent = 'Email ou mot de passe incorrect.';
    }
  });

  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const city = document.getElementById('signupCity').value.trim();
    const zip = document.getElementById('signupZip').value.trim();
    const password = document.getElementById('signupPassword').value;
    const consent = document.getElementById('consentRequired').checked;
    const marketing = document.getElementById('consentMarketing').checked;
    const errorEl = document.getElementById('signupError');
    errorEl.textContent = '';

    if (!consent) {
      errorEl.textContent = 'Le consentement est requis pour créer un compte.';
      return;
    }
    if (!firebaseReady) {
      errorEl.textContent = 'Création de compte indisponible : configurez Firebase (voir script.js).';
      return;
    }
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(cred.user.uid).set({
        firstName, lastName, email, phone, city, zip,
        consentTraitement: true,
        consentMarketing: marketing,
        consentDate: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentUser = { firstName, lastName, email, phone, city, zip };
      closeAuthModal();
      openCheckout();
    } catch (err) {
      errorEl.textContent = 'Impossible de créer le compte (email déjà utilisé ?).';
    }
  });

  document.querySelectorAll('.open-mentions').forEach(btn => {
    btn.addEventListener('click', () => openLegalModal('mentionsLegalesModal'));
  });
  document.querySelectorAll('.open-privacy').forEach(btn => {
    btn.addEventListener('click', () => openLegalModal('politiqueModal'));
  });
  document.querySelectorAll('[data-close-legal]').forEach(btn => {
    btn.addEventListener('click', closeLegalModals);
  });
  document.getElementById('legalOverlay').addEventListener('click', closeLegalModals);
});:root {
  --bg-dark: #0F2027;
  --bg-dark-2: #16333B;
  --bg-light: #F6FAF9;
  --surface: #FFFFFF;
  --teal: #4FBDAE;
  --teal-dark: #337F76;
  --coral: #F1602F;
  --ink: #12262B;
  --ink-soft: #5B6E71;
  --border: #E2EAE8;
  --radius: 14px;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Manrope', sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--bg-light);
  line-height: 1.5;
}
h1, h2, h3, .logo, .cart-count, .step-index, .price, .gauge-count {
  font-family: var(--font-display);
}
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; }

/* Header */
.site-header { position: sticky; top: 0; z-index: 40; background: var(--bg-dark); color: #fff; }
.header-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; gap: 16px; }
.logo { font-weight: 700; font-size: 1.3rem; color: #fff; text-decoration: none; letter-spacing: -0.02em; }
.logo span { color: var(--teal); }
.main-nav { display: none; gap: 24px; }
.main-nav a { color: #CFE7E3; text-decoration: none; font-size: 0.95rem; }
.main-nav a:hover { color: #fff; }
@media (min-width: 760px) { .main-nav { display: flex; } }
.cart-btn {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16);
  color: #fff; padding: 8px 14px; border-radius: 999px; cursor: pointer;
  font-family: var(--font-body); font-weight: 600; font-size: 0.9rem;
}
.cart-count {
  background: var(--coral); color: #fff; border-radius: 999px; min-width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; padding: 0 5px;
}
.user-status { display: flex; align-items: center; gap: 10px; color: #CFE7E3; font-size: 0.85rem; }
.logout-btn { color: var(--teal); text-decoration: underline; font-size: 0.8rem; }
.delivery-choice { margin: 14px 0; display: flex; flex-direction: column; gap: 6px; }
.delivery-choice label { font-size: 0.85rem; font-weight: 600; }
.delivery-choice select, .delivery-choice input {
  padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); font-family: var(--font-body); font-size: 0.95rem;
}

/* Hero */
.hero {
  background: linear-gradient(120deg, var(--bg-dark) 0%, var(--bg-dark-2) 55%, #1E4A4A 100%);
  background-size: 200% 200%; color: #fff; padding: 72px 0 88px;
}
@media (prefers-reduced-motion: no-preference) { .hero { animation: heatShift 14s ease-in-out infinite; } }
@keyframes heatShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
.eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.75rem; color: var(--teal); font-weight: 700; margin: 0 0 14px; }
.hero h1 { font-size: clamp(2.1rem, 5vw, 3.4rem); line-height: 1.08; margin: 0 0 18px; font-weight: 700; letter-spacing: -0.02em; }
.hero h1 em { font-style: normal; color: var(--coral); }
.hero-sub { font-size: 1.1rem; color: #CFE7E3; max-width: 480px; margin: 0 0 32px; }

.btn {
  display: inline-block; font-family: var(--font-body); font-weight: 700; font-size: 0.95rem;
  padding: 14px 26px; border-radius: 999px; border: none; cursor: pointer; text-decoration: none;
  transition: transform 0.15s ease, background 0.15s ease;
}
.btn-primary { background: var(--coral); color: #fff; }
.btn-primary:hover { background: #D94E20; transform: translateY(-1px); }
.btn-full { width: 100%; text-align: center; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* How it works */
.how-it-works, .catalogue { scroll-margin-top: 84px; padding: 64px 0; }
.how-it-works h2, .catalogue h2 { font-size: 1.8rem; margin: 0 0 32px; letter-spacing: -0.01em; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 28px; grid-template-columns: 1fr; }
@media (min-width: 720px) { .steps { grid-template-columns: repeat(3, 1fr); } }
.step-index {
  display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border-radius: 50%; background: var(--teal); color: #fff; font-weight: 700; margin-bottom: 14px;
}
.steps h3 { margin: 0 0 8px; font-size: 1.1rem; }
.steps p { margin: 0; color: var(--ink-soft); font-size: 0.95rem; }

/* Catalogue */
.catalogue-alt { background: #EFF6F5; }
.product-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.product-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; display: flex; flex-direction: column; gap: 12px;
}
.product-visual {
  width: 100%; height: 110px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: 2.6rem; background: linear-gradient(135deg, #E7F5F3, #D3ECE8);
}
.product-name { font-weight: 700; font-size: 1rem; margin: 0; }
.price { font-weight: 700; font-size: 1.15rem; color: var(--ink); margin: 0; }
.gauge { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
.gauge-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--teal), var(--coral)); }
.gauge-label { font-size: 0.8rem; color: var(--ink-soft); display: flex; justify-content: space-between; }
.gauge-count { font-weight: 700; color: var(--coral); }
.add-btn {
  background: var(--ink); color: #fff; border: none; border-radius: 999px; padding: 10px 16px;
  font-weight: 700; font-size: 0.9rem; cursor: pointer; font-family: var(--font-body);
}
.add-btn:hover { background: var(--teal-dark); }
.add-btn:disabled { background: #C7D0CE; cursor: not-allowed; }

/* Footer */
.site-footer { background: var(--bg-dark); color: #CFE7E3; padding: 40px 0; margin-top: 60px; }
.footer-inner { display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between; align-items: flex-start; }
.footer-logo { margin: 0 0 6px; }
.footer-note { margin: 0; font-size: 0.85rem; color: #9DBBB6; }
.footer-links { display: flex; flex-direction: column; gap: 8px; }
.footer-links a { color: #CFE7E3; }
.link-btn {
  background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer;
  font-family: var(--font-body); font-size: 0.9rem; padding: 0; text-align: left;
}
.link-btn.inline { display: inline; font-size: inherit; }

/* Panneau réservation + fenêtres */
.drawer-overlay, .modal-overlay {
  position: fixed; inset: 0; background: rgba(15,32,39,0.5); opacity: 0; pointer-events: none;
  transition: opacity 0.2s ease; z-index: 50;
}
.drawer-overlay.visible, .modal-overlay.visible { opacity: 1; pointer-events: auto; }
.cart-drawer {
  position: fixed; top: 0; right: 0; height: 100%; width: min(380px, 100%); background: var(--surface);
  z-index: 60; transform: translateX(100%); transition: transform 0.25s ease;
  display: flex; flex-direction: column; padding: 20px;
}
.cart-drawer.open { transform: translateX(0); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.icon-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--ink); }
.cart-items { flex: 1; overflow-y: auto; }
.cart-empty { color: var(--ink-soft); }
.cart-line { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 8px; }
.cart-line-name { font-weight: 600; font-size: 0.9rem; }
.cart-line-remove { background: none; border: none; color: var(--coral); cursor: pointer; font-size: 0.85rem; }
.cart-footer { border-top: 1px solid var(--border); padding-top: 16px; margin-top: 12px; }
.cart-total-row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 1.05rem; }

.modal {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -48%); width: min(420px, 92vw);
  max-height: 88vh; overflow-y: auto; background: var(--surface); border-radius: var(--radius);
  padding: 28px; z-index: 70; opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%); }
.modal-text ul { padding-left: 20px; color: var(--ink-soft); font-size: 0.92rem; }
.modal-close { position: absolute; top: 16px; right: 16px; }

.auth-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.auth-tab {
  flex: 1; background: var(--bg-light); border: 1px solid var(--border); padding: 10px; border-radius: 10px;
  cursor: pointer; font-weight: 700; font-family: var(--font-body); color: var(--ink-soft);
}
.auth-tab.active { background: var(--ink); color: #fff; border-color: var(--ink); }
.auth-form { display: none; flex-direction: column; gap: 6px; }
.auth-form.active { display: flex; }
.auth-form label { font-size: 0.85rem; font-weight: 600; margin-top: 8px; }
.auth-form input { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); font-family: var(--font-body); font-size: 0.95rem; }
.auth-form input:focus-visible, .btn:focus-visible, .add-btn:focus-visible, .icon-btn:focus-visible, .link-btn:focus-visible {
  outline: 3px solid var(--teal); outline-offset: 2px;
}
.checkbox-row { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: var(--ink-soft); margin-top: 12px; }
.checkbox-row input { margin-top: 3px; }
.form-error { color: var(--coral); font-size: 0.85rem; min-height: 1em; margin: 8px 0 0; }

.checkout-hello { color: var(--ink-soft); margin-top: -8px; }
.checkout-summary { margin: 16px 0; }
.checkout-line { display: flex; justify-content: space-between; font-size: 0.9rem; padding: 6px 0; }
.checkout-total-row { display: flex; justify-content: space-between; font-size: 1.1rem; padding: 12px 0; border-top: 1px solid var(--border); margin-bottom: 16px; }
.checkout-note { font-size: 0.8rem; color: var(--ink-soft); margin-top: 14px; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .hero { animation: none; }
  * { transition-duration: 0.01ms !important; }
                            }
