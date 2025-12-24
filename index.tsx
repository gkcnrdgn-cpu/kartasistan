
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

/**
 * Kredi Kartı Veri Modeli
 */
interface CreditCard {
  id: string;
  cardName: string;
  bank: string;
  totalLimit: number;
  usedAmount: number;
  remainingLimit: number; // Otomatik hesaplanan
  dueDay: number; // Ayın kaçıncı günü
}

/**
 * AI Danışmanı Bileşeni
 * Harcamaları analiz eder ve tavsiyeler sunar.
 */
const AIAdvisor = ({ cards }: { cards: CreditCard[] }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    if (cards.length === 0) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const context = cards.map(c => `${c.cardName}: ${c.usedAmount} TL borç, ${c.remainingLimit} TL limit`).join(', ');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Aşağıdaki kredi kartı verilerine bakarak kullanıcıya 2 cümlelik, samimi ve Türkçe bir finansal tasarruf tavsiyesi ver: ${context}`,
      });
      setAdvice(response.text || 'Analiz şu an yapılamıyor.');
    } catch (err) {
      setAdvice('Hizmet şu an meşgul, lütfen sonra tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 text-white mb-8 border border-slate-800 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💡</span>
        <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">Yapay Zeka Finans Asistanı</h3>
      </div>
      {advice ? (
        <div className="animate-in fade-in zoom-in duration-300">
          <p className="text-sm italic text-slate-300 leading-relaxed mb-4">"{advice}"</p>
          <button onClick={() => setAdvice(null)} className="text-[10px] font-bold text-blue-500 hover:text-white transition-colors">YENİLE</button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">Limit kullanım oranlarını analiz edip tasarruf stratejisi oluşturmamı ister misin?</p>
          <button 
            onClick={getAdvice} 
            disabled={loading || cards.length === 0}
            className="w-full md:w-auto bg-blue-600 px-6 py-3 rounded-xl text-xs font-black hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'ANALİZ EDİLİYOR...' : 'ANALİZ ET'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Ana Uygulama Bileşeni
 */
const App = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  // Verileri yükle
  useEffect(() => {
    const saved = localStorage.getItem('credit_tracker_data');
    if (saved) {
      try {
        setCards(JSON.parse(saved));
      } catch (e) {
        console.error("Veri yüklenemedi");
      }
    }
  }, []);

  // Verileri kaydet
  useEffect(() => {
    localStorage.setItem('credit_tracker_data', JSON.stringify(cards));
  }, [cards]);

  // Hata/Bilgi mesajı zamanlayıcısı
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // İstatistikler
  const stats = useMemo(() => {
    const totalLimit = cards.reduce((a, b) => a + b.totalLimit, 0);
    const totalUsed = cards.reduce((a, b) => a + b.usedAmount, 0);
    const totalRemaining = totalLimit - totalUsed;
    return { totalLimit, totalUsed, totalRemaining };
  }, [cards]);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const cardName = fd.get('cardName') as string;
    const bank = fd.get('bank') as string;
    const totalLimit = Number(fd.get('totalLimit'));
    const usedAmount = Number(fd.get('usedAmount'));
    const dueDay = Number(fd.get('dueDay'));

    // Doğrulama
    if (!cardName || !bank) {
      setAlert({ msg: "Lütfen kart adı ve banka bilgilerini girin.", type: 'error' });
      return;
    }
    if (totalLimit < 0 || usedAmount < 0) {
      setAlert({ msg: "Limit veya borç miktarı negatif olamaz.", type: 'error' });
      return;
    }
    if (dueDay < 1 || dueDay > 31) {
      setAlert({ msg: "Ödeme günü 1-31 arasında olmalıdır.", type: 'error' });
      return;
    }

    const remainingLimit = totalLimit - usedAmount;
    const newCard: CreditCard = {
      id: editingCard?.id || crypto.randomUUID(),
      cardName,
      bank,
      totalLimit,
      usedAmount,
      remainingLimit,
      dueDay
    };

    if (editingCard) {
      setCards(cards.map(c => c.id === editingCard.id ? newCard : c));
      setAlert({ msg: "Kart güncellendi.", type: 'success' });
    } else {
      setCards([...cards, newCard]);
      setAlert({ msg: "Yeni kart eklendi.", type: 'success' });
    }

    setIsModalOpen(false);
    setEditingCard(null);
  };

  const deleteCard = (id: string) => {
    if (confirm('Bu kartı silmek istediğinize emin misiniz?')) {
      setCards(cards.filter(c => c.id !== id));
      setAlert({ msg: "Kart silindi.", type: 'success' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-4 md:p-8">
      {/* Üst Bilgi */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">KartAsistan v2</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Excel Tabanlı Limit Takip Sistemi</p>
        </div>
        <button 
          onClick={() => { setEditingCard(null); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
        >
          YENİ KART EKLE +
        </button>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* AI Bölümü */}
        <AIAdvisor cards={cards} />

        {/* Özet Paneli */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Toplam Limit</p>
            <p className="text-3xl font-black">{stats.totalLimit.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kullanılan Borç</p>
            <p className="text-3xl font-black text-red-600">{stats.totalUsed.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kalan Limit</p>
            <p className="text-3xl font-black text-emerald-600">{stats.totalRemaining.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        {/* Tablo Alanı */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Kart Adı</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Banka</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Toplam Limit</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Kullanılan</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Kalan Limit</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Son Ödeme</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cards.map(card => (
                  <tr key={card.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5 font-bold text-slate-900">{card.cardName}</td>
                    <td className="px-6 py-5">
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">{card.bank}</span>
                    </td>
                    <td className="px-6 py-5 font-mono font-bold">{card.totalLimit.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-6 py-5 font-mono font-bold text-red-600">{card.usedAmount.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-6 py-5 font-mono font-bold text-emerald-600">{card.remainingLimit.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-6 py-5 font-bold text-slate-600">Her ayın {card.dueDay}. günü</td>
                    <td className="px-6 py-5 text-right space-x-3">
                      <button 
                        onClick={() => { setEditingCard(card); setIsModalOpen(true); }}
                        className="text-[10px] font-black text-blue-600 uppercase hover:underline"
                      >
                        Düzenle
                      </button>
                      <button 
                        onClick={() => deleteCard(card.id)}
                        className="text-[10px] font-black text-red-400 uppercase hover:underline"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cards.length === 0 && (
              <div className="py-32 text-center">
                <p className="text-slate-300 font-black uppercase text-xs tracking-widest">Henüz Kayıtlı Kart Bulunmuyor</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                >
                  İlk Kartı Ekle
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 md:p-12 shadow-3xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">{editingCard ? 'Kartı Güncelle' : 'Yeni Kart Tanımla'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Kart Adı</label>
                  <input 
                    name="cardName" 
                    defaultValue={editingCard?.cardName} 
                    placeholder="Örn: Bonus" 
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Banka</label>
                  <input 
                    name="bank" 
                    defaultValue={editingCard?.bank} 
                    placeholder="Örn: Garanti" 
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Toplam Limit (₺)</label>
                  <input 
                    name="totalLimit" 
                    type="number"
                    defaultValue={editingCard?.totalLimit} 
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Borç / Kullanılan (₺)</label>
                  <input 
                    name="usedAmount" 
                    type="number"
                    defaultValue={editingCard?.usedAmount} 
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Son Ödeme Günü (1-31)</label>
                <input 
                  name="dueDay" 
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={editingCard?.dueDay || 15} 
                  className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-100 active:scale-95 transition-all"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Mesajı */}
      {alert && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-8 ${alert.type === 'error' ? 'bg-red-600' : 'bg-slate-900'} text-white text-sm font-bold`}>
          {alert.msg}
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
