const { expect } = require("chai");

const provider = ethers.provider;
let feature, arbitrator;
let deployer, sender0, receiver0
let contractAsSignerDeployer,
    contractAsSignerSender0

beforeEach(async function () {
  // Get the ContractFactory and Signers here.
  // TODO: deploy an Arbitrator
  const Feature = await ethers.getContractFactory("Feature");
  const CentralizedArbitrator = await ethers.getContractFactory("CentralizedArbitrator");

  [deployer, arbitrator, sender0, receiver0, ...addrs] = await ethers.getSigners();

  feature = await Feature.deploy();
  arbitrator = await CentralizedArbitrator.deploy("20000000000000000"); // 0.02 ether

  await feature.deployed();
  await arbitrator.deployed();

  contractAsSignerDeployer = feature.connect(deployer);
  contractAsSignerSender0 = feature.connect(sender0);
  contractAsSignerReceiver0 = feature.connect(receiver0);

  const initializeTx = await contractAsSignerDeployer.initialize(
    arbitrator.address, // Arbitrator address
    "0x85", // ArbitratorExtraData
    "604800" // Fee Timeout: 604800s => 1 day
  );
});

describe("Feature", function () {
  it("Should reward the receiver after a claim", async function () {
    const createTransactionTx = await contractAsSignerSender0.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10days
      "259200", // _timeoutClaim => 3days
      "", // _metaEvidence
      {
        value: "1000000000000000000" // 1eth in wei
      }
    );

    expect((await feature.transactions(0)).sender).to.equal(sender0.address);
    expect((await feature.transactions(0)).delayClaim).to.equal("259200");

    const claimTx = await contractAsSignerReceiver0.claim(
      0, // _transactionID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    // wait until the transaction is mined
    const transactionMinedClaimTx = await claimTx.wait();
    const gasFeeClaimTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000)

    expect((await feature.claims(0)).transactionID).to.equal(0);

    await network.provider.send("evm_increaseTime", [259200])
    await network.provider.send("evm_mine") // this one will have 100s more

    const payTx = await contractAsSignerDeployer.pay(
      0 // _claimID
    );

    await payTx.wait();

    const newBalanceReceiverExpected = new ethers.BigNumber.from("10001000000000000000000").sub(gasFeeClaimTx)

    expect((await provider.getBalance(receiver0.address)).toString()).to.equal(newBalanceReceiverExpected.toString());
  });
});
