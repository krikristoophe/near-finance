import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson, viewCall } from "~/lib/client";
import { type Token } from "~/lib/transformations";
import { type FungibleTokenMetadata } from "~/lib/ft/contract";
import { transactions } from "near-api-js";
import { addMultisigRequestAction } from "./manage";
import { functionCallAction } from "./lockup";
import { TGas } from "./staking";
import BN from "bn.js";
import { useWalletTerminator } from "~/store/slices/wallet-selector";
import { parseNearAmount } from "near-api-js/lib/utils/format";
import { z } from "zod";
import { getFtMetadataForAccounts } from "~/lib/utils";

export const EXCHANGES = ["REF"] as const;

export const useSupportedExchange = () => {
  return useQuery(["supportedExchange"], () => {
    return [EXCHANGES[0]];
  });
};

export const useGetSwapOpportunities = (token: Token, exchange: string) => {
  return useQuery(["swapIn", token, exchange], () => {
    if (exchange !== "REF") {
      throw new Error("Exchange not supported");
    }
  });
};

export interface LiquidityPool {
  pool_kind: string;
  token_account_ids: string[];
  amounts: string[];
  total_fee: number;
  shares_total_supply: string;
  amp: number;
  farming: boolean;
  token_symbols: string[];
  id: string;
  tvl: string;
  token0_ref_price: string;
}

export const useGetRefLiquidityPools = (
  includeEmptyPools: boolean,
  poolType?: "SIMPLE_POOL" | "RATED_SWAP",
) => {
  return useQuery(["liquidityPools", includeEmptyPools], async () => {
    const pools = await fetchJson<LiquidityPool[]>(
      "https://indexer.ref.finance/list-pools",
    );

    const tokenAccountIds = [
      ...new Set(
        pools.flatMap((pool) => {
          return pool.token_account_ids;
        }),
      ),
    ];

    const ftMetadatas = await getFtMetadataForAccounts(tokenAccountIds);

    console.log(ftMetadatas);

    return pools
      .filter((pool) => {
        return includeEmptyPools || pool.tvl !== "0";
      })
      .filter((pool) => {
        if (!poolType) {
          return true;
        }
        return pool.pool_kind === poolType;
      })
      .map((pool) => {
        const amounts = pool.amounts.map((amount, i) => {
          const accId = pool.token_account_ids[i];
          const ftMetadata = ftMetadatas.find((ft) => ft.accountId === accId);
          if (!ftMetadata) {
            return "0";
          }
          const formattedAmount = Number(amount) / 10 ** ftMetadata.decimals;
          return formattedAmount.toString();
        });
        pool.amounts = amounts;
        return pool;
      })
      .sort((a, b) => {
        return Number(a.id) - Number(b.id);
      });
  });
};

export const useGetLiquidityPoolById = (poolId?: string) => {
  return useQuery(
    ["liquidityPool", poolId],
    async () => {
      const poolDetails = await fetchJson<LiquidityPool[]>(
        "https://indexer.ref.finance/list-pools-by-ids?ids=" + poolId,
      );
      return poolDetails[0];
    },
    { enabled: !!poolId },
  );
};

type TokenInfo = {
  price: string;
  decimal: number;
  symbol: string;
};

type Tokens = Record<string, TokenInfo>;

export const useGetTokenPrices = () => {
  return useQuery(["tokenPrices"], async () => {
    const res = await fetchJson<Tokens>(
      "https://indexer.ref.finance/list-token-price",
    );
    return res;
  });
};

type DepositParams = {
  fundingAccId: string;
  tokenLeftAccId: string;
  tokenLeftAmount: string;
  tokenRightAccId: string;
  tokenRightAmount: string;
  poolId: string;
};

