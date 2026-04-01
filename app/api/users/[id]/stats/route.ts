import { NextResponse } from 'next/server';

// seed固定の疑似乱数生成器（再現性確保）
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // バリデーション: IDが空の場合
  if (!id || id.trim() === '') {
    return NextResponse.json(
      { error: 'Invalid user ID' },
      { status: 400 }
    );
  }

  // テスト用: "not-found" の場合は404
  if (id === 'not-found') {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // 直近30日分のdailyActivityを生成
  const random = seededRandom(42);
  const dailyActivity: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = Math.floor(random() * 11); // 0〜10
    dailyActivity.push({ date: dateStr, count });
  }

  // 当月のアクティブ日数を計算
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthlyActiveDays = dailyActivity.filter((d) => {
    const date = new Date(d.date);
    return (
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear &&
      d.count > 0
    );
  }).length;

  return NextResponse.json({
    monthlyActiveDays,
    totalPosts: 142,
    dailyActivity,
  });
}
