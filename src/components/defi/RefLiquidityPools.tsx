import { useEffect, useState } from "react";
import { z } from "zod";
import { DropdownFormField } from "~/components/inputs/dropdown";
import { TokenWithMaxInput } from "~/components/inputs/near";
import { SenderFormField } from "~/components/inputs/sender";
import { SwitchInput } from "~/components/inputs/switch";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import {
  useDepositToRefLiquidityPool,
  useGetLiquidityPoolById,
  useGetRefLiquidityPools,
  useGetTokenPrices,
  type LiquidityPool,
} from "~/hooks/defi";
import { useZodForm } from "~/hooks/form";
import {
  useGetAllTokensWithBalanceForWallet,
  useTeamsWalletsWithLockups,
} from "~/hooks/teams";
import { viewCall } from "~/lib/client";
import { type FungibleTokenMetadata } from "~/lib/ft/contract";
import { type Token } from "~/lib/transformations";
import { convertToIndivisibleFormat } from "~/lib/utils";

const formSchema = z.object({
  poolId: z.string(),
  tokenLeftAmount: z.string(),
  tokenRightAmount: z.string(),
  enableEmptyPools: z.boolean(),
  funding: z.string(),
});

export const getFormattedPoolBalance = (pool: {
  amounts: string[];
  token_symbols: string[];
  id: string;
}) => {
  return `${pool.token_symbols.join("-")} (${Object.keys(pool.amounts)
    .map((_, idx) => `${pool.amounts[idx]} ${pool.token_symbols[idx]}`)
    .join(" | ")}) ID: ${pool.id}`;
};

export const getUserBalanceForPool = (
  pool?: LiquidityPool,
  userTokens?: Token[],
) => {
  const tokens: Token[] = [];

  if (pool && userTokens) {
    for (let i = 0; i < pool.token_account_ids.length; i++) {
      const token = userTokens.find(
        (t) => t.account_id == pool.token_account_ids[i],
      );
      if (token) {
        tokens.push(token);
      } else {
        tokens.push(undefined);
      }
    }
  }

  return tokens;
};

