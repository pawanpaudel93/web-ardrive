import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy, log } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    log("----------------------------------------");
    const Market = await deploy("NFTMarketPlace", {
        from: deployer,
        log: true,
    });
    log("You have deployed the NFT MarketPlace contract to:", Market.address);

    const networkName = hre.network.name;
    log(
        `Verify with: \n npx hardhat verify --network ${networkName} ${Market.address}`
    );
};
export default func;
func.tags = ["all",];