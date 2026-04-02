import React from 'react';
import { UserProfile } from '../types/user';
import styles from './UserProfileView.module.css';

interface UserProfileViewProps {
  profile: UserProfile | null | undefined;
  editable: boolean;
  onEdit?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  profile,
  editable,
  onEdit,
}) => {
  if (!profile) {
    return (
      <div className={styles.container}>
        <p>ユーザーが見つかりません</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img
          className={styles.avatar}
          src={profile.avatarUrl || '/default-avatar.png'}
          alt={profile.name}
        />
        <div>
          <h1 className={styles.name}>{profile.name}</h1>
          <p className={styles.email}>{profile.email}</p>
        </div>
      </div>

      {profile.bio && (
        <div className={styles.section}>
          <div className={styles.label}>自己紹介</div>
          <p className={styles.value}>{profile.bio}</p>
        </div>
      )}

      {profile.location && (
        <div className={styles.section}>
          <div className={styles.label}>所在地</div>
          <p className={styles.value}>{profile.location}</p>
        </div>
      )}

      {profile.website && (
        <div className={styles.section}>
          <div className={styles.label}>Webサイト</div>
          <p className={styles.value}>
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          </p>
        </div>
      )}

      <div className={styles.meta}>
        登録日: {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
      </div>

      {editable && (
        <button className={styles.editButton} onClick={onEdit}>
          プロフィールを編集
        </button>
      )}
    </div>
  );
};
