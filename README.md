# FEATURE

## Getting Started

`cp .env.example .env`
`npm run test`

## Deploy

`npx hardhat run scripts/deploy.js --network <network>`

## Etherscan Verification

`npx hardhat clean`
`npx hardhat verify --network <network> <smart contract address>`

## Run Test with event logs

``npx hardhat test --logs`
