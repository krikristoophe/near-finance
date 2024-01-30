import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { initFungibleTokenContract } from "~/lib/ft/contract";
import {
  dbDataToTransfersData,
  LikelyTokens,
  Token,
} from "~/lib/transformations";
import usePersistingStore from "~/store/useStore";
import { config } from "~/config/config";
import { fetchJson } from "~/store-easy-peasy/helpers/fetchJson";
import { z } from "zod";
import { useSession } from "next-auth/react";
import {
  getDaysDateBetweenDates,
  useGetBalanceBetweenDates,
} from "./dashboard";
import { getFtBalanceAtDate } from "~/lib/client";

export function useAddMember() {
  return api.teams.inviteToTeam.useMutation();
}

export function useListInvitations() {
  return api.teams.getInvitationsForUser.useQuery();
}

export function useRemoveInvitation() {
  return api.teams.deleteInvitation.useMutation();
}

export function useAddWallet() {
  return api.teams.addWalletsForTeam.useMutation();
}

export function useListWallets() {
  const { currentTeam } = usePersistingStore();
  if (!currentTeam) {
    throw new Error("Missing team ID");
  }

  return api.teams.getWalletsForTeam.useQuery({
    teamId: currentTeam.id,
  });
}

export function useTeamsWalletsWithLockups() {
  const { currentTeam, newNearConnection } = usePersistingStore();
  if (!currentTeam) {
    throw new Error("Missing team ID");
  }

  const { data } = useListWallets();
  return useQuery({
    queryKey: ["wallets", currentTeam?.id],
    queryFn: async () => {
      return await dbDataToTransfersData({
        data: data || [],
        getNearConnection: newNearConnection,
      });
    },
    enabled: !!data,
  });
}

export function useListAddressBook() {
  const { currentTeam } = usePersistingStore();
  if (!currentTeam) {
    throw new Error("Missing team ID");
  }

  return api.teams.getBeneficiariesForTeam.useQuery({
    teamId: currentTeam?.id || "",
  });
}

export function useGetTokensForWallet(walletId: string) {
  return useQuery({
    queryKey: ["tokens", walletId],
    queryFn: async () => {
      const data: LikelyTokens = await fetchJson(
        config.urls.kitWallet.likelyTokens(walletId),
      );
      console.log(data);
      return data;
    },
    enabled: !!walletId,
  });
}

export function useGetAllTokensWithBalanceForWallet(walletId: string) {
  const { newNearConnection } = usePersistingStore();
  const { data: tokenAddresses } = useGetTokensForWallet(walletId);

  return useQuery({
    queryKey: ["tokens", walletId, tokenAddresses?.list],
    queryFn: async () => {
      const tokAddrs = tokenAddresses?.list || [];

      const promises = tokAddrs.map(async (token) => {
        const near = await newNearConnection();
        const contract = initFungibleTokenContract(
          await near.account(""),
          token,
        );
        try {
          const ft_metadata = await contract.ft_metadata();
          const ft_balance = await contract.ft_balance_of({
            account_id: walletId,
          });

          const t: Token = {
            ...ft_metadata,
            balance: ft_balance,
            account_id: token,
          };

          return t;
        } catch (e) {
          console.log(e);
        }
      });

      const nearPromise = async () => {
        try {
          const account = (await newNearConnection()).account(walletId);
          const balance = await (await account).getAccountBalance();
          return {
            balance: balance.available,
            decimals: 24,
            name: "NEAR",
            symbol: "NEAR",
            account_id: "near",
          } as Token;
        } catch (e) {
          console.log(e);
        }
      };

      return (await Promise.all(promises.concat(nearPromise()))).filter(
        (t) => !!t,
      );
    },
    enabled: !!tokenAddresses,
  });
}

export function useCreateTeam() {
  return api.teams.createTeam.useMutation();
}

export function useListTeams() {
  return api.teams.getTeamsForUser.useQuery();
}

export const createTeamAndInviteUsers = z.object({
  name: z.string(),
  members: z.array(z.string()).transform((value) => {
    return value.filter(Boolean);
  }),
  wallets: z.array(z.string()).transform((value) => {
    return value.filter(Boolean);
  }),
});

export function useCreateTeamAndInviteUsers() {
  const createTeam = useCreateTeam();
  const addMember = useAddMember();
  const addWallet = useAddWallet();
  const session = useSession();

  return useMutation({
    mutationFn: async (data: z.infer<typeof createTeamAndInviteUsers>) => {
      const team = await createTeam.mutateAsync({
        teamName: data.name,
      });

      await Promise.all(
        data.members
          .filter((member) => member !== session.data.user.email)
          .map((member) =>
            addMember.mutateAsync({
              teamId: team.id,
              invitedEmail: member,
            }),
          ),
      );

      await addWallet.mutateAsync({
        teamId: team.id,
        walletAddresses: data.wallets,
      });

      return team;
    },
  });
}

export function useGetBalancesForTeamBetweenDates(from: Date, to: Date) {
  const wallets = useTeamsWalletsWithLockups();
  const days = getDaysDateBetweenDates(from, to);

  return useQuery({
    queryKey: ["balances", from, to],
    queryFn: async () => {
      const balances = await Promise.all(
        wallets.data?.flatMap(async (wallet) => {
          return days.map(async (date) => {
            const balance = await getFtBalanceAtDate(
              date,
              wallet.walletDetails.walletAddress,
            );
            return {
              date,
              wallet,
              balance,
            };
          });
        }) || [],
      );
      const res = await Promise.all(balances.flat());
      console.log(res);

      return res;
    },
    enabled: !!wallets.data,
  });
}
