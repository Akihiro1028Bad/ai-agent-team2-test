import React from 'react';
import { UserProfile } from '../types/user';

interface ProfileViewProps {
  profile: UserProfile;
  onEdit: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onEdit }) => {
  const formattedDate = new Date(profile.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="profile-view">
      <div className="profile-header">
        <img
          src={profile.avatarUrl || '/default-avatar.png'}
          alt={profile.name}
          className="profile-avatar"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-avatar.png';
          }}
        />
        <h2>{profile.name}</h2>
        <p className="profile-email">{profile.email}</p>
      </div>

      <div className="profile-details">
        <div className="profile-field">
          <span className="profile-label">自己紹介</span>
          <p>{profile.bio || '未設定'}</p>
        </div>
        <div className="profile-field">
          <span className="profile-label">所在地</span>
          <p>{profile.location || '未設定'}</p>
        </div>
        <div className="profile-field">
          <span className="profile-label">Webサイト</span>
          {profile.website ? (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          ) : (
            <p>未設定</p>
          )}
        </div>
        <div className="profile-field">
          <span className="profile-label">登録日</span>
          <p>{formattedDate}</p>
        </div>
      </div>

      <button className="profile-edit-button" onClick={onEdit}>
        編集
      </button>
    </div>
  );
};
