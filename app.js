/* ─── TON Connect Integration ─── */

// Load TON Connect SDK dynamically
(function loadSDK() {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
  script.onload = initTonConnect;
  script.onerror = () => {
    console.warn('TON Connect SDK not loaded, running in demo mode');
    initDemo();
  };
  document.head.appendChild(script);
})();

// ─── State ───────────────────────────────────────────────────
let tonConnectUI = null;
let currentAddress = null;
let isDemoMode = false;

// ─── Init TON Connect ─────────────────────────────────────────
function initTonConnect() {
  try {
    // Replace with your actual manifest URL if you have one
    const manifestUrl = window.location.href.replace('index.html', '') + 'tonconnect-manifest.json';

    tonConnectUI = new window.TonConnectUI.TonConnectUI({
      manifestUrl,
      buttonRootId: null, // We use our own UI
    });

    // Listen for connection changes
    tonConnectUI.onStatusChange(wallet => {
      if (wallet) {
        const address = wallet.account.address;
        onWalletConnected(address);
      } else {
        onWalletDisconnected();
      }
    });

    // Check if already connected
    if (tonConnectUI.wallet) {
      onWalletConnected(tonConnectUI.wallet.account.address);
    }

    console.log('✅ TON Connect initialized');
  } catch (err) {
    console.warn('TON Connect init failed, using demo mode:', err);
    initDemo();
  }
}

function initDemo() {
  isDemoMode = true;
  console.log('🎭 Running in demo mode (no real wallet connection)');
}

// ─── Connect wallet by name ───────────────────────────────────
async function connectWallet(walletName) {
  animateCardPulse();

  if (isDemoMode) {
    showToast(`Демо: Открываем ${getWalletLabel(walletName)}...`);
    await delay(1200);
    const demoAddress = 'UQD' + randomHex(46);
    onWalletConnected(demoAddress);
    return;
  }

  try {
    showToast(`Открываем ${getWalletLabel(walletName)}...`);

    const walletsList = await tonConnectUI.getWallets();
    const targetWallet = walletsList.find(w =>
      w.appName?.toLowerCase().includes(walletName) ||
      w.name?.toLowerCase().includes(walletName)
    );

    if (targetWallet) {
      await tonConnectUI.openSingleWalletModal(targetWallet.appName);
    } else {
      // Fallback to main modal
      await tonConnectUI.openModal();
    }
  } catch (err) {
    showToast('Не удалось открыть кошелёк. Попробуй QR.');
    console.error(err);
  }
}

// ─── Show QR Code ─────────────────────────────────────────────
async function showQR() {
  showState('qr');

  if (isDemoMode) {
    await delay(800);
    renderDemoQR();
    return;
  }

  try {
    await tonConnectUI.openModal();
    showState('disconnected'); // Modal handles QR
  } catch (err) {
    console.error(err);
    renderDemoQR();
  }
}

async function renderDemoQR() {
  const container = document.getElementById('qr-container');
  // Use QR code library from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.onload = () => {
    container.innerHTML = '';
    const demoLink = 'ton://connect?id=demo_' + randomHex(32);
    new QRCode(container, {
      text: demoLink,
      width: 210,
      height: 210,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });

    // Simulate connection after scan
    setTimeout(() => {
      showToast('Демо: Имитируем подключение...');
      setTimeout(() => {
        const demoAddress = 'UQD' + randomHex(46);
        onWalletConnected(demoAddress);
      }, 2000);
    }, 5000);
  };
  document.head.appendChild(script);
}

// ─── Disconnect ───────────────────────────────────────────────
async function disconnectWallet() {
  if (!isDemoMode && tonConnectUI) {
    try {
      await tonConnectUI.disconnect();
    } catch (err) {
      console.error(err);
    }
  }
  onWalletDisconnected();
}

// ─── On Connect ───────────────────────────────────────────────
async function onWalletConnected(rawAddress) {
  currentAddress = rawAddress;
  const friendlyAddress = toFriendlyAddress(rawAddress);

  document.getElementById('wallet-address').textContent = shortenAddress(friendlyAddress);
  document.getElementById('wallet-address').setAttribute('data-full', friendlyAddress);
  document.getElementById('wallet-balance').textContent = 'Загрузка...';

  showState('connected');
  showToast('✅ Кошелёк подключён!');

  // Fetch balance
  fetchBalance(friendlyAddress);
}

function onWalletDisconnected() {
  currentAddress = null;
  showState('disconnected');
  showToast('Кошелёк отключён');
}

// ─── Balance ──────────────────────────────────────────────────
async function fetchBalance(address) {
  try {
    // Use toncenter API
    const url = `https://toncenter.com/api/v2/getAddressBalance?address=${address}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok) {
      const nanotons = BigInt(data.result);
      const tons = Number(nanotons) / 1e9;
      document.getElementById('wallet-balance').textContent =
        tons.toFixed(4) + ' TON';
    } else {
      document.getElementById('wallet-balance').textContent = '— TON';
    }
  } catch (err) {
    // Demo fallback
    const demoBalance = (Math.random() * 100).toFixed(4);
    document.getElementById('wallet-balance').textContent = demoBalance + ' TON (demo)';
  }
}

// ─── Copy Address ─────────────────────────────────────────────
function copyAddress() {
  const el = document.getElementById('wallet-address');
  const full = el.getAttribute('data-full') || el.textContent;
  navigator.clipboard.writeText(full).then(() => {
    showToast('📋 Адрес скопирован!');
  });
}

// ─── UI State Manager ────────────────────────────────────────
function showState(name) {
  document.querySelectorAll('.state').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById('state-' + name);
  if (el) {
    el.classList.remove('hidden');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'fadeUp 0.4s ease forwards';
  }
}

function showDisconnected() { showState('disconnected'); }

// ─── Toast ────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── Helpers ──────────────────────────────────────────────────
function getWalletLabel(name) {
  const map = {
    tonkeeper: 'Tonkeeper',
    mytonwallet: 'MyTonWallet',
    tonhub: 'Tonhub',
    openmask: 'OpenMask',
  };
  return map[name] || name;
}

function shortenAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function toFriendlyAddress(raw) {
  // If already looks friendly, return as-is
  if (/^[UEk0][Qf]/.test(raw)) return raw;
  return raw; // Return raw if can't convert
}

function randomHex(len) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function animateCardPulse() {
  const card = document.getElementById('wallet-card');
  card.style.boxShadow = '0 0 60px rgba(0,152,234,0.4)';
  setTimeout(() => { card.style.boxShadow = ''; }, 600);
}

// ─── CSS Animation ───────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);

// ─── Animated Background Canvas ──────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const COUNT = 60;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      hue: Math.random() > 0.7 ? 195 : 200, // TON blue range
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, createParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,152,234,${0.06 * (1 - dist / 140)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();
