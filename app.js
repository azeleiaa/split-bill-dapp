/**
 * ==========================================================================
 * APLIKASI UTAMA (FRONTEND LOGIC) - SPLIT BILL DINAMIS
 * Menggunakan Ethers.js Versi 6
 * ==========================================================================
 */

// 1. ALAMAT DAN ABI SMART CONTRACT
// Catatan: Setelah men-deploy kontrak pintar Anda, masukkan alamat kontrak di sini.
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Alamat default local Hardhat/Anvil

const CONTRACT_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_description", "type": "string" },
            { "internalType": "uint256", "name": "_totalAmount", "type": "uint256" },
            { "internalType": "address[]", "name": "_debtors", "type": "address[]" }
        ],
        "name": "createSplitBill",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_billId", "type": "uint256" }
        ],
        "name": "payBill",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_debtor", "type": "address" }
        ],
        "name": "getInboundBills",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "id", "type": "uint256" },
                    { "internalType": "address", "name": "creator", "type": "address" },
                    { "internalType": "string", "name": "description", "type": "string" },
                    { "internalType": "uint256", "name": "totalAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountPerPerson", "type": "uint256" },
                    { "internalType": "address[]", "name": "debtors", "type": "address[]" },
                    { "internalType": "bool[]", "name": "paymentStatus", "type": "bool[]" },
                    { "internalType": "bool", "name": "userPaidStatus", "type": "bool" }
                ],
                "internalType": "struct SplitBill.BillDetail[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_creator", "type": "address" }
        ],
        "name": "getOutboundBills",
        "outputs": [
            {
                "components": [
                    { "internalType": "uint256", "name": "id", "type": "uint256" },
                    { "internalType": "address", "name": "creator", "type": "address" },
                    { "internalType": "string", "name": "description", "type": "string" },
                    { "internalType": "uint256", "name": "totalAmount", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountPerPerson", "type": "uint256" },
                    { "internalType": "address[]", "name": "debtors", "type": "address[]" },
                    { "internalType": "bool[]", "name": "paymentStatus", "type": "bool[]" },
                    { "internalType": "bool", "name": "userPaidStatus", "type": "bool" }
                ],
                "internalType": "struct SplitBill.BillDetail[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// 2. STATE APLIKASI
let provider = null;
let signer = null;
let contract = null;
let userAddress = "";

// 3. ELEMEN DOM UTAMA
const btnConnect = document.getElementById('btnConnect');
const btnConnectBody = document.getElementById('btnConnectBody');
const walletInfo = document.getElementById('walletInfo');
const accountAddress = document.getElementById('accountAddress');
const disconnectedState = document.getElementById('disconnectedState');
const connectedState = document.getElementById('connectedState');
const formCreateBill = document.getElementById('formCreateBill');
const billDescription = document.getElementById('billDescription');
const billTotalAmount = document.getElementById('billTotalAmount');
const debtorsContainer = document.getElementById('debtorsContainer');
const btnAddDebtor = document.getElementById('btnAddDebtor');
const valPerPerson = document.getElementById('valPerPerson');
const inboundContainer = document.getElementById('inboundContainer');
const outboundContainer = document.getElementById('outboundContainer');
const btnSubmitBill = document.getElementById('btnSubmitBill');

// UI Elemen Tambahan (v2)
const btnCopyAddr   = document.getElementById('btnCopyAddr');
const btnRefresh    = document.getElementById('btnRefresh');
const networkPill   = document.getElementById('networkPill');
const networkName   = document.getElementById('networkName');
const statInbound   = document.getElementById('statInbound');
const statOutbound  = document.getElementById('statOutbound');
const statPending   = document.getElementById('statPending');

// 4. EVENT LISTENERS UTAMA
window.addEventListener('load', initializeDApp);
btnConnect.addEventListener('click', connectWallet);
btnConnectBody.addEventListener('click', connectWallet);
btnAddDebtor.addEventListener('click', addNewDebtorRow);
billTotalAmount.addEventListener('input', updateSplitPreview);
debtorsContainer.addEventListener('input', updateSplitPreview);

// Copy alamat wallet ke clipboard
if (btnCopyAddr) {
    btnCopyAddr.addEventListener('click', () => {
        if (userAddress) {
            navigator.clipboard.writeText(userAddress).then(() => {
                showToast('Alamat wallet disalin!', 'success');
            }).catch(() => {
                showToast('Gagal menyalin alamat.', 'error');
            });
        }
    });
}

// Refresh manual data dashboard
if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        btnRefresh.classList.add('spinning');
        await refreshDashboard();
        setTimeout(() => btnRefresh.classList.remove('spinning'), 600);
    });
}

