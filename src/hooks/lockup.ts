import { transactions } from "near-api-js";
import { TGas } from "./staking";
import BN from "bn.js";
import { useMutation } from "@tanstack/react-query";
import { useWalletTerminator } from "~/store/slices/wallet-selector";
import { addMultisigRequestAction } from "./manage";
import { getNearTimestamp } from "~/lib/utils";
import { config } from "~/config/config";
import { findProperVestingSchedule } from "~/lib/lockup/utils";

type CreateLockup = {
  fundingAccountId: string;
  ownerId: string;
  yoctoDeposit: string;
  start: Date;
  end: Date;
  allowStaking: boolean;
  cliff?: Date;
};

export const functionCallAction = (
  methodName: string,
  args: Record<string, unknown>,
  yoctoDeposit: string,
  gas: string,
) => {
  console.log(JSON.stringify(args));

  return {
    type: "FunctionCall",
    method_name: methodName,
    args: btoa(JSON.stringify(args)),
    deposit: yoctoDeposit,
    gas: gas,
  };
};

export const transferAction = (amount: string) => {
  return {
    type: "Transfer",
    amount: amount,
  };
};

// Vesting schedule that can be cancelled
const getCreateVestingScheduleArgs = (params: CreateLockup) => {
  const defaultArgs = {
    owner_account_id: params.ownerId,
    lockup_duration: "0",
  };
  if (!params.allowStaking) {
    defaultArgs["whitelist_account_id"] = "system";
  }

  // needed for vesting schedule
  let cliff = params.cliff;
  if (!cliff) {
    cliff = params.start;
  }

  return {
    ...defaultArgs,
    vesting_schedule: {
      VestingSchedule: {
        start_timestamp: getNearTimestamp(params.start).toString(),
        cliff_timestamp: getNearTimestamp(cliff).toString(),
        end_timestamp: getNearTimestamp(params.end).toString(),
      },
    },
  };
};

export const useCreateLockup = () => {
  const wsStore = useWalletTerminator();
  return useMutation({
    mutationFn: async (params: CreateLockup) => {
      console.log("useCreateLockup", { params });

      const args = getCreateVestingScheduleArgs(params);
      console.log("useCreateLockup", { args });

      const createLockupAction = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(config.accounts.lockupFactory, [
          functionCallAction(
            "create",
            args,
            params.yoctoDeposit,
            (250 * TGas).toString(),
          ),
        ]),
        new BN(300 * TGas),
        new BN("0"),
      );

      console.log("useCreateLockup", { actions: createLockupAction });

      await wsStore.signAndSendTransaction({
        senderId: params.fundingAccountId,
        receiverId: params.fundingAccountId,
        actions: [createLockupAction],
      });
    },
  });
};

export const useTerminationPrepareToWithdraw = () => {
  const wsStore = useWalletTerminator();
  return useMutation({
    mutationFn: async ({ lockupAccountId, multisigAccId }: Params) => {
      console.log("useTerminationPrepareToWithdraw", { lockupAccountId });

      const prepareToWithdrawAction = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(lockupAccountId, [
          functionCallAction(
            "termination_prepare_to_withdraw",
            {},
            "0",
            (250 * TGas).toString(),
          ),
        ]),
        new BN(300 * TGas),
        new BN("0"),
      );

      console.log("useTerminationPrepareToWithdraw", {
        actions: prepareToWithdrawAction,
      });

      await wsStore.signAndSendTransaction({
        senderId: multisigAccId,
        receiverId: multisigAccId,
        actions: [prepareToWithdrawAction],
      });
    },
  });
};

type Params = {
  multisigAccId: string;
  lockupAccountId: string;
};

export const useTerminateVestingSchedule = () => {
  const wsStore = useWalletTerminator();
  return useMutation({
    mutationFn: async (params: Params) => {
      console.log("useTerminateVestingSchedule", { params });

      const terminateVestingScheduleAction = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(params.lockupAccountId, [
          functionCallAction(
            "terminate_vesting",
            {},
            "0",
            (250 * TGas).toString(),
          ),
        ]),
        new BN(300 * TGas),
        new BN("0"),
      );

      console.log("useTerminateVestingSchedule", {
        actions: terminateVestingScheduleAction,
      });

      await wsStore.signAndSendTransaction({
        senderId: params.multisigAccId,
        receiverId: params.multisigAccId,
        actions: [terminateVestingScheduleAction],
      });
    },
  });
};

type PrivateVestingScheduleParams = {
  lockupOwnerAccountId: string;
  authToken: string;
  start: Date;
  cliff: Date;
  end: Date;
  hashValue: string;
};

export const useTerminatePrivateVestingSchedule = () => {
  const wsStore = useWalletTerminator();
  return useMutation({
    mutationFn: async (params: PrivateVestingScheduleParams & Params) => {
      console.log("useTerminateVestingSchedule", { params });

      const vestingScheduleWithSalt = findProperVestingSchedule(params);

      const terminateVestingScheduleAction = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(params.lockupAccountId, [
          functionCallAction(
            "terminate_vesting",
            vestingScheduleWithSalt,
            "0",
            (250 * TGas).toString(),
          ),
        ]),
        new BN(300 * TGas),
        new BN("0"),
      );

      console.log("useTerminateVestingSchedule", {
        actions: terminateVestingScheduleAction,
      });

      await wsStore.signAndSendTransaction({
        senderId: params.multisigAccId,
        receiverId: params.multisigAccId,
        actions: [terminateVestingScheduleAction],
      });
    },
  });
};

export const useTerminationWithdraw = () => {
  const wsStore = useWalletTerminator();
  return useMutation({
    mutationFn: async ({ lockupAccountId, multisigAccId }: Params) => {
      console.log("useTerminationWithdraw", { lockupAccountId });

      const withdrawAction = transactions.functionCall(
        "add_request",
        addMultisigRequestAction(lockupAccountId, [
          functionCallAction(
            "termination_withdraw",
            { receiver_id: multisigAccId },
            "0",
            (250 * TGas).toString(),
          ),
        ]),
        new BN(300 * TGas),
        new BN("0"),
      );

      console.log("useTerminationWithdraw", { actions: withdrawAction });

      await wsStore.signAndSendTransaction({
        senderId: multisigAccId,
        receiverId: multisigAccId,
        actions: [withdrawAction],
      });
    },
  });
};
