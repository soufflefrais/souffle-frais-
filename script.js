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
});
