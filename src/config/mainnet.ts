import { type Config } from "./config";
import { createKitWalletUrls } from "~/config/kitWallet";
import { createNearBlocksUrls } from "~/config/nearBlocks";
import { createNearBlocksApiUrls } from "./nearBlocksApi";
import { newNearNearBlocksApiNew, baseUrl } from "./nearBlocksApiNew";

export const mainnet: Config = {
  networkId: "mainnet",
  urls: {
    rpc: "https://beta.rpc.mainnet.near.org",
    myNearWallet: "https://app.mynearwallet.com",
    kitWallet: createKitWalletUrls("https://api.kitwallet.app"),
    nearBlocks: createNearBlocksUrls("https://nearblocks.io"),
    nearBlocksApi: createNearBlocksApiUrls("https://api.nearblocks.io/v1"),
    nearBlocksApiNew: newNearNearBlocksApiNew(baseUrl),
  },
  accounts: {
    multisigFactory: "multisignature.near",
    lockupFactory: "lockup.near",
    lockupFactoryFoundation: "foundation.near",
  },
};