const RefLiquidityPools = () => {
  const form = useZodForm(formSchema, {
    defaultValues: {
      enableEmptyPools: false,
      tokenLeftAmount: "0",
      tokenRightAmount: "0",
    },
  });
  const walletsQuery = useTeamsWalletsWithLockups();
  const liquidityPoolsQuery = useGetRefLiquidityPools(
    form.watch("enableEmptyPools"),
  );

  const tokensQuery = useGetAllTokensWithBalanceForWallet(
    form.watch("funding"),
  );
  const liquidityPoolDetailsQuery = useGetLiquidityPoolById(
    form.watch("poolId"),
  );
  const tokenPricesQuery = useGetTokenPrices();
  const depositMutation = useDepositToRefLiquidityPool();

  const userTokensForPool = getUserBalanceForPool(
    liquidityPoolDetailsQuery.data,
    tokensQuery.data,
  );

  const watchedLeft = form.watch("tokenLeftAmount");
  const watchedRight = form.watch("tokenRightAmount");

  const [expectedLeft, setExpectedLeft] = useState("0");
  const [expectedRight, setExpectedRight] = useState("0");
  useEffect(() => {
    const updateAmounts = () => {
      if (!tokenPricesQuery.data) {
        return;
      }
      const prices = tokenPricesQuery.data;
      const tokenRight = liquidityPoolDetailsQuery.data?.token_account_ids[1];
      const tokenLeft = liquidityPoolDetailsQuery.data?.token_account_ids[0];

      if (watchedLeft !== expectedLeft) {
        const leftVal = parseFloat(watchedLeft);

        const right =
          (leftVal * parseFloat(prices[tokenLeft]?.price)) /
          parseFloat(prices[tokenRight]?.price);

        // update right
        form.setValue("tokenRightAmount", right.toString());
        setExpectedRight(right.toString());

        setExpectedLeft(watchedLeft);
        console.log("update right");
      }
      if (watchedRight !== expectedRight) {
        const rightVal = parseFloat(watchedRight);

        const left =
          (rightVal * parseFloat(prices[tokenRight]?.price)) /
          parseFloat(prices[tokenLeft]?.price);

        form.setValue("tokenLeftAmount", left.toString());
        setExpectedLeft(left.toString());

        setExpectedRight(watchedRight);
        console.log("update left");
      }
    };
    updateAmounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedLeft, watchedRight]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log(values);
    const tokenLeftAccId = liquidityPoolDetailsQuery.data?.token_account_ids[0];
    const tokenRightAccId =
      liquidityPoolDetailsQuery.data?.token_account_ids[1];

    const leftMetadata = await viewCall<FungibleTokenMetadata>(
      tokenLeftAccId,
      "ft_metadata",
      {},
    );
    const rightMetadata = await viewCall<FungibleTokenMetadata>(
      tokenRightAccId,
      "ft_metadata",
      {},
    );
    const l = convertToIndivisibleFormat(
      values.tokenLeftAmount,
      leftMetadata.decimals,
    );

    const r = convertToIndivisibleFormat(
      values.tokenRightAmount,
      rightMetadata.decimals,
    );
    console.log(
      l,
      r,
      values.poolId,
      tokenLeftAccId,
      tokenRightAccId,
      values.funding,
    );

    await depositMutation.mutateAsync({
      fundingAccId: values.funding,
      tokenLeftAccId: tokenLeftAccId,
      tokenRightAccId: tokenRightAccId,
      tokenLeftAmount: l.toString(),
      tokenRightAmount: r.toString(),
      poolId: values.poolId,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <SenderFormField
          isLoading={walletsQuery.isLoading}
          wallets={walletsQuery.data?.filter((w) => !w.isLockup)}
          name="funding"
          control={form.control}
          rules={{
            required: "Please select a wallet.",
          }}
          description="Funding wallet."
          placeholder="Select a wallet"
          label="Sender"
        />

        <DropdownFormField
          isLoading={liquidityPoolsQuery.isLoading}
          items={liquidityPoolsQuery.data?.map((pool) => ({
            id: pool.id,
            name: getFormattedPoolBalance(pool),
          }))}
          name="poolId"
          control={form.control}
          rules={{
            required: "Please select a pool.",
          }}
          description="Select a liquidity pool."
          placeholder="NEAR-BTC"
          label="Liquidity pool"
        />

        <TokenWithMaxInput
          control={form.control}
          name="tokenLeftAmount"
          label={`Amount of ${
            liquidityPoolDetailsQuery.data
              ? liquidityPoolDetailsQuery.data?.token_symbols[0]
              : "first token"
          } to deposit in the pool`}
          placeholder="10"
          rules={{ required: true }}
          decimals={userTokensForPool[0]?.decimals || 0}
          maxIndivisible={userTokensForPool[0]?.balance || "0"}
          symbol={liquidityPoolDetailsQuery.data?.token_symbols[0]}
        />

        <TokenWithMaxInput
          control={form.control}
          name="tokenRightAmount"
          label={`Amount of ${
            liquidityPoolDetailsQuery.data
              ? liquidityPoolDetailsQuery.data?.token_symbols[1]
              : "second token"
          } to deposit in the pool`}
          placeholder="10"
          rules={{ required: true }}
          decimals={userTokensForPool[1]?.decimals || 0}
          maxIndivisible={userTokensForPool[1]?.balance || "0"}
          symbol={liquidityPoolDetailsQuery.data?.token_symbols[1]}
        />

        <SwitchInput
          control={form.control}
          name={"enableEmptyPools"}
          label="Enable empty liquidity pools"
          description="Note: enable this option if you want to see empty pools."
          rules={{ required: false }}
        />

        {/* <SwitchInput
            control={form.control}
            name={"enableNotOwningTokens"}
            label="Enable not owning tokens"
            description="Note: enable this option if you want to see pools where you don't own any tokens, thus you can't participate in the pool without swapping."
            rules={{ required: false }}
          /> */}

        <Button type="submit">Create liquidity deposit request</Button>
      </form>
    </Form>
  );
};

export default RefLiquidityPools;
