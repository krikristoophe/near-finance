import Head from "next/head";
import { type ReactNode } from "react";
import Sidebar from "./sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <Head>
        <title>Create T3 App</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="relative flex min-h-screen flex-row">
        <Sidebar />
        <div className="flex  flex-1 flex-col">
          <div className="h-full bg-slate-100">
            <div>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
