import React, { useState } from 'react';
import { UserProfileUpdateInput } from '../types/user';

interface ProfileEditFormProps {
  initialValues: {
    bio?: string;
    location?: string;
    website?: string;
  };
  onSave: (data: UserProfileUpdateInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  initialValues,
  onSave,
  onCancel,
  saving,
}) => {
  const [bio, setBio] = useState(initialValues.bio || '');
  const [location, setLocation] = useState(initialValues.location || '');
  const [website, setWebsite] = useState(initialValues.website || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (bio.length > 500) {
      newErrors.bio = '自己紹介は500文字以内で入力してください';
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      newErrors.website = '有効なURL（http:// または https://）を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave({ bio, location, website });
  };

  return (
    <form className="profile-edit-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="自己紹介を入力してください"
        />
        <span className="char-count">{bio.length}/500</span>
        {errors.bio && <span className="error">{errors.bio}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="例: Tokyo, Japan"
        />
      </div>

      <div className="form-field">
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="例: https://example.com"
        />
        {errors.website && <span className="error">{errors.website}</span>}
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          キャンセル
        </button>
      </div>
    </form>
  );
};