// 5. INISIALISASI dApp & DETEKSI WALLET
async function initializeDApp() {
    if (typeof window.ethereum !== 'undefined') {
        // PERBEDAAN ETHERS.JS V6:
        // ethers.providers.Web3Provider sudah diubah menjadi ethers.BrowserProvider.
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // Memeriksa apakah user sudah terhubung ke MetaMask sebelumnya
        try {
            const accounts = await provider.send("eth_accounts", []);
            if (accounts.length > 0) {
                await setupConnectedWallet();
            } else {
                showDisconnectedUI();
            }
        } catch (error) {
            console.error("Gagal mendeteksi akun:", error);
            showDisconnectedUI();
        }

        // PERBEDAAN ETHERS.JS V6:
        // Listener accountChanged mendeteksi perubahan akun dari wallet MetaMask
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
        showToast("MetaMask tidak terdeteksi! Silakan instal MetaMask.", "warning");
        showDisconnectedUI();
    }
}

// 6. FUNGSI KONEKSI WALLET
async function connectWallet() {
    if (!provider) {
        showToast("MetaMask tidak tersedia.", "error");
        return;
    }
    try {
        btnConnect.disabled = true;
        btnConnectBody.disabled = true;
        
        // Request izin koneksi wallet ke MetaMask
        await provider.send("eth_requestAccounts", []);
        await setupConnectedWallet();
        
        showToast("Koneksi wallet berhasil!", "success");
    } catch (error) {
        console.error("User menolak koneksi:", error);
        showToast("Koneksi dibatalkan oleh user.", "error");
        btnConnect.disabled = false;
        btnConnectBody.disabled = false;
    }
}

// 7. SETUP WALLET YANG TERHUBUNG
async function setupConnectedWallet() {
    // PERBEDAAN ETHERS.JS V6:
    // Mendapatkan signer dengan await provider.getSigner()
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    
    // Inisialisasi instance Smart Contract dengan Signer agar bisa mengirim transaksi
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // Update tampilan UI alamat akun
    accountAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    
    // Tampilkan network pill dengan nama jaringan
    if (networkPill && networkName) {
        try {
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);
            const chainNames = {
                1:     'Ethereum',
                5:     'Goerli',
                11155111: 'Sepolia',
                137:   'Polygon',
                31337: 'Localhost',
                1337:  'Localhost',
            };
            networkName.textContent = chainNames[chainId] || `Chain ${chainId}`;
            networkPill.classList.remove('hidden');
        } catch (e) {
            networkPill.classList.add('hidden');
        }
    }

    // Toggle state tampilan
    disconnectedState.classList.add('hidden');
    connectedState.classList.remove('hidden');
    walletInfo.classList.remove('hidden');
    btnConnect.classList.add('hidden');
    
    // Update data tagihan
    await refreshDashboard();
}

// 8. KETIKA AKUN METAMASK DIGANTI (REAL-TIME REFRESH)
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User memutus semua akun
        showDisconnectedUI();
        showToast("Wallet terputus.", "warning");
    } else {
        // Re-inisialisasi koneksi dengan alamat baru
        showToast("Akun MetaMask diganti, memuat ulang data...", "info");
        await setupConnectedWallet();
    }
}

// 9. DISPLAY STATE DISCONNECTED
function showDisconnectedUI() {
    userAddress = "";
    signer = null;
    contract = null;
    
    disconnectedState.classList.remove('hidden');
    connectedState.classList.add('hidden');
    walletInfo.classList.add('hidden');
    btnConnect.classList.remove('hidden');
    btnConnect.disabled = false;
    btnConnectBody.disabled = false;

    if (networkPill) networkPill.classList.add('hidden');
    if (statInbound)  statInbound.textContent  = '—';
    if (statOutbound) statOutbound.textContent = '—';
    if (statPending)  statPending.textContent  = '—';
}

