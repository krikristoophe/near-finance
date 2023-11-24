import { type PublicKey } from "near-api-js/lib/utils";
import { useNearContext } from "~/context/near";
import { useWalletSelector } from "~/context/wallet";
import AccountingSection from "./AccountingSection";
import ApprovalSection from "./ApprovalSection";
import PaymentsSection from "./PaymentsSection";
import TeamsMenu from "./TeamsMenu";
import TreasurySection from "./TreasurySection";

const Sidebar = ({ publicKey }: { publicKey: PublicKey | null }) => {
  const { modal } = useWalletSelector();
  const handleSignIn = () => {
    modal.show();
  };

  return (
    <div className="sticky top-0 flex h-screen w-64 min-w-fit flex-col border-r-2">
      <TeamsMenu />
      <div className="flex h-screen flex-col px-3 pb-3">
        <TreasurySection />
        <PaymentsSection />
        <ApprovalSection />
        <AccountingSection />
        <div className="flex-grow"></div>
        <div className="flex flex-col gap-1">
          {publicKey && (
            <button
              className="mb-2 inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => {
                handleSignIn();
              }}
            >
              Ⓝ {publicKey.toString().slice(0, 20)}...
            </button>
          )}
          {!publicKey && (
            <button
              className="mb-2 inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => {
                handleSignIn();
              }}
            >
              Ⓝ Sign In
            </button>
          )}
          <CurrentNetwork />
          <Webthreeconnected publicKey={publicKey} />
        </div>
      </div>
    </div>
  );
};

const CurrentNetwork = () => {
  const { network, switchNetwork } = useNearContext();

  return (
    <div className="prose flex items-center justify-center">
      <div
        className="text-xs text-gray-500"
        onClick={() => {
          void switchNetwork();
        }}
      >
        Current network:
      </div>
      <div className="prose ml-1 text-xs text-gray-500">{network}</div>
    </div>
  );
};

const Webthreeconnected = ({ publicKey }: { publicKey: PublicKey | null }) => {
  const copyToClipboard = async () => {
    if (!publicKey) return;

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(publicKey.toString());
        alert("Public key copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    } else {
      alert("Clipboard API not supported in your browser.");
    }
  };

  // Determine styles and behavior based on publicKey availability
  const textStyle = publicKey
    ? "text-xs text-gray-500 cursor-pointer"
    : "text-xs text-gray-300 cursor-default"; // Lighter color and default cursor when publicKey is null

  const clickHandler = publicKey ? copyToClipboard : undefined;

  return (
    <div className="prose flex items-center justify-center">
      <div className={textStyle} onClick={clickHandler}>
        Click here to copy ledger public key
      </div>
    </div>
  );
};

export default Sidebar;
