import { useStoreActions, useStoreState } from "easy-peasy";
import { CurrentNetwork } from "~/components/Sidebar/CurrentNetwork";
import { SelectAccount } from "~/components/Sidebar/SelectAccount/SelectAccount";
import { WalletModal } from "~/components/Sidebar/WalletModal/WalletModal";
import { Button } from "~/components/ui/button";
import AccountingSection from "./AccountingSection";
import ApprovalSection from "./ApprovalSection";
import PaymentsSection from "./PaymentsSection";
import { ReportsButton } from "./Reports";
import TeamsMenu from "./TeamsMenu";
import TreasurySection from "./TreasurySection";

const Sidebar = () => {
  const selectedAccount = useStoreState(
    (state: any) => state.accounts.selected,
  );
  const openWalletModal = useStoreActions(
    (actions: any) => actions.wallets.modal.open,
  );

  return (
    <>
      <div className="sticky top-0 flex h-screen w-64 min-w-fit flex-col border-r-2">
        <TeamsMenu />

        <div className="my-5 flex flex-col px-4 pb-3">
          {selectedAccount ? (
            <SelectAccount openWalletModal={openWalletModal} />
          ) : (
            <Button onClick={openWalletModal}>Connect Account</Button>
          )}
        </div>

        <div className="flex h-screen flex-col px-3 pb-3">
          <TreasurySection />
          <PaymentsSection />
          <ApprovalSection />
          <AccountingSection />
          <ReportsButton />
          <div className="flex-grow"></div>
          <div className="flex flex-col gap-1">
            <CurrentNetwork />
          </div>
        </div>
      </div>
      <WalletModal />
    </>
  );
};

export default Sidebar;
