const { expect } = require("chai");

const provider = ethers.provider;
let feature, arbitrator;
let deployer, sender0, receiver0, sender1, receiver1;
let contractAsSignerDeployer,
    contractAsSignerSender0;

beforeEach(async function () {
  // Get the ContractFactory and Signers here.
  // TODO: deploy an Arbitrator
  const Feature = await ethers.getContractFactory("Feature");
  const CentralizedArbitrator = await ethers.getContractFactory("CentralizedArbitrator");

  [deployer, arbitrator, sender0, receiver0, sender1, receiver1] = await ethers.getSigners();

  feature = await Feature.deploy();
  arbitrator = await CentralizedArbitrator.deploy("20000000000000000"); // 0.02 ether

  await feature.deployed();
  await arbitrator.deployed();

  contractAsSignerDeployer = feature.connect(deployer);
  contractAsSignerSender0 = feature.connect(sender0);
  contractAsSignerReceiver0 = feature.connect(receiver0);
  contractAsSignerSender1 = feature.connect(sender1);
  contractAsSignerReceiver1 = feature.connect(receiver1);

  const initializeTx = await contractAsSignerDeployer.initialize(
    arbitrator.address, // Arbitrator address
    "0x85", // ArbitratorExtraData
    "604800" // Fee Timeout: 604800s => 1 day
  );
});

describe("Feature", function () {
  it("Should pay the receiver after a claim and a payment", async function () {
    const createTransactionTx = await contractAsSignerSender0.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10 days
      "259200", // _timeoutClaim => 3 days
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

  it("Should give back the money to the sender after a valid claim timeout payment", async function () {
    const createTransactionTx = await contractAsSignerSender1.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10days
      "259200", // _timeoutClaim => 3days
      "", // _metaEvidence
      {
        value: "1000000000000000000", // 1eth in wei
        gasPrice: 150000000000
      }
    );

    expect((await feature.transactions(0)).sender).to.equal(sender1.address);

    // wait until the transaction is mined
    const transactionMinedClaimTx = await createTransactionTx.wait();
    const gasFeeCreateTransactionTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000)

    await network.provider.send("evm_increaseTime", [864000])
    await network.provider.send("evm_mine") // this one will have 100s more

    const withdrawTx = await contractAsSignerDeployer.refund(
      0 // _transactionID
    );

    await withdrawTx.wait();

    const newBalanceSenderExpected = new ethers.BigNumber.from("10000000000000000000000").sub(gasFeeCreateTransactionTx)

    expect((await provider.getBalance(sender1.address)).toString()).to.equal(newBalanceSenderExpected.toString());
  });

  it("Should give the arbitration fee and the total deposit to the challenger after a successful challenge", async function () {
    // challengeClaim
    // si le challenger a raison il récupère le deposit et le sender pourra eventuellement recuperer ses fonds a pres un tiemout payment

    // isExecuted = true
  });

  it("Should give the amount of transaction and the total deposit to the claimer after a aborted challenge", async function () {
    // si le challenger c

    // isExecuted = false

    // if timeout passed => refund => {isExecuted = false}
  });
});
