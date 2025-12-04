"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserProfileForm } from "./UserProfileForm";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  userId: string;
  email: string;
  profile: Profile | null;
};

export function UserProfilePageClient({ userId, email, profile }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ người dùng</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Quản lý tên hiển thị và avatar của bạn. Hệ thống sẽ dùng tên hiển thị thay cho email ở thanh topbar nếu có.
        </CardContent>
      </Card>

      <UserProfileForm
        userId={userId}
        email={email}
        initialDisplayName={profile?.display_name ?? null}
        initialAvatarUrl={profile?.avatar_url ?? null}
      />
    </div>
  );
}