// 10. FORM INPUT TEMAN SECARA DINAMIS
function addNewDebtorRow() {
    const rows = debtorsContainer.querySelectorAll('.debtor-row');
    const newIdx = rows.length + 1;
    
    const divRow = document.createElement('div');
    divRow.className = 'debtor-row';
    divRow.innerHTML = `
        <span class="row-number">${newIdx}</span>
        <input type="text" class="debtor-input" placeholder="0x..." required>
        <button type="button" class="btn-remove-row" title="Hapus">&times;</button>
    `;
    
    // Daftarkan listener hapus baris
    const btnRemove = divRow.querySelector('.btn-remove-row');
    btnRemove.addEventListener('click', () => {
        divRow.remove();
        reorderRowNumbers();
        updateSplitPreview();
    });

    debtorsContainer.appendChild(divRow);
    
    // Aktifkan semua tombol hapus jika jumlah baris > 1
    toggleRemoveButtons(true);
    updateSplitPreview();
}

function reorderRowNumbers() {
    const rows = debtorsContainer.querySelectorAll('.debtor-row');
    rows.forEach((row, index) => {
        row.querySelector('.row-number').textContent = index + 1;
    });
    // Jika sisa 1 baris, matikan tombol hapus
    if (rows.length === 1) {
        toggleRemoveButtons(false);
    }
}

function toggleRemoveButtons(enable) {
    const removeBtns = debtorsContainer.querySelectorAll('.btn-remove-row');
    removeBtns.forEach(btn => {
        btn.disabled = !enable;
    });
}

// Tambahkan listener default hapus baris ke input pertama
debtorsContainer.querySelector('.btn-remove-row').addEventListener('click', function(e) {
    e.target.parentElement.remove();
    reorderRowNumbers();
    updateSplitPreview();
});

// 11. ESTIMASI DAN PREVIEW PEMBAGIAN RATA
function updateSplitPreview() {
    const totalAmountEth = parseFloat(billTotalAmount.value) || 0;
    const debtorInputs = debtorsContainer.querySelectorAll('.debtor-input');
    const totalPeople = debtorInputs.length + 1; // Debtor + Pembuat Tagihan
    
    if (totalAmountEth > 0 && totalPeople > 0) {
        const share = totalAmountEth / totalPeople;
        valPerPerson.textContent = `${share.toFixed(5)} ETH`;
    } else {
        valPerPerson.textContent = '0.00 ETH';
    }
}

// 12. PENGIRIMAN DAN PEMBUATAN TAGIHAN (WRITE CONTRACT)
formCreateBill.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!contract) return;
    
    const desc = billDescription.value.trim();
    const totalEth = billTotalAmount.value;
    const debtorInputs = debtorsContainer.querySelectorAll('.debtor-input');
    
    // Kumpulkan alamat wallet teman
    const debtorAddresses = [];
    let hasInvalidAddress = false;
    
    debtorInputs.forEach(input => {
        const addr = input.value.trim();
        // PERBEDAAN ETHERS.JS V6:
        // Mengecek validitas alamat Ethereum menggunakan ethers.isAddress(addr)
        if (!ethers.isAddress(addr)) {
            hasInvalidAddress = true;
            input.classList.add('border-danger');
        } else {
            input.classList.remove('border-danger');
            debtorAddresses.push(addr);
        }
    });

    if (hasInvalidAddress) {
        showToast("Terdapat alamat wallet teman yang tidak valid. Periksa kembali format 0x...", "error");
        return;
    }

    // Pastikan tidak ada alamat yang sama dengan alamat pembuat tagihan
    if (debtorAddresses.includes(userAddress.toLowerCase()) || debtorAddresses.includes(userAddress)) {
        showToast("Alamat Anda sendiri tidak perlu dimasukkan sebagai teman.", "error");
        return;
    }

    try {
        btnSubmitBill.disabled = true;
        btnSubmitBill.innerHTML = `<span class="icon">⏳</span> Memproses di MetaMask...`;
        
        // PERBEDAAN ETHERS.JS V6:
        // Konversi nilai ETH ke satuan wei menggunakan ethers.parseEther()
        const totalAmountWei = ethers.parseEther(totalEth.toString());
        
        showToast("Konfirmasi transaksi di dompet MetaMask Anda...", "info");
        
        // Eksekusi fungsi createSplitBill di smart contract
        const tx = await contract.createSplitBill(desc, totalAmountWei, debtorAddresses);
        
        showToast("Transaksi berhasil terkirim! Menunggu konfirmasi block...", "info");
        
        // Tunggu hingga transaksi berhasil di-mine
        await tx.wait();
        
        showToast("Tagihan sukses dicatat di blockchain!", "success");
        
        // Reset form
        billDescription.value = "";
        billTotalAmount.value = "";
        debtorsContainer.innerHTML = `
            <div class="debtor-row">
                <span class="row-number">1</span>
                <input type="text" class="debtor-input" placeholder="0x..." required>
                <button type="button" class="btn-remove-row" title="Hapus" disabled>&times;</button>
            </div>
        `;
        // Daftarkan ulang listener hapus ke elemen baru
        debtorsContainer.querySelector('.btn-remove-row').addEventListener('click', function(e) {
            e.target.parentElement.remove();
            reorderRowNumbers();
            updateSplitPreview();
        });
        updateSplitPreview();
        
        // Refresh data dashboard
        await refreshDashboard();
        
    } catch (error) {
        console.error("Gagal membuat tagihan:", error);
        showToast("Transaksi pembuatan tagihan gagal: " + (error.reason || error.message || error), "error");
    } finally {
        btnSubmitBill.disabled = false;
        btnSubmitBill.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Kirim Tagihan ke Blockchain`;
    }
});

// 13. REFRESH & BACA DATA DASHBOARD (READ CONTRACT)
async function refreshDashboard() {
    if (!contract || !userAddress) return;
    
    // Tampilkan skeleton loader selagi memuat data
    renderSkeletonLoaders();
    
    try {
        // Ambil Tagihan Masuk (Inbound Bills)
        const inboundBills = await contract.getInboundBills(userAddress);
        renderInboundDashboard(inboundBills);
        
        // Ambil Tagihan Keluar (Outbound Bills)
        const outboundBills = await contract.getOutboundBills(userAddress);
        renderOutboundDashboard(outboundBills);
        
    } catch (error) {
        console.error("Gagal mengambil data dashboard:", error);
        showToast("Gagal memuat data dari Smart Contract.", "error");
    }
}

// 14. RENDERING TAMPILAN SKELETON LOADER
function renderSkeletonLoaders() {
    const skeletonHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div>`;
    inboundContainer.innerHTML = skeletonHTML;
    outboundContainer.innerHTML = skeletonHTML;
}

