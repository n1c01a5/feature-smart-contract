const { expect } = require("chai");

describe("Feature", function () {
  it("Should return the new transaction", async function () {
    const Feature = await ethers.getContractFactory("Feature");
    const feature = await Feature.deploy();

    await feature.deployed();

    const setFeatureTx = await feature.createTransaction(
      100,
      100,
      100,
      ""
    );

    // expect(await feature.greet()).to.equal("");

    // const setFeatureTx = await feature.setFeature("");

    // // wait until the transaction is mined
    // await setFeatureTx.wait();

    // expect(await feature.greet()).to.equal("");
  });
});
