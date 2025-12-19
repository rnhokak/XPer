"use client";

import { useState, useTransition } from "react";
import { generateLinkCodeAction, unlinkTelegramAction } from "@/app/(protected)/settings/telegram/actions";
import { LinkCodeCard } from "./components/LinkCodeCard";
import { TelegramLinkStatusCard } from "./components/TelegramLinkStatusCard";

type TelegramLinkInfo = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  telegram_user_id: number;
  telegram_chat_id: number;
  created_at: string | null;
};

type LinkCodeState = {
  code: string;
  expiresAt: string;
};

type Props = {
  initialLink: TelegramLinkInfo | null;
};

export function TelegramSettingsPageClient({ initialLink }: Props) {
  const [link, setLink] = useState<TelegramLinkInfo | null>(initialLink);
  const [codeState, setCodeState] = useState<LinkCodeState | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isUnlinking, startUnlinking] = useTransition();

  const handleGenerate = () => {
    setCodeError(null);
    startGenerating(async () => {
      const res = await generateLinkCodeAction();
      if (!res.success || !res.code || !res.expiresAt) {
        setCodeError(res.error ?? "Không tạo được mã, thử lại sau.");
        return;
      }
      setCodeState({ code: res.code, expiresAt: res.expiresAt });
    });
  };

  const handleUnlink = () => {
    setUnlinkError(null);
    startUnlinking(async () => {
      const res = await unlinkTelegramAction();
      if (!res.success) {
        setUnlinkError(res.error ?? "Không thể hủy liên kết, thử lại sau.");
        return;
      }
      setLink(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <TelegramLinkStatusCard link={link} onUnlink={handleUnlink} unlinking={isUnlinking} error={unlinkError} />
      <LinkCodeCard codeState={codeState} onGenerate={handleGenerate} generating={isGenerating} error={codeError} />
    </div>
  );
}