// 15. RENDERING TAGIHAN MASUK (INBOUND)
function renderInboundDashboard(bills) {
    inboundContainer.innerHTML = "";

    // Update stat
    if (statInbound) statInbound.textContent = bills.length;
    const pendingCount = bills.filter(b => !b.userPaidStatus).length;
    if (statPending) statPending.textContent = pendingCount;
    
    if (bills.length === 0) {
        inboundContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap">📂</div>
                <p>Tidak ada tagihan masuk untuk akun Anda.</p>
            </div>
        `;
        return;
    }
    
    // Tampilkan tagihan terbaru di paling atas
    const sortedBills = [...bills].reverse();
    
    sortedBills.forEach(bill => {
        // PERBEDAAN ETHERS.JS V6:
        // Konversi nilai Wei kembali ke Ether string dengan ethers.formatEther()
        const amountEth = ethers.formatEther(bill.amountPerPerson);
        const totalEth = ethers.formatEther(bill.totalAmount);
        
        const isPaid = bill.userPaidStatus;
        const statusLabel = isPaid ? "Lunas" : "Belum Dibayar";
        const ribbonClass = isPaid ? "ribbon-paid" : "ribbon-unpaid";
        
        const card = document.createElement('div');
        card.className = 'bill-card';
        card.innerHTML = `
            <div class="card-ribbon ${ribbonClass}">${statusLabel}</div>
            
            <div class="bill-header">
                <div class="bill-description">${escapeHtml(bill.description)}</div>
                <div class="bill-creator-addr">Penagih: <span>${bill.creator}</span></div>
            </div>
            
            <div class="bill-body">
                <div>
                    <div class="amount-label">Bagian Anda</div>
                    <div class="amount-value split">${parseFloat(amountEth).toFixed(5)} ETH</div>
                </div>
                <div>
                    <div class="amount-label" style="text-align: right;">Total Tagihan</div>
                    <div class="amount-value" style="font-size: 16px;">${parseFloat(totalEth).toFixed(4)} ETH</div>
                </div>
            </div>
            
            ${!isPaid ? `
                <div class="card-action">
                    <button class="btn btn-primary btn-pay" data-id="${bill.id}" data-amount="${bill.amountPerPerson}">
                        💳 Bayar Sekarang
                    </button>
                </div>
            ` : ''}
        `;
        
        // Daftarkan click listener ke tombol "Bayar Sekarang"
        if (!isPaid) {
            const btnPay = card.querySelector('.btn-pay');
            btnPay.addEventListener('click', () => payInboundBill(bill.id, bill.amountPerPerson));
        }
        
        inboundContainer.appendChild(card);
    });
}

// 16. RENDERING TAGIHAN KELUAR (OUTBOUND)
function renderOutboundDashboard(bills) {
    outboundContainer.innerHTML = "";

    // Update stat
    if (statOutbound) statOutbound.textContent = bills.length;
    
    if (bills.length === 0) {
        outboundContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap">📊</div>
                <p>Anda belum membuat tagihan apapun.</p>
            </div>
        `;
        return;
    }
    
    const sortedBills = [...bills].reverse();
    
    sortedBills.forEach(bill => {
        const totalEth = ethers.formatEther(bill.totalAmount);
        const perPersonEth = ethers.formatEther(bill.amountPerPerson);
        
        // Buat daftar pemantauan bayar untuk debtor
        let debtorsListHTML = "";
        let paidCount = 0;
        
        bill.debtors.forEach((debtor, index) => {
            const hasPaid = bill.paymentStatus[index];
            if (hasPaid) paidCount++;
            
            debtorsListHTML += `
                <div class="tracker-item">
                    <span class="tracker-addr">${debtor.slice(0, 8)}...${debtor.slice(-6)}</span>
                    <span class="tracker-status ${hasPaid ? 'status-paid' : 'status-pending'}">
                        ${hasPaid ? '✅ Lunas' : '⏳ Belum'}
                    </span>
                </div>
            `;
        });
        
        const isAllPaid = paidCount === bill.debtors.length;
        const statusLabel = isAllPaid ? "Lunas Semua" : `${paidCount}/${bill.debtors.length} Dibayar`;
        const ribbonClass = isAllPaid ? "ribbon-paid" : "ribbon-unpaid";

        const card = document.createElement('div');
        card.className = 'bill-card';
        card.innerHTML = `
            <div class="card-ribbon ${ribbonClass}">${statusLabel}</div>
            
            <div class="bill-header">
                <div class="bill-description">${escapeHtml(bill.description)}</div>
                <div class="bill-creator-addr">Pembagian: <span>${parseFloat(perPersonEth).toFixed(5)} ETH / orang</span></div>
            </div>
            
            <div class="bill-body">
                <div>
                    <div class="amount-label">Total Tagihan Anda</div>
                    <div class="amount-value">${parseFloat(totalEth).toFixed(5)} ETH</div>
                </div>
            </div>

            <div class="debtors-tracker">
                <div class="tracker-title">Daftar Status Teman</div>
                <div class="tracker-list">
                    ${debtorsListHTML}
                </div>
            </div>
        `;
        
        outboundContainer.appendChild(card);
    });
}

// 17. LOGIKA PEMBAYARAN TAGIHAN (WRITE CONTRACT)
async function payInboundBill(billId, amountWei) {
    if (!contract) return;
    
    try {
        // Cari tombol bayar terkait untuk visual loading
        const btn = document.querySelector(`.btn-pay[data-id="${billId}"]`);
        let originalText = "";
        if (btn) {
            originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="icon">⏳</span> Proses...`;
        }
        
        showToast("Konfirmasi pembayaran di dompet MetaMask Anda...", "info");
        
        // PERBEDAAN ETHERS.JS V6:
        // Memanggil fungsi smart contract payBill dengan mengirim value (ETH) via msg.value
        // format parameter: contract.methodName(args, { value: ... })
        const tx = await contract.payBill(billId, { value: amountWei });
        
        showToast("Pembayaran terkirim! Menunggu verifikasi blockchain...", "info");
        
        // Tunggu mining block
        await tx.wait();
        
        showToast("Pembayaran sukses! Dana ditransfer ke penagih.", "success");
        
        // Refresh data
        await refreshDashboard();
        
    } catch (error) {
        console.error("Gagal melakukan pembayaran:", error);
        showToast("Gagal membayar tagihan: " + (error.reason || error.message || error), "error");
        
        // Reset tombol jika gagal
        const btn = document.querySelector(`.btn-pay[data-id="${billId}"]`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `💳 Bayar Sekarang`;
        }
    }
}

// 18. FUNGSI UTILITY & NOTIFIKASI TOAST
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Handler klik tutup toast
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Hapus otomatis dalam 5 detik
    setTimeout(() => {
        removeToast(toast);
    }, 5000);
}

function removeToast(toast) {
    if (toast.parentNode) {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }
}

// Mencegah kerentanan XSS pada data dari blockchain
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
