import { 
  ConnectButton, 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery,
  useSuiClient 
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// @ts-ignore: Tắt lỗi báo thiếu types
import QRCode from 'react-qr-code'; 
import './App.css';

// --- CẤU HÌNH ---
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID as string;
const POOL_ID = import.meta.env.VITE_POOL_ID as string;
const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';
const COLORS = ['#d97706', '#06b6d4', '#fbbf24'];

// 🔥 [SỬA] ĐIỀN LINK VERCEL CỦA BẠN VÀO ĐÂY ĐỂ CỐ ĐỊNH LINK GIỚI THIỆU
const APP_DOMAIN = "https://strustflow.vercel.app"; 

function App() {
  const account = useCurrentAccount();
  const client = useSuiClient(); 
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // --- STATES ---
  const [amount, setAmount] = useState("0.1");
  const [isWaiting, setIsWaiting] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard'>('home');
  const [viewMode, setViewMode] = useState<'recent' | 'top'>('recent');
  const [showQR, setShowQR] = useState(false);
  const [referrer, setReferrer] = useState<string>("");
  const [reportedProps, setReportedProps] = useState<string[]>([]);
  const [region, setRegion] = useState<string>("Quỹ Chung");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalRecipient, setProposalRecipient] = useState("");
  const [proposalReason, setProposalReason] = useState("");
  const [newAdmin, setNewAdmin] = useState("");

  // --- INIT ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam && refParam.startsWith('0x')) {
      setReferrer(refParam);
      localStorage.setItem('trustflow_ref', refParam);
    } else {
      const saved = localStorage.getItem('trustflow_ref');
      if (saved) setReferrer(saved);
    }

    const savedReports = localStorage.getItem('trustflow_reports');
    if (savedReports) setReportedProps(JSON.parse(savedReports));
  }, []);

  const finalReferrer = useMemo(() => {
    if (!account) return referrer;
    if (referrer === account.address) return ""; 
    return referrer;
  }, [referrer, account]);

  // 🔥 [SỬA] Dùng APP_DOMAIN thay vì window.location.origin
  const fullReferralLink = useMemo(() => {
    if (!account) return "";
    return `${APP_DOMAIN}?ref=${account.address}`;
  }, [account]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (parseFloat(val) < 0) return;
    setAmount(val);
  };

  // --- DATA FETCHING ---
  const { data: poolData, refetch: refetchPool } = useSuiClientQuery('getObject', {
    id: POOL_ID,
    options: { showContent: true }
  });

  const { data: events, refetch: refetchEvents, isPending: isEventsLoading } = useSuiClientQuery('queryEvents', {
    query: { MoveModule: { package: PACKAGE_ID, module: 'fund_box' } },
    limit: 50,
    order: 'descending'
  });

  const proposalIds = useMemo(() => {
    const eventData = (events as any)?.data;
    if (!eventData || !Array.isArray(eventData)) return [];
    
    const ids = eventData
      .filter((ev: any) => ev.type.includes("ProposalCreated"))
      .map((ev: any) => {
        const raw = ev.parsedJson?.proposal_id;
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object' && raw.id) return raw.id;
        return null;
      })
      .filter((id: any) => !!id);

    return [...new Set(ids)];
  }, [events]);

  const { data: proposalObjects, refetch: refetchProps, isError: isPropsError } = useSuiClientQuery('multiGetObjects', {
    ids: proposalIds.length > 0 ? proposalIds : [],
    options: { showContent: true }
  });

  // --- REPORTING ---
  const handleReportProposal = (id: string) => {
    if(!window.confirm("Bạn có chắc muốn báo cáo đề xuất này là Spam/Lừa đảo?")) return;
    const newReports = [...reportedProps, id];
    setReportedProps(newReports);
    localStorage.setItem('trustflow_reports', JSON.stringify(newReports));
    alert("🚨 Đã ghi nhận báo cáo! Đề xuất này sẽ bị ẩn.");
  };

  const handleUndoReport = (id: string) => {
    const newReports = reportedProps.filter(pid => pid !== id);
    setReportedProps(newReports);
    localStorage.setItem('trustflow_reports', JSON.stringify(newReports));
  };

  const exportToCSV = () => {
    const eventList = (events as any)?.data || [];
    if (eventList.length === 0) return alert("Chưa có dữ liệu để xuất!");
    const csvRows = [["Loại", "Người Gửi", "Số Tiền (SUI)", "Thời Gian", "Ghi Chú"]];
    eventList.forEach((ev: any) => {
      if (ev.type.includes("DonateEvent")) {
        const d = ev.parsedJson;
        const cleanMessage = (d.message || '').replace(/"/g, '""'); 
        csvRows.push(["Donate", d.donor, (Number(d.amount)/1e9).toFixed(4), new Date(Number(ev.timestampMs)).toLocaleString('vi-VN'), `"${cleanMessage}"`]);
      }
    });
    const csvString = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trustflow_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALCULATIONS ---
  const poolContent = (poolData?.data?.content as any);
  const poolBalance = poolContent?.fields?.balance || 0;
  const totalSui = Number(poolBalance) / 1_000_000_000;
  
  const dynamicGoal = useMemo(() => {
    if (!Array.isArray(proposalObjects)) return 10;
    const sumNeeded = proposalObjects.reduce((acc: number, obj: any) => {
      const f = obj.data?.content?.fields;
      if (f && !f.is_executed) return acc + (Number(f.amount) / 1_000_000_000);
      return acc;
    }, 0);
    return sumNeeded === 0 ? 10 : sumNeeded;
  }, [proposalObjects]);

  const progress = Math.min((totalSui / dynamicGoal) * 100, 100);

  const isAdmin = useMemo(() => {
    if (!account || !poolContent) return false;
    const adminField = poolContent?.fields?.admins;
    const adminListRaw = adminField?.fields?.contents || [];
    const myAddress = account.address.toLowerCase();
    const listNormalized = adminListRaw.map((addr: string) => String(addr).toLowerCase());
    return listNormalized.includes(myAddress);
  }, [account, poolContent]);

  useEffect(() => {
    const interval = setInterval(() => { refetchPool(); refetchEvents(); refetchProps(); }, 3000);
    return () => clearInterval(interval);
  }, [refetchPool, refetchEvents, refetchProps]);

  // --- ACTIONS ---
  const executeTx = (tx: Transaction, msg: string) => {
    setIsWaiting(true);
    signAndExecute(
      { transaction: tx as any, chain: `sui:${SUI_NETWORK}` },
      {
        onSuccess: async (result) => {
          console.log("🚀 Đã gửi lệnh...", result.digest);
          try {
            const txResult = await client.waitForTransaction({
              digest: result.digest, options: { showEffects: true, showEvents: true },
            });
            const status = txResult.effects?.status?.status;
            if (status === 'success') {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
              setTimeout(() => {
                setIsWaiting(false); refetchPool(); refetchEvents(); refetchProps();
                alert(`✅ ${msg}`);
                setProposalAmount(""); setProposalRecipient(""); setProposalReason(""); setNewAdmin("");
              }, 1000);
            } else {
              setIsWaiting(false);
              const errDetail = txResult.effects?.status?.error || "Lỗi không xác định";
              alert(`⚠️ Giao dịch bị TỪ CHỐI!\nLý do: ${errDetail}`);
            }
          } catch (e) {
            console.error(e); setIsWaiting(false);
            alert("⚠️ Đã gửi lệnh nhưng mạng chậm. Vui lòng kiểm tra ví sau.");
          }
        },
        onError: (err) => { 
          console.error(err); setIsWaiting(false); 
          alert("❌ Không thể gửi lệnh! (Đã hủy hoặc lỗi ví)."); 
        }
      }
    );
  };

  const handleDonate = () => {
    if (!account) return;
    const tx = new Transaction();
    tx.setGasBudget(50000000); 
    const val = BigInt(Math.floor(parseFloat(amount) * 1e9));
    const [coin] = tx.splitCoins(tx.gas, [val]);
    const refAddr = (finalReferrer && finalReferrer.startsWith('0x')) ? finalReferrer : account.address;
    const finalMsg = message || "Cố lên Việt Nam! ❤️";

    const valSui = parseFloat(amount);
    let successMsg = "Quyên góp thành công!";
    if (valSui >= 50) successMsg = "ĐẲNG CẤP! Bạn nhận được HUY HIỆU VÀNG 🥇";
    else if (valSui >= 10) successMsg = "Tuyệt vời! Bạn nhận được HUY HIỆU BẠC 🥈";
    else if (valSui >= 1) successMsg = "Cảm ơn! Bạn nhận được HUY HIỆU ĐỒNG 🥉";

    tx.moveCall({
      target: `${PACKAGE_ID}::fund_box::donate`,
      arguments: [ tx.object(POOL_ID), coin, tx.pure.address(refAddr), tx.pure.bool(isAnonymous), tx.pure.string(region), tx.pure.string(finalMsg) ]
    });
    executeTx(tx, successMsg);
  };

  // --- ADMIN ACTIONS ---
  const createProposal = () => {
    if (!proposalAmount || !proposalRecipient) return alert("Nhập đủ thông tin!");
    const tx = new Transaction();
    const val = BigInt(Math.floor(parseFloat(proposalAmount) * 1e9));
    tx.moveCall({ target: `${PACKAGE_ID}::fund_box::create_proposal`, arguments: [tx.object(POOL_ID), tx.pure.u64(val), tx.pure.address(proposalRecipient), tx.pure.string(proposalReason || "Hỗ trợ")] });
    executeTx(tx, "Đã tạo đề xuất!");
  };
  const voteProposal = (propId: string) => { const tx = new Transaction(); tx.moveCall({ target: `${PACKAGE_ID}::fund_box::approve_proposal`, arguments: [tx.object(POOL_ID), tx.object(propId)] }); executeTx(tx, "Đã bỏ phiếu duyệt!"); };
  const executeProposal = (propId: string) => { const tx = new Transaction(); tx.moveCall({ target: `${PACKAGE_ID}::fund_box::execute_proposal`, arguments: [tx.object(propId), tx.object(POOL_ID)] }); executeTx(tx, "Đã giải ngân tiền!"); };
  const addAdmin = () => { if (!newAdmin) return; const tx = new Transaction(); tx.moveCall({ target: `${PACKAGE_ID}::fund_box::add_admin`, arguments: [tx.object(POOL_ID), tx.pure.address(newAdmin)] }); executeTx(tx, "Đã thêm Admin mới!"); };
  const deleteProposal = (propId: string) => { if(!window.confirm("🗑 Xóa đề xuất?")) return; const tx = new Transaction(); tx.moveCall({ target: `${PACKAGE_ID}::fund_box::delete_proposal`, arguments: [tx.object(POOL_ID), tx.object(propId)] }); executeTx(tx, "Đã xóa đề xuất!"); };

  const copyReferralLink = () => {
    if (!account || !fullReferralLink) return alert("Vui lòng kết nối ví!");
    navigator.clipboard.writeText(fullReferralLink);
    alert("📋 Đã copy link giới thiệu!");
  };

  // --- CHARTS & HISTORY ---
  const donateEventsList = useMemo(() => {
    const allEvents = (events as any)?.data;
    if (!allEvents || !Array.isArray(allEvents)) return [];
    return allEvents.filter((ev: any) => ev.type.includes("DonateEvent"));
  }, [events]);

  const chartData = useMemo(() => {
    const areaData = [...donateEventsList].reverse().map((ev: any, index: number) => ({ name: `#${index + 1}`, amount: Number(ev.parsedJson?.amount) / 1e9 }));
    const regionMap: Record<string, number> = {};
    donateEventsList.forEach((ev: any) => { const r = ev.parsedJson?.region || "Chung"; regionMap[r] = (regionMap[r] || 0) + 1; });
    return { areaData, pieData: Object.entries(regionMap).map(([name, value]) => ({ name, value })) };
  }, [donateEventsList]);

  const topDonors = useMemo(() => {
    const map: Record<string, number> = {};
    donateEventsList.forEach((ev: any) => { const d = ev.parsedJson?.donor; if(d) map[d] = (map[d] || 0) + Number(ev.parsedJson?.amount)/1e9; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10);
  }, [donateEventsList]);

  return (
    <div className="container">
      <header className="navbar">
        <div className="logo" onClick={() => setActiveTab('home')}>✨ SUI TRUSTFLOW</div>
        <div className="nav-menu">
          <button className={`nav-btn ${activeTab==='home'?'active':''}`} onClick={()=>setActiveTab('home')}>🏠 Home</button>
          <button className={`nav-btn ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}>📊 Dash</button>
          {account && <button className="nav-btn" onClick={() => setShowQR(true)} style={{display:'flex', alignItems:'center', gap:'5px', border:'1px solid rgba(255,255,255,0.2)'}}>📱 Mã QR</button>}
        </div>
        <ConnectButton />
      </header>

      <main className="content">
        {activeTab === 'dashboard' ? (
          <div className="dashboard-layout fade-in">
            {isAdmin && (
              <div className="admin-panel" style={{border:'1px solid #06b6d4', background:'rgba(6,182,212,0.1)', borderRadius:'16px', padding:'20px', marginBottom:'30px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <h3 style={{color:'#06b6d4', marginTop:0}}>⚖️ Hội Đồng Quản Trị</h3>
                  <button onClick={exportToCSV} className="btn-outline">📄 Xuất Báo Cáo (.CSV)</button>
                </div>
                <div style={{display:'grid', gap:'10px', gridTemplateColumns:'1fr 1fr 1fr auto', marginBottom:'20px'}}>
                  <input className="message-input" placeholder="Ví nhận" value={proposalRecipient} onChange={e=>setProposalRecipient(e.target.value)}/>
                  <input className="message-input" type="number" placeholder="Số SUI" value={proposalAmount} onChange={e=>setProposalAmount(e.target.value)}/>
                  <input className="message-input" placeholder="Lý do" value={proposalReason} onChange={e=>setProposalReason(e.target.value)}/>
                  <button className="btn-primary" onClick={createProposal} disabled={isWaiting}>+ Tạo</button>
                </div>
                <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                  <input className="message-input" placeholder="Thêm ví Admin..." value={newAdmin} onChange={e=>setNewAdmin(e.target.value)} style={{maxWidth:'300px'}}/>
                  <button className="btn-primary" onClick={addAdmin} disabled={isWaiting} style={{width:'auto'}}>Thêm Admin</button>
                </div>
                <h4 style={{color:'#fff'}}>Danh sách Đề xuất (Cần 3/5 Phiếu)</h4>
                {isPropsError && <div style={{color: '#ef4444'}}>⚠️ Lỗi tải dữ liệu.</div>}
                {isEventsLoading && <div className="skeleton-loader"><div className="pulse"></div></div>}
                <div className="proposal-list">
                  {(Array.isArray(proposalObjects) ? proposalObjects : [])?.map((obj: any, index: number) => {
                    const fallbackId = proposalIds[index];
                    const isReported = reportedProps.includes(fallbackId);
                    if (obj.error || !obj.data) return null;
                    const fields = obj.data?.content?.fields;
                    if (!fields) return null;
                    const votes = fields.approvals?.fields?.contents?.length || 0;
                    const isExecuted = fields.is_executed;
                    const hasVoted = fields.approvals?.fields?.contents?.includes(account?.address);
                    const canDelete = isAdmin || (fields.creator === account?.address);
                    return (
                      <div key={fields.id.id} style={{position:'relative', background:'rgba(0,0,0,0.3)', padding:'15px', borderRadius:'10px', marginBottom:'10px', borderLeft: isExecuted?'4px solid #10b981':'4px solid #fbbf24', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        {isReported && (<div className="reported-overlay"><span>🚫 Đã báo cáo</span><button onClick={()=>handleUndoReport(fallbackId)} style={{marginTop:'5px',background:'transparent',border:'1px solid #ef4444',color:'#ef4444'}}>Hoàn tác</button></div>)}
                        <div><div style={{fontSize:'1.1rem',fontWeight:'bold'}}>{Number(fields.amount)/1e9} SUI <span style={{fontSize:'0.9rem',fontWeight:'normal',color:'#94a3b8'}}>tới {fields.recipient.slice(0,6)}...</span></div><div style={{color:'#cbd5e1'}}>📝 {fields.reason}</div></div>
                        <div style={{textAlign:'right'}}><div style={{fontWeight:'bold',color:isExecuted?'#10b981':'#fbbf24',marginBottom:'5px'}}>{isExecuted?"ĐÃ GIẢI NGÂN":`Phiếu: ${votes}/3`}</div><div style={{display:'flex',gap:'5px',justifyContent:'flex-end'}}>{!isExecuted&&(<> {!hasVoted&&<button className="btn-primary" onClick={()=>voteProposal(fields.id.id)} style={{background:'#06b6d4',padding:'5px 15px',fontSize:'0.8rem'}}>Vote 👍</button>} {votes>=3&&<button className="btn-primary" onClick={()=>executeProposal(fields.id.id)} style={{background:'#10b981',padding:'5px 15px',fontSize:'0.8rem'}}>Giải Ngân 💸</button>} {canDelete&&<button onClick={()=>deleteProposal(fields.id.id)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.5)',color:'#ef4444',padding:'5px 10px',borderRadius:'6px',cursor:'pointer',marginLeft:'5px'}}>🗑</button>} </>)}<button className="btn-report" onClick={()=>handleReportProposal(fields.id.id)} style={{marginLeft:'5px'}}>🚩</button></div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="charts-grid">
              <div className="chart-card"><h3>Dòng tiền</h3><ResponsiveContainer width="100%" height={300}><AreaChart data={chartData.areaData}><defs><linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} /><XAxis dataKey="name" hide /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{backgroundColor:'#1e293b',borderColor:'#475569',borderRadius:'12px'}}/><Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#colorAmt)"/></AreaChart></ResponsiveContainer></div>
              <div className="chart-card"><h3>Phân bổ Vùng</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={chartData.pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80}>{chartData.pieData.map((_,i)=>(<Cell key={`cell-${i}`} fill={COLORS[i%COLORS.length]}/>))}</Pie><Tooltip contentStyle={{backgroundColor:'#1e293b',borderColor:'#475569',borderRadius:'12px'}}/><Legend/></PieChart></ResponsiveContainer></div>
            </div>
          </div>
        ) : (
          <div className="home-layout fade-in">
            <section className="stats-grid">
              <div className="stat-card"><h3>💎 Quỹ: {totalSui.toFixed(2)} / {dynamicGoal.toFixed(2)} SUI</h3><p style={{fontSize:'0.8rem', color:'#94a3b8', marginTop:'-5px', marginBottom:'10px'}}>(Cần thêm {(dynamicGoal - totalSui) > 0 ? (dynamicGoal - totalSui).toFixed(2) : 0} SUI để đủ vốn)</p><div className="progress-container"><div className="progress-bar" style={{width: `${progress}%`}}></div></div></div>
              <div className="stat-card referral-card" style={{display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'10px'}}><h3>🤝 Tham gia lan tỏa</h3><button className="btn-primary" onClick={() => setShowQR(true)} style={{width:'100%'}}>Lấy Mã Giới Thiệu</button></div>
            </section>
            <div className="main-action-layout">
              <section className="donate-box">
                <h2>🔥 Gửi Yêu Thương</h2>
                {finalReferrer && (<div style={{marginBottom:'15px', padding:'10px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'8px', color:'#34d399', fontSize:'0.9rem', textAlign:'center'}}>👋 Bạn được giới thiệu bởi: <strong>{finalReferrer.slice(0,6)}...{finalReferrer.slice(-4)}</strong></div>)}
                <div style={{marginBottom:'15px'}}><label style={{display:'block', color:'#94a3b8', marginBottom:'5px', fontSize:'0.9rem'}}>Chọn dự án muốn ủng hộ:</label><select onChange={e => setRegion(e.target.value)} className="custom-select"><option value="Quỹ Chung">🌏 Quỹ Chung (Admin phân bổ)</option>{(Array.isArray(proposalObjects) ? proposalObjects : []).filter((obj: any) => !obj.data?.content?.fields?.is_executed && obj.data?.content?.fields).map((obj: any) => {const f = obj.data?.content?.fields;return (<option key={f.id.id} value={`Dự án: ${f.reason}`}>❤️ {f.reason} (Cần {Number(f.amount)/1e9} SUI)</option>);})}</select></div>
                <textarea className="message-input" placeholder="Lời nhắn..." onChange={e=>setMessage(e.target.value)} rows={2} style={{marginBottom:'10px'}}/>
                <div className="input-group"><input type="number" className="amount-input" value={amount} onChange={handleAmountChange} placeholder="0.0" min="0" step="any" onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()} /><span className="unit-label">SUI</span></div>
                <div className="checkbox-wrapper"><input type="checkbox" onChange={e=>setIsAnonymous(e.target.checked)}/> <label>Ẩn danh</label></div>
                <button className="btn-primary" onClick={handleDonate} disabled={isWaiting}>Quyên góp</button>
              </section>
              <section className="history-box">
                <div className="history-header"><h2>Bảng Vàng</h2><div className="nav-menu" style={{margin:0}}><button className={`nav-btn ${viewMode==='recent'?'active':''}`} onClick={()=>setViewMode('recent')}>Mới</button><button className={`nav-btn ${viewMode==='top'?'active':''}`} onClick={()=>setViewMode('top')}>Top</button></div></div>
                <div className="event-list">{viewMode === 'top' ? topDonors.map((d,i)=>(<div key={i} className="event-item"><span>#{i+1} {d[0].slice(0,6)}...</span><span>{d[1].toFixed(1)} SUI</span></div>)) : donateEventsList.slice(0,10).map((ev:any, i:number) => (<div key={i} className="event-item extended"><div className="event-header"><div className="donor-addr">{ev.parsedJson?.is_anonymous ? "🎭 Ẩn danh" : `👤 ${ev.parsedJson?.donor?.slice(0,6)}...`} <span className="region-tag" style={{maxWidth:'150px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', verticalAlign:'bottom', display:'inline-block'}}>{ev.parsedJson?.region || "Chung"}</span></div><div className="event-amount">+{Number(ev.parsedJson?.amount)/1e9} SUI</div></div>{ev.parsedJson?.message && <div className="message-bubble">💬 "{ev.parsedJson.message}"</div>}</div>))}</div>
              </section>
            </div>
          </div>
        )}
      </main>

      {showQR && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowQR(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowQR(false); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
        >
          <div style={{
            background: '#1e293b', padding: '30px', borderRadius: '16px',
            maxWidth: '90%', width: '400px', textAlign: 'center',
            border: '1px solid #334155', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{color: '#fff', marginTop: 0}}>📱 Quét Mã Để Ủng Hộ</h3>
            {fullReferralLink && (
              <div style={{background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px'}}>
                <QRCode value={fullReferralLink} size={180} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`} />
              </div>
            )}
            <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '5px'}}>Link giới thiệu của bạn:</p>
            <div style={{background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', wordBreak: 'break-all', fontFamily: 'monospace', color: '#cbd5e1', marginBottom: '20px', fontSize:'0.85rem'}}>{fullReferralLink}</div>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn-primary" onClick={copyReferralLink} style={{flex:1}}>Sao Chép Link</button>
              <button onClick={() => setShowQR(false)} style={{flex:1, background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;