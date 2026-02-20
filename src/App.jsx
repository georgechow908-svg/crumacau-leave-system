import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, FileText, ChevronLeft, ChevronRight, PlusCircle, LayoutDashboard, Cloud, Download, BarChart2, Trash2, RotateCcw } from 'lucide-react';

// Firebase SDK Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore';

// --- Firebase 設定 (已填入您的真實金鑰) ---
const firebaseConfig = {
  apiKey: "AIzaSyC3O_sjvTSbxKJE3b5cSBW74wCvFFlHk5I",
  authDomain: "crumacau-leave-system.firebaseapp.com",
  projectId: "crumacau-leave-system",
  storageBucket: "crumacau-leave-system.firebasestorage.app",
  messagingSenderId: "508647002195",
  appId: "1:508647002195:web:988c23b584b781e7e8f6a6"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'company-leave-system'; 

const LEAVE_TYPES = [
  { id: 'work', label: '事工', color: 'bg-blue-100 text-blue-800' },
  { id: 'personal', label: '私人', color: 'bg-green-100 text-green-800' },
  { id: 'sick', label: '生病', color: 'bg-red-100 text-red-800' },
  { id: 'other', label: '其他', color: 'bg-gray-100 text-gray-800' },
];

export default function App() {
  const [view, setView] = useState('apply'); // apply, admin, calendar
  const [leaves, setLeaves] = useState([]);
  const [notification, setNotification] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 初始化並登入
  useEffect(() => {
    if (!auth) return;

    // 嘗試匿名登入
    signInAnonymously(auth).catch((error) => {
      console.error("登入失敗:", error);
      showNotification("登入失敗，請確認 Firebase Authentication 已啟用「匿名登入」");
      setLoading(false);
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽數據 (即時同步)
  useEffect(() => {
    if (!user || !db) return;

    const leavesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'leaves');
    
    const unsubscribe = onSnapshot(leavesCollection, (snapshot) => {
      const leavesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 按照開始日期倒序排列
      leavesData.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      
      setLeaves(leavesData);
      setLoading(false);
    }, (error) => {
      console.error("Data fetch error:", error);
      if (user) showNotification("讀取資料失敗，請檢查網路");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // 提交請假申請
  const handleSubmitLeave = async (formData) => {
    if (!user) {
      showNotification("尚未連線到資料庫");
      return;
    }
    try {
      const newLeave = {
        ...formData,
        status: 'Pending',
        createdAt: Date.now(),
        userId: user.uid
      };
      
      // 寫入 Firestore
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leaves'), newLeave);
      
      showNotification("申請已成功提交到雲端！");
      setView('calendar'); 
    } catch (error) {
      console.error("Error adding document: ", error);
      showNotification("提交失敗：" + error.message);
    }
  };

  // 更新審批狀態
  const handleUpdateStatus = async (id, status) => {
    if (!user) return;
    try {
      const leaveRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaves', id);
      await updateDoc(leaveRef, { status: status });
      showNotification(`已更新狀態為：${status === 'Approved' ? '批准' : '拒絕'}`);
    } catch (error) {
      console.error("Error updating document: ", error);
      showNotification("更新失敗");
    }
  };

  // 刪除假單
  const handleDeleteLeave = async (id) => {
    if (!user) return;
    if (!window.confirm("確定要刪除這筆紀錄嗎？此操作無法復原。")) return;
    try {
      const leaveRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaves', id);
      await deleteDoc(leaveRef);
      showNotification("已成功刪除紀錄");
    } catch (error) {
      console.error("Error deleting document: ", error);
      showNotification("刪除失敗");
    }
  };

  // 重置假單狀態 (退回待審批)
  const handleResetStatus = async (id) => {
    if (!user) return;
    if (!window.confirm("確定要取消此假單的審批結果，並退回「待審批」狀態嗎？")) return;
    try {
      const leaveRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaves', id);
      await updateDoc(leaveRef, { status: 'Pending' });
      showNotification("已退回待審批");
    } catch (error) {
      console.error("Error resetting document: ", error);
      showNotification("撤銷失敗");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* 導航欄 */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
              <Calendar className="w-6 h-6" />
              <span>同工離澳日期申請 <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-normal align-middle ml-1">Cloud</span></span>
            </div>
            <div className="flex space-x-1 sm:space-x-4">
              <NavButton active={view === 'apply'} onClick={() => setView('apply')} icon={<PlusCircle size={18} />} label="同工申請離澳" />
              <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<CheckCircle size={18} />} label="事工負責人審批" count={leaves.filter(l => l.status === 'Pending').length} />
              <NavButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={<LayoutDashboard size={18} />} label="團隊月曆" />
            </div>
          </div>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {notification && (
          <div className="fixed top-20 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-down z-50">
            {notification}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 text-slate-400 gap-4">
            <Cloud className="w-12 h-12 animate-bounce text-indigo-200" />
            <p>正在連線到雲端資料庫...</p>
          </div>
        ) : (
          <>
            {view === 'apply' && (
              <ApplyForm onSubmit={handleSubmitLeave} />
            )}

            {view === 'admin' && (
              <AdminDashboard 
                leaves={leaves} 
                onUpdateStatus={handleUpdateStatus} 
                onDeleteLeave={handleDeleteLeave}
                onResetStatus={handleResetStatus}
              />
            )}

            {view === 'calendar' && (
              <CalendarView leaves={leaves} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// --- 子組件 ---

function NavButton({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium
        ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}
      `}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  );
}

function ApplyForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    type: '事工',
    reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.endDate) return;
    
    // 簡單驗證結束日期不能早於開始日期
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      alert("結束日期不能早於開始日期！");
      return;
    }
    
    onSubmit(formData);
    setFormData({ name: '', startDate: '', endDate: '', type: '事工', reason: '' });
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FileText className="text-indigo-500" />
        填寫請假單
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">同工姓名</label>
          <input
            type="text"
            required
            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="請輸入姓名"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">開始日期</label>
            <input
              type="date"
              required
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.startDate}
              onChange={e => setFormData({...formData, startDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">結束日期</label>
            <input
              type="date"
              required
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.endDate}
              onChange={e => setFormData({...formData, endDate: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">請假類別</label>
          <div className="grid grid-cols-2 gap-2">
            {LEAVE_TYPES.map(type => (
              <label key={type.id} className={`
                cursor-pointer border rounded p-2 text-center text-sm font-medium transition-all
                ${formData.type === type.label 
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500' 
                  : 'border-slate-200 hover:border-slate-300'}
              `}>
                <input 
                  type="radio" 
                  name="type" 
                  value={type.label} 
                  className="hidden" 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">請假原因 / 備註</label>
          <textarea
            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none h-24"
            placeholder="請簡述原因..."
            value={formData.reason}
            onChange={e => setFormData({...formData, reason: e.target.value})}
          ></textarea>
        </div>

        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">
          提交申請
        </button>
      </form>
    </div>
  );
}

function AdminDashboard({ leaves, onUpdateStatus, onDeleteLeave, onResetStatus }) {
  const pendingLeaves = leaves.filter(l => l.status === 'Pending');
  const historyLeaves = leaves.filter(l => l.status !== 'Pending');

  // 計算請假天數的輔助函數
  const calculateDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return diffDays;
  };

  // 生成匯總資料 (僅計算已批准的假單)
  const generateSummary = () => {
    const summary = {};
    leaves.filter(l => l.status === 'Approved').forEach(leave => {
      const days = calculateDays(leave.startDate, leave.endDate);
      if (!summary[leave.name]) {
        summary[leave.name] = { total: 0, work: 0, personal: 0, sick: 0, other: 0 };
      }
      summary[leave.name].total += days;
      if (leave.type === '事工') summary[leave.name].work += days;
      else if (leave.type === '私人') summary[leave.name].personal += days;
      else if (leave.type === '生病') summary[leave.name].sick += days;
      else summary[leave.name].other += days;
    });
    
    return Object.entries(summary).map(([name, data]) => ({
      name, ...data
    })).sort((a, b) => b.total - a.total); // 依總天數排序
  };

  const summaryData = generateSummary();

  // 匯出 CSV 功能
  const exportToCSV = () => {
    // CSV 標頭
    let csvContent = "同工姓名,開始日期,結束日期,請假天數,請假類別,原因,狀態\n";
    
    // CSV 內容
    leaves.forEach(leave => {
      const days = calculateDays(leave.startDate, leave.endDate);
      // 處理原因中的換行或逗號，避免破壞 CSV 格式
      const safeReason = `"${(leave.reason || '').replace(/"/g, '""')}"`;
      let statusText = leave.status === 'Approved' ? '已批准' : leave.status === 'Rejected' ? '已拒絕' : '待審批';
      
      csvContent += `${leave.name},${leave.startDate},${leave.endDate},${days},${leave.type},${safeReason},${statusText}\n`;
    });

    // 加上 BOM 讓 Excel 能正確辨識中文 (UTF-8)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `請假紀錄匯出_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 待審批區塊 */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-amber-600">
          <Clock className="w-5 h-5" />
          待審批申請 ({pendingLeaves.length})
        </h2>
        
        {pendingLeaves.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
            目前沒有待審批的申請
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingLeaves.map(leave => (
              <LeaveCard 
                key={leave.id} 
                leave={leave} 
                isAdmin={true} 
                onUpdateStatus={onUpdateStatus} 
                calculateDays={calculateDays} 
              />
            ))}
          </div>
        )}
      </section>

      {/* 歷史記錄與報表區塊 */}
      <section className="grid md:grid-cols-2 gap-8">
        
        {/* 左側：歷史記錄 */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-slate-700">最近審批記錄</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-semibold text-slate-600">同工</th>
                    <th className="p-3 font-semibold text-slate-600">日期</th>
                    <th className="p-3 font-semibold text-slate-600">狀態</th>
                    <th className="p-3 font-semibold text-slate-600 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLeaves.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50 group">
                      <td className="p-3 font-medium">{leave.name}</td>
                      <td className="p-3 text-slate-500 text-xs">{leave.startDate}</td>
                      <td className="p-3">
                        <StatusBadge status={leave.status} />
                      </td>
                      <td className="p-3 flex justify-center gap-2 opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onResetStatus(leave.id)} 
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                          title="撤銷並退回待審批"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button 
                          onClick={() => onDeleteLeave(leave.id)} 
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="永久刪除紀錄"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyLeaves.length === 0 && (
                     <tr><td colSpan="4" className="p-4 text-center text-slate-400">尚無記錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 右側：資料匯總與匯出 */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              同工請假匯總 (已批准)
            </h2>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors font-medium border border-indigo-200"
            >
              <Download size={16} /> 匯出 CSV 報表
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-semibold text-slate-600">同工</th>
                    <th className="p-3 font-semibold text-center text-slate-600">總天數</th>
                    <th className="p-3 font-semibold text-center text-blue-600">事工</th>
                    <th className="p-3 font-semibold text-center text-green-600">私人</th>
                    <th className="p-3 font-semibold text-center text-red-600">生病</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryData.map(stat => (
                    <tr key={stat.name} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-700">{stat.name}</td>
                      <td className="p-3 text-center font-bold bg-slate-50">{stat.total}</td>
                      <td className="p-3 text-center text-slate-500">{stat.work || '-'}</td>
                      <td className="p-3 text-center text-slate-500">{stat.personal || '-'}</td>
                      <td className="p-3 text-center text-slate-500">{stat.sick || '-'}</td>
                    </tr>
                  ))}
                  {summaryData.length === 0 && (
                     <tr><td colSpan="5" className="p-4 text-center text-slate-400">尚無已批准的紀錄</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function CalendarView({ leaves }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // 取得當月天數
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  // 取得當月第一天是星期幾
  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 產生月曆格子
  const renderCalendarDays = () => {
    const days = [];
    const emptyDays = Array(firstDay).fill(null);
    const dateDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    const allCells = [...emptyDays, ...dateDays];

    return allCells.map((day, index) => {
      if (!day) return <div key={`empty-${index}`} className="bg-slate-50 border border-slate-100 min-h-[80px]"></div>;

      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // 篩選當天的請假 (只顯示已批准)
      const daysLeaves = leaves.filter(l => {
        return l.status === 'Approved' && dateStr >= l.startDate && dateStr <= l.endDate;
      });

      return (
        <div key={day} className="border border-slate-200 bg-white min-h-[100px] p-1 relative group hover:bg-slate-50 transition-colors">
          <span className={`text-sm font-semibold p-1 block ${new Date().toISOString().split('T')[0] === dateStr ? 'text-indigo-600' : 'text-slate-700'}`}>
            {day}
          </span>
          <div className="space-y-1 mt-1">
            {daysLeaves.map(leave => (
              <div 
                key={leave.id} 
                className={`text-xs px-1.5 py-0.5 rounded truncate shadow-sm border-l-2
                  ${leave.type === '生病' ? 'bg-red-50 border-red-400 text-red-700' : 
                    leave.type === '私人' ? 'bg-green-50 border-green-400 text-green-700' :
                    leave.type === '事工' ? 'bg-blue-50 border-blue-400 text-blue-700' :
                    'bg-gray-50 border-gray-400 text-gray-700'}
                `}
                title={`${leave.name}: ${leave.reason}`}
              >
                {leave.name} ({leave.type})
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-300">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-slate-800">{monthName}</h2>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-300">
          <ChevronRight size={20} />
        </button>
      </div>
      
      <div className="grid grid-cols-7 text-center bg-slate-100 text-slate-500 text-xs py-2 font-medium border-b border-slate-200">
        <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
      </div>
      
      <div className="grid grid-cols-7 auto-rows-fr">
        {renderCalendarDays()}
      </div>
      
      <div className="p-4 bg-slate-50 text-xs text-slate-500 flex gap-4 border-t border-slate-200">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border-l-2 border-blue-400"></div> 事工</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border-l-2 border-green-400"></div> 私人</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border-l-2 border-red-400"></div> 生病</div>
      </div>
    </div>
  );
}

// 通用組件：請假卡片
function LeaveCard({ leave, isAdmin, onUpdateStatus, calculateDays }) {
  const typeStyle = LEAVE_TYPES.find(t => t.label === leave.type)?.color;
  const days = calculateDays ? calculateDays(leave.startDate, leave.endDate) : 1;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-lg text-slate-800">{leave.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${typeStyle}`}>
            {leave.type}
          </span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            共 {days} 天
          </span>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-2 mb-2">
          <Clock size={14} />
          {leave.startDate} ~ {leave.endDate}
        </div>
        <div className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
          <span className="font-medium text-slate-500 text-xs block mb-1">原因：</span>
          {leave.reason}
        </div>
      </div>

      {isAdmin && leave.status === 'Pending' && (
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => onUpdateStatus(leave.id, 'Rejected')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <XCircle size={16} /> 拒絕
          </button>
          <button 
            onClick={() => onUpdateStatus(leave.id, 'Approved')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            <CheckCircle size={16} /> 批准
          </button>
        </div>
      )}
      
      {!isAdmin && (
         <StatusBadge status={leave.status} />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Approved') return <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">已批准</span>;
  if (status === 'Rejected') return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">已拒絕</span>;
  return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">待審批</span>;
}