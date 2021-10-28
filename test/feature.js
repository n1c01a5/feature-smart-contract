const { expect } = require("chai");

const provider = ethers.provider;
let feature, arbitrator;
let deployer, sender0, receiver0, sender1, receiver1, sender2, receiver2, sender3, receiver3, sender4, receiver4, challenger0, sender5, receiver5, challenger1;
let contractAsSignerDeployer,
    contractAsSignerSender0;

beforeEach(async function () {
  // Get the ContractFactory and Signers here.
  // TODO: deploy an Arbitrator
  const Feature = await ethers.getContractFactory("Feature");
  const CentralizedArbitrator = await ethers.getContractFactory("CentralizedArbitrator");

  [deployer, sender0, receiver0, sender1, receiver1, sender2, receiver2, sender3, receiver3, sender4, receiver4, challenger0, sender5, receiver5, challenger1] = await ethers.getSigners();

  feature = await Feature.deploy();
  arbitrator = await CentralizedArbitrator.deploy("20000000000000000"); // 0.02 ether

  await feature.deployed();
  await arbitrator.deployed();

  contractAsSignerDeployer = feature.connect(deployer);
  contractAsSignerSender0 = feature.connect(sender0);
  contractAsSignerReceiver0 = feature.connect(receiver0);
  contractAsSignerSender1 = feature.connect(sender1);
  contractAsSignerReceiver1 = feature.connect(receiver1);
  contractAsSignerSender2 = feature.connect(sender2);
  contractAsSignerReceiver2 = feature.connect(receiver2);
  contractAsSignerSender3 = feature.connect(sender3);
  contractAsSignerReceiver3 = feature.connect(receiver3);
  contractAsSignerSender4 = feature.connect(sender4);
  contractAsSignerReceiver4 = feature.connect(receiver4);
  contractAsSignerChallenger0 = feature.connect(challenger0);
  contractAsSignerSender5 = feature.connect(sender5);
  contractAsSignerReceiver5 = feature.connect(receiver5);
  contractAsSignerChallenger1 = feature.connect(challenger1);

  contractAsSignerJuror = arbitrator.connect(deployer);

  const initializeTx = await contractAsSignerDeployer.initialize(
    arbitrator.address, // Arbitrator address
    "0x85" // ArbitratorExtraData
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

    const getRunningClaimIDsOfTransactionTx = await contractAsSignerReceiver0.getRunningClaimIDsOfTransaction(
      0
    );

    expect(getRunningClaimIDsOfTransactionTx.length).to.equal(getRunningClaimIDsOfTransactionTx.length);

    const gasFeeClaimTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000);

    expect((await feature.claims(0)).transactionID).to.equal(0);

    await network.provider.send("evm_increaseTime", [259200]);
    await network.provider.send("evm_mine"); // this one will have 100s more

    const payTx = await contractAsSignerDeployer.pay(
      0 // _claimID
    );

    await payTx.wait();

    const newBalanceReceiverExpected = new ethers.BigNumber.from("10001000000000000000000").sub(gasFeeClaimTx);

    expect((await provider.getBalance(receiver0.address)).toString()).to.equal(newBalanceReceiverExpected.toString());
  });

  it("Should refund the money to the sender after a timeout payment without any claim", async function () {
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
    const gasFeeCreateTransactionTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000);

    await network.provider.send("evm_increaseTime", [864000]);
    await network.provider.send("evm_mine"); // this one will have 100s more

    const withdrawTx = await contractAsSignerDeployer.refund(
      0 // _transactionID
    );

    await withdrawTx.wait();

    const newBalanceSenderExpected = new ethers.BigNumber.from("10000000000000000000000").sub(gasFeeCreateTransactionTx);

    expect((await provider.getBalance(sender1.address)).toString()).to.equal(newBalanceSenderExpected.toString());
  });

  it("Should revert the refund to the sender if the timeout payment is not passed", async function () {
    const createTransactionTx = await contractAsSignerSender2.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10days
      "259200", // _timeoutClaim => 3days
      "", // _metaEvidence
      {
        value: "1000000000000000000", // 1eth in wei
        gasPrice: 150000000000
      }
    );

    expect((await feature.transactions(0)).sender).to.equal(sender2.address);

    // wait until the transaction is mined
    const transactionMinedClaimTx = await createTransactionTx.wait();
    const gasFeeCreateTransactionTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000);

    const claimTx = await contractAsSignerReceiver2.claim(
      0, // _transactionID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    await network.provider.send("evm_increaseTime", [42]);
    await network.provider.send("evm_mine"); // this one will have 100s more

    await expect(
      contractAsSignerDeployer.refund(0)
    ).to.be.revertedWith("The timeout payment should be passed.");
  });

  it("Should revert the refund to the sender if there is any claim", async function () {
    const createTransactionTx = await contractAsSignerSender3.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10days
      "259200", // _timeoutClaim => 3days
      "", // _metaEvidence
      {
        value: "1000000000000000000", // 1eth in wei
        gasPrice: 150000000000
      }
    );

    expect((await feature.transactions(0)).sender).to.equal(sender3.address);

    // wait until the transaction is mined
    const transactionMinedClaimTx = await createTransactionTx.wait();
    const gasFeeCreateTransactionTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000);

    const claimTx = await contractAsSignerReceiver3.claim(
      0, // _transactionID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    await network.provider.send("evm_increaseTime", [864000]);
    await network.provider.send("evm_mine"); // this one will have 100s more

    await expect(
      contractAsSignerDeployer.refund(0)
    ).to.be.revertedWith("The transaction should not to have running claims.");
  });

  it("Should give the arbitration fee and the total deposit to the challenger after a successful challenge", async function () {
    const createTransactionTx = await contractAsSignerSender4.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10 days
      "259200", // _timeoutClaim => 3 days
      "", // _metaEvidence
      {
        value: "1000000000000000000" // 1eth in wei
      }
    );

    // Claim
    const claimTx = await contractAsSignerReceiver4.claim(
      0, // _transactionID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    await claimTx.wait();

    // Challenge claim
    const challengeClaimTx = await contractAsSignerChallenger0.challengeClaim(
      0, // _claimID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    // wait until the transaction is mined
    const transactionMinedChallengeClaimTx = await challengeClaimTx.wait();

    const gasFeeChallengeClaimTx = transactionMinedChallengeClaimTx.gasUsed.valueOf().mul(150000000000);

    // Give ruling
    const giveRulingTx = await contractAsSignerJuror.giveRuling(
      0, // _disputeID
      2 // Ruling for the challenger
    );

    const claim = await feature.claims(0);

    // Claim status switch to Resolved.
    expect(parseInt(claim.status)).to.equal(2);

    const newBalanceChallenger0Expected = new ethers.BigNumber.from("10000200000000000000000").sub(gasFeeChallengeClaimTx);

    expect((await provider.getBalance(challenger0.address)).toString()).to.equal(newBalanceChallenger0Expected.toString());
  });

  it("Should give the amount of the total deposit to the claimer after a aborted challenge", async function () {
    const createTransactionTx = await contractAsSignerSender5.createTransaction(
      "100000000000000000", // _deposit for claim : 0.1eth => 10% of amount
      "864000", // _timeoutPayment => 10 days
      "259200", // _timeoutClaim => 3 days
      "", // _metaEvidence
      {
        value: "1000000000000000000" // 1eth in wei
      }
    );

    // Claim
    const claimTx = await contractAsSignerReceiver5.claim(
      0, // _transactionID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    // wait until the transaction is mined
    const transactionMinedClaimTx = await claimTx.wait();

    const gasFeeClaimTx = transactionMinedClaimTx.gasUsed.valueOf().mul(150000000000);

    // Challenge claim
    const challengeClaimTx = await contractAsSignerChallenger1.challengeClaim(
      0, // _claimID
      {
        value: "120000000000000000", // 0.12eth
        gasPrice: 150000000000
      }
    );

    await challengeClaimTx.wait();

    // Give ruling
    const rulingTx = await contractAsSignerJuror.giveRuling(
      0, // _disputeID
      1 // Ruling for the receiver
    );

    await rulingTx.wait();

    const newBalanceReceiver5Expected = new ethers.BigNumber.from("10000000000000000000000").sub(gasFeeClaimTx).sub("20000000000000000");

    expect((await provider.getBalance(receiver5.address)).toString()).to.equal(newBalanceReceiver5Expected.toString());
  });
});