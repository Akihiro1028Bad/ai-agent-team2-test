'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/user';
import styles from './ProfileEditForm.module.css';

interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  profile,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = '名前は必須です';
    }
    if (bio.length > 500) {
      newErrors.bio = '自己紹介は500文字以内で入力してください';
    }
    if (location.length > 100) {
      newErrors.location = '所在地は100文字以内で入力してください';
    }
    if (website && !website.startsWith('https://')) {
      newErrors.website = 'URLは https:// で始めてください';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '保存に失敗しました'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>プロフィール編集</h2>

      <div className={styles.field}>
        <label htmlFor="name">名前 *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
      </div>

      <div className={styles.field}>
        <label>メールアドレス</label>
        <div className={styles.readOnly}>{profile.email}</div>
      </div>

      <div className={styles.field}>
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
        />
        {errors.bio && <div className={styles.fieldError}>{errors.bio}</div>}
      </div>

      <div className={styles.field}>
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
        {errors.location && (
          <div className={styles.fieldError}>{errors.location}</div>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
        {errors.website && (
          <div className={styles.fieldError}>{errors.website}</div>
        )}
      </div>

      <div className={styles.field}>
        <label>登録日</label>
        <div className={styles.readOnly}>
          {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSaving}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};
