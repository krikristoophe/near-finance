import { thunk } from "easy-peasy";
import { LedgerClient } from "../helpers/LedgerClient";
import { JsonRpcProvider } from "near-api-js/lib/providers";

const INDEXER_SERVICE_URL = "https://api.kitwallet.app";

const getAllAccountsWithKey = async (publicKey: any) =>
  await fetch(`${INDEXER_SERVICE_URL}/publicKey/${publicKey}/accounts`, {
    headers: { "X-requestor": "near" },
  }).then((r) => r.json());

const isMultisig = async (accountId: any, provider: any) =>
  await provider.query({
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: "list_request_ids",
    args_base64: "e30=",
  });

const getMultisigAccounts = async (publicKey: any, rpcUrl: any) => {
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const allAccounts = await getAllAccountsWithKey(publicKey);
  console.log(allAccounts);

  const result = await Promise.allSettled(
    allAccounts.map((accountId: any) => isMultisig(accountId, provider)),
  );

  return result
    .map((v, index) => ({
      status: v.status,
      accountId: allAccounts[index],
      publicKey,
      wallet: "ledger",
      addedBy: "auto",
    }))
    .filter((v) => v.status === "fulfilled")
    .map((v) => ({
      accountId: v.accountId,
      publicKey: v.publicKey,
      wallet: v.wallet,
      addedBy: v.addedBy,
    }));
};

export const connect = thunk(async (_, __, { getStoreActions, getState }) => {
  const slice: any = getState();
  const actions: any = getStoreActions();
  const navigate = actions.wallets.modal.navigate;

  navigate("/ledger/connect/progress");

  const ledger = new LedgerClient();
  let publicKey = null;

  try {
    await ledger.connect();
    publicKey = await ledger.getPublicKey();
  } catch (e) {
    console.log(e);
    navigate({ route: "/ledger/connect/error", routeParams: { error: e } });
  } finally {
    ledger.isConnected() && (await ledger.disconnect());
  }

  if (!publicKey) return;

  navigate("/ledger/multisig-accounts/progress");

  try {
    const multisigAccounts = await getMultisigAccounts(publicKey.toString(), slice.rpcUrl);

    if (multisigAccounts.length > 0) {
      navigate({
        route: "/ledger/multisig-accounts/success",
        routeParams: { accounts: multisigAccounts },
      });
      actions.accounts.addAccounts(multisigAccounts);
    }
  } catch (e) {
    console.log(e);
    navigate({
      route: "/ledger/multisig-accounts/error",
      routeParams: { error: e },
    });
  }
});