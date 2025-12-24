
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CreditCard, NewCard, CardStats, SortConfig, SortField, ToastMessage, Transaction, SpendingCategory } from './types';
import { loadCards, saveCards, loadTransactions, saveTransactions } from './utils/storage';
import { Button } from './components/Button';
import { CardForm } from './components/CardForm';
import { Stats } from './components/Stats';
import { Toast } from './components/Toast';
import { SpendingForm } from './components/SpendingForm';
import { PaymentForm } from './components/PaymentForm';
import { HistoryModal } from './components/HistoryModal';
import { InstallModal } from './components/InstallModal';
import { AIAdvisor } from './components/AIAdvisor';
import { MobileCard } from './components/MobileCard';
import { BottomNav } from './components/BottomNav';

const App: React.FC = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'cards' | 'tools'>('overview');
  
  // Gün değişimlerini takip etmek için bir state
  const [todayDate, setTodayDate] = useState(new Date());
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSpendingOpen, setIsSpendingOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [activeCard, setActiveCard] = useState<CreditCard | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'daysUntilDue', direction: 'asc' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verileri yükle
  useEffect(() => {
    setCards(loadCards());
    setTransactions(loadTransactions());
    
    // Her saat başı tarihi kontrol et (Gece yarısı geçişlerini yakalamak için)
    const timer = setInterval(() => {
      setTodayDate(new Date());
    }, 1000 * 60 * 60);
    
    return () => clearInterval(timer);
  }, []);

  // Verileri her değişimde kaydet
  useEffect(() => {
    saveCards(cards);
    saveTransactions(transactions);
  }, [cards, transactions]);

  const addToast = (text: string, type: ToastMessage['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Merkezi tarih hesaplayıcı
  const getDaysUntilDue = (day: number) => {
    const today = todayDate;
    let dueDate = new Date(today.getFullYear(), today.getMonth(), day);
    if (today.getDate() > day) {
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const stats = useMemo((): CardStats => {
    const breakdown: Record<SpendingCategory, number> = {
      'Market': 0, 'Akaryakıt': 0, 'Eğlence': 0, 'Fatura': 0, 'Sağlık': 0, 'Giyim': 0, 'Diğer': 0
    };

    transactions.filter(t => t.type === 'spending').forEach(t => {
      const cat = t.category || 'Diğer';
      breakdown[cat] += t.amount;
    });

    return cards.reduce((acc, card) => ({
      ...acc,
      totalLimit: acc.totalLimit + card.totalLimit,
      totalUsed: acc.totalUsed + card.usedAmount,
      totalRemaining: acc.totalRemaining + (card.totalLimit - card.usedAmount),
    }), { totalLimit: 0, totalUsed: 0, totalRemaining: 0, categoryBreakdown: breakdown });
  }, [cards, transactions]);

  const sortedAndFilteredCards = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let result = cards.filter(c => 
      c.cardName.toLowerCase().includes(term) || 
      c.bank.toLowerCase().includes(term)
    );

    result.sort((a, b) => {
      let valA: any = a[sortConfig.field as keyof CreditCard];
      let valB: any = b[sortConfig.field as keyof CreditCard];

      if (sortConfig.field === 'remainingLimit') {
        valA = a.totalLimit - a.usedAmount;
        valB = b.totalLimit - b.usedAmount;
      } else if (sortConfig.field === 'daysUntilDue') {
        valA = getDaysUntilDue(a.dueDay);
        valB = getDaysUntilDue(b.dueDay);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cards, searchTerm, sortConfig, todayDate]); // todayDate değiştiğinde liste de güncellenir

  const handleAddOrEdit = (data: NewCard | CreditCard) => {
    if ('id' in data) {
      setCards(prev => prev.map(c => c.id === data.id ? data as CreditCard : c));
      addToast('Kart başarıyla güncellendi', 'success');
    } else {
      const newCard: CreditCard = { ...data, id: crypto.randomUUID() };
      setCards(prev => [...prev, newCard]);
      addToast('Yeni kart eklendi', 'success');
    }
    setIsFormOpen(false);
    setEditingCard(null);
  };

  const handleSpend = (amount: number, description: string, category: SpendingCategory) => {
    if (!activeCard) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      cardId: activeCard.id,
      amount,
      description,
      category,
      date: new Date().toISOString(),
      type: 'spending'
    };

    setTransactions(prev => [...prev, newTransaction]);
    setCards(prev => prev.map(c => c.id === activeCard.id ? { ...c, usedAmount: c.usedAmount + amount } : c));

    addToast(`${formatCurrency(amount)} harcama kaydedildi`, 'success');
    setIsSpendingOpen(false);
    setActiveCard(null);
  };

  const handlePayment = (amount: number, description: string) => {
    if (!activeCard) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      cardId: activeCard.id,
      amount,
      description,
      date: new Date().toISOString(),
      type: 'payment'
    };

    setTransactions(prev => [...prev, newTransaction]);
    setCards(prev => prev.map(c => c.id === activeCard.id ? { ...c, usedAmount: Math.max(0, c.usedAmount - amount) } : c));

    addToast(`${formatCurrency(amount)} ödeme kaydedildi`, 'success');
    setIsPaymentOpen(false);
    setActiveCard(null);
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    if (confirm('İşlemi silmek istediğinizden emin misiniz?')) {
      setCards(prev => prev.map(c => {
        if (c.id === transaction.cardId) {
          const adjAmount = transaction.type === 'spending' ? -transaction.amount : transaction.amount;
          return { ...c, usedAmount: Math.max(0, c.usedAmount + adjAmount) };
        }
        return c;
      }));
      setTransactions(prev => prev.filter(t => t.id !== id));
      addToast('İşlem geri alındı', 'info');
    }
  };

  const handleDeleteCard = (id: string) => {
    if (confirm('Kart ve geçmişi kalıcı olarak silinecek. Emin misiniz?')) {
      setCards(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.filter(t => t.cardId !== id));
      addToast('Kart silindi', 'error');
    }
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportData = () => {
    const combinedData = { cards, transactions };
    const dataStr = JSON.stringify(combinedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `kart-asistan-yedek-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    addToast('Veriler yedeklendi', 'info');
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setCards(json.cards || []);
        setTransactions(json.transactions || []);
        addToast('Veriler yüklendi', 'success');
      } catch (err) {
        addToast('Dosya formatı hatalı', 'error');
      }
    };
    reader.readAsText(file);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) return <span className="ml-1 opacity-20">↕</span>;
    return <span className="ml-1 text-blue-600 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto selection:bg-blue-100 pb-28 md:pb-8">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-200">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-none flex items-center gap-2">
                KartAsistan
              </h1>
              <p className="text-gray-500 mt-1 text-sm md:text-lg font-medium hidden md:block">Akıllı limit yönetimi.</p>
            </div>
          </div>
          <button onClick={() => setIsInstallModalOpen(true)} className="md:hidden p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </button>
        </div>
        
        <div className="hidden md:flex flex-wrap gap-2 items-center">
          <Button variant="secondary" size="sm" onClick={exportData} className="rounded-xl border-gray-200 text-xs py-2">📥 Yedekle</Button>
          <input type="file" ref={fileInputRef} onChange={importData} accept=".json" className="hidden" />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl border-gray-200 text-xs py-2">📤 Yükle</Button>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-48 transition-all shadow-sm text-sm"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <Button onClick={() => { setEditingCard(null); setIsFormOpen(true); }} className="shadow-lg shadow-blue-500/20 py-2.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-none">Yeni Kart</Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="space-y-8">
        {(activeTab === 'overview' || !window.matchMedia('(max-width: 768px)').matches) && (
          <>
            <AIAdvisor cards={cards} transactions={transactions} />
            <Stats stats={stats} />
          </>
        )}

        {(activeTab === 'cards' || !window.matchMedia('(max-width: 768px)').matches) && (
          <div className="animate-in fade-in duration-700">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th onClick={() => handleSort('cardName')} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Kart <SortIcon field="cardName" /></th>
                      <th onClick={() => handleSort('bank')} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Banka <SortIcon field="bank" /></th>
                      <th onClick={() => handleSort('totalLimit')} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Limit <SortIcon field="totalLimit" /></th>
                      <th onClick={() => handleSort('usedAmount')} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Kullanılan <SortIcon field="usedAmount" /></th>
                      <th onClick={() => handleSort('remainingLimit')} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Kalan <SortIcon field="remainingLimit" /></th>
                      <th onClick={() => handleSort('daysUntilDue')} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-blue-600">Vade <SortIcon field="daysUntilDue" /></th>
                      <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Eylemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedAndFilteredCards.map((card) => {
                      const daysLeft = getDaysUntilDue(card.dueDay);
                      return (
                        <tr key={card.id} className={`hover:bg-blue-50/30 transition-all group ${daysLeft <= 5 && card.usedAmount > 0 ? 'bg-orange-50/20' : ''}`}>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900 text-base">{card.cardName}</span>
                              <button onClick={() => { setActiveCard(card); setIsHistoryOpen(true); }} className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter mt-1 hover:underline text-left">Geçmiş</button>
                            </div>
                          </td>
                          <td className="px-4 py-5"><span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-500 border border-gray-200 uppercase">{card.bank}</span></td>
                          <td className="px-4 py-5 text-gray-500 text-sm font-bold">{formatCurrency(card.totalLimit)}</td>
                          <td className="px-4 py-5"><span className={`text-sm font-black ${(card.usedAmount / card.totalLimit) > 0.85 ? 'text-orange-600' : 'text-gray-800'}`}>{formatCurrency(card.usedAmount)}</span></td>
                          <td className="px-4 py-5"><span className={`text-base font-black ${card.totalLimit - card.usedAmount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(card.totalLimit - card.usedAmount)}</span></td>
                          <td className="px-4 py-5">
                            <span className={`font-black text-xs ${daysLeft <= 5 && card.usedAmount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                              {daysLeft === 0 ? 'Bugün!' : `${daysLeft} Gün`}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setActiveCard(card); setIsSpendingOpen(true); }} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-colors">💸</button>
                              <button onClick={() => { setActiveCard(card); setIsPaymentOpen(true); }} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors">💳</button>
                              <button onClick={() => { setEditingCard(card); setIsFormOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">✏️</button>
                              <button onClick={() => handleDeleteCard(card.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden space-y-4 px-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Kayıtlı Kartlar</h2>
                <div className="flex gap-2">
                  <button onClick={exportData} className="p-2 bg-gray-100 text-gray-500 rounded-xl">📥</button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-100 text-gray-500 rounded-xl">📤</button>
                </div>
              </div>
              {sortedAndFilteredCards.length > 0 ? (
                sortedAndFilteredCards.map(card => (
                  <MobileCard 
                    key={card.id} 
                    card={card} 
                    onSpend={() => { setActiveCard(card); setIsSpendingOpen(true); }}
                    onPay={() => { setActiveCard(card); setIsPaymentOpen(true); }}
                    onEdit={() => { setEditingCard(card); setIsFormOpen(true); }}
                    onDelete={() => handleDeleteCard(card.id)}
                    onHistory={() => { setActiveCard(card); setIsHistoryOpen(true); }}
                  />
                ))
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Henüz kart eklenmemiş</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onAddClick={() => { setEditingCard(null); setIsFormOpen(true); }} 
      />

      <Toast toasts={toasts} onClose={removeToast} />
      <CardForm isOpen={isFormOpen} initialData={editingCard} onCancel={() => { setIsFormOpen(false); setEditingCard(null); }} onSubmit={handleAddOrEdit} />
      <SpendingForm isOpen={isSpendingOpen} card={activeCard} onCancel={() => { setIsSpendingOpen(false); setActiveCard(null); }} onSubmit={handleSpend} />
      <PaymentForm isOpen={isPaymentOpen} card={activeCard} onCancel={() => { setIsPaymentOpen(false); setActiveCard(null); }} onSubmit={handlePayment} />
      <HistoryModal isOpen={isHistoryOpen} card={activeCard} transactions={transactions} onClose={() => { setIsHistoryOpen(false); setActiveCard(null); }} onDeleteTransaction={deleteTransaction} />
      <InstallModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
    </div>
  );
};

export default App;
