// ============================================================
// PRODUITS — remplacez par vos vrais appareils / stock réel
// ============================================================
const PRODUCTS = [
  { id: 'clim-9k', category: 'clim', name: 'Climatiseur mobile 9000 BTU', price: 329, stock: 8, maxStock: 20, icon: '❄️', image: 'photos/clim-9k.jpg' },
  { id: 'clim-12k-silence', category: 'clim', name: 'Climatiseur mobile 12000 BTU silencieux', price: 449, stock: 4, maxStock: 20, icon: '🧊' },
  { id: 'clim-split', category: 'clim', name: 'Climatiseur split Inverter 12000 BTU', price: 599, stock: 3, maxStock: 15, icon: '❄️', image: 'photos/clim-split.jpg' },
  { id: 'vent-pied', category: 'vent', name: 'Ventilateur sur pied 3 vitesses', price: 39, stock: 22, maxStock: 40, icon: '🌀', image: 'photos/vent-pied.jpg' },
  { id: 'vent-brume', category: 'vent', name: 'Ventilateur brumisateur extérieur', price: 79, stock: 11, maxStock: 30, icon: '💦' },
  { id: 'vent-usb', category: 'vent', name: 'Mini ventilateur USB rechargeable', price: 19, stock: 35, maxStock: 50, icon: '🔌', image: 'photos/vent-usb.jpg' },
];
// ============================================================
// FIREBASE — À REMPLACER par la configuration de votre projet
// (Console Firebase > Paramètres du projet > Vos applications)
// Tant que ce n'est pas fait, la connexion/inscription reste désactivée
// mais le reste du site (catalogue, réservation) fonctionne normalement.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyB2HaXnwXK8xU1n23eItjscT_diuaaV0cQ",
  authDomain: "souffle-frais.firebaseapp.com",
  projectId: "souffle-frais",
  storageBucket: "souffle-frais.firebasestorage.app",
  messagingSenderId: "281045967809",
  appId: "1:281045967809:web:e1d806796d6c88a13d0540"
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
    // Garde le client connecté sur son téléphone tant qu'il ne se déconnecte pas lui-même
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  }
} catch (e) {
  console.warn('Firebase non configuré :', e.message);
}

// Reconnecte automatiquement un client déjà inscrit, au chargement de la page
function watchAuthState() {
  if (!firebaseReady) return;
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const profileDoc = await db.collection('users').doc(user.uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      currentUser = { firstName: profile.firstName || '', lastName: profile.lastName || '', email: user.email, phone: profile.phone, city: profile.city, zip: profile.zip };
    } else {
      currentUser = null;
    }
    renderUserStatus();
  });
}

function renderUserStatus() {
  const el = document.getElementById('userStatus');
  if (!el) return;
  if (currentUser) {
    el.innerHTML = '';
    const greeting = document.createElement('span');
    greeting.textContent = `Bonjour ${currentUser.firstName}`;
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'link-btn logout-btn';
    logoutBtn.textContent = 'Déconnexion';
    logoutBtn.addEventListener('click', () => auth.signOut());
    el.append(greeting, logoutBtn);
  } else {
    el.innerHTML = '';
  }
}

// ============================================================
// FEDAPAY — À REMPLACER par la clé publique de votre compte
// (Tableau de bord FedaPay > Paramètres > Clés API)
// Créez un compte de type "Individuel / Startup" sur fedapay.com
// ============================================================
const fedapayConfig = {
  publicKey: 'VOTRE_CLE_PUBLIQUE_FEDAPAY',
  environment: 'live' // mettez 'sandbox' pour tester sans vrai paiement
};
// Le XOF est indexé sur l'euro à un taux fixe (pas besoin de le mettre à jour)
const EUR_TO_XOF = 655.957;

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
  const deposit = Math.round(total * 0.5 * 100) / 100;
  const balance = total - deposit;
  document.getElementById('checkoutTotal').textContent = formatPrice(total);
  document.getElementById('checkoutDeposit').textContent = formatPrice(deposit);
  document.getElementById('checkoutBalance').textContent = formatPrice(balance);

  document.getElementById('deliveryChoice').value = 'pickup';
  document.getElementById('deliveryAddressRow').style.display = 'none';
  document.getElementById('deliveryAddress').value = '';

  document.getElementById('checkoutModal').classList.add('open');
  document.getElementById('checkoutOverlay').classList.add('visible');
}
function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('open');
  document.getElementById('checkoutOverlay').classList.remove('visible');
}

