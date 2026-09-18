import { useEffect, useRef } from "react";
import { platformApiBase } from "../lib/platform_api";

export default function VkOneTapWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (document.getElementById("vkid-sdk-script")) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.id = "vkid-sdk-script";
        script.src = "https://unpkg.com/@vkid/sdk@2.6.8/dist-sdk/umd/index.js";
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    loadScript().then(() => {
      const VKID = (window as any).VKIDSDK;
      if (!VKID) return;

      const returnTo = window.location.href;
      VKID.Config.init({
        app: 54763400,
        redirectUrl: "https://api.prevention-ai.ru/api/auth/vk/callback",
        responseMode: VKID.ConfigResponseMode.Redirect,
        source: VKID.ConfigSource.LOWCODE,
        scope: "email",
        state: returnTo,
      });

      const oneTap = new VKID.OneTap();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        oneTap.render({
          container: containerRef.current,
          showAlternativeLogin: true,
          oauthList: ["mail_ru", "ok_ru"],
        });
      }
    }).catch((e) => {
      console.warn("Failed to load VK ID SDK", e);
    });
  }, []);

  return <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}></div>;
}