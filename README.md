# Sui Trustflow (Charity Wallet)

A decentralized application (DApp) for managing and donating to charitable causes using the **Sui Blockchain**.

## 🌟 Features

- **Secure Donations**: Make secure donations using SUI tokens.
- **Transparent Transactions**: All transactions and pool balances are recorded transparently on the Sui blockchain.
- **NFT Rewards**: Earn Bronze, Silver, or Gold Tier NFT badges automatically when you donate above certain thresholds.
- **Proposal System**: Admins can submit, vote on (requires multi-signature), and execute charitable grants or withdrawals.
- **Referral System**: Generate unique referral QR codes to invite others to donate.
- **Data Dashboard**: View real-time charts of donations and transparent list of incoming funds.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Sui CLI (for deploying the smart contracts if needed)
- A Sui Wallet (like Sui Wallet, Suiet, or Surf Wallet)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/sui-trustflow.git
   cd sui-trustflow
   ```

2. **Install frontend dependencies:**
   ```bash
   cd Strustflow
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables:**
   In the `Strustflow` directory, create a `.env` file referencing the given `.env.example`:
   ```env
   VITE_PACKAGE_ID=0x_your_deployed_package_id
   VITE_POOL_ID=0x_your_shared_pool_id
   VITE_SUI_NETWORK=testnet # Use mainnet for production
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## 📄 Smart Contracts (Move)

The smart contracts are written in the Move language and located in `Strustflow/move`.

### Deployment Instructions:
To deploy your own instance of the charity pool:
1. Ensure your Sui CLI is configured to the correct network (`sui client switch --env testnet`).
2. Navigate to the contract folder:
   ```bash
   cd Strustflow/move
   sui move build
   sui client publish --gas-budget 100000000
   ```
3. Extract the `Package ID` and the shared `Pool` object ID from the transaction logs and update your `.env` file.

## 🤝 Contributing
Contributions are welcome! Please open a Pull Request or create an Issue.

## 📝 License
Distributed under the MIT License.
