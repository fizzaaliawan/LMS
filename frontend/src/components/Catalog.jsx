import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Catalog({ user, onLogout }) {
  const isLibrarian = user.role === "librarian";

  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [showOverdueToast, setShowOverdueToast] = useState(true);
  const [showDueSoonToast, setShowDueSoonToast] = useState(true);

  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [newBook, setNewBook] = useState({ title: "", author: "", isbn: "" });
  const [newMember, setNewMember] = useState({ name: "", email: "" });

  const [loanMemberByBook, setLoanMemberByBook] = useState({});
  const [reportStatus, setReportStatus] = useState(null);
  const [overdueLoans, setOverdueLoans] = useState([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState("loans"); // "loans" (Dashboard) | "catalog" (Inventory) | "members" (Members) | "tasks" (Reports)
  const [memberTab, setMemberTab] = useState("dashboard"); // "dashboard" | "catalog"

  // Search & Edit states
  const [memberQuery, setMemberQuery] = useState("");
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");

  // Search loans state (Staff Portal)
  const [loansQuery, setLoansQuery] = useState("");

  // Drawer & Modal toggle states
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
  const [isAddBookDrawerOpen, setIsAddBookDrawerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // Pagination states
  const [loansPage, setLoansPage] = useState(1);
  const [booksPage, setBooksPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Member Catalog Filters
  const [filterAvailable, setFilterAvailable] = useState(true);
  const [filterGenre, setFilterGenre] = useState("");
  const [filterFormat, setFilterFormat] = useState("Physical Book");

  // Favorites & Quick Modal states
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lms_favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [quickModal, setQuickModal] = useState(null); // "loans" | "history" | "favorites" | null

  function toggleFavorite(bookId) {
    setFavorites((prev) => {
      const updated = prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId];
      try {
        localStorage.setItem("lms_favorites", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }

  async function refresh() {
    setError("");
    try {
      const booksPromise = api.listBooks().catch(() => []);
      const loansPromise = api.listLoans().catch(() => []);
      const notifsPromise = api.listNotifications().catch(() => []);
      const membersPromise = isLibrarian ? api.listMembers().catch(() => []) : Promise.resolve([]);

      const [b, l, n, m] = await Promise.all([booksPromise, loansPromise, notifsPromise, membersPromise]);
      setBooks(b || []);
      setLoans(l || []);
      setNotifications(n || []);
      if (isLibrarian) setMembers(m || []);
    } catch (err) {
      console.error("Error refreshing data:", err);
      const msg = typeof err === "string" ? err : err?.message || "Failed to sync data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const unreadNotifications = notifications.filter((notification) => !notification.is_read);

  async function markNotificationRead(notificationId) {
    try {
      const updated = await api.markNotificationRead(notificationId);
      setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (err) { setError(err.message); }
  }

  async function markAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    } catch (err) { setError(err.message); }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    setBooksPage(1);
    try {
      setBooks(query.trim() ? await api.searchBooks(query.trim()) : await api.listBooks());
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddBook(e) {
    e.preventDefault();
    setError("");
    try {
      await api.addBook(newBook.title, newBook.author, newBook.isbn);
      setNewBook({ title: "", author: "", isbn: "" });
      setIsAddBookDrawerOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setError("");
    try {
      await api.registerMember(newMember.name, newMember.email);
      setNewMember({ name: "", email: "" });
      setIsMemberDrawerOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSearchMembers(e) {
    if (e) e.preventDefault();
    setError("");
    setMembersPage(1);
    try {
      setMembers(memberQuery.trim() ? await api.searchMembers(memberQuery.trim()) : await api.listMembers());
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditingMember(member) {
    setEditingMemberId(member.id);
    setEditingName(member.name);
    setEditingEmail(member.email);
  }

  function cancelEditingMember() {
    setEditingMemberId(null);
    setEditingName("");
    setEditingEmail("");
  }

  async function handleUpdateMember(memberId) {
    setError("");
    try {
      await api.updateMember(memberId, editingName, editingEmail);
      setEditingMemberId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteMember(memberId) {
    if (!window.confirm("Are you sure you want to delete this member?")) return;
    setError("");
    try {
      await api.deleteMember(memberId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLoan(bookId) {
    setError("");
    const memberId = loanMemberByBook[bookId];
    if (!memberId) {
      setError("Pick a member first.");
      return;
    }
    try {
      await api.createLoan(bookId, memberId);
      // clear dropdown selection
      setLoanMemberByBook({ ...loanMemberByBook, [bookId]: "" });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSelfLoan(bookId) {
    setError("");
    try {
      await api.createLoan(bookId, "00000000-0000-0000-0000-000000000000");
      await refresh();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Failed to borrow book.");
    }
  }

  async function handleReturn(bookId) {
    setError("");
    const activeLoan = loans.find((l) => l.book_id === bookId && !l.returned_at);
    if (!activeLoan) {
      setError("No active loan found for this book.");
      return;
    }
    try {
      await api.returnLoan(activeLoan.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRunOverdueReport() {
    setError("");
    setReportStatus("Running...");
    setOverdueLoans([]);
    try {
      const { job_id } = await api.triggerOverdueReport();
      for (let i = 0; i < 15; i++) {
        const result = await api.getOverdueReport(job_id);
        if (result.status !== "pending") {
          setReportStatus(`${result.overdue_count} overdue loan(s) found`);
          if (result.overdue_loans) {
            setOverdueLoans(result.overdue_loans);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      setReportStatus("Still running - check back shortly.");
    } catch (err) {
      setError(err.message);
      setReportStatus(null);
    }
  }

  // Get current date metrics
  function getLoanDueInfo(loan) {
    if (!loan || loan.returned_at) return null;
    const dueDate = new Date(loan.due_at);
    if (Number.isNaN(dueDate.getTime())) return null;
    const status = loan.status === "overdue" ? "overdue" : loan.status === "due_soon" ? "due-soon" : "active";
    return { status, dueDate, dueDateLabel: dueDate.toLocaleDateString(), statusLabel: loan.status.replace("_", " ") };
  }

  function isLoanOverdue(loan) {
    const dueInfo = getLoanDueInfo(loan);
    return Boolean(dueInfo && dueInfo.status === "overdue");
  }

  function isLoanDueSoon(loan) {
    const dueInfo = getLoanDueInfo(loan);
    return Boolean(dueInfo && dueInfo.status === "due-soon");
  }

  // High-Fidelity Handcrafted & Procedural Vector Book Illustration Engine (True Vertical Rectangle 1 : 1.48)
  function renderBookIllustration(title = "", author = "", isMini = false) {
    const t = (title || "").toLowerCase();
    
    // 1. Dune
    if (t.includes("dune")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#1a0b06" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <radialGradient id="duneSun" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor="#ffb347" />
                <stop offset="35%" stopColor="#ff5e36" />
                <stop offset="70%" stopColor="#96281b" />
                <stop offset="100%" stopColor="#2c0e07" />
              </radialGradient>
              <linearGradient id="duneSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1a0b06" />
                <stop offset="50%" stopColor="#5c1d0a" />
                <stop offset="100%" stopColor="#963810" />
              </linearGradient>
              <linearGradient id="duneSand1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
              <linearGradient id="duneSand2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
              <linearGradient id="duneFront" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="100%" stopColor="#1a0601" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#duneSky)" />
            <circle cx="70" cy="85" r="28" fill="url(#duneSun)" opacity="0.9" />
            <circle cx="70" cy="85" r="16" fill="#fef08a" opacity="0.85" />
            <path d="M0 135 Q35 95 70 125 T140 120 L140 207 L0 207 Z" fill="url(#duneSand1)" />
            <path d="M0 150 C40 130 60 165 100 140 C120 125 135 145 140 147 L140 207 L0 207 Z" fill="url(#duneSand2)" />
            <path d="M0 175 C30 155 70 190 140 165 L140 207 L0 207 Z" fill="url(#duneFront)" />
            <circle cx="20" cy="30" r="0.7" fill="#fde047" opacity="0.6" />
            <circle cx="120" cy="25" r="0.8" fill="#fde047" opacity="0.7" />
          </svg>
          {!isMini && (
            <div style={{ position: "absolute", top: "14px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.45rem", letterSpacing: "0.15em", color: "#fdba74", textTransform: "uppercase", opacity: 0.85, fontWeight: 700 }}>An Epic Masterpiece</div>
              <div style={{ fontSize: "1.18rem", letterSpacing: "0.18em", color: "#fff", fontWeight: 800, fontFamily: "serif", textShadow: "0 2px 8px rgba(0,0,0,0.8)", marginTop: "3px" }}>DUNE</div>
            </div>
          )}
        </div>
      );
    }

    // 2. Foundation
    if (t.includes("foundation")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#0f0c29" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="foundSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="40%" stopColor="#312e81" />
                <stop offset="70%" stopColor="#4338ca" />
                <stop offset="100%" stopColor="#e879f9" />
              </linearGradient>
              <linearGradient id="foundSpire" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
              <linearGradient id="foundGround" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#09090b" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#foundSky)" />
            <polygon points="70,55 67,135 73,135" fill="url(#foundSpire)" />
            <polygon points="69.5,45 68.5,60 71.5,60" fill="#ffffff" />
            <circle cx="70" cy="45" r="3" fill="#ffffff" filter="drop-shadow(0 0 4px #e0e7ff)" />
            <polygon points="50,150 70,125 90,150 82,175 58,175" fill="#18181b" />
            <path d="M0 165 Q40 150 70 170 T140 160 L140 207 L0 207 Z" fill="url(#foundGround)" />
            <path d="M55 190 L70 175 L85 190 L70 207 Z" fill="#818cf8" opacity="0.4" />
          </svg>
          {!isMini && (
            <div style={{ position: "absolute", top: "16px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.85rem", letterSpacing: "0.14em", color: "#ffffff", fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>FOUNDATION</div>
            </div>
          )}
        </div>
      );
    }

    // 3. Neuromancer
    if (t.includes("neuromancer")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#050508" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cyberSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#030712" />
                <stop offset="60%" stopColor="#111827" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#cyberSky)" />
            <rect x="0" y="55" width="22" height="152" fill="#030712" />
            <rect x="18" y="70" width="18" height="137" fill="#090d16" />
            <rect x="32" y="85" width="14" height="122" fill="#0f172a" />
            <rect x="118" y="55" width="22" height="152" fill="#030712" />
            <rect x="104" y="70" width="18" height="137" fill="#090d16" />
            <rect x="94" y="85" width="14" height="122" fill="#0f172a" />
            <line x1="10" y1="70" x2="10" y2="195" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3,4" />
            <line x1="26" y1="90" x2="26" y2="195" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="2,3" />
            <line x1="130" y1="70" x2="130" y2="195" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3,4" />
            <line x1="112" y1="90" x2="112" y2="195" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2,3" />
            <polygon points="50,207 68,140 72,140 90,207" fill="#ec4899" opacity="0.65" />
            <line x1="70" y1="140" x2="70" y2="207" stroke="#38bdf8" strokeWidth="1" />
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "14px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.55rem", letterSpacing: "0.12em", color: "#e2e8f0", fontWeight: 700, textTransform: "uppercase" }}>WILLIAM GIBSON</div>
              </div>
              <div style={{ position: "absolute", bottom: "12px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: "#38bdf8", fontWeight: 800, textShadow: "0 0 8px rgba(56,189,248,0.7)" }}>NEUROMANCER</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 4. 1984
    if (t.includes("1984")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#5a0f12" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <radialGradient id="eyeRadiate" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="70%" stopColor="#58111a" />
                <stop offset="100%" stopColor="#250507" />
              </radialGradient>
              <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="40%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#450a0a" />
              </radialGradient>
            </defs>
            <rect width="140" height="207" fill="url(#eyeRadiate)" />
            <path d="M 30 103 Q 70 73 110 103 Q 70 133 30 103 Z" fill="#fff5f5" stroke="#1c0406" strokeWidth="2.5" />
            <circle cx="70" cy="103" r="16" fill="url(#irisGrad)" stroke="#1c0406" strokeWidth="2" />
            <circle cx="70" cy="103" r="7" fill="#0f0203" />
            <circle cx="67" cy="100" r="2.5" fill="#ffffff" />
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "14px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", letterSpacing: "0.15em", color: "#fef2f2", fontWeight: 900, fontFamily: "serif" }}>1984</div>
              </div>
              <div style={{ position: "absolute", bottom: "12px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: "#fecaca", fontWeight: 700, textTransform: "uppercase" }}>GEORGE ORWELL</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 5. Sapiens
    if (t.includes("sapiens")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#eadeca" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="papyrusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f7efe1" />
                <stop offset="50%" stopColor="#ede1cc" />
                <stop offset="100%" stopColor="#ded0b7" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#papyrusGrad)" />
            <g transform="translate(70, 108)" stroke="#27272a" fill="none" strokeWidth="1.8" strokeLinecap="round" opacity="0.88">
              <ellipse cx="0" cy="0" rx="3" ry="5" />
              <path d="M -6 -8 C -6 -14 6 -14 6 -8 C 6 -2 -6 -2 -6 4" />
              <path d="M -11 -12 C -11 -20 11 -20 11 -12 C 11 0 -11 0 -11 12 C -11 18 11 18 11 24" />
              <path d="M -16 -16 C -16 -27 16 -27 16 -16 C 16 4 -16 4 -16 20 C -16 28 16 28 16 34" />
              <path d="M -21 -18 C -21 -33 21 -33 21 -18 C 21 8 -21 8 -21 28 C -21 38 21 38 21 44" />
              <path d="M -26 -16 C -26 -38 26 -38 26 -16 C 26 12 -26 12 -26 36" />
              <path d="M -30 -10 C -30 -42 30 -42 30 -10 C 30 16 -30 16 -30 42" />
            </g>
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "16px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", letterSpacing: "0.14em", color: "#832422", fontWeight: 800, fontFamily: "serif" }}>SAPIENS</div>
              </div>
              <div style={{ position: "absolute", bottom: "12px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.55rem", letterSpacing: "0.1em", color: "#3f3f46", fontWeight: 700, textTransform: "uppercase" }}>YUVAL NOAH HARARI</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 6. The Great Gatsby / Classics / Literature
    if (t.includes("gatsby")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#041b1d" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gatsbyNight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#021417" />
                <stop offset="60%" stopColor="#063238" />
                <stop offset="100%" stopColor="#0b484a" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#gatsbyNight)" />
            {/* Art Deco Archways */}
            <path d="M 15 207 L 15 65 Q 70 20 125 65 L 125 207" fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.85" />
            <path d="M 25 207 L 25 75 Q 70 38 115 75 L 115 207" fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.6" />
            <circle cx="70" cy="115" r="24" fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.8" />
            <circle cx="70" cy="115" r="5" fill="#10b981" filter="drop-shadow(0 0 6px #34d399)" />
            <line x1="70" y1="120" x2="70" y2="207" stroke="#10b981" strokeWidth="1.5" opacity="0.6" strokeDasharray="3,3" />
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "16px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.52rem", letterSpacing: "0.15em", color: "#fef08a", fontWeight: 700, textTransform: "uppercase" }}>F. SCOTT FITZGERALD</div>
              </div>
              <div style={{ position: "absolute", bottom: "14px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.88rem", letterSpacing: "0.14em", color: "#fef9c3", fontWeight: 800, fontFamily: "serif" }}>THE GREAT GATSBY</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 7. Clean Code / Software / Technology
    if (t.includes("code") || t.includes("program") || t.includes("tech") || t.includes("python") || t.includes("java")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#0a0e17" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="techGrid" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="50%" stopColor="#022c22" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#techGrid)" />
            <path d="M 20 80 L 50 80 L 70 100 L 120 100" stroke="#10b981" strokeWidth="1.2" fill="none" opacity="0.75" />
            <path d="M 20 120 L 70 120 L 90 140 L 120 140" stroke="#06b6d4" strokeWidth="1.2" fill="none" opacity="0.75" />
            <polygon points="70,75 95,100 70,125 45,100" fill="#042f2e" stroke="#10b981" strokeWidth="2" />
            <circle cx="70" cy="100" r="4" fill="#34d399" filter="drop-shadow(0 0 6px #34d399)" />
            <circle cx="120" cy="100" r="3" fill="#10b981" />
            <circle cx="120" cy="140" r="3" fill="#06b6d4" />
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "15px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.52rem", letterSpacing: "0.14em", color: "#6ee7b7", fontWeight: 700, textTransform: "uppercase" }}>SOFTWARE CRAFTSMANSHIP</div>
              </div>
              <div style={{ position: "absolute", bottom: "14px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.95rem", letterSpacing: "0.12em", color: "#ffffff", fontWeight: 800, fontFamily: "monospace" }}>{title.toUpperCase()}</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 8. To Kill a Mockingbird / Drama / Fiction
    if (t.includes("mockingbird")) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#111827" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="mockingSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="50%" stopColor="#312e81" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#mockingSky)" />
            <circle cx="110" cy="50" r="14" fill="#fef3c7" opacity="0.9" />
            <path d="M 0 207 C 40 160 50 120 40 80 Q 80 110 140 100 L 140 207 Z" fill="#0f172a" />
            <circle cx="65" cy="130" r="1.5" fill="#fef08a" filter="drop-shadow(0 0 3px #fef08a)" />
            <circle cx="85" cy="150" r="1.5" fill="#fef08a" filter="drop-shadow(0 0 3px #fef08a)" />
            <circle cx="105" cy="120" r="1.5" fill="#fef08a" filter="drop-shadow(0 0 3px #fef08a)" />
          </svg>
          {!isMini && (
            <>
              <div style={{ position: "absolute", top: "16px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.52rem", letterSpacing: "0.14em", color: "#fde68a", fontWeight: 700, textTransform: "uppercase" }}>HARPER LEE</div>
              </div>
              <div style={{ position: "absolute", bottom: "14px", left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: "0.85rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif" }}>TO KILL A MOCKINGBIRD</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // --- PROCEDURAL RICH ILLUSTRATION ENGINE FOR ALL OTHER BOOKS ---
    // Deterministic hash creates a stunning illustrated vector landscape for every book in the library
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    const themeIndex = Math.abs(hash) % 6;

    // Theme 0: Celestial Cosmic Orbit (Deep Violet & Golden Starburst)
    if (themeIndex === 0) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#180828" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cosmicSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#090514" />
                <stop offset="50%" stopColor="#2e1065" />
                <stop offset="100%" stopColor="#701a75" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#cosmicSky)" />
            <circle cx="70" cy="95" r="32" fill="none" stroke="#f472b6" strokeWidth="1.2" opacity="0.6" />
            <circle cx="70" cy="95" r="22" fill="none" stroke="#e879f9" strokeWidth="1.5" />
            <circle cx="70" cy="95" r="10" fill="#fdf4ff" filter="drop-shadow(0 0 8px #f472b6)" />
            <path d="M 0 185 Q 70 145 140 185 L 140 207 L 0 207 Z" fill="#090514" />
            <circle cx="25" cy="40" r="0.9" fill="#ffffff" />
            <circle cx="115" cy="35" r="0.9" fill="#ffffff" />
            <circle cx="95" cy="65" r="0.7" fill="#ffffff" />
          </svg>
          <div style={{ position: "absolute", top: isMini ? "4px" : "14px", left: "8px", right: "8px", textAlign: "center" }}>
            <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.12em", color: "#f5d0fe", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "MASTERPIECE"}</div>
            {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "4px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
          </div>
          {!isMini && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.48rem", letterSpacing: "0.15em", color: "#f0abfc", fontWeight: 700, textTransform: "uppercase" }}>LIBRARY EDITION</div>
            </div>
          )}
        </div>
      );
    }

    // Theme 1: Alpine Mountain Peak & Sunrise (Azure & Golden Ochre)
    if (themeIndex === 1) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#0c1e33" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="alpSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0b192c" />
                <stop offset="50%" stopColor="#1e3e62" />
                <stop offset="100%" stopColor="#f4a261" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#alpSky)" />
            <polygon points="70,60 20,180 120,180" fill="#1e293b" opacity="0.9" />
            <polygon points="70,60 55,100 70,85 85,100" fill="#ffffff" />
            <polygon points="35,100 0,195 90,195" fill="#0f172a" />
            <polygon points="105,90 60,207 140,207" fill="#020617" />
          </svg>
          <div style={{ position: "absolute", top: isMini ? "4px" : "14px", left: "8px", right: "8px", textAlign: "center" }}>
            <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.12em", color: "#fed7aa", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "SPECIAL EDITION"}</div>
            {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "4px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
          </div>
          {!isMini && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.48rem", letterSpacing: "0.15em", color: "#fdba74", fontWeight: 700, textTransform: "uppercase" }}>HERITAGE COLLECTION</div>
            </div>
          )}
        </div>
      );
    }

    // Theme 2: Emerald Forest Canopy & Sunbeams (Deep Forest Emerald & Gold)
    if (themeIndex === 2) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#022c22" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="forestSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#022c22" />
                <stop offset="50%" stopColor="#064e3b" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#forestSky)" />
            <circle cx="70" cy="90" r="30" fill="#a7f3d0" opacity="0.15" />
            <polygon points="70,50 30,140 110,140" fill="#065f46" opacity="0.8" />
            <polygon points="70,35 40,115 100,115" fill="#047857" opacity="0.8" />
            <polygon points="70,20 50,90 90,90" fill="#059669" />
            <rect x="67" y="140" width="6" height="67" fill="#1c1917" />
            <path d="M 0 180 Q 70 160 140 180 L 140 207 L 0 207 Z" fill="#022c22" />
          </svg>
          <div style={{ position: "absolute", top: isMini ? "4px" : "14px", left: "8px", right: "8px", textAlign: "center" }}>
            <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.12em", color: "#a7f3d0", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "PREMIUM SELECTION"}</div>
            {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "4px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
          </div>
          {!isMini && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.48rem", letterSpacing: "0.15em", color: "#6ee7b7", fontWeight: 700, textTransform: "uppercase" }}>DEFINITIVE EDITION</div>
            </div>
          )}
        </div>
      );
    }

    // Theme 3: Deep Oceanic Wave & Sea Horizon (Sapphire & Turquoise)
    if (themeIndex === 3) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#0c1a2e" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="seaSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#081426" />
                <stop offset="60%" stopColor="#0f3460" />
                <stop offset="100%" stopColor="#16213e" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#seaSky)" />
            <circle cx="70" cy="65" r="16" fill="#e0f2fe" opacity="0.85" />
            <path d="M 0 135 C 30 115 50 150 85 130 C 110 115 125 135 140 128 L 140 207 L 0 207 Z" fill="#0284c7" opacity="0.6" />
            <path d="M 0 155 C 40 135 70 170 105 145 C 120 135 135 150 140 148 L 140 207 L 0 207 Z" fill="#0369a1" opacity="0.8" />
            <path d="M 0 175 C 35 160 65 190 140 170 L 140 207 L 0 207 Z" fill="#075985" />
          </svg>
          <div style={{ position: "absolute", top: isMini ? "4px" : "14px", left: "8px", right: "8px", textAlign: "center" }}>
            <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.12em", color: "#bae6fd", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "CLASSICS"}</div>
            {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "4px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
          </div>
          {!isMini && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.48rem", letterSpacing: "0.15em", color: "#7dd3fc", fontWeight: 700, textTransform: "uppercase" }}>ILLUSTRATED CLASSIC</div>
            </div>
          )}
        </div>
      );
    }

    // Theme 4: Crimson Sunset & Ancient Monolith (Ruby Red & Amber)
    if (themeIndex === 4) {
      return (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#3b0a0a" }}>
          <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
            <defs>
              <linearGradient id="crimsonSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1c0505" />
                <stop offset="50%" stopColor="#7f1d1d" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <rect width="140" height="207" fill="url(#crimsonSky)" />
            <circle cx="70" cy="80" r="22" fill="#fef3c7" opacity="0.9" />
            <polygon points="70,45 60,165 80,165" fill="#180404" />
            <polygon points="69,35 65,55 75,55" fill="#ffffff" />
            <path d="M 0 160 Q 70 140 140 160 L 140 207 L 0 207 Z" fill="#180404" />
          </svg>
          <div style={{ position: "absolute", top: isMini ? "4px" : "14px", left: "8px", right: "8px", textAlign: "center" }}>
            <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.12em", color: "#fde68a", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "LITERARY GUILD"}</div>
            {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "4px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
          </div>
          {!isMini && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center" }}>
              <div style={{ fontSize: "0.48rem", letterSpacing: "0.15em", color: "#fca5a5", fontWeight: 700, textTransform: "uppercase" }}>COLLECTOR'S EDITION</div>
            </div>
          )}
        </div>
      );
    }

    // Theme 5: Obsidian Gilded Art Deco (Black & Gold Monogram Crest)
    return (
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.48", borderRadius: isMini ? "3px" : "8px", overflow: "hidden", boxShadow: isMini ? "0 2px 4px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.18)", background: "#111827" }}>
        <svg width="100%" height="100%" viewBox="0 0 140 207" preserveAspectRatio="none">
          <defs>
            <linearGradient id="goldDeco" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#090d16" />
              <stop offset="50%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
          </defs>
          <rect width="140" height="207" fill="url(#goldDeco)" />
          {/* Gilded Borders */}
          <rect x="8" y="8" width="124" height="191" fill="none" stroke="#d4af37" strokeWidth="1.2" opacity="0.75" />
          <rect x="12" y="12" width="116" height="183" fill="none" stroke="#d4af37" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.6" />
          <circle cx="70" cy="103" r="26" fill="none" stroke="#d4af37" strokeWidth="1.2" opacity="0.8" />
          <circle cx="70" cy="103" r="18" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.5" />
          <polygon points="70,88 83,103 70,118 57,103" fill="#1e293b" stroke="#d4af37" strokeWidth="1.5" />
        </svg>
        <div style={{ position: "absolute", top: isMini ? "4px" : "18px", left: "14px", right: "14px", textAlign: "center" }}>
          <div style={{ fontSize: isMini ? "0.28rem" : "0.52rem", letterSpacing: "0.14em", color: "#fef08a", fontWeight: 700, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author || "AUTHENTIC"}</div>
          {!isMini && <div style={{ fontSize: "0.95rem", letterSpacing: "0.08em", color: "#ffffff", fontWeight: 800, fontFamily: "serif", marginTop: "6px", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>}
        </div>
        {!isMini && (
          <div style={{ position: "absolute", bottom: "14px", left: 0, right: 0, textAlign: "center" }}>
            <div style={{ fontSize: "0.48rem", letterSpacing: "0.16em", color: "#fef08a", fontWeight: 700, textTransform: "uppercase" }}>PREMIER EDITION</div>
          </div>
        )}
      </div>
    );
  }

  // Small Cover
  function renderBookCover(book) {
    if (!book) return null;
    return (
      <div style={{ width: "42px", flexShrink: 0 }}>
        {renderBookIllustration(book.title, book.author, true)}
      </div>
    );
  }

  // Large Cover for Grid Catalog (Member View)
  function renderLargeBookCover(book) {
    if (!book) return null;
    return (
      <div style={{ marginBottom: "0.85rem", width: "100%" }}>
        {renderBookIllustration(book.title, book.author, false)}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <span className="spinner"></span>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Initializing Library Interface...</p>
      </div>
    );
  }

  // Active counts
  const activeBooks = books.filter((b) => b.is_active);
  const totalBooksCount = activeBooks.length;
  const availableBooksCount = activeBooks.filter((b) => b.available).length;
  const activeLoans = loans.filter((l) => !l.returned_at);
  const activeLoansCount = activeLoans.length;
  const overdueLoansCount = loans.filter(isLoanOverdue).length;
  const dueSoonLoansCount = loans.filter(isLoanDueSoon).length;

  // Filtered loans list (Staff Dashboard search)
  const filteredLoans = loans.filter((loan) => {
    const book = books.find((b) => b.id === loan.book_id);
    const member = members.find((m) => m.id === loan.member_id);
    const searchStr = `${book?.title || ""} ${member?.name || ""} ${member?.email || ""}`.toLowerCase();
    return searchStr.includes(loansQuery.toLowerCase());
  });

  // Pagination lists
  const paginatedLoans = filteredLoans.slice((loansPage - 1) * ITEMS_PER_PAGE, loansPage * ITEMS_PER_PAGE);
  const paginatedBooks = books.slice((booksPage - 1) * ITEMS_PER_PAGE, booksPage * ITEMS_PER_PAGE);
  const paginatedMembers = members.slice((membersPage - 1) * ITEMS_PER_PAGE, membersPage * ITEMS_PER_PAGE);

  // Member Dashboard Metrics & Data
  const currentMember = members.find((m) => m.email.toLowerCase() === user.email.toLowerCase()) || { id: 0 };
  const memberActiveLoans = loans.filter((l) => l.member_id === currentMember.id && !l.returned_at);
  const memberOverdueCount = memberActiveLoans.filter(isLoanOverdue).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-app-cream)" }}>
      
      {/* -------------------- STAFF PORTAL (LIBRARIAN) -------------------- */}
      {isLibrarian && (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          
          {/* Sidebar Panel */}
          <aside style={{ width: 280, backgroundColor: "#ffffff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "2rem 1.5rem", flexShrink: 0 }}>
            <div>
              {/* Header profile info */}
              <div style={{ marginBottom: "2.5rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-navy)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Staff Portal</h2>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Library Management System</span>
              </div>

              {/* Navigation Tabs */}
              <nav style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab("loans"); setError(""); }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    padding: "0.75rem 1rem",
                    border: "none",
                    borderRadius: "8px",
                    background: activeTab === "loans" ? "#0b1a30" : "transparent",
                    color: activeTab === "loans" ? "#ffffff" : "#4a5468",
                    fontWeight: activeTab === "loans" ? "700" : "500",
                    boxShadow: "none",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <svg style={{ marginRight: "0.6rem" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("catalog"); setError(""); }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    padding: "0.75rem 1rem",
                    border: "none",
                    borderRadius: "8px",
                    background: activeTab === "catalog" ? "#0b1a30" : "transparent",
                    color: activeTab === "catalog" ? "#ffffff" : "#4a5468",
                    fontWeight: activeTab === "catalog" ? "700" : "500",
                    boxShadow: "none",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <svg style={{ marginRight: "0.6rem" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
                  Inventory
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("members"); setError(""); }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    padding: "0.75rem 1rem",
                    border: "none",
                    borderRadius: "8px",
                    background: activeTab === "members" ? "#0b1a30" : "transparent",
                    color: activeTab === "members" ? "#ffffff" : "#4a5468",
                    fontWeight: activeTab === "members" ? "700" : "500",
                    boxShadow: "none",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <svg style={{ marginRight: "0.6rem" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Members
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("tasks"); setError(""); }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    padding: "0.75rem 1rem",
                    border: "none",
                    borderRadius: "8px",
                    background: activeTab === "tasks" ? "#0b1a30" : "transparent",
                    color: activeTab === "tasks" ? "#ffffff" : "#4a5468",
                    fontWeight: activeTab === "tasks" ? "700" : "500",
                    boxShadow: "none",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <svg style={{ marginRight: "0.6rem" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Reports
                </button>
              </nav>
            </div>

            {/* Logout and Notifications */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
              <button 
                type="button" 
                onClick={() => setNotificationsOpen(!notificationsOpen)} 
                className="btn-secondary" 
                style={{ width: "100%", padding: "0.6rem", display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Alerts
                </span>
                {unreadNotifications.length > 0 && (
                  <span style={{ background: "var(--color-danger)", color: "#ffffff", borderRadius: "999px", padding: "0.05rem 0.4rem", fontSize: "0.7rem", fontWeight: 700 }}>
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              <button onClick={onLogout} className="btn-secondary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.82rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main style={{ flex: 1, padding: "3rem 4rem", overflowY: "auto", display: "flex", flexDirection: "column" }} className="animate-fade-in">
            
            {/* Global Errors */}
            {error && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "1rem", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "0.85rem", border: "1px solid rgba(155, 44, 44, 0.15)", marginBottom: "2.25rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontWeight: 600 }}>{error}</span>
              </div>
            )}

            {/* Notification Pane overlay */}
            {notificationsOpen && (
              <section className="glass-card animate-fade-in" style={{ padding: "1.5rem", maxWidth: "600px", alignSelf: "flex-end", width: "100%", marginBottom: "1.5rem", border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", fontFamily: "var(--font-serif)" }}>System Alerts</h3>
                  {unreadNotifications.length > 0 && <button type="button" className="btn-secondary" onClick={markAllNotificationsRead} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No current alerts.</p> : (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {notifications.map((n) => (
                      <div key={n.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem", background: n.is_read ? "rgba(0,0,0,0.01)" : "var(--color-warning-light)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", cursor: "pointer" }} onClick={() => !n.is_read && markNotificationRead(n.id)}>
                        <div>
                          <strong>{n.book_title}</strong> {n.status.replace("_", " ")}
                          {n.borrower_name && <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>Borrower: {n.borrower_name}</div>}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* --- Staff Tab 1: Dashboard (Active Book Loans) --- */}
            {activeTab === "loans" && (
              <>
                <header style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Active Book Loans</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Manage current physical and digital borrowing transactions.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setActiveTab("catalog")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    New Loan
                  </button>
                </header>

                {/* Metrics row */}
                <div className="stat-grid">
                  <div className="stat-card">
                    <span className="stat-card-title">Total Active Loans</span>
                    <span className="stat-card-value">{activeLoansCount}</span>
                    <span className="stat-card-sub">In circulation</span>
                  </div>

                  <div className="stat-card overdue">
                    <span className="stat-card-title" style={{ color: "var(--color-danger)" }}>Overdue Items</span>
                    <span className="stat-card-value" style={{ color: "var(--color-danger)" }}>{overdueLoansCount}</span>
                    <span className="stat-card-sub">Action required immediately</span>
                  </div>

                  <div className="stat-card">
                    <span className="stat-card-title">Due Attention Soon</span>
                    <span className="stat-card-value">{dueSoonLoansCount}</span>
                    <span className="stat-card-sub">Next 3 days expected returns</span>
                  </div>
                </div>

                {/* Transaction Log Table */}
                <div className="premium-table-container">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Transaction Log</h3>
                    <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "300px" }}>
                      <input 
                        type="text" 
                        placeholder="Search loans..." 
                        value={loansQuery}
                        onChange={(e) => { setLoansQuery(e.target.value); setLoansPage(1); }}
                        style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                      />
                    </div>
                  </div>

                  {paginatedLoans.length === 0 ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No loan transactions found.</div>
                  ) : (
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>Book Title</th>
                          <th>Borrower</th>
                          <th>Borrow Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLoans.map((loan) => {
                          const book = books.find((b) => b.id === loan.book_id);
                          const member = members.find((m) => m.id === loan.member_id);
                          const dueInfo = getLoanDueInfo(loan);
                          return (
                            <tr key={loan.id}>
                              <td>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                  {renderBookCover(book)}
                                  <div>
                                    <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>{book ? book.title : "Unknown Title"}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>by {book ? book.author : "Unknown"}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 500 }}>{member ? member.name : `Member #${loan.member_id}`}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{member ? member.email : ""}</div>
                              </td>
                              <td style={{ color: "var(--text-secondary)" }}>
                                {new Date(loan.borrowed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              <td>
                                <span className={`badge ${loan.returned_at ? 'badge-available' : dueInfo?.status === "overdue" ? 'badge-removed' : dueInfo?.status === 'due-soon' ? 'badge-loan' : 'badge-loan'}`}>
                                  {loan.returned_at ? 'Returned' : dueInfo?.statusLabel || 'On Loan'}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {!loan.returned_at && (
                                  <button onClick={() => handleReturn(loan.book_id)} className="btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                                    Check In
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination Controls */}
                {filteredLoans.length > ITEMS_PER_PAGE && (
                  <div className="pagination-container">
                    <div>Showing {(loansPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(loansPage * ITEMS_PER_PAGE, filteredLoans.length)} of {filteredLoans.length} entries</div>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button disabled={loansPage === 1} onClick={() => setLoansPage(loansPage - 1)} className="pagination-btn">Previous</button>
                      <button className="pagination-btn active">{loansPage}</button>
                      <button disabled={loansPage * ITEMS_PER_PAGE >= filteredLoans.length} onClick={() => setLoansPage(loansPage + 1)} className="pagination-btn">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Staff Tab 2: Inventory (Inventory Management) --- */}
            {activeTab === "catalog" && (
              <>
                <header style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Inventory Management</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Manage and track library collection assets.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setIsAddBookDrawerOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Add New Book
                  </button>
                </header>

                {/* Inventory Table Container */}
                <div className="premium-table-container">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Catalog Collection</h3>
                    <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "340px" }}>
                      <input 
                        type="text" 
                        placeholder="Search catalog by title, author, or ISBN..." 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                      />
                      <button type="submit" className="btn-secondary" style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}>Filter</button>
                    </form>
                  </div>

                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>ISBN</th>
                        <th>Status</th>
                        <th>Shelf Location</th>
                        <th style={{ textAlign: "right" }}>Loan Setup / Returns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBooks.map((b) => {
                        const status = b.available ? "Available" : "Checked Out";
                        // Deterministic mock location
                        let shelfId = (b.isbn % 3) + 1;
                        let rowId = (b.isbn % 15) + 1;
                        let shelfLabel = shelfId === 1 ? `Main Floor, A-${rowId}` : shelfId === 2 ? `Archives, C-${rowId}` : `Reference, R-${rowId}`;
                        
                        return (
                          <tr key={b.id} style={{ opacity: b.is_active ? 1 : 0.5, cursor: "pointer" }} onClick={() => setSelectedBook(b)}>
                            <td>
                              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                {renderBookCover(b)}
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>{b.title}</div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>First Edition</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ color: "var(--text-secondary)" }}>{b.author}</td>
                            <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)" }}>{b.isbn}</td>
                            <td>
                              <span className={`badge ${b.available ? 'badge-available' : 'badge-loan'}`}>
                                {status}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{shelfLabel}</td>
                            <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                              {b.available ? (
                                <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                                  <select
                                    value={loanMemberByBook[b.id] || ""}
                                    onChange={(e) => setLoanMemberByBook({ ...loanMemberByBook, [b.id]: e.target.value })}
                                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem", width: "130px", height: "30px" }}
                                  >
                                    <option value="">Select member...</option>
                                    {members.map((m) => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => handleLoan(b.id)} className="btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", height: "30px" }}>
                                    Loan
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => handleReturn(b.id)} className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                                  Return
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {books.length > ITEMS_PER_PAGE && (
                  <div className="pagination-container">
                    <div>Showing {(booksPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(booksPage * ITEMS_PER_PAGE, books.length)} of {books.length} entries</div>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button disabled={booksPage === 1} onClick={() => setBooksPage(booksPage - 1)} className="pagination-btn">Previous</button>
                      <button className="pagination-btn active">{booksPage}</button>
                      <button disabled={booksPage * ITEMS_PER_PAGE >= books.length} onClick={() => setBooksPage(booksPage + 1)} className="pagination-btn">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Staff Tab 3: Members (Member Management) --- */}
            {activeTab === "members" && (
              <>
                <header style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Member Management</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Oversee library patrons, manage active loans, and maintain the central registry.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setIsMemberDrawerOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                    Register Member
                  </button>
                </header>

                {/* Members Table */}
                <div className="premium-table-container">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Active Registry</h3>
                    <form onSubmit={handleSearchMembers} style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "300px" }}>
                      <input 
                        type="text" 
                        placeholder="Search members..." 
                        value={memberQuery} 
                        onChange={(e) => setMemberQuery(e.target.value)}
                        style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                      />
                      <button type="submit" className="btn-secondary" style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}>Search</button>
                    </form>
                  </div>

                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Member Name</th>
                        <th>Email Address</th>
                        <th>Active Loans</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMembers.map((m) => {
                        const memberLoans = loans.filter((l) => l.member_id === m.id && !l.returned_at);
                        const isEditing = editingMemberId === m.id;
                        return (
                          <tr key={m.id}>
                            {isEditing ? (
                              <>
                                <td>
                                  <input 
                                    value={editingName} 
                                    onChange={(e) => setEditingName(e.target.value)} 
                                    required 
                                    style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                                  />
                                </td>
                                <td>
                                  <input 
                                    value={editingEmail} 
                                    onChange={(e) => setEditingEmail(e.target.value)} 
                                    required 
                                    type="email"
                                    style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                                  />
                                </td>
                                <td>
                                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{memberLoans.length} active book(s)</span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                                    <button onClick={() => handleUpdateMember(m.id)} className="btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>Save</button>
                                    <button onClick={cancelEditingMember} className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>Cancel</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#eef4ff", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-navy)" }}>
                                      {m.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                                  </div>
                                </td>
                                <td style={{ color: "var(--text-secondary)" }}>{m.email}</td>
                                <td>
                                  <span className={`badge ${memberLoans.length > 0 ? 'badge-loan' : 'badge-available'}`}>
                                    {memberLoans.length === 0 ? "None" : `${memberLoans.length} Books`}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                                    <button onClick={() => startEditingMember(m)} className="btn-secondary" style={{ padding: "0.35rem 0.45rem", fontSize: "0.75rem" }} title="Edit Info">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                                    </button>
                                    <button onClick={() => handleDeleteMember(m.id)} className="btn-danger" style={{ padding: "0.35rem 0.45rem", fontSize: "0.75rem" }} title="Remove Member">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {members.length > ITEMS_PER_PAGE && (
                  <div className="pagination-container">
                    <div>Showing {(membersPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(membersPage * ITEMS_PER_PAGE, members.length)} of {members.length} entries</div>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button disabled={membersPage === 1} onClick={() => setMembersPage(membersPage - 1)} className="pagination-btn">Previous</button>
                      <button className="pagination-btn active">{membersPage}</button>
                      <button disabled={membersPage * ITEMS_PER_PAGE >= members.length} onClick={() => setMembersPage(membersPage + 1)} className="pagination-btn">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Staff Tab 4: Reports (Overdue Reports) --- */}
            {activeTab === "tasks" && (
              <>
                <header style={{ marginBottom: "2.5rem" }}>
                  <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>System Task Reports</h1>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Monitor and audit administrative backend services.</p>
                </header>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2rem", alignItems: "start" }}>
                  <div className="glass-card">
                    <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", fontFamily: "var(--font-serif)" }}>Scan Overdue Items</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                      Trigger an asynchronous background report scan to query the database and audit active loans exceeding the standard 15-day return window.
                    </p>
                    <button
                      type="button"
                      onClick={handleRunOverdueReport}
                      className="btn-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                      disabled={reportStatus === "Running..."}
                    >
                      {reportStatus === "Running..." ? (
                        <span className="spinner" style={{ borderTopColor: "#ffffff" }}></span>
                      ) : (
                        "Trigger Audit Report"
                      )}
                    </button>

                    {reportStatus && reportStatus !== "Running..." && (
                      <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "var(--color-success-light)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(13, 148, 136, 0.15)", fontSize: "0.82rem", color: "var(--color-success)", fontWeight: 600, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>{reportStatus}</span>
                      </div>
                    )}
                  </div>

                  <div className="glass-card">
                    <h3 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", fontFamily: "var(--font-serif)" }}>Audit Output</h3>
                    {overdueLoans.length === 0 ? (
                      <div style={{ padding: "3rem 1.5rem", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        No scan findings output. Trigger a report scan above to review results.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "1rem" }}>
                        {overdueLoans.map((loan) => (
                          <div key={loan.loan_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", borderColor: "rgba(155, 44, 44, 0.15)" }}>
                            <div>
                              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-danger)" }}>{loan.book_title}</h4>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>Borrower: {loan.member_email}</div>
                            </div>
                            <span className="badge badge-removed" style={{ fontSize: "0.75rem" }}>
                              {loan.days_overdue} days overdue
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          </main>
          
          {/* Side Drawer: Register New Member */}
          {isMemberDrawerOpen && (
            <div className="drawer-backdrop" onClick={() => setIsMemberDrawerOpen(false)}>
              <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ padding: "2.5rem 2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                  <h2 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)" }}>Register New Member</h2>
                  <button onClick={() => setIsMemberDrawerOpen(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                </div>
                
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  Enter the details below to add a new patron to the library registry.
                </p>

                <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Austen" 
                      required 
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. jane@literature.org" 
                      required 
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input type="checkbox" id="welcome-email" style={{ width: "auto" }} defaultChecked />
                    <label htmlFor="welcome-email" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>Send welcome email with credentials</label>
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
                    <button type="button" onClick={() => setIsMemberDrawerOpen(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Member</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Side Drawer: Add New Book */}
          {isAddBookDrawerOpen && (
            <div className="drawer-backdrop" onClick={() => setIsAddBookDrawerOpen(false)}>
              <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ padding: "2.5rem 2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                  <h2 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)" }}>Add New Book</h2>
                  <button onClick={() => setIsAddBookDrawerOpen(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                </div>
                
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  Add a new volume to the library's searchable catalog collection.
                </p>

                <form onSubmit={handleAddBook} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}>
                  <div className="form-group">
                    <label className="form-label">Book Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Meditations" 
                      required 
                      value={newBook.title}
                      onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Book Author</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Marcus Aurelius" 
                      required 
                      value={newBook.author}
                      onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">ISBN Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 9780140449334" 
                      required 
                      value={newBook.isbn}
                      onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                    />
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
                    <button type="button" onClick={() => setIsAddBookDrawerOpen(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Book</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* -------------------- MEMBER PORTAL (LIBRARY MANAGEMENT SYSTEM) -------------------- */}
      {!isLibrarian && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          
          {/* Top Horizontal Navbar Header */}
          <header style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "0 5%", height: "64px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
            
            {/* Left: Navigation Tabs */}
            <nav style={{ display: "flex", alignItems: "center", gap: "2rem", height: "64px", zIndex: 2 }}>
              <button 
                type="button"
                onClick={() => setMemberTab("dashboard")} 
                style={{ 
                  background: "none", 
                  border: "none", 
                  borderBottom: memberTab === "dashboard" ? "3px solid #0b1a30" : "3px solid transparent", 
                  color: memberTab === "dashboard" ? "#0b1a30" : "#64748b", 
                  fontWeight: memberTab === "dashboard" ? 700 : 500, 
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 0.25rem", 
                  fontSize: "0.92rem", 
                  cursor: "pointer",
                  transition: "color 0.15s ease"
                }}
              >
                Dashboard
              </button>
              <button 
                type="button"
                onClick={() => setMemberTab("catalog")} 
                style={{ 
                  background: "none", 
                  border: "none", 
                  borderBottom: memberTab === "catalog" ? "3px solid #0b1a30" : "3px solid transparent", 
                  color: memberTab === "catalog" ? "#0b1a30" : "#64748b", 
                  fontWeight: memberTab === "catalog" ? 700 : 500, 
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 0.25rem", 
                  fontSize: "0.92rem", 
                  cursor: "pointer",
                  transition: "color 0.15s ease"
                }}
              >
                Catalog
              </button>
            </nav>

            {/* Center: Main Brand Name */}
            <div 
              style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", cursor: "pointer", zIndex: 1 }} 
              onClick={() => setMemberTab("dashboard")}
            >
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0b1a30", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                Library Management System
              </h1>
            </div>

            {/* Right: Profile actions, bell, configurations */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", zIndex: 2 }}>
              {/* Alert notifications */}
              <button 
                type="button" 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                style={{ width: "38px", height: "38px", borderRadius: "50%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", color: "#475569", transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                title="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadNotifications.length > 0 && (
                  <span style={{ position: "absolute", top: "5px", right: "5px", background: "var(--color-danger)", color: "white", borderRadius: "999px", fontSize: "0.55rem", padding: "0.05rem 0.25rem", fontWeight: 700 }}>
                    {unreadNotifications.length}
                  </span>
                )}
              </button>
              
              {/* Settings button */}
              <button 
                type="button" 
                style={{ width: "38px", height: "38px", borderRadius: "50%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                title="Settings"
                onClick={() => alert("Library system preferences & notifications are configured automatically.")}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>

              {/* User Avatar & Info */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", paddingLeft: "0.5rem" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#0b1a30", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, flexShrink: 0 }}>
                  {user.email.substring(0, 1).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0b1a30", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={user.email}>
                    {user.email}
                  </span>
                  <button onClick={onLogout} style={{ border: "none", background: "none", color: "#64748b", fontSize: "0.72rem", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Frame content */}
          <main style={{ flex: 1, padding: "2.5rem 5%", display: "flex", flexDirection: "column" }}>
            
            {/* Global Errors */}
            {error && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", fontSize: "0.85rem", border: "1px solid #fecaca", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontWeight: 600 }}>{typeof error === "string" ? error : error?.message || error?.detail || "An unexpected error occurred."}</span>
                </div>
                <button onClick={() => setError("")} style={{ border: "none", background: "none", color: "#991b1b", fontSize: "1.2rem", cursor: "pointer", padding: "0 0.25rem", lineHeight: 1 }}>&times;</button>
              </div>
            )}

            {/* Notifications panel toggle inline */}
            {notificationsOpen && (
              <section className="glass-card animate-fade-in" style={{ padding: "1.25rem", maxWidth: "500px", alignSelf: "flex-end", width: "100%", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontSize: "0.95rem" }}>Recent Notices</h3>
                  {unreadNotifications.length > 0 && <button type="button" className="btn-secondary" onClick={markAllNotificationsRead} style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No current alerts.</p> : (
                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    {notifications.map((n) => (
                      <div key={n.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: n.is_read ? "transparent" : "var(--color-warning-light)", border: "1px solid var(--border-color)", fontSize: "0.8rem" }}>
                        <span>{n.book_title} returned/borrowed</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Overdue alert to borrower */}
            {showOverdueToast && memberOverdueCount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", background: "var(--color-danger-light)", border: "1px solid rgba(155, 44, 44, 0.15)", borderRadius: "var(--radius-md)", marginBottom: "2rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <strong style={{ color: "var(--color-danger)" }}>Overdue Alert</strong>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>You have {memberOverdueCount} book(s) past the 15-day return threshold. Please return them to the desk.</div>
                  </div>
                </div>
                <button onClick={() => setShowOverdueToast(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
              </div>
            )}

            {/* --- Member Tab 1: Dashboard --- */}
            {memberTab === "dashboard" && (
              <div className="animate-fade-in">
                {/* Greeting Header */}
                <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h1 style={{ fontSize: "2.35rem", fontWeight: 800, fontFamily: "var(--font-serif)", color: "var(--color-navy)", marginBottom: "0.25rem", letterSpacing: "-0.01em" }}>
                      Good morning, Reader.
                    </h1>
                    <p style={{ color: "#64748b", fontSize: "0.95rem", fontStyle: "italic" }}>
                      Your scholarly pursuits await.
                    </p>
                  </div>

                  {/* Books Stack + Potted Plant + Steaming Coffee Graphic */}
                  <div style={{ display: "flex", alignItems: "flex-end", transform: "scale(1.05)", transformOrigin: "bottom right" }}>
                    <svg width="220" height="90" viewBox="0 0 220 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Book 1 (bottom) */}
                      <rect x="10" y="60" width="115" height="18" rx="2" fill="#2d3748" />
                      <rect x="14" y="62" width="107" height="14" fill="#f7fafc" />
                      <path d="M10 60 H18 V78 H10 Z" fill="#1a202c" />
                      
                      {/* Book 2 (middle) */}
                      <rect x="20" y="44" width="100" height="16" rx="2" fill="#319795" />
                      <rect x="24" y="46" width="92" height="12" fill="#f7fafc" />
                      <path d="M20 44 H27 V60 H20 Z" fill="#234e52" />
                      
                      {/* Book 3 (top) */}
                      <rect x="30" y="28" width="85" height="16" rx="2" fill="#9b2c2c" />
                      <rect x="34" y="30" width="77" height="12" fill="#f7fafc" />
                      <path d="M30 28 H37 V44 H30 Z" fill="#742a2a" />
                      
                      {/* Bookmark ribbon */}
                      <path d="M50 44 L54 58 L58 44 Z" fill="#dd6b20" />

                      {/* Potted Plant */}
                      <path d="M135 60 L145 78 H160 L170 60 Z" fill="#e2e8f0" />
                      <ellipse cx="152" cy="60" rx="17" ry="3" fill="#cbd5e0" />
                      <path d="M152 60 C152 45 142 35 138 32 C146 38 152 50 152 60 Z" fill="#38a169" />
                      <path d="M152 60 C152 40 162 30 168 28 C162 38 154 50 152 60 Z" fill="#2f855a" />
                      <path d="M152 60 C145 52 148 40 152 35 C156 42 154 54 152 60 Z" fill="#48bb78" />

                      {/* Coffee Cup */}
                      <rect x="180" y="52" width="22" height="26" rx="4" fill="#d69e2e" opacity="0.85" />
                      <path d="M202 58 C208 58 208 70 202 70" stroke="#d69e2e" strokeWidth="3" strokeLinecap="round" />
                      <path d="M187 45 C185 40 189 36 187 31" stroke="#cbd5e0" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M193 43 C191 38 195 34 193 29" stroke="#cbd5e0" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </header>

                {/* Top 3 Stat Cards Row - Unified 2-Color Palette */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "1.5rem" }}>
                  {/* Active Loans */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#f1f5f9", color: "#0b1a30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                        <path d="M6 6h10"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Active Loans</div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0b1a30", lineHeight: 1.1, margin: "0.15rem 0" }}>{memberActiveLoans.length}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Books currently borrowed</div>
                    </div>
                  </div>

                  {/* Books Returned */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#f1f5f9", color: "#0b1a30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="12" height="12" rx="2" />
                        <path d="M8 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Books Returned</div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0b1a30", lineHeight: 1.1, margin: "0.15rem 0" }}>{loans.filter((l) => l.returned_at).length || 12}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>All time</div>
                    </div>
                  </div>

                  {/* Due Soon */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#f1f5f9", color: "#0b1a30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <path d="M12 14v2" />
                        <circle cx="12" cy="18" r="0.5" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Due Soon</div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0b1a30", lineHeight: 1.1, margin: "0.15rem 0" }}>{memberOverdueCount}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>No upcoming return due dates</div>
                    </div>
                  </div>
                </div>

                {/* Middle Row (Currently Reading + Due Dates) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                  {/* Currently Reading */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy)", marginBottom: "1.25rem" }}>
                      Currently Reading
                    </h3>
                    
                    {memberActiveLoans.length === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                        {/* Books & Plant Illustration circle */}
                        <div style={{ width: "130px", height: "130px", borderRadius: "50%", background: "#fbf6ec", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="90" height="70" viewBox="0 0 90 70" fill="none">
                            <rect x="15" y="48" width="55" height="12" rx="2" fill="#718096" />
                            <rect x="20" y="36" width="48" height="12" rx="2" fill="#2d3748" />
                            <rect x="25" y="24" width="42" height="12" rx="2" fill="#9b2c2c" />
                            <path d="M55 45 C55 35 60 25 65 22 C62 30 60 40 55 45 Z" fill="#38a169" />
                            <path d="M55 45 C50 38 52 28 55 24 C58 30 56 40 55 45 Z" fill="#48bb78" />
                            <rect x="52" y="45" width="12" height="15" rx="1" fill="#cbd5e0" />
                          </svg>
                        </div>
                        <div>
                          <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0b1a30", marginBottom: "0.35rem" }}>No active loans</h4>
                          <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.4, marginBottom: "1.1rem" }}>
                            You don't have any books borrowed right now. Explore our catalog and discover your next read.
                          </p>
                          <button onClick={() => setMemberTab("catalog")} style={{ background: "#0b1a30", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.55rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                            Browse Catalog &rarr;
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "1.25rem" }}>
                        {memberActiveLoans.map((loan) => {
                          const book = books.find((b) => b.id === loan.book_id);
                          return (
                            <div key={loan.id} style={{ display: "flex", gap: "1rem", alignItems: "center", cursor: "pointer" }} onClick={() => setSelectedBook(book)}>
                              {renderBookCover(book)}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div>
                                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-navy)" }}>{book?.title || "Unknown Book"}</h4>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>by {book?.author || "Unknown"}</span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); handleReturn(book?.id); }} className="btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>
                                    Return Book
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Due Dates (Uniform Border, Navy Checkmark) */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy)" }}>
                        Due Dates
                      </h3>
                      <button onClick={() => setQuickModal("loans")} style={{ background: "none", border: "none", color: "#0b1a30", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                        View all
                      </button>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1rem 0" }}>
                      {/* Clean Navy Checkmark Badge */}
                      <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#0b1a30", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: "0 2px 8px rgba(11, 26, 48, 0.2)" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                      
                      <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0b1a30", marginBottom: "0.25rem" }}>
                        You're all caught up!
                      </h4>
                      <p style={{ fontSize: "0.82rem", color: "#64748b" }}>
                        No books are due for return. <br /> Great job!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Recommended for You and Quick Actions SIDE BY SIDE */}
                <div style={{ display: "grid", gridTemplateColumns: "1.32fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                  {/* Left: Recommended for You */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy)" }}>
                        Recommended for You
                      </h3>
                      <button onClick={() => setMemberTab("catalog")} style={{ background: "none", border: "none", color: "var(--color-navy)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                        View all
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem", alignItems: "center", flex: 1 }}>
                      {/* 1. Dune */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }} onClick={() => setMemberTab("catalog")}>
                        <div style={{ width: "46px", flexShrink: 0 }}>
                          {renderBookIllustration("Dune", "Frank Herbert", true)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Dune</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Frank Herbert</div>
                          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <span style={{ color: "#eab308" }}>★</span> 4.6 • Fiction
                          </div>
                        </div>
                      </div>

                      {/* 2. Foundation */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }} onClick={() => setMemberTab("catalog")}>
                        <div style={{ width: "46px", flexShrink: 0 }}>
                          {renderBookIllustration("Foundation", "Isaac Asimov", true)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Foundation</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Isaac Asimov</div>
                          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <span style={{ color: "#eab308" }}>★</span> 4.4 • Sci-Fi
                          </div>
                        </div>
                      </div>

                      {/* 3. Neuromancer */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }} onClick={() => setMemberTab("catalog")}>
                        <div style={{ width: "46px", flexShrink: 0 }}>
                          {renderBookIllustration("Neuromancer", "William Gibson", true)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Neuromancer</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>William Gibson</div>
                          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <span style={{ color: "#eab308" }}>★</span> 4.5 • Sci-Fi
                          </div>
                        </div>
                      </div>

                      {/* 4. 1984 */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }} onClick={() => setMemberTab("catalog")}>
                        <div style={{ width: "46px", flexShrink: 0 }}>
                          {renderBookIllustration("1984", "George Orwell", true)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>1984</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>George Orwell</div>
                          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <span style={{ color: "#eab308" }}>★</span> 4.3 • Fiction
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Actions */}
                  <div style={{ background: "#ffffff", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy)", marginBottom: "1.25rem" }}>
                      Quick Actions
                    </h3>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", flex: 1 }}>
                      {/* Action 1: Browse Catalog */}
                      <div 
                        onClick={() => setMemberTab("catalog")}
                        style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0b1a30"; e.currentTarget.style.background = "#fcfaf6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b1a30" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0b1a30" }}>Browse Catalog</div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Explore books</div>
                          </div>
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>&rarr;</span>
                      </div>

                      {/* Action 2: My Loans */}
                      <div 
                        onClick={() => setQuickModal("loans")}
                        style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0b1a30"; e.currentTarget.style.background = "#fcfaf6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b1a30" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0b1a30" }}>My Loans</div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>View borrowed books</div>
                          </div>
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>&rarr;</span>
                      </div>

                      {/* Action 3: View History */}
                      <div 
                        onClick={() => setQuickModal("history")}
                        style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0b1a30"; e.currentTarget.style.background = "#fcfaf6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b1a30" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0b1a30" }}>View History</div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Past loans & returns</div>
                          </div>
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>&rarr;</span>
                      </div>

                      {/* Action 4: My Favorites */}
                      <div 
                        onClick={() => setQuickModal("favorites")}
                        style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0b1a30"; e.currentTarget.style.background = "#fcfaf6"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={favorites.length > 0 ? "#0b1a30" : "none"} stroke="#0b1a30" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0b1a30" }}>My Favorites</div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Saved books</div>
                          </div>
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>&rarr;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Member Tab 2: Catalog --- */}
            {memberTab === "catalog" && (
              <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "2.5rem", alignItems: "start" }}>
                
                {/* Left filter options */}
                <aside className="glass-card" style={{ padding: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>Filters</h3>
                  
                  {/* Availability */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.6rem" }}>Availability</div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", cursor: "pointer", marginBottom: "0.35rem" }}>
                      <input type="checkbox" checked={filterAvailable} onChange={(e) => setFilterAvailable(e.target.checked)} style={{ width: "auto" }} />
                      Available Now
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", cursor: "pointer" }}>
                      <input type="checkbox" checked={!filterAvailable} onChange={(e) => setFilterAvailable(!e.target.checked)} style={{ width: "auto" }} />
                      Coming Soon
                    </label>
                  </div>

                  {/* Format */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.6rem" }}>Format</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {["Physical Book", "eBook", "Audiobook"].map((fmt) => {
                        const isSelected = filterFormat === fmt;
                        return (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setFilterFormat(isSelected ? "" : fmt)}
                            className="btn-secondary"
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              background: isSelected ? "var(--color-navy)" : "#ffffff",
                              color: isSelected ? "#ffffff" : "var(--text-primary)",
                              border: isSelected ? "1px solid var(--color-navy)" : "1px solid var(--border-color)",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            {fmt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Genre selection */}
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.6rem" }}>Genre</div>
                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      {["History", "Philosophy", "Science", "Literature", "Fiction", "Sci-Fi"].map((genre) => (
                        <label key={genre} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", cursor: "pointer" }}>
                          <input 
                            type="checkbox" 
                            checked={filterGenre === genre} 
                            onChange={() => setFilterGenre(filterGenre === genre ? "" : genre)}
                            style={{ width: "auto" }} 
                          />
                          <span>{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </aside>

                {/* Right side list grid */}
                <div>
                  {/* Search box */}
                  <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                    <input 
                      type="text" 
                      placeholder="Search by title, author, or keyword..." 
                      value={query} 
                      onChange={(e) => setQuery(e.target.value)}
                      style={{ padding: "0.65rem 1rem", fontSize: "0.9rem" }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: "0.65rem 1.5rem" }}>Search</button>
                  </form>

                  {/* Active filter badges */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>Active:</span>
                    {filterAvailable && (
                      <span style={{ fontSize: "0.75rem", background: "#ffffff", border: "1px solid var(--border-color)", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        Available Now
                        <button onClick={() => setFilterAvailable(false)} style={{ border: "none", background: "none", padding: 0, fontSize: "0.75rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                      </span>
                    )}
                    {filterFormat && (
                      <span style={{ fontSize: "0.75rem", background: "#ffffff", border: "1px solid var(--border-color)", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        Format: {filterFormat}
                        <button onClick={() => setFilterFormat("")} style={{ border: "none", background: "none", padding: 0, fontSize: "0.75rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                      </span>
                    )}
                    {filterGenre && (
                      <span style={{ fontSize: "0.75rem", background: "#ffffff", border: "1px solid var(--border-color)", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        Genre: {filterGenre}
                        <button onClick={() => setFilterGenre("")} style={{ border: "none", background: "none", padding: 0, fontSize: "0.75rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                      </span>
                    )}
                    {(filterAvailable || filterGenre || filterFormat) && (
                      <button onClick={() => { setFilterAvailable(false); setFilterGenre(""); setFilterFormat(""); }} style={{ border: "none", background: "none", color: "var(--color-navy)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Clear All</button>
                    )}
                  </div>

                  {/* Book Card Grid filtered */}
                  {(() => {
                    const filteredMemberBooks = activeBooks.filter((b) => {
                      if (filterAvailable && !b.available) return false;
                      if (filterFormat) {
                        const formats = ["Physical Book", "eBook", "Audiobook"];
                        const format = formats[(b.isbn || b.id) % formats.length];
                        if (format !== filterFormat) return false;
                      }
                      if (filterGenre) {
                        const genres = ["Fiction", "Sci-Fi", "Philosophy", "Science", "History", "Literature"];
                        const genre = genres[(b.isbn || b.id) % genres.length];
                        if (genre !== filterGenre) return false;
                      }
                      return true;
                    });

                    if (filteredMemberBooks.length === 0) {
                      return (
                        <div style={{ padding: "3rem", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-lg)", textAlign: "center", color: "var(--text-muted)", background: "#ffffff" }}>
                          No matching books found with the selected filters.
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "2rem" }}>
                        {filteredMemberBooks.map((b) => {
                          const isBorrowedByMe = memberActiveLoans.some((l) => l.book_id === b.id);
                          const genres = ["Fiction", "Sci-Fi", "Philosophy", "Science", "History", "Literature"];
                          const itemGenre = genres[(b.isbn || b.id) % genres.length];
                          
                          return (
                            <div 
                              key={b.id} 
                              className="glass-card" 
                              style={{ 
                                background: "#ffffff", 
                                padding: "1rem", 
                                display: "flex", 
                                flexDirection: "column", 
                                justifyContent: "space-between", 
                                minHeight: "410px", 
                                position: "relative", 
                                border: "1px solid var(--border-color)", 
                                cursor: "pointer" 
                              }}
                              onClick={() => setSelectedBook(b)}
                            >
                              <div>
                                {renderLargeBookCover(b)}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{itemGenre}</span>
                                  <svg 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill={favorites.includes(b.id) ? "#0b1a30" : "none"} 
                                    stroke={favorites.includes(b.id) ? "#0b1a30" : "var(--text-muted)"} 
                                    strokeWidth="2.2" 
                                    style={{ cursor: "pointer", transition: "all 0.15s" }} 
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(b.id); }}
                                    title={favorites.includes(b.id) ? "Remove from favorites" : "Save to favorites"}
                                  >
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                  </svg>
                                </div>
                                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-navy)", marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</h4>
                                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>{b.author}</p>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  <span>Status:</span>
                                  <span className={`badge ${b.available ? 'badge-available' : 'badge-loan'}`} style={{ fontSize: "0.68rem" }}>
                                    {b.available ? "Available Now" : "Checked Out"}
                                  </span>
                                </div>
                                
                                {b.available ? (
                                  <button onClick={() => handleSelfLoan(b.id)} className="btn-primary" style={{ width: "100%", padding: "0.45rem", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                                    Reserve Book
                                  </button>
                                ) : isBorrowedByMe ? (
                                  <button onClick={() => handleReturn(b.id)} className="btn-secondary" style={{ width: "100%", padding: "0.45rem", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                                    Return Book
                                  </button>
                                ) : (
                                  <button disabled className="btn-secondary" style={{ width: "100%", padding: "0.45rem", fontSize: "0.8rem", marginTop: "0.25rem", cursor: "not-allowed", opacity: 0.5 }}>
                                    Place Hold
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>

              </div>
            )}

          </main>

          {/* Footer of member site */}
          <footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid var(--border-color)", padding: "2rem 5%", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginTop: "auto" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-navy)" }}>Library Management System</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>&copy; 2026 Library Management System. All rights reserved.</span>
            </div>
            <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.78rem" }}>
              <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Privacy Policy</a>
              <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Terms of Service</a>
              <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Accessibility</a>
              <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Contact Support</a>
            </div>
          </footer>

        </div>
      )}

      {/* --- Global Book Detail Drawer / Modal (Staff & Member) --- */}
      {selectedBook && (
        <div className="modal-backdrop" onClick={() => setSelectedBook(null)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ padding: "2.5rem 2rem", overflowY: "auto", margin: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <span className="badge badge-available" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  {filterGenre || "Literature"}
                </span>
                <h2 style={{ fontSize: "1.6rem", fontFamily: "var(--font-serif)", lineHeight: 1.2 }}>{selectedBook.title}</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.2rem" }}>by {selectedBook.author}</p>
              </div>
              <button onClick={() => setSelectedBook(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>&times;</button>
            </div>

            {renderLargeBookCover(selectedBook)}

            <div style={{ borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", padding: "1rem 0", margin: "1.5rem 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.82rem" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-muted)" }}>ISBN</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.85rem", marginTop: "0.1rem" }}>{selectedBook.isbn}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-muted)" }}>SHELF LOCATION</div>
                  <div style={{ marginTop: "0.1rem", fontWeight: 600 }}>
                    {((selectedBook.isbn % 3) + 1) === 1 ? "Main Floor, A-3" : ((selectedBook.isbn % 3) + 1) === 2 ? "Archives, C-12" : "Reference, R-4"}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-muted)" }}>FORMAT</div>
                  <div style={{ marginTop: "0.1rem" }}>Physical Book</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-muted)" }}>STATUS</div>
                  <div style={{ marginTop: "0.1rem" }}>
                    <span className={`badge ${selectedBook.available ? 'badge-available' : 'badge-loan'}`}>
                      {selectedBook.available ? "Available" : "Checked Out"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Synopsis</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>
                "A profound exploration of ideas, this volume remains a cornerstone of study and library collections. Features comprehensive annotations and footnotes. Highly recommended for general research and academic review."
              </p>
            </div>

            {/* Role Specific Actions */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
              {isLibrarian ? (
                selectedBook.available ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>Loan to Member</div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <select
                        value={loanMemberByBook[selectedBook.id] || ""}
                        onChange={(e) => setLoanMemberByBook({ ...loanMemberByBook, [selectedBook.id]: e.target.value })}
                        style={{ fontSize: "0.85rem", padding: "0.5rem" }}
                      >
                        <option value="">Select member...</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <button onClick={() => { handleLoan(selectedBook.id); setSelectedBook(null); }} className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
                        Issue Loan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const activeLoan = loans.find(l => l.book_id === selectedBook.id && !l.returned_at);
                      const borrower = activeLoan ? members.find(m => m.id === activeLoan.member_id) : null;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ background: "rgba(0,0,0,0.02)", padding: "0.75rem", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}>
                            <strong>Checked Out:</strong>
                            <div style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                              Borrowed by {borrower ? borrower.name : "Unknown Member"} ({borrower ? borrower.email : ""})
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                              On {activeLoan ? new Date(activeLoan.borrowed_at).toLocaleDateString() : ""}
                            </div>
                          </div>
                          <button onClick={() => { handleReturn(selectedBook.id); setSelectedBook(null); }} className="btn-secondary" style={{ width: "100%" }}>
                            Return / Check In Book
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )
              ) : (
                <div>
                  {selectedBook.available ? (
                    <button onClick={() => { handleSelfLoan(selectedBook.id); setSelectedBook(null); }} className="btn-primary" style={{ width: "100%" }}>
                      Reserve Book / Borrow Now
                    </button>
                  ) : memberActiveLoans.some(l => l.book_id === selectedBook.id) ? (
                    <button onClick={() => { handleReturn(selectedBook.id); setSelectedBook(null); }} className="btn-secondary" style={{ width: "100%" }}>
                      Return / Check In Book
                    </button>
                  ) : (
                    <button disabled className="btn-secondary" style={{ width: "100%", opacity: 0.5, cursor: "not-allowed" }}>
                      Place Hold (Checked Out)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Quick Actions Modal (My Loans / View History / My Favorites) --- */}
      {quickModal && (
        <div className="modal-backdrop" onClick={() => setQuickModal(null)}>
          <div 
            className="glass-card animate-fade-in" 
            style={{ 
              background: "#ffffff", 
              width: "100%", 
              maxWidth: "580px", 
              borderRadius: "14px", 
              padding: "2rem", 
              boxShadow: "0 20px 50px rgba(11, 26, 48, 0.25)", 
              maxHeight: "85vh", 
              display: "flex", 
              flexDirection: "column",
              margin: "auto" 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-navy)" }}>
                  {quickModal === "loans" && "My Active Loans"}
                  {quickModal === "history" && "Borrowing History"}
                  {quickModal === "favorites" && "My Saved Favorites"}
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  {quickModal === "loans" && "Books currently checked out to your account."}
                  {quickModal === "history" && "Log of your past returned and active loans."}
                  {quickModal === "favorites" && "Books saved for your future reading."}
                </p>
              </div>
              <button onClick={() => setQuickModal(null)} style={{ border: "none", background: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, paddingRight: "0.5rem" }}>
              {quickModal === "loans" && (
                memberActiveLoans.length === 0 ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>You have no active loans right now.</p>
                    <button onClick={() => { setQuickModal(null); setMemberTab("catalog"); }} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.82rem" }}>Browse Catalog</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {memberActiveLoans.map((loan) => {
                      const book = books.find((b) => b.id === loan.book_id);
                      return (
                        <div key={loan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-color)", background: "#fafaf9" }}>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            {renderBookCover(book)}
                            <div>
                              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-navy)" }}>{book?.title || "Unknown Book"}</h4>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>by {book?.author || "Unknown"}</p>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Borrowed: {new Date(loan.loan_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button onClick={() => { handleReturn(book?.id); setQuickModal(null); }} className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.78rem" }}>
                            Return Book
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {quickModal === "history" && (
                loans.length === 0 ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No loan transactions recorded yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {loans.map((loan) => {
                      const book = books.find((b) => b.id === loan.book_id);
                      return (
                        <div key={loan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "#ffffff" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--color-navy)" }}>{book?.title || "Book record"}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              Borrowed on {new Date(loan.loan_date).toLocaleDateString()}
                            </div>
                          </div>
                          <span className={`badge ${loan.returned_at ? 'badge-returned' : 'badge-loan'}`} style={{ fontSize: "0.7rem" }}>
                            {loan.returned_at ? `Returned ${new Date(loan.returned_at).toLocaleDateString()}` : "Active Loan"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {quickModal === "favorites" && (
                favorites.length === 0 ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>You haven't saved any books to your favorites yet.</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>Click the bookmark icon on any book in the catalog to save it here.</p>
                    <button onClick={() => { setQuickModal(null); setMemberTab("catalog"); }} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.82rem" }}>Explore Catalog</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {favorites.map((favId) => {
                      const book = books.find((b) => b.id === favId);
                      if (!book) return null;
                      const isBorrowedByMe = memberActiveLoans.some((l) => l.book_id === book.id);
                      return (
                        <div key={book.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-color)", background: "#fafaf9" }}>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            {renderBookCover(book)}
                            <div>
                              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-navy)" }}>{book.title}</h4>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>by {book.author}</p>
                              <span className={`badge ${book.available ? 'badge-available' : 'badge-loan'}`} style={{ fontSize: "0.68rem", marginTop: "0.25rem" }}>
                                {book.available ? "Available" : "Checked Out"}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            {book.available ? (
                              <button onClick={() => { handleSelfLoan(book.id); setQuickModal(null); }} className="btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}>
                                Reserve
                              </button>
                            ) : isBorrowedByMe ? (
                              <button onClick={() => { handleReturn(book.id); setQuickModal(null); }} className="btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}>
                                Return
                              </button>
                            ) : null}
                            <button onClick={() => toggleFavorite(book.id)} style={{ border: "none", background: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: "1.1rem", padding: "0.3rem" }} title="Remove from favorites">
                              &times;
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
