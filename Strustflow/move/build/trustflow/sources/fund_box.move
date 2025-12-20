module trustflow::fund_box {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use std::string::{Self, String}; // Thêm thư viện xử lý chuỗi
    use sui::vec_set::{Self, VecSet};
    use sui::transfer;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};

    // --- CÁC MÃ LỖI ---
    const ENotAdmin: u64 = 0;
    const EAlreadyVoted: u64 = 1;
    const ENotEnoughVotes: u64 = 2;
    const EAlreadyExecuted: u64 = 3;
    const ENotEnoughFunds: u64 = 4;
    const ENotCreator: u64 = 99; 

    // --- LINK ẢNH NFT (Bạn có thể thay bằng link IPFS của bạn sau này) ---
    const IMG_BRONZE: vector<u8> = b"https://cdn-icons-png.flaticon.com/512/2583/2583319.png";
    const IMG_SILVER: vector<u8> = b"https://cdn-icons-png.flaticon.com/512/2583/2583344.png";
    const IMG_GOLD: vector<u8> = b"https://cdn-icons-png.flaticon.com/512/2583/2583434.png";

    // --- STRUCTS ---

    public struct Pool has key {
        id: UID,
        balance: Balance<SUI>,
        admins: VecSet<address>,
    }

    public struct Proposal has key, store {
        id: UID,
        amount: u64,
        recipient: address,
        reason: String,
        approvals: VecSet<address>,
        is_executed: bool,
        creator: address,
    }

    // [MỚI] NFT THƯỞNG CHO NHÀ HẢO TÂM
    public struct DonorBadge has key, store {
        id: UID,
        name: String,
        tier: String, // Bronze, Silver, Gold
        image_url: String,
        issue_date: u64, // Có thể dùng timestamp (tạm thời để số transaction)
    }

    // --- EVENTS ---

    public struct DonateEvent has copy, drop {
        donor: address,
        amount: u64,
        region: String,
        message: String,
        is_anonymous: bool,
    }

    public struct ProposalCreated has copy, drop {
        proposal_id: ID,
        amount: u64,
        recipient: address,
        reason: String,
        creator: address,
    }

    // --- INIT ---
    fun init(ctx: &mut TxContext) {
        let sender = ctx.sender();
        let mut admins = vec_set::empty();
        vec_set::insert(&mut admins, sender);

        let pool = Pool {
            id: object::new(ctx),
            balance: balance::zero(),
            admins,
        };
        transfer::share_object(pool);
    }

    // --- LOGIC DONATE + MINT NFT ---
    public entry fun donate(
        pool: &mut Pool, 
        cash: Coin<SUI>, 
        _ref_address: address, 
        is_anonymous: bool,
        region: String,
        message: String,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&cash);
        let donor = ctx.sender();

        // 1. Nhận tiền
        let coin_balance = coin::into_balance(cash);
        balance::join(&mut pool.balance, coin_balance);

        // 2. [MỚI] Logic thưởng NFT
        // 1 SUI = 1_000_000_000 MIST
        if (amount >= 1_000_000_000) {
            let (tier_name, img_url) = if (amount >= 50_000_000_000) {
                (b"GOLD DONOR", IMG_GOLD) // > 50 SUI
            } else if (amount >= 10_000_000_000) {
                (b"SILVER DONOR", IMG_SILVER) // > 10 SUI
            } else {
                (b"BRONZE DONOR", IMG_BRONZE) // > 1 SUI
            };

            // Tạo NFT
            let badge = DonorBadge {
                id: object::new(ctx),
                name: string::utf8(tier_name),
                tier: string::utf8(tier_name),
                image_url: string::utf8(img_url),
                issue_date: ctx.epoch(),
            };

            // Gửi NFT thẳng vào ví người quyên góp
            transfer::public_transfer(badge, donor);
        };

        // 3. Emit sự kiện
        event::emit(DonateEvent {
            donor,
            amount,
            region,
            message,
            is_anonymous
        });
    }

    // --- CÁC HÀM KHÁC GIỮ NGUYÊN ---
    
    public entry fun create_proposal(
        pool: &mut Pool, amount: u64, recipient: address, reason: String, ctx: &mut TxContext
    ) {
        let sender = ctx.sender();
        assert!(vec_set::contains(&pool.admins, &sender), ENotAdmin);
        let proposal_uid = object::new(ctx);
        let proposal_id = object::uid_to_inner(&proposal_uid);
        let proposal = Proposal {
            id: proposal_uid, amount, recipient, reason, approvals: vec_set::empty(), is_executed: false, creator: sender,
        };
        event::emit(ProposalCreated { proposal_id, amount, recipient, reason, creator: sender });
        transfer::share_object(proposal);
    }

    public entry fun approve_proposal(pool: &Pool, proposal: &mut Proposal, ctx: &mut TxContext) {
        let sender = ctx.sender();
        assert!(vec_set::contains(&pool.admins, &sender), ENotAdmin);
        assert!(proposal.is_executed == false, EAlreadyExecuted);
        assert!(!vec_set::contains(&proposal.approvals, &sender), EAlreadyVoted);
        vec_set::insert(&mut proposal.approvals, sender);
    }

    public entry fun execute_proposal(proposal: &mut Proposal, pool: &mut Pool, ctx: &mut TxContext) {
        assert!(vec_set::length(&proposal.approvals) >= 3, ENotEnoughVotes);
        assert!(proposal.is_executed == false, EAlreadyExecuted);
        assert!(balance::value(&pool.balance) >= proposal.amount, ENotEnoughFunds);
        let cash = coin::take(&mut pool.balance, proposal.amount, ctx);
        transfer::public_transfer(cash, proposal.recipient);
        proposal.is_executed = true;
    }

    public entry fun add_admin(pool: &mut Pool, new_admin: address, ctx: &mut TxContext) {
        let sender = ctx.sender();
        assert!(vec_set::contains(&pool.admins, &sender), ENotAdmin);
        if (!vec_set::contains(&pool.admins, &new_admin)) {
            vec_set::insert(&mut pool.admins, new_admin);
        }
    }

    public entry fun delete_proposal(_pool: &Pool, proposal: Proposal, ctx: &mut TxContext) {
        let sender = ctx.sender();
        assert!(proposal.creator == sender, ENotCreator);
        let Proposal { id, amount: _, recipient: _, reason: _, approvals: _, is_executed: _, creator: _ } = proposal;
        object::delete(id);
    }
}