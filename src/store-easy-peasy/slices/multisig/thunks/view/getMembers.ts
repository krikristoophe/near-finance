import { thunk } from "easy-peasy";
import { viewFunction } from "~/store-easy-peasy/slices/multisig/helpers/viewFunction";

export const getMembers = thunk(async (_, payload: any) => {
  const { contractId, provider }: any = payload;

  return await viewFunction({
    provider,
    contractId,
    method: "get_members",
  });
});
