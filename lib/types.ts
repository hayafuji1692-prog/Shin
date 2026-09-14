export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type CategoryRule = {
  id: string;
  keyword: string;
  category_id: string;
  priority: number;
};

export type Card = {
  id: string;
  issuer: string;
  name: string;
};

export type Transaction = {
  id: string;
  gmail_message_id: string;
  card_id: string | null;
  transaction_date: string;
  merchant_raw: string;
  merchant_normalized: string;
  amount: number;
  category_id: string | null;
  source_issuer: string;
  created_at: string;
};

export type MonthlyCategoryTotal = {
  month: string;
  category_id: string | null;
  total: number;
};