function startFedaPayCheckout() {
  if (!window.FedaPay) {
    alert("Le module de paiement FedaPay ne s'est pas chargé. Vérifiez votre connexion.");
    return;
  }
  if (fedapayConfig.publicKey === 'VOTRE_CLE_PUBLIQUE_FEDAPAY') {
    alert('Paiement indisponible : configurez FedaPay (voir script.js).');
    return;
  }
  if (cart.length === 0 || !currentUser) return;

  const deliveryChoice = document.getElementById('deliveryChoice').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
  if (deliveryChoice === 'delivery' && !deliveryAddress) {
    alert('Merci de préciser votre adresse de livraison.');
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const deposit = Math.round(total * 0.5 * 100) / 100;
  const depositXOF = Math.round(deposit * EUR_TO_XOF);
  const description = cart.map(item => item.name).join(', ').slice(0, 255);

  const FedaPay = window['FedaPay'];
  const widget = FedaPay.init({
    public_key: fedapayConfig.publicKey,
    environment: fedapayConfig.environment,
    transaction: {
      amount: depositXOF,
      description: `Acompte 50% - ${description || 'Réservation SouffleFrais'}`
    },
    currency: { iso: 'XOF' },
    customer: {
      email: currentUser.email,
      firstname: currentUser.firstName,
      lastname: currentUser.lastName,
      phone_number: { number: currentUser.phone, country: 'BJ' }
    },
    onComplete: (resp) => {
      if (resp.reason === FedaPay.DIALOG_DISMISSED) return;
      if (resp.transaction && resp.transaction.status === 'approved') {
        confirmReservation({
          transactionId: resp.transaction.id,
          total, deposit, balance: total - deposit,
          deliveryChoice, deliveryAddress
        });
      } else {
        alert('Le paiement a échoué ou a été refusé. Réessayez.');
      }
    }
  });
  widget.open();
}

async function confirmReservation(details) {
  // En production : vérifiez la transaction FedaPay côté serveur avant de
  // considérer l'acompte comme définitivement payé.
  if (firebaseReady && db && currentUser) {
    try {
      await db.collection('reservations').add({
        userEmail: currentUser.email,
        items: cart,
        total: details.total,
        deposit: details.deposit,
        balance: details.balance,
        balanceDue: 'à régler au retrait',
        deliveryChoice: details.deliveryChoice,
        deliveryAddress: details.deliveryChoice === 'delivery' ? details.deliveryAddress : null,
        fedapayTransactionId: details.transactionId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("Erreur d'enregistrement Firestore :", e);
    }
  }
  cart = [];
  renderCart();
  closeCheckoutModal();
  const balanceMsg = details.deliveryChoice === 'delivery'
    ? `Solde de ${formatPrice(details.balance)} à régler à la livraison.`
    : `Solde de ${formatPrice(details.balance)} à régler au retrait en boutique.`;
  alert(`Acompte reçu, réservation confirmée ! ${balanceMsg} Un email de confirmation vous a été envoyé.`);
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
  watchAuthState();

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
  document.getElementById('fedapayPayBtn').addEventListener('click', startFedaPayCheckout);
  document.getElementById('deliveryChoice').addEventListener('change', (e) => {
    document.getElementById('deliveryAddressRow').style.display = e.target.value === 'delivery' ? 'block' : 'none';
  });

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
      renderUserStatus();
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
      renderUserStatus();
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
