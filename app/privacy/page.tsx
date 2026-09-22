export const metadata = { title: "プライバシーポリシー | 家計簿" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="section-title">プライバシーポリシー</h1>
      <div className="card">
        <p style={{ marginBottom: 12 }}>
          本アプリは、開発者本人の家計管理のためだけに作られた個人利用のツールです。第三者への公開・提供は行っていません。
        </p>
        <p style={{ marginBottom: 12 }}>
          クレジットカードの利用通知メール（Gmail）を読み取り、取引の日時・店舗名・金額を抽出してデータベース（Supabase）に保存し、
          支出の分類・グラフ表示に利用します。取得したメールの内容は上記の目的以外には使用せず、開発者以外の第三者と共有することはありません。
        </p>
        <p>
          本アプリに関するお問い合わせは、開発者本人までご連絡ください。
        </p>
      </div>
    </>
  );
}
