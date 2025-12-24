
export type SpendingCategory = 'Market' | 'Akaryakıt' | 'Eğlence' | 'Fatura' | 'Sağlık' | 'Giyim' | 'Diğer';

export interface CreditCard {
  id: string;
  cardName: string;
  bank: string;
  totalLimit: number;
  usedAmount: number;
  dueDay: number; // Ayın kaçıncı günü (1-31)
  statementDay: number; // Hesap kesim günü (1-31)
}

export type NewCard = Omit<CreditCard, 'id'>;

export interface Transaction {
  id: string;
  cardId: string;
  amount: number;
  description: string;
  date: string;
  type: 'spending' | 'payment';
  category?: SpendingCategory;
}

export interface CardStats {
  totalLimit: number;
  totalUsed: number;
  totalRemaining: number;
  categoryBreakdown: Record<SpendingCategory, number>;
}

export type SortField = keyof CreditCard | 'remainingLimit' | 'daysUntilDue';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}
