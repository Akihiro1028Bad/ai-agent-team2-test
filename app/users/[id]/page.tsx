'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useUserProfile } from '../../../src/hooks/useUserProfile';
import { UserProfileView } from '../../../src/components/UserProfileView';

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { profile, loading, error } = useUserProfile(id);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!profile) return <div>ユーザーが見つかりません</div>;

  return <UserProfileView profile={profile} editable={false} />;
}
