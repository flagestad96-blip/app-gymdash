import React from "react";
import SplashScreen from "./SplashScreen";

export default function AppLoading({ label = "Laster..." }: { label?: string }) {
  return <SplashScreen subtitle={label} />;
}
