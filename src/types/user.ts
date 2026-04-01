export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}

export interface DailyActivity {
  date: string;    // "2026-03-15" 形式（ISO 8601 日付）
  count: number;   // その日の活動数
}

export interface UserStats {
  monthlyActiveDays: number;      // 月間アクティブ日数（当月のログイン日数）
  totalPosts: number;             // 累計投稿数
  dailyActivity: DailyActivity[]; // 直近30日間の日別データ
}
