import { RulesManager } from "@/components/ui/RulesManager";
import { getCategories, getCategoryRules } from "@/lib/queries";

export const revalidate = 0;

export default async function RulesPage() {
  const [categories, rules] = await Promise.all([getCategories(), getCategoryRules()]);

  return (
    <>
      <h1 className="section-title">分類ルール管理</h1>
      <RulesManager categories={categories} initialRules={rules} />
    </>
  );
}