export const useDepositToRefLiquidityPool = () => {
  const wsStore = useWalletTerminator();

  return useMutation({
    mutationFn: async (params: DepositParams) => {
      const refAccountId = "v2.ref-finance.near";
      const storageDepositRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "storage_deposit",
            {
              account_id: params.fundingAccId,
              registration_only: false,
            },
            parseNearAmount("0.125"),
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      const ftTransferCallLeftRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(params.tokenLeftAccId, [
          functionCallAction(
            "ft_transfer_call",
            {
              receiver_id: refAccountId,
              amount: params.tokenLeftAmount,
              msg: "",
            },
            "1",
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      const ftTransferCallRightRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(params.tokenRightAccId, [
          functionCallAction(
            "ft_transfer_call",
            {
              receiver_id: refAccountId,
              amount: params.tokenRightAmount,
              msg: "",
            },
            "1",
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      const addLiquidityRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "add_liquidity",
            {
              pool_id: parseInt(params.poolId),
              amounts: [params.tokenLeftAmount, params.tokenRightAmount],
            },
            parseNearAmount("0.01"),
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [storageDepositRequest],
      });
      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [ftTransferCallLeftRequest],
      });
      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [ftTransferCallRightRequest],
      });
      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [addLiquidityRequest],
      });
    },
  });
};

const stablePoolsRefDeposit = z.object({
  poolId: z.number(),
  tokens: z.array(z.string()),
  amounts: z.array(z.string()),
  shares: z.string(),
  fundingAccId: z.string(),
});

export const useDepositToRefStableLiquidityPool = () => {
  const wsStore = useWalletTerminator();

  return useMutation({
    mutationFn: async (params: z.infer<typeof stablePoolsRefDeposit>) => {
      const refAccountId = "v2.ref-finance.near";
      const storageDepositRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "storage_deposit",
            {
              account_id: params.fundingAccId,
              registration_only: false,
            },
            parseNearAmount("0.125"),
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [storageDepositRequest],
      });

      for (let i = 0; i < params.tokens.length; i++) {
        if (params.amounts[i] === "0") {
          continue;
        }
        const ftTransferCallRequest = transactions.functionCall(
          "add_request",
          addMultisigRequestAction(params.tokens[i], [
            functionCallAction(
              "ft_transfer_call",
              {
                receiver_id: refAccountId,
                amount: params.amounts[i],
                msg: "",
              },
              "1",
              (50 * TGas).toString(),
            ),
          ]),
          new BN(100 * TGas),
          new BN("0"),
        );

        await wsStore.signAndSendTransaction({
          senderId: params.fundingAccId,
          receiverId: params.fundingAccId,
          actions: [ftTransferCallRequest],
        });
      }

      const addStableLiquidityRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "add_stable_liquidity",
            {
              pool_id: params.poolId,
              amounts: params.amounts,
              min_shares: params.shares,
            },
            parseNearAmount("0.01"),
            (100 * TGas).toString(),
          ),
        ]),
        new BN(200 * TGas),
        new BN("0"),
      );

      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [addStableLiquidityRequest],
      });
    },
  });
};

export interface LiquidityPoolRef {
  pool_kind: string;
  token_account_ids: string[];
  amounts: string[];
  total_fee: number;
  shares_total_supply: string;
  amp: number;
  farming: boolean;
  token_symbols: string[];
  id: string;
}

export const useGetRefLiquidityPoolsForAccount = (accountId?: string) => {
  return useQuery(
    ["liquidityPoolsForAccount", accountId],
    async () => {
      const endpoint =
        "https://indexer.ref.finance/liquidity-pools/" + accountId;
      const pools = await fetchJson<LiquidityPoolRef[]>(endpoint);
      const ftMetadatas = await getFtMetadataForAccounts(
        pools.flatMap((pool) => pool.token_account_ids),
      );
      return pools.map((pool) => {
        const amounts = pool.amounts.map((amount, i) => {
          const accId = pool.token_account_ids[i];
          const ftMetadata = ftMetadatas.find((ft) => ft.accountId === accId);
          if (!ftMetadata) {
            return "0";
          }
          const formattedAmount = Number(amount) / 10 ** ftMetadata.decimals;
          return formattedAmount.toString();
        });
        pool.amounts = amounts;
        return pool;
      });
    },
    { enabled: !!accountId },
  );
};

export const withdrawRef = z.object({
  poolId: z.number(),
  tokens: z.array(z.string()),
  amounts: z.array(z.string()),
  shares: z.string(),
  fundingAccId: z.string(),
});

