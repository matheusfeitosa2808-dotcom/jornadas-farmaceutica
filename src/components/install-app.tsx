"use client";
import { useEffect, useState } from "react";

/**
 * Banner "instalar como app".
 *
 * Chrome, Edge e Android guardam o evento `beforeinstallprompt` e instalam em
 * um toque. Safari (iOS e macOS) não expõe esse evento, então ali mostramos a
 * instrução real do menu Compartilhar em vez de um botão que não faz nada.
 *
 * Some sozinho quando o app já está instalado.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "jornadas-install-dismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIosSafari()) setShowIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* modo privado */
    }
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "dismissed") dismiss();
  };

  if (dismissed || (!prompt && !showIosHint)) return null;

  return (
    <aside className="install-banner" aria-label="Instalar o app Jornadas" role="complementary">
      {prompt ? (
        <>
          <p>Instale o Jornadas para abrir direto da tela inicial, sem a barra do navegador.</p>
          <div className="install-banner-actions">
            <button type="button" className="install-banner-primary" onClick={install}>
              Instalar
            </button>
            <button type="button" className="install-banner-dismiss" onClick={dismiss}>
              Agora não
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Para instalar no iPhone: toque em Compartilhar na barra do Safari e
            escolha Adicionar à Tela de Início.
          </p>
          <div className="install-banner-actions">
            <button type="button" className="install-banner-dismiss" onClick={dismiss}>
              Entendi
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
