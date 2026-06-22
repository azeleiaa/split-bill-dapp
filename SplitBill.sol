// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SplitBill
 * @dev Kontrak Pintar untuk membagi tagihan secara dinamis dan melakukan pembayaran on-chain.
 */
contract SplitBill {
    struct Bill {
        uint256 id;
        address creator;
        string description;
        uint256 totalAmount;
        uint256 amountPerPerson;
        address[] debtors;
    }

    struct BillDetail {
        uint256 id;
        address creator;
        string description;
        uint256 totalAmount;
        uint256 amountPerPerson;
        address[] debtors;
        bool[] paymentStatus;
        bool userPaidStatus; // Status pembayaran khusus untuk user yang memanggil (jika debtor)
    }

    uint256 private nextBillId;
    
    // Menyimpan seluruh tagihan yang dibuat
    Bill[] private bills;
    
    // Mapping dari Bill ID -> Debtor Address -> Status Lunas (true/false)
    mapping(uint256 => mapping(address => bool)) private isPaid;
    
    // Mapping dari Debtor Address -> Daftar ID Tagihan yang ditujukan kepadanya
    mapping(address => uint256[]) private debtorBillIds;
    
    // Mapping dari Creator Address -> Daftar ID Tagihan yang dibuatnya
    mapping(address => uint256[]) private creatorBillIds;

    // Events untuk pencatatan di blockchain log
    event BillCreated(
        uint256 indexed billId,
        address indexed creator,
        string description,
        uint256 totalAmount,
        uint256 amountPerPerson,
        address[] debtors
    );
    
    event BillPaid(
        uint256 indexed billId,
        address indexed debtor,
        address indexed creator,
        uint256 amount
    );

    /**
     * @dev Membuat tagihan baru dan menghitung pembagian secara rata.
     * Pembagian dihitung sebagai: Total Harga / (Jumlah Teman + 1 Pembuat)
     * @param _description Deskripsi singkat mengenai tagihan
     * @param _totalAmount Total nilai tagihan dalam wei
     * @param _debtors Array dari alamat dompet teman yang diajak split bill
     */
    function createSplitBill(
        string calldata _description,
        uint256 _totalAmount,
        address[] calldata _debtors
    ) external {
        require(_debtors.length > 0, "Harus memasukkan minimal satu teman.");
        require(_totalAmount > 0, "Total tagihan harus lebih besar dari 0.");
        
        // Pembagian rata: jumlah teman + 1 pembuat
        uint256 parts = _debtors.length + 1;
        uint256 amountPerPerson = _totalAmount / parts;
        require(amountPerPerson > 0, "Jumlah pembagian per orang terlalu kecil.");

        uint256 billId = nextBillId;
        nextBillId++;

        // Simpan data tagihan
        bills.push(Bill({
            id: billId,
            creator: msg.sender,
            description: _description,
            totalAmount: _totalAmount,
            amountPerPerson: amountPerPerson,
            debtors: _debtors
        }));

        // Hubungkan tagihan dengan masing-masing teman (debtor)
        for (uint256 i = 0; i < _debtors.length; i++) {
            require(_debtors[i] != address(0), "Alamat wallet teman tidak valid.");
            require(_debtors[i] != msg.sender, "Pembuat tagihan tidak bisa menjadi debtor.");
            debtorBillIds[_debtors[i]].push(billId);
        }
        
        // Hubungkan tagihan dengan pembuat (creator)
        creatorBillIds[msg.sender].push(billId);

        emit BillCreated(billId, msg.sender, _description, _totalAmount, amountPerPerson, _debtors);
    }

    /**
     * @dev Melakukan pembayaran tagihan.
     * Mengirimkan nilai ETH sesuai tagihan secara langsung ke dompet Creator.
     * @param _billId ID dari tagihan yang akan dibayar
     */
    function payBill(uint256 _billId) external payable {
        require(_billId < bills.length, "Tagihan tidak ditemukan.");
        Bill storage bill = bills[_billId];
        
        // Validasi apakah pengirim adalah salah satu debtor
        bool isDebtor = false;
        for (uint256 i = 0; i < bill.debtors.length; i++) {
            if (bill.debtors[i] == msg.sender) {
                isDebtor = true;
                break;
            }
        }
        require(isDebtor, "Anda tidak terdaftar dalam tagihan ini.");
        require(!isPaid[_billId][msg.sender], "Anda sudah membayar tagihan ini.");
        require(msg.value >= bill.amountPerPerson, "Jumlah ETH yang dikirim kurang.");

        // Tandai status pembayaran debtor menjadi lunas
        isPaid[_billId][msg.sender] = true;

        // Kirim dana langsung dari smart contract ke creator tagihan
        (bool success, ) = payable(bill.creator).call{value: msg.value}("");
        require(success, "Gagal mengirimkan ETH ke pembuat tagihan.");

        emit BillPaid(_billId, msg.sender, bill.creator, msg.value);
    }

    /**
     * @dev Mengambil daftar lengkap tagihan masuk untuk alamat debtor tertentu.
     * Mengembalikan array struct berisi info detail dan status pembayaran.
     */
    function getInboundBills(address _debtor) external view returns (BillDetail[] memory) {
        uint256[] storage billIds = debtorBillIds[_debtor];
        BillDetail[] memory details = new BillDetail[](billIds.length);
        
        for (uint256 i = 0; i < billIds.length; i++) {
            uint256 billId = billIds[i];
            Bill storage bill = bills[billId];
            
            bool[] memory statuses = new bool[](bill.debtors.length);
            bool userPaid = false;
            for (uint256 j = 0; j < bill.debtors.length; j++) {
                statuses[j] = isPaid[billId][bill.debtors[j]];
                if (bill.debtors[j] == _debtor) {
                    userPaid = statuses[j];
                }
            }
            
            details[i] = BillDetail({
                id: billId,
                creator: bill.creator,
                description: bill.description,
                totalAmount: bill.totalAmount,
                amountPerPerson: bill.amountPerPerson,
                debtors: bill.debtors,
                paymentStatus: statuses,
                userPaidStatus: userPaid
            });
        }
        return details;
    }

    /**
     * @dev Mengambil daftar lengkap tagihan keluar yang dibuat oleh alamat creator tertentu.
     */
    function getOutboundBills(address _creator) external view returns (BillDetail[] memory) {
        uint256[] storage billIds = creatorBillIds[_creator];
        BillDetail[] memory details = new BillDetail[](billIds.length);
        
        for (uint256 i = 0; i < billIds.length; i++) {
            uint256 billId = billIds[i];
            Bill storage bill = bills[billId];
            
            bool[] memory statuses = new bool[](bill.debtors.length);
            for (uint256 j = 0; j < bill.debtors.length; j++) {
                statuses[j] = isPaid[billId][bill.debtors[j]];
            }
            
            details[i] = BillDetail({
                id: billId,
                creator: bill.creator,
                description: bill.description,
                totalAmount: bill.totalAmount,
                amountPerPerson: bill.amountPerPerson,
                debtors: bill.debtors,
                paymentStatus: statuses,
                userPaidStatus: false
            });
        }
        return details;
    }

    /**
     * @dev Mengambil detail lengkap satu tagihan berdasarkan ID.
     */
    function getBillDetails(uint256 _billId) external view returns (
        uint256 id,
        address creator,
        string memory description,
        uint256 totalAmount,
        uint256 amountPerPerson,
        address[] memory debtors,
        bool[] memory paymentStatus
    ) {
        require(_billId < bills.length, "Tagihan tidak ditemukan.");
        Bill storage bill = bills[_billId];
        
        bool[] memory statuses = new bool[](bill.debtors.length);
        for (uint256 i = 0; i < bill.debtors.length; i++) {
            statuses[i] = isPaid[_billId][bill.debtors[i]];
        }

        return (
            bill.id,
            bill.creator,
            bill.description,
            bill.totalAmount,
            bill.amountPerPerson,
            bill.debtors,
            statuses
        );
    }
}