export const useWithdrawFromRefLiquidityPool = () => {
  const wsStore = useWalletTerminator();
  const viewQuery = useGetRefLiquidityPoolsForAccount();

  return useMutation({
    mutationFn: async (params: z.infer<typeof withdrawRef>) => {
      await viewQuery.refetch();
      const refAccountId = "v2.ref-finance.near";
      const storageDepositRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "storage_deposit",
            {
              account_id: params.fundingAccId,
              registration_only: false,
            },
            parseNearAmount("0.005"),
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      const removeLiquidityRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(refAccountId, [
          functionCallAction(
            "remove_liquidity",
            {
              pool_id: params.poolId,
              shares: params.shares,
              min_amounts: params.amounts,
            },
            "1",
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [storageDepositRequest],
      });
      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccId,
        receiverId: params.fundingAccId,
        actions: [removeLiquidityRequest],
      });

      for (const token of params.tokens) {
        const withdraw = transactions.functionCall(
          "add_request",
          addMultisigRequestAction(refAccountId, [
            functionCallAction(
              "withdraw",
              {
                token_id: token,
                amount: "0",
                unregister: false,
              },
              "1",
              (200 * TGas).toString(),
            ),
          ]),
          new BN(300 * TGas),
          new BN("0"),
        );

        await wsStore.signAndSendTransaction({
          senderId: params.fundingAccId,
          receiverId: params.fundingAccId,
          actions: [withdraw],
        });
      }
    },
  });
};

interface BurrowAssetConfig {
  borrow_apr: string;
  borrowed: BalanceAndShares;
  config: Config;
  farms: unknown[]; // Assuming 'any' type here as there's no provided structure for farms
  last_update_timestamp: string;
  prot_fee: string;
  reserved: string;
  supplied: BalanceAndShares;
  supply_apr: string;
  token_id: string;
}

interface BalanceAndShares {
  balance: string;
  shares: string;
}

interface Config {
  can_borrow: boolean;
  can_deposit: boolean;
  can_use_as_collateral: boolean;
  can_withdraw: boolean;
  extra_decimals: number;
  max_utilization_rate: string;
  net_tvl_multiplier: number;
  prot_ratio: number;
  reserve_ratio: number;
  target_utilization: number;
  target_utilization_rate: string;
  volatility_ratio: number;
}

export const burrowSupplyFormSchema = z.object({
  token: z.string(),
  tokenAmount: z.number(),
  funding: z.string(),
});

export const useSupplyToBurrow = () => {
  const wsStore = useWalletTerminator();

  return useMutation({
    mutationFn: async (params: z.infer<typeof burrowSupplyFormSchema>) => {
      const burrowAccountId = "contract.main.burrow.near";

      const storageDepositRequest = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(burrowAccountId, [
          functionCallAction(
            "storage_deposit",
            {
              account_id: params.funding,
              registration_only: false,
            },
            parseNearAmount("0.25"),
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      const config = await viewCall<BurrowAssetConfig>(
        burrowAccountId,
        "get_asset",
        { token_id: "usdt.tether-token.near" },
      );

      const ftMetadata = await viewCall<FungibleTokenMetadata>(
        params.token,
        "ft_metadata",
        {},
      );

      const indivisibleAmount = `${params.tokenAmount}${"0".repeat(
        ftMetadata.decimals,
      )}`;

      const ftTransferCall = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(params.token, [
          functionCallAction(
            "ft_transfer_call",
            {
              receiver_id: burrowAccountId,
              amount: indivisibleAmount,
              msg: `{\"Execute\":{\"actions\":[{\"IncreaseCollateral\":{\"token_id\":\"${
                params.token
              }\",\"max_amount\":\"${indivisibleAmount}${"0".repeat(
                config.config.extra_decimals,
              )}\"}}]}}`,
            },
            "1",
            (50 * TGas).toString(),
          ),
        ]),
        new BN(100 * TGas),
        new BN("0"),
      );

      await wsStore.signAndSendTransaction({
        senderId: params.funding,
        receiverId: params.funding,
        actions: [storageDepositRequest],
      });

      await wsStore.signAndSendTransaction({
        senderId: params.funding,
        receiverId: params.funding,
        actions: [ftTransferCall],
      });
    },
  });
};
