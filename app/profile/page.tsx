import { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'プロフィール | Sample App',
};

// TODO: 認証基盤導入後に差し替え
function getCurrentUserId(): string {
  return 'current-user-id';
}

export default function ProfilePage() {
  const userId = getCurrentUserId();
  return <ProfileClient userId={userId} />;
}
