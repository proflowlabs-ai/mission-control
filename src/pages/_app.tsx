import "@/app/globals.css";
import type { AppProps } from "next/app";
import { MissionControlLayout } from "@/components/mission-control-layout";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="dark">
      <MissionControlLayout>
        <Component {...pageProps} />
      </MissionControlLayout>
    </div>
  );
}
