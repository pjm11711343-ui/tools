/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Plus, 
  ArrowLeftRight, 
  History, 
  Box, 
  MapPin, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Search,
  Hammer,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  Settings2,
  Shield,
  Image as ImageIcon,
  Camera,
  X,
  Edit2,
  RotateCw,
  Printer,
  FileDown,
  Save,
  Check,
  Upload,
  Download,
  Lock,
  Menu,
  AlertTriangle,
  User,
  Calendar,
  Trash2,
  MessageSquare,
  Share2,
  Copy,
  QrCode,
  ExternalLink
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Site, Tool, TransferHistory, ToolStatus, Notice, ApprovalRequest } from './types';
import { SITES as INITIAL_SITES, APP_VERSION, CATEGORIES, INITIAL_TOOLS } from './constants';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default function App() {
  // Persistence logic using localStorage with error handling
  const safeJsonParse = (val: string | null, fallback: any) => {
    if (val === null || val === undefined) return fallback;
    try {
      const parsed = JSON.parse(val);
      // Extra safety: ensure it's an array if expected to be
      return parsed;
    } catch (e) {
      console.error('Failed to parse storage data:', e);
      return fallback;
    }
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isVerified, setIsVerified] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('is_verified') === 'true';
  });

  const [tools, setTools] = useState<Tool[]>([]);
  const [history, setHistory] = useState<TransferHistory[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlSiteId = urlParams.get('siteId');
    if (urlSiteId) return urlSiteId;

    // Check role to determine default if no saved site
    const urlRole = urlParams.get('role');
    const role = (urlRole === 'admin' || urlRole === 'manager') 
      ? urlRole 
      : (localStorage.getItem('user_role') as any) || 'admin';

    if (role === 'admin') {
      return 'all'; // Admin defaults to "All Sites"
    }

    const savedSiteId = localStorage.getItem('last_site_id');
    return savedSiteId || INITIAL_SITES[0].id;
  });

  const [view, setView] = useState<'inventory' | 'history' | 'notices'>(() => {
    if (typeof window === 'undefined') return 'inventory';
    const urlParams = new URLSearchParams(window.location.search);
    const urlView = urlParams.get('view');
    if (urlView === 'inventory' || urlView === 'history' || urlView === 'notices') return urlView;
    return 'inventory';
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('search') || '';
  });
  
  // Handle auto-print from URL param
  useEffect(() => {
    if (isLoaded) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('print') === 'true') {
        // Remove the param so it doesn't keep printing on refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        setTimeout(() => {
          window.print();
        }, 1000);
      }
    }
  }, [isLoaded]);
  const [userRole, setUserRole] = useState<'admin' | 'manager'>(() => {
    if (typeof window === 'undefined') return 'admin';
    const urlParams = new URLSearchParams(window.location.search);
    const urlRole = urlParams.get('role');
    if (urlRole === 'admin' || urlRole === 'manager') return urlRole;
    return (localStorage.getItem('user_role') as any) || 'admin';
  });

  const [userSiteId, setUserSiteId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserSiteId = urlParams.get('userSiteId');
    if (urlUserSiteId) return urlUserSiteId;
    return localStorage.getItem('user_site_id');
  });
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isAdminPassModalOpen, setIsAdminPassModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppNameModalOpen, setIsAppNameModalOpen] = useState(false);

  const [adminPass, setAdminPass] = useState('0000');
  const [appName, setAppName] = useState('(주)명신기공');
  const [appSubName, setAppSubName] = useState('현장 공구 관리 시스템');

  // Firebase Real-time Sync & Migration Logic
  useEffect(() => {
    const sitesRef = collection(db, 'sites');
    const toolsRef = collection(db, 'tools');
    const historyRef = collection(db, 'history');
    const requestsRef = collection(db, 'requests');
    const noticesRef = collection(db, 'notices');
    const settingsRef = doc(db, 'settings', 'admin');

    // 1. Initial Migration Check
    const runMigration = async () => {
      const sitesSnap = await getDocs(sitesRef);
      if (sitesSnap.empty) {
        console.log("Database is empty, running migration from local storage...");
        const batch = writeBatch(db);
        
        // Migrate Sites
        const localSites = safeJsonParse(localStorage.getItem('sites_v1'), INITIAL_SITES);
        localSites.forEach((s: Site) => batch.set(doc(sitesRef, s.id), s));
        
        // Migrate Tools
        const localTools = safeJsonParse(localStorage.getItem('tools_v1'), INITIAL_TOOLS);
        localTools.forEach((t: Tool) => batch.set(doc(toolsRef, t.id), t));
        
        // Migrate History
        const localHistory = safeJsonParse(localStorage.getItem('history_v1'), []);
        localHistory.forEach((h: TransferHistory) => batch.set(doc(historyRef, h.id), h));

        // Migrate Admin Pass
        const localAdminPass = localStorage.getItem('admin_master_pass') || '0000';
        batch.set(settingsRef, { masterPassword: localAdminPass });
        
        await batch.commit();
        console.log("Migration complete.");
      }
    };

    runMigration();

    // 2. Real-time Subscribers
    const unsubSites = onSnapshot(sitesRef, { includeMetadataChanges: true }, (snap) => {
      const data = snap.docs.map(d => d.data() as Site);
      const sorted = [...data].sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });
      setSites(sorted.length > 0 ? sorted : INITIAL_SITES);
      if (!snap.metadata.hasPendingWrites) setIsSyncing(false);
    });

    const unsubTools = onSnapshot(toolsRef, { includeMetadataChanges: true }, (snap) => {
      setTools(snap.docs.map(d => d.data() as Tool));
      if (!snap.metadata.hasPendingWrites) setIsSyncing(false);
    });

    const unsubHistory = onSnapshot(query(historyRef, orderBy('date', 'desc')), { includeMetadataChanges: true }, (snap) => {
      setHistory(snap.docs.map(d => d.data() as TransferHistory));
      if (!snap.metadata.hasPendingWrites) setIsSyncing(false);
    });

    const unsubRequests = onSnapshot(query(requestsRef, orderBy('requestedAt', 'desc')), (snap) => {
      setRequests(snap.docs.map(d => d.data() as ApprovalRequest));
    });

    const unsubNotices = onSnapshot(query(noticesRef, orderBy('createdAt', 'desc')), (snap) => {
      setNotices(snap.docs.map(d => d.data() as Notice));
    });

    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdminPass(data.masterPassword || '0000');
        setAppName(data.appName || '(주)명신기공');
        setAppSubName(data.appSubName || '현장 공구 관리 시스템');
      }
    });

    setIsSyncing(false);
    setIsLoaded(true);

    if (!isVerified) {
      setIsRoleModalOpen(true);
    }

    return () => {
      unsubSites();
      unsubTools();
      unsubHistory();
      unsubRequests();
      unsubNotices();
      unsubSettings();
    };
  }, []);

  const syncToFirebase = async (dataTools?: Tool[], dataHistory?: TransferHistory[], dataSites?: Site[], dataAdminPass?: string) => {
    setIsSaving(true);
    try {
      if (dataTools) {
        // Caution: This is a simplified overwrite for migration/reset scenarios
        // In this app, we usually use targeted updates (doc calls)
      }
      if (dataAdminPass) {
        await updateDoc(doc(db, 'settings', 'admin'), { masterPassword: dataAdminPass });
      }
      setIsSaving(false);
      return true;
    } catch (e) {
      console.error('Firebase sync failed:', e);
      setIsSaving(false);
      return false;
    }
  };

  // Mark as loaded effectively managed by Firebase useEffect
  // useEffect associated with local storage are mostly removed or simplified to backup roles

  // Modal states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false);
  const [isEditSiteModalOpen, setIsEditSiteModalOpen] = useState(false);
  const [isEditToolModalOpen, setIsEditToolModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isDeleteRequestModalOpen, setIsDeleteRequestModalOpen] = useState(false);
  const [isAddNoticeModalOpen, setIsAddNoticeModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered tools for the current site
  const siteTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch = (tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || tool.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      if (selectedSiteId === 'all') return matchesSearch;
      return tool.currentSiteId === selectedSiteId && matchesSearch;
    });
  }, [tools, selectedSiteId, searchQuery]);

  const selectedSite = useMemo(() => {
    const found = sites.find(s => s.id === selectedSiteId);
    if (found) return found;
    if (selectedSiteId === 'all') return { id: 'all', name: '전체 현장 통합' };
    return sites[0] || INITIAL_SITES[0] || { id: 'unknown', name: '현장 정보 없음' };
  }, [selectedSiteId, sites]);

  const handleAddTool = async (name: string, serialNumber: string, category: string, unit: string, quantity: number, siteId: string, imageUrl?: string, notes?: string) => {
    setIsSyncing(true);
    const id = `tool-${Date.now()}`;
    const newTool: Tool = {
      id,
      name,
      serialNumber,
      category,
      currentSiteId: siteId,
      status: 'available',
      lastUpdated: new Date().toISOString(),
      imageUrl: imageUrl || '',
      unit,
      quantity,
      notes: notes || ''
    };
    
    try {
      await setDoc(doc(db, 'tools', id), newTool);
      setIsAddModalOpen(false);
      setPreviewImage(null);
    } catch (e) {
      console.error('Add tool failed:', e);
      alert('공구 등록에 실패했습니다.');
      setIsSyncing(false);
    }
  };

  const handleUpdateTool = async (id: string, name: string, serialNumber: string, category: string, unit: string, quantity: number, status: ToolStatus, imageUrl?: string, notes?: string) => {
    setIsSyncing(true);
    try {
      const toolRef = doc(db, 'tools', id);
      const existingTool = tools.find(t => t.id === id);
      const date = new Date().toISOString();
      
      const updateData: any = {
        name, 
        serialNumber, 
        category, 
        unit,
        quantity,
        status,
        lastUpdated: date,
        notes: notes || ''
      };
      if (imageUrl) updateData.imageUrl = imageUrl;
      
      const batch = writeBatch(db);
      batch.update(toolRef, updateData);

      // Record special event if status changed to lost or disposed
      if (existingTool && (status === 'lost' || status === 'disposed') && existingTool.status !== status) {
        const historyId = `hist-status-${Date.now()}`;
        const newHistory: TransferHistory = {
          id: historyId,
          toolId: id,
          toolName: name,
          fromSiteId: existingTool.currentSiteId,
          toSiteId: existingTool.currentSiteId, // same site
          date: date,
          type: 'out',
          notes: status === 'lost' ? '분실 처리됨' : '폐기 처리됨',
          recordedBy: userRole === 'admin' ? '총괄 관리자' : '현장 담당자',
          quantity: existingTool.quantity
        };
        batch.set(doc(db, 'history', historyId), newHistory);
      }
      
      await batch.commit();
      setIsEditToolModalOpen(false);
      setActiveTool(null);
      setPreviewImage(null);
    } catch (e) {
      alert('공구 정보 수정에 실패했습니다.');
    }
  };

  const handleTransfer = async (toolId: string, toSiteId: string, notes: string, quantityToMove: number) => {
    setIsSyncing(true);
    const tool = tools.find(t => t.id === toolId);
    if (!tool || quantityToMove <= 0) {
      setIsSyncing(false);
      return;
    }

    if (quantityToMove > tool.quantity) {
      alert('이동할 수량이 현재 보유 수량보다 많습니다.');
      setIsSyncing(false);
      return;
    }

    const fromSiteId = tool.currentSiteId;
    const date = new Date().toISOString();

    if (userRole === 'manager') {
      try {
        const requestId = `req-transfer-${Date.now()}`;
        const newRequest: ApprovalRequest = {
          id: requestId,
          type: 'transfer',
          status: 'pending',
          toolId: tool.id,
          toolName: tool.name,
          requestedSiteId: fromSiteId,
          targetSiteId: toSiteId,
          quantity: quantityToMove,
          reason: notes,
          requestedBy: selectedSite.name,
          requestedAt: date
        };
        await setDoc(doc(db, 'requests', requestId), newRequest);
        alert('관리자 승인을 위해 이동 요청이 전송되었습니다.');
        setIsTransferModalOpen(false);
        setActiveTool(null);
      } catch (e) {
        console.error('Transfer request failed:', e);
        alert('이동 요청 전송에 실패했습니다.');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    // Admin immediate execution
    await executeTransfer(toolId, toSiteId, notes, quantityToMove, '총괄 관리자');
    setIsTransferModalOpen(false);
    setActiveTool(null);
  };

  const executeTransfer = async (toolId: string, toSiteId: string, notes: string, quantityToMove: number, recordedBy: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const date = new Date().toISOString();
    const historyId = `hist-transfer-${Date.now()}`;
    const newHistory: TransferHistory = {
      id: historyId,
      toolId: tool.id,
      toolName: tool.name,
      fromSiteId: tool.currentSiteId,
      toSiteId: toSiteId,
      date: date,
      type: 'out',
      notes,
      recordedBy,
      quantity: quantityToMove
    };

    try {
      const batch = writeBatch(db);
      if (quantityToMove === tool.quantity) {
        batch.update(doc(db, 'tools', toolId), {
          currentSiteId: toSiteId,
          lastUpdated: date
        });
      } else {
        batch.update(doc(db, 'tools', toolId), {
          quantity: tool.quantity - quantityToMove,
          lastUpdated: date
        });
        
        const existingAtTarget = tools.find(t => 
          t.currentSiteId === toSiteId && 
          t.name === tool.name && 
          t.serialNumber === tool.serialNumber
        );

        if (existingAtTarget) {
          batch.update(doc(db, 'tools', existingAtTarget.id), {
            quantity: existingAtTarget.quantity + quantityToMove,
            lastUpdated: date
          });
        } else {
          const newToolRef = doc(collection(db, 'tools'));
          const newTool: Tool = {
            ...tool,
            id: newToolRef.id,
            currentSiteId: toSiteId,
            quantity: quantityToMove,
            lastUpdated: date
          };
          batch.set(newToolRef, newTool);
        }
      }
      batch.set(doc(db, 'history', historyId), newHistory);
      await batch.commit();
      setIsSyncing(false);
    } catch (e) {
      console.error('Execution failed:', e);
      throw e;
    }
  };

  const handleAddSite = async (name: string, password?: string) => {
    setIsSyncing(true);
    const id = `site-${Date.now()}`;
    const newSite: Site = {
      id,
      name,
      password: password || '1111',
      order: sites.length // Add to end
    };
    
    try {
      await setDoc(doc(db, 'sites', id), newSite);
      setIsAddSiteModalOpen(false);
    } catch (e) {
      console.error('Add site failed:', e);
      alert('현장 추가에 실패했습니다.');
      setIsSyncing(false);
    }
  };

  const handleMoveSite = async (siteId: string, direction: 'up' | 'down') => {
    setIsSyncing(true);
    const currentIndex = sites.findIndex(s => s.id === siteId);
    if (currentIndex === -1) {
      setIsSyncing(false);
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sites.length) return;

    const currentSite = sites[currentIndex];
    const neighborSite = sites[newIndex];

    try {
      const batch = writeBatch(db);
      
      // Update orders. Ensure we have valid order numbers to swap.
      // If order is missing, use index as default.
      const currentOrder = currentSite.order ?? currentIndex;
      const neighborOrder = neighborSite.order ?? newIndex;

      batch.update(doc(db, 'sites', currentSite.id), { order: neighborOrder });
      batch.update(doc(db, 'sites', neighborSite.id), { order: currentOrder });
      
      // Also ensure other sites have orders to keep the list stable
      sites.forEach((site, index) => {
        if (site.id !== currentSite.id && site.id !== neighborSite.id && site.order === undefined) {
          batch.update(doc(db, 'sites', site.id), { order: index });
        }
      });

      await batch.commit();
    } catch (e) {
      alert('순서 변경에 실패했습니다.');
    }
  };

  const handleEditSite = async (id: string, name: string, password?: string) => {
    try {
      await updateDoc(doc(db, 'sites', id), { 
        name, 
        password: password || '1111' 
      });
      setIsEditSiteModalOpen(false);
      setEditingSite(null);
    } catch (e) {
      alert('현장 정보 수정에 실패했습니다.');
    }
  };

  const handleDeleteTool = async (id: string, reason?: string) => {
    setIsSyncing(true);
    const tool = tools.find(t => t.id === id);
    if (!tool) return;

    if (userRole === 'manager' && !reason) {
      setActiveTool(tool);
      setIsDeleteRequestModalOpen(true);
      setIsSyncing(false);
      return;
    }

    if (userRole === 'manager' && reason) {
      try {
        const requestId = `req-delete-${Date.now()}`;
        const newRequest: ApprovalRequest = {
          id: requestId,
          type: 'delete',
          status: 'pending',
          toolId: tool.id,
          toolName: tool.name,
          requestedSiteId: tool.currentSiteId,
          quantity: tool.quantity,
          reason: reason,
          requestedBy: selectedSite.name,
          requestedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'requests', requestId), newRequest);
        alert('관리자 승인을 위해 삭제 요청이 전송되었습니다.');
        setIsDeleteRequestModalOpen(false);
        setActiveTool(null);
      } catch (e) {
        console.error('Delete request failed:', e);
        alert('삭제 요청 전송에 실패했습니다.');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    // Admin logic (immediate)
    if (!window.confirm('정말 이 공구를 삭제하시겠습니까? 데이터는 복구할 수 없습니다.')) {
      setIsSyncing(false);
      return;
    }
    
    try {
      await executeDelete(id);
      setIsEditToolModalOpen(false);
      setActiveTool(null);
    } catch (e) {
      console.error('Delete failed:', e);
      alert('공구 삭제에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const executeDelete = async (toolId: string) => {
    try {
      const toolRef = doc(db, 'tools', toolId);
      await deleteDoc(toolRef);
    } catch (e) {
      console.error('Execution failed:', e);
      throw e;
    }
  };

  const handleApproveRequest = async (request: ApprovalRequest) => {
    setIsSyncing(true);
    try {
      if (request.type === 'transfer' && request.targetSiteId) {
        await executeTransfer(request.toolId, request.targetSiteId, `[승인됨] ${request.reason}`, request.quantity, `관리자 승인 (${request.requestedBy} 요청)`);
      } else if (request.type === 'delete') {
        await executeDelete(request.toolId);
      }
      
      await updateDoc(doc(db, 'requests', request.id), { status: 'approved' });
      alert('요청이 승인되었습니다.');
    } catch (e) {
      console.error('Approval failed:', e);
      alert('승인 처리에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, 'requests', requestId), { status: 'rejected' });
      alert('요청이 거절되었습니다.');
    } catch (e) {
      console.error('Rejection failed:', e);
      alert('거절 처리에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; // Aggressive downscale
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setPreviewImage(canvas.toDataURL('image/jpeg', 0.4)); // Aggressive compression
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRotateImage = () => {
    if (!previewImage) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous"; // Handle potential CORS issues
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.height;
        canvas.height = img.width;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        setPreviewImage(canvas.toDataURL('image/jpeg', 0.7)); // Slightly lower quality for space
      } catch (e) {
        console.error('Rotation failed:', e);
        alert('이미지 회전 중 오류가 발생했습니다.');
      }
    };
    img.onerror = () => {
      console.error('Failed to load image for rotation');
    };
    img.src = previewImage;
  };

  const handleExportCSV = () => {
    let csvContent = "";
    const fileName = `inventory_report_${selectedSite.name}_${new Date().toISOString().split('T')[0]}.csv`;

    if (view === 'inventory') {
      csvContent += "구분,모델명,시리얼번호,현장,상태,단위,수량,최근업데이트\n";
      siteTools.forEach(tool => {
        const siteName = sites.find(s => s.id === tool.currentSiteId)?.name || 'Unknown';
        csvContent += `"${tool.category}","${tool.name}","${tool.serialNumber}","${siteName}","${tool.status}","${tool.unit}",${tool.quantity},"${tool.lastUpdated}"\n`;
      });
    } else {
      csvContent += "날짜,공구명,출발지,목적지,유형,담당자,비고\n";
      history.forEach(h => {
        const fromSite = sites.find(s => s.id === h.fromSiteId)?.name || 'N/A';
        const toSite = sites.find(s => s.id === h.toSiteId)?.name || 'N/A';
        csvContent += `"${h.date}","${h.toolName}","${fromSite}","${toSite}","${h.type}","${h.recordedBy}","${h.notes}"\n`;
      });
    }

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    // 1. Get the styles from the current document
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('');
        } catch (e) {
          return ''; // Handle cross-origin styles
        }
      })
      .join('');

    // 2. Get the content to print
    const printArea = document.getElementById('printable-content');
    if (!printArea) return;
    
    const printContent = printArea.innerHTML;
    const siteName = selectedSite.name;
    const reportType = view === 'inventory' ? '공구 자산 현황 보고서' : '공구 이동 히스토리 리포트';

    // 3. Create a standalone HTML document
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${siteName} - ${reportType}</title>
          <meta charset="UTF-8">
          <style>
            ${styles}
            @media print {
              button, .no-print { display: none !important; }
              body { background: white !important; }
              .print-only { display: block !important; }
            }
            body { padding: 40px; font-family: sans-serif; background: white; }
          </style>
        </head>
        <body>
          <div class="print-header" style="margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px;">
            <h1 style="margin: 0; font-size: 24px; color: #111;">${siteName}</h1>
            <p style="margin: 5px 0 0; color: #666;">${reportType} | 출력일시: ${new Date().toLocaleString()}</p>
          </div>
          <div class="main-report">
            ${printContent}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                // Close after print to be clean
                // window.close(); 
              }, 800);
            };
          </script>
        </body>
      </html>
    `;

    // 4. Open as a Blob URL (This transfers the DATA, not just a link)
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleManualSave = () => {
    setIsSaving(true);
    // Real-time sync is already active, this is for user feedback and piece of mind
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const handleExportBackup = () => {
    const backupData = {
      tools,
      history,
      sites,
      version: '1.0',
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddNotice = async (title: string, content: string, important: boolean) => {
    setIsSyncing(true);
    const id = `notice-${Date.now()}`;
    const newNotice: Notice = {
      id,
      title,
      content,
      important,
      author: userRole === 'admin' ? '총괄 관리자' : (sites.find(s => s.id === userSiteId)?.name || '현장 담당자'),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'notices', id), newNotice);
      setIsAddNoticeModalOpen(false);
    } catch (e) {
      alert('공지사항 등록에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm('이 공지사항을 삭제하시겠습니까?')) return;
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'notices', id));
    } catch (e) {
      alert('삭제에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('백업 파일을 불러오시겠습니까? 현재 데이터베이스 내용이 백업 파일의 내용으로 교체됩니다.\n(대용량 데이터의 경우 수 초가 소요될 수 있습니다.)')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tools && json.history && json.sites) {
          setIsSaving(true);
          setIsSyncing(true);
          
          // Split into chunks of 400 (Firestore limit is 500)
          const CHUNK_SIZE = 400;
          
          const processInBatches = async (items: any[], collectionName: string) => {
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
              const chunk = items.slice(i, i + CHUNK_SIZE);
              const batch = writeBatch(db);
              chunk.forEach(item => {
                if (item.id) {
                  // Use a non-merging set to ensure total document replacement
                  batch.set(doc(db, collectionName, item.id), item);
                }
              });
              await batch.commit();
            }
          };

          await processInBatches(json.sites, 'sites');
          await processInBatches(json.tools, 'tools');
          await processInBatches(json.history, 'history');
          
          setIsSaving(false);
          setIsSyncing(false);
          alert('데이터베이스 복구가 완료되었습니다. 변경사항을 적용하기 위해 앱을 재시작합니다.');
          window.location.reload(); // Force a fresh state
        } else {
          alert('유효한 백업 파일이 아닙니다. (필수 데이터 누락)');
          setIsSyncing(false);
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('데이터 복구 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
        setIsSaving(false);
        setIsSyncing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="min-h-screen bg-gray-100 text-[#141414] font-sans">
      {/* Sidebar / Site Navigation */}
      <div className="flex h-screen overflow-hidden relative">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-sm"
            />
          )}
        </AnimatePresence>

        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shadow-xl transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-slate-800 flex justify-between items-center group/title">
            <div 
              className={userRole === 'admin' ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
              onClick={() => userRole === 'admin' && setIsAppNameModalOpen(true)}
            >
              <h1 className="text-lg font-bold tracking-tight">{appName}</h1>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{appSubName}</p>
            </div>
            <div className="flex items-center gap-2">
              {userRole === 'admin' && (
                <>
                  <Shield className="w-4 h-4 text-blue-500" />
                  <button 
                    onClick={() => setIsShareModalOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="앱 공유 및 접속 QR"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2">
            {userRole === 'admin' ? (
              <>
                <div className="flex justify-between items-center px-4 mb-3">
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">
                    현장 목록 ({sites.length})
                  </div>
                  <button 
                    onClick={() => setIsAddSiteModalOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="현장 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <ul className="space-y-1 mb-6">
                  <li>
                    <button
                      onClick={() => setSelectedSiteId('all')}
                      className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-3 ${
                        selectedSiteId === 'all' 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Box className={`w-4 h-4 ${selectedSiteId === 'all' ? 'text-white' : 'text-slate-500'}`} />
                      <span>전체 공구 확인</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setIsRequestsModalOpen(true)}
                      className="w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-between group text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      <div className="flex items-center gap-3">
                        <History className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
                        <span>승인 대기 요청</span>
                      </div>
                      {requests.filter(r => r.status === 'pending').length > 0 && (
                        <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          {requests.filter(r => r.status === 'pending').length}
                        </span>
                      )}
                    </button>
                  </li>
                </ul>
              </>
            ) : (
              <div className="px-4 mb-3 py-2 bg-blue-900/20 rounded-lg border border-blue-800/30">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[10px] uppercase text-blue-400 font-bold tracking-widest">
                    담당 현장
                  </div>
                  <button 
                    onClick={() => {
                      const site = sites.find(s => s.id === userSiteId);
                      if (site) {
                        setEditingSite(site);
                        setIsEditSiteModalOpen(true);
                      }
                    }}
                    className="text-[10px] text-blue-400 font-bold hover:text-white flex items-center gap-1"
                  >
                    <Settings2 className="w-3 h-3" /> 비밀번호 변경
                  </button>
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {sites.find(s => s.id === userSiteId)?.name || '현장 지정 필요'}
                </div>
              </div>
            )}

            <div className="px-4 mt-6 mb-3">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">
                {userRole === 'admin' ? '현장별 분류' : '현장 이동'}
              </div>
            </div>
            <ul className="space-y-1">
              {sites.filter(s => userRole === 'admin' || s.id === userSiteId).map((site, index, filteredSites) => (
                <li key={site.id} className="group relative">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedSiteId(site.id)}
                      className={`flex-1 text-left px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-between ${
                        selectedSiteId === site.id 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MapPin className={`w-4 h-4 flex-shrink-0 ${selectedSiteId === site.id ? 'text-white' : 'text-slate-500'}`} />
                        <div className="flex flex-col">
                          <span className="truncate">{site.name}</span>
                          {userRole === 'admin' && (
                            <span className="text-[9px] font-mono opacity-60 tracking-wider">PW: {site.password || '1111'}</span>
                          )}
                        </div>
                      </div>
                      {selectedSiteId === site.id && (userRole === 'admin' || userRole === 'manager') && (
                        <div className="flex items-center gap-2">
                          <Edit2 
                            className="w-3.5 h-3.5 opacity-70 cursor-pointer hover:opacity-100" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSite(site);
                              setIsEditSiteModalOpen(true);
                            }}
                          />
                        </div>
                      )}
                    </button>
                    
                    {userRole === 'admin' && (
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={index === 0}
                          onClick={() => handleMoveSite(site.id, 'up')}
                          className={`p-0.5 hover:text-white transition-colors ${index === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500'}`}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={index === filteredSites.length - 1}
                          onClick={() => handleMoveSite(site.id, 'down')}
                          className={`p-0.5 hover:text-white transition-colors ${index === filteredSites.length - 1 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500'}`}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/50 space-y-3">
            <div className="flex justify-between items-center px-1 mb-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Tools</span>
              <button 
                onClick={() => {
                  setIsVerified(false);
                  sessionStorage.removeItem('is_verified');
                  setIsRoleModalOpen(true);
                  setIsSidebarOpen(false);
                }}
                className="text-[9px] text-red-500/70 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
              >
                <Lock className="w-2.5 h-2.5" /> 로그아웃
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleExportBackup}
                className="flex-1 flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-all text-[10px] text-slate-400 font-bold"
                title="데이터 내보내기"
              >
                <Download className="w-3.5 h-3.5 mb-1 text-slate-500" />
                백업 생성
              </button>
              <label className="flex-1 flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-all text-[10px] text-slate-400 font-bold cursor-pointer" title="데이터 가져오기">
                <Upload className="w-3.5 h-3.5 mb-1 text-slate-500" />
                복구/이동
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
            
            <button 
              onClick={() => setIsRoleModalOpen(true)}
              className="w-full group flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-blue-500/20 group-hover:scale-110 transition-transform">
                {userRole === 'admin' ? '관' : '현'}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{userRole === 'admin' ? 'Full Access' : 'Limited Access'}</div>
                <div className="text-xs font-bold text-slate-200">{userRole === 'admin' ? '총괄 관리자' : '현장 담당자'}</div>
              </div>
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </button>
            
            <div className="flex flex-col gap-1 items-center">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${
                isSyncing ? 'bg-blue-500/10 border-blue-500/20' : 'bg-green-500/10 border-green-500/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-sm ${
                  isSyncing ? 'bg-blue-500 shadow-blue-500/60' : 'bg-green-500 shadow-green-500/60'
                }`}></div>
                <span className={`text-[8px] font-bold uppercase tracking-tight ${
                  isSyncing ? 'text-blue-500' : 'text-green-500'
                }`}>
                  {isSyncing ? 'Syncing...' : 'Live Sync Active'}
                </span>
              </div>
              <span className="text-[9px] text-slate-600 font-mono font-bold tracking-tighter uppercase">Software Version {APP_VERSION}</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full bg-gray-100 w-full overflow-hidden">
          {/* Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="메뉴 열기"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-4">
                <h2 className="text-sm lg:text-lg font-bold text-gray-800 line-clamp-1">{selectedSite.name} 현황</h2>
                <span className="hidden lg:block bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider no-print">진행중</span>
              </div>
            </div>

            <div className="flex gap-2 lg:gap-3">
              {userRole === 'admin' && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="p-2 lg:px-4 lg:py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                  title="공구 신규 등록"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden lg:inline">자산 등록</span>
                </button>
              )}
              <button 
                onClick={handleManualSave}
                disabled={isSaving}
                className={`p-2 lg:px-4 lg:py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border ${
                  isSaving 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="수동 저장"
              >
                {isSaving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4 text-gray-400" />}
                <span className="hidden lg:inline">{isSaving ? '저장됨' : '저장'}</span>
              </button>

              <button 
                onClick={handlePrint}
                className="p-2 lg:px-4 lg:py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
                title="인쇄"
              >
                <Printer className="w-4 h-4 text-gray-400" />
                <span className="hidden lg:inline">인쇄</span>
              </button>
            </div>
          </header>

          {/* Stats Overview */}
          <div className="px-4 lg:px-8 py-4 lg:pt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0">
            <div className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-[9px] lg:text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">현장 보유 공구</div>
              <div className="text-xl lg:text-2xl font-bold">{siteTools.length}<span className="text-xs font-normal text-gray-400 ml-1 italic">EA</span></div>
            </div>
            <div className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-[9px] lg:text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">가동 가능 공구</div>
              <div className="text-xl lg:text-2xl font-bold text-blue-600">{siteTools.filter(t => t.status === 'available').length}<span className="text-xs font-normal text-gray-400 ml-1 italic">EA</span></div>
            </div>
            <div className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-[9px] lg:text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">점검/수리 필요</div>
              <div className="text-xl lg:text-2xl font-bold text-orange-500">{siteTools.filter(t => t.status === 'damaged').length}<span className="text-xs font-normal text-gray-400 ml-1 italic">EA</span></div>
            </div>
            <div className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-[9px] lg:text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">금일 변동 건수</div>
              <div className="text-xl lg:text-2xl font-bold text-emerald-600">
                {history.filter(h => new Date(h.date).toDateString() === new Date().toDateString()).length}
                <span className="text-xs font-normal text-gray-400 ml-1 italic">건</span>
              </div>
            </div>
          </div>

          {/* View Toggle and Search */}
          <div className="px-4 lg:px-8 mt-2 lg:mt-6 flex-shrink-0">
            <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setView('inventory')}
                className={`px-4 lg:px-6 py-3 text-xs lg:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  view === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                전체 공구 리스트
              </button>
              <button 
                onClick={() => setView('history')}
                className={`px-4 lg:px-6 py-3 text-xs lg:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  view === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                공구 이동 히스토리
              </button>
              <button 
                onClick={() => setView('notices')}
                className={`px-4 lg:px-6 py-3 text-xs lg:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  view === 'notices' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                공지사항 게시판
              </button>
            </div>
          </div>

          <div className="px-4 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="공구 또는 S/N 검색..." 
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-[10px] lg:text-xs text-gray-500 font-medium">
              표시됨: {view === 'inventory' ? siteTools.length : history.length} 항목
            </div>
          </div>

          {/* Content Area */}
          <div id="printable-content" className="flex-1 overflow-y-auto p-4 lg:p-8 pt-2">
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
              <h1 className="text-2xl font-bold text-slate-900">{selectedSite.name} - {view === 'inventory' ? '공구 자산 현황 보고서' : '공구 이동 히스토리 리포트'}</h1>
              <p className="text-sm text-slate-500 mt-1">출력 일시: {new Date().toLocaleString()}</p>
            </div>
            <AnimatePresence mode="wait">
              {view === 'inventory' ? (
                <motion.div 
                  key="inventory"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {siteTools.map((tool) => (
                    <div 
                      key={tool.id} 
                      className="bg-white rounded-lg border border-gray-100 p-2.5 shadow-sm hover:shadow-md transition-all group flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[8px] uppercase font-bold rounded self-start">
                            {tool.category}
                          </div>
                          {selectedSiteId === 'all' && (
                            <div className="flex items-center gap-1 text-[9px] text-blue-600 font-bold">
                              <MapPin className="w-2.5 h-2.5" />
                              {sites.find(s => s.id === tool.currentSiteId)?.name || '알 수 없음'}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={tool.status} />
                      </div>
                      
                      {tool.imageUrl && (
                        <div className="w-full h-28 mb-2 rounded border border-gray-50 bg-gray-50 flex items-center justify-center p-1">
                          <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-contain" />
                        </div>
                      )}
                      
                      <h3 className="text-sm font-bold text-gray-800 mb-0 group-hover:text-blue-600 transition-colors line-clamp-1">{tool.name}</h3>
                      <p className="font-mono text-[8px] text-gray-400 mb-2 uppercase tracking-tight">{tool.serialNumber}</p>
                      
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        <div className="bg-gray-50/50 p-1.5 rounded-md border border-gray-100/50 flex justify-between items-center">
                          <div className="text-[8px] text-gray-400 font-bold">단위</div>
                          <div className="text-[10px] font-bold text-gray-700">{tool.unit}</div>
                        </div>
                        <div className="bg-blue-50/30 p-1.5 rounded-md border border-blue-100/30 flex justify-between items-center">
                          <div className="text-[8px] text-blue-400 font-bold">수량</div>
                          <div className="text-[10px] font-bold text-blue-700">{tool.quantity}</div>
                        </div>
                      </div>
                      
                      {(() => {
                        const lastTransfer = [...history].reverse().find(h => h.toolId === tool.id && h.toSiteId === tool.currentSiteId);
                        const fromSiteName = lastTransfer ? (sites.find(s => s.id === lastTransfer.fromSiteId)?.name || '외부 도입') : '최초 등록';
                        return (
                          <div className="flex flex-col gap-1.5 mb-3 px-1">
                            {userRole === 'admin' && tool.notes && (
                              <div className="bg-amber-50 p-2 rounded border border-amber-100 mb-1">
                                <div className="text-[8px] text-amber-600 font-bold uppercase mb-0.5 opacity-70">관리자 비고</div>
                                <p className="text-[10px] text-amber-900 font-medium leading-tight">{tool.notes}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <ArrowDownLeft className="w-3 h-3 text-emerald-500 shrink-0" />
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-gray-400">
                                  {new Date(tool.lastUpdated).toLocaleDateString()}
                                </span>
                                <span className="text-[9px] text-blue-500 font-bold">
                                  발송: {fromSiteName}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-gray-50">
                        <div className="flex justify-between gap-1.5">
                          <button 
                            onClick={() => {
                              setActiveTool(tool);
                              setPreviewImage(tool.imageUrl || null);
                              setIsEditToolModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            수정
                          </button>
                          
                          <button 
                            onClick={() => {
                              setActiveTool(tool);
                              setIsTransferModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-100 transition-colors group/btn"
                          >
                            <ArrowLeftRight className="w-3 h-3 group-hover/btn:rotate-180 transition-transform duration-300" />
                            이동
                          </button>

                          <button 
                            onClick={() => handleDeleteTool(tool.id)}
                            className="w-8 h-7 flex items-center justify-center bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition-colors shrink-0"
                            title="삭제"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {siteTools.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                      <Box className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm font-medium">이 현장에 등록된 공구가 없습니다.</p>
                      <button onClick={() => setIsAddModalOpen(true)} className="mt-4 text-blue-600 text-xs font-bold hover:underline">새 공구 등록하기</button>
                    </div>
                  )}
                </motion.div>
              ) : view === 'history' ? (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="divide-y divide-gray-50 uppercase font-bold text-slate-400">
                    {history.map((record) => (
                      <div key={record.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            record.fromSiteId === selectedSiteId ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {record.fromSiteId === selectedSiteId ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                          </div>
                          <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">{record.toolName}</span>
                              {record.quantity && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded border border-blue-100">
                                  {record.quantity}개
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-gray-400 font-mono tracking-tighter">{new Date(record.date).toLocaleDateString()}</span>
                              <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                              <span className="text-[10px] text-gray-400 lowercase">{record.recordedBy}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                          <div className="text-center sm:text-right">
                            <div className="text-[8px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">이전 현장</div>
                            <div className="text-xs font-bold text-gray-500 truncate max-w-[100px]">
                              {sites.find(s => s.id === record.fromSiteId)?.name || '외부'}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                          <div className="text-center sm:text-left">
                            <div className="text-[8px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">현재 현장</div>
                            <div className="text-xs font-bold text-blue-600 truncate max-w-[100px]">
                              {sites.find(s => s.id === record.toSiteId)?.name}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {history.length === 0 && (
                    <div className="p-20 flex flex-col items-center justify-center text-gray-300 italic text-sm">
                      <History className="w-8 h-8 mb-3 opacity-20" />
                      변동 내역이 아직 없습니다.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="notices"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4 max-w-4xl mx-auto"
                >
                  <div className="flex justify-between items-center mb-6 px-1">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">공지사항</h2>
                      <p className="text-xs text-gray-500 mt-1">현장별 주요 공지 및 안내사항을 확인하세요.</p>
                    </div>
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => setIsAddNoticeModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                      >
                        <Plus className="w-4 h-4" />
                        게시글 작성
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {notices.map((notice) => (
                      <div 
                        key={notice.id} 
                        className={`bg-white rounded-2xl border ${notice.important ? 'border-amber-200 bg-amber-50/10' : 'border-gray-100'} p-6 shadow-sm relative group`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                            {notice.important && (
                              <span className="self-start px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase rounded-md tracking-wider mb-1 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> IMPORTANT
                              </span>
                            )}
                            <h3 className={`text-base font-bold ${notice.important ? 'text-amber-900' : 'text-gray-900'}`}>{notice.title}</h3>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" /> {notice.author}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> {new Date(notice.createdAt).toLocaleDateString()}
                            </div>
                            {userRole === 'admin' && (
                              <button 
                                onClick={() => handleDeleteNotice(notice.id)}
                                className="text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${notice.important ? 'text-amber-800' : 'text-gray-600'}`}>
                          {notice.content}
                        </div>
                      </div>
                    ))}
                    {notices.length === 0 && (
                      <div className="py-32 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400">
                        <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium italic">게시된 공지사항이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Transfer Modal */}
      {isTransferModalOpen && activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                공구 현장 이동 지원
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleTransfer(
                  activeTool.id, 
                  formData.get('toSiteId') as string,
                  formData.get('notes') as string,
                  Number(formData.get('quantity'))
                );
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">이동 대상 공구</label>
                <div className="p-3 rounded-xl border border-gray-100 bg-blue-50/50 flex justify-between items-center text-left">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{activeTool.name}</p>
                    <p className="font-mono text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider">{activeTool.serialNumber}</p>
                  </div>
                  <div className="text-right text-[10px] text-blue-600 font-bold whitespace-nowrap ml-4">
                    보유: {activeTool.quantity} {activeTool.unit}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">이동 수량</label>
                  <input 
                    name="quantity"
                    type="number"
                    min="1"
                    max={activeTool.quantity}
                    defaultValue={activeTool.quantity}
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">목적지 현장</label>
                  <select 
                    name="toSiteId" 
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  >
                    <option value="">현장 선택...</option>
                    {sites.filter(s => s.id !== selectedSiteId).map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-left pt-1">
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">이동 사유 / 비고</label>
                <textarea 
                  name="notes"
                  rows={2}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  placeholder="긴급 지원, 수리 발송 등..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
                >
                  이동 실행
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Tool Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <Hammer className="w-4 h-4 text-blue-600" />
                신규 공구 자산 등록
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddTool(
                  formData.get('name') as string,
                  formData.get('serialNumber') as string,
                  formData.get('category') as string,
                  formData.get('unit') as string,
                  Number(formData.get('quantity')),
                  formData.get('targetSiteId') as string,
                  previewImage || undefined,
                  formData.get('notes') as string
                );
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">공구 사진 (선택사항)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  {previewImage ? (
                    <div className="relative w-full h-full p-2">
                       <img src={previewImage} className="w-full h-full object-contain rounded-xl" />
                       <div className="absolute top-2 right-2 flex gap-2">
                         <button 
                           type="button"
                           onClick={(e) => { e.stopPropagation(); handleRotateImage(); }}
                           className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md transition-colors"
                           title="90도 회전"
                         >
                           <RotateCw className="w-3 h-3" />
                         </button>
                         <button 
                           type="button"
                           onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                           className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                           title="삭제"
                         >
                           <X className="w-3 h-3" />
                         </button>
                       </div>
                     </div>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-gray-300 group-hover:text-blue-500 mb-1" />
                      <span className="text-xs text-gray-400 group-hover:text-blue-600">사진 클릭하여 첨부</span>
                    </>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">공구 명칭</label>
                  <input 
                    name="name" 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                    placeholder="예: Hilti TE-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">자산 번호 (S/N)</label>
                  <input 
                    name="serialNumber" 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                    placeholder="SN-XXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">단위 (대, SET 등)</label>
                  <select 
                    name="unit" 
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  >
                    <option value="대">대</option>
                    <option value="SET">SET</option>
                    <option value="개">개</option>
                    <option value="박스">박스</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">보유 수량</label>
                  <input 
                    name="quantity" 
                    type="number"
                    min="1"
                    required
                    defaultValue="1"
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>

              {userRole === 'admin' && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 underline decoration-blue-500/30 underline-offset-4">관리자 비고 (상세 메모)</label>
                  <textarea 
                    name="notes" 
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[60px] resize-none"
                    placeholder="공구 특이사항 등을 기록하세요..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">등록 현장</label>
                  <select 
                    name="targetSiteId" 
                    required
                    defaultValue={selectedSiteId !== 'all' ? selectedSiteId : (sites[0]?.id || '')}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  >
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">장비 카테고리</label>
                  <select 
                    name="category" 
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="">카테고리 선택...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  자산 등록 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Site Modal */}
      {isAddSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                새 현장 추가
              </h3>
              <button onClick={() => setIsAddSiteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddSite(
                  formData.get('name') as string,
                  formData.get('password') as string
                );
              }}
              className="p-6 space-y-6"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">현장 명칭</label>
                <input 
                  name="name" 
                  type="text"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  placeholder="예: 경기 화성 물류센터 현장"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">현장 비밀번호 (담당자용)</label>
                <input 
                  name="password" 
                  type="text"
                  required
                  defaultValue="1111"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  placeholder="담당자가 접속할 때 사용할 비밀번호"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setIsAddSiteModalOpen(false)}
                  className="py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  현장 추가 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Tool Modal */}
      {isEditToolModalOpen && activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                공구 정보 및 사진 수정
              </h3>
              <button 
                onClick={() => { setIsEditToolModalOpen(false); setActiveTool(null); setPreviewImage(null); }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdateTool(
                  activeTool.id,
                  formData.get('name') as string,
                  formData.get('serialNumber') as string,
                  formData.get('category') as string,
                  formData.get('unit') as string,
                  Number(formData.get('quantity')),
                  formData.get('status') as ToolStatus,
                  previewImage || undefined,
                  formData.get('notes') as string
                );
              }}
              className="p-6 space-y-5"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">공구 사진 수정</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  {previewImage ? (
                    <div className="relative w-full h-full p-2">
                       <img src={previewImage} className="w-full h-full object-contain rounded-xl" />
                       <div className="absolute top-2 right-2 flex gap-2">
                         <button 
                           type="button"
                           onClick={(e) => { e.stopPropagation(); handleRotateImage(); }}
                           className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md transition-colors"
                           title="90도 회전"
                         >
                           <RotateCw className="w-3 h-3" />
                         </button>
                         <button 
                           type="button"
                           onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                           className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                           title="삭제"
                         >
                           <X className="w-3 h-3" />
                         </button>
                       </div>
                     </div>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-gray-300 group-hover:text-blue-500 mb-1" />
                      <span className="text-xs text-gray-400 group-hover:text-blue-600">사진 클릭하여 첨부</span>
                    </>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">공구 명칭</label>
                  <input 
                    name="name" 
                    type="text"
                    required
                    defaultValue={activeTool.name}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">자산 번호 (S/N)</label>
                  <input 
                    name="serialNumber" 
                    type="text"
                    required
                    defaultValue={activeTool.serialNumber}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">단위</label>
                  <select 
                    name="unit" 
                    required
                    defaultValue={activeTool.unit || '대'}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  >
                    <option value="대">대</option>
                    <option value="SET">SET</option>
                    <option value="개">개</option>
                    <option value="박스">박스</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">수량</label>
                  <input 
                    name="quantity" 
                    type="number"
                    min="1"
                    required
                    defaultValue={activeTool.quantity || 1}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>

              {userRole === 'admin' && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 underline decoration-blue-500/30 underline-offset-4">관리자 비고 (상세 메모)</label>
                  <textarea 
                    name="notes" 
                    defaultValue={activeTool.notes}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[60px] resize-none"
                    placeholder="공구 특이사항 등을 기록하세요..."
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">공구 상태 설정 (분실/폐기 시 자동 기록)</label>
                <select 
                  name="status" 
                  required
                  defaultValue={activeTool.status}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-bold"
                >
                  <option value="available">가동 가능 (Available)</option>
                  <option value="damaged">점검/수리 필요 (Damaged)</option>
                  <option value="lost">분실 처리 (Lost)</option>
                  <option value="disposed">폐기 처리 (Disposed)</option>
                </select>
              </div>

              <div className="pt-0.5">
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">카테고리</label>
                <select 
                  name="category" 
                  required
                  defaultValue={activeTool.category}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="">카테고리 선택...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => { setIsEditToolModalOpen(false); setActiveTool(null); setPreviewImage(null); }}
                  className="py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Site Modal */}
      {isEditSiteModalOpen && editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                현장 정보 수정
              </h3>
              <button 
                onClick={() => { setIsEditSiteModalOpen(false); setEditingSite(null); }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleEditSite(
                  editingSite.id,
                  (formData.get('name') as string) || editingSite.name,
                  formData.get('password') as string
                );
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">현장 명칭</label>
                <input 
                  name="name" 
                  type="text"
                  required
                  disabled={userRole === 'manager'}
                  defaultValue={editingSite.name}
                  className={`w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold ${userRole === 'manager' ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">현장 비밀번호 (담당자용)</label>
                <input 
                  name="password" 
                  type="text"
                  required
                  defaultValue={editingSite.password || '1111'}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => { setIsEditSiteModalOpen(false); setEditingSite(null); }}
                  className="py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Reason Modal (Manager) */}
      {isDeleteRequestModalOpen && activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
              <h3 className="font-bold text-base text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                삭제 승인 요청
              </h3>
              <button 
                onClick={() => { setIsDeleteRequestModalOpen(false); setActiveTool(null); }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleDeleteTool(activeTool.id, formData.get('reason') as string);
              }}
              className="p-4 space-y-4"
            >
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">삭제 대상 공구</div>
                <div className="font-bold text-gray-800 text-sm">{activeTool.name}</div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{activeTool.serialNumber}</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">삭제 사유를 입력해주세요 (필수)</label>
                <textarea 
                  name="reason" 
                  required
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
                  placeholder="예: 파손으로 인한 폐기 필요, 현장 종료로 인한 자산 제거 등..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => { setIsDeleteRequestModalOpen(false); setActiveTool(null); }}
                  className="py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-md shadow-red-200"
                >
                  승인 요청
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Notice Modal */}
      {isAddNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                공지사항 게시글 작성
              </h3>
              <button 
                onClick={() => setIsAddNoticeModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddNotice(
                  formData.get('title') as string,
                  formData.get('content') as string,
                  formData.get('important') === 'on'
                );
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 tracking-wider font-bold">제목</label>
                <input 
                  name="title" 
                  type="text" 
                  required 
                  placeholder="공지사항 제목을 입력하세요..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 tracking-wider font-bold">내용</label>
                <textarea 
                  name="content" 
                  rows={8} 
                  required 
                  placeholder="전달할 내용을 입력하세요..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium resize-none"
                ></textarea>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox" 
                  name="important" 
                  id="important"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="important" className="text-sm font-bold text-gray-700 cursor-pointer">중요 공지로 설정 (상단 강조 표시)</label>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAddNoticeModalOpen(false)}
                  className="py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  게시하기
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Admin Requests Modal */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                현장 요청 승인 대기 목록
              </h3>
              <button 
                onClick={() => setIsRequestsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {requests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                  <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">대기 중인 요청이 없습니다.</p>
                </div>
              ) : (
                requests.filter(r => r.status === 'pending').map((req) => (
                  <div key={req.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      req.type === 'transfer' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {req.type === 'transfer' ? <ArrowLeftRight className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.type === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {req.type === 'transfer' ? '이동 요청' : '자산 삭제 요청'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{new Date(req.requestedAt).toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-1">{req.toolName}</h4>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 italic">“{req.reason}”</p>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 border-t border-gray-50 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">요청 현장:</span>
                          <span className="text-[11px] text-slate-700 font-bold">{req.requestedBy}</span>
                        </div>
                        {req.type === 'transfer' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">도착 현장:</span>
                            <span className="text-[11px] text-blue-600 font-bold">
                              {sites.find(s => s.id === req.targetSiteId)?.name || '알 수 없음'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">수량:</span>
                          <span className="text-[11px] text-slate-700 font-bold">{req.quantity}개</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                      <button 
                        onClick={() => handleApproveRequest(req)}
                        className="flex-1 sm:w-20 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                      >
                        승인
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(req.id)}
                        className="flex-1 sm:w-20 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0">
               <button 
                 onClick={() => setIsRequestsModalOpen(false)}
                 className="w-full py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
               >
                 닫기
               </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* User Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">접속 모드 설정</h3>
              <p className="text-sm text-gray-500 mt-2">사용자 권한에 맞는 모드를 선택하세요.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <button 
                onClick={() => {
                  setUserRole('admin');
                  setUserSiteId(null);
                  setPasswordInput('');
                  setPasswordError(false);
                }}
                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                  userRole === 'admin' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 hover:border-blue-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${userRole === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-800">총괄 관리자</div>
                  <div className="text-[10px] text-gray-500 font-medium">모든 현장 제어 및 설정 권한</div>
                </div>
              </button>

              <div className={`p-4 rounded-2xl border-2 transition-all ${userRole === 'manager' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 focus-within:border-blue-200'}`}>
                <button 
                  onClick={() => {
                    setUserRole('manager');
                    setPasswordInput('');
                    setPasswordError(false);
                  }}
                  className="w-full flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${userRole === 'manager' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800">현장 담당자</div>
                    <div className="text-[10px] text-gray-500 font-medium">지정된 현장의 자산만 관리</div>
                  </div>
                </button>

                {userRole === 'manager' && (
                  <div className="mt-4 pt-4 border-t border-blue-100">
                    <label className="block text-[10px] uppercase font-bold text-blue-600 mb-2">담당 현장 선택</label>
                    <select 
                      value={userSiteId || ''}
                      onChange={(e) => {
                        setUserSiteId(e.target.value);
                        setPasswordInput('');
                        setPasswordError(false);
                      }}
                      className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-3"
                    >
                      <option value="">현장을 선택하세요...</option>
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {userRole === 'admin' ? '관리자 비밀번호' : '현장 비밀번호'}
                  </label>
                  {userRole === 'admin' && (
                    <button 
                      onClick={() => setIsAdminPassModalOpen(true)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      비밀번호 변경
                    </button>
                  )}
                </div>
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  placeholder="비밀번호를 입력하세요"
                  className={`w-full bg-gray-50 border ${passwordError ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-200'} rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-center tracking-[0.5em] font-bold`}
                />
                {passwordError && (
                  <p className="text-[10px] text-red-500 mt-1.5 text-center font-bold">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50">
              <button 
                onClick={() => {
                  if (userRole === 'admin') {
                    if (passwordInput === adminPass) {
                      setIsVerified(true);
                      sessionStorage.setItem('is_verified', 'true');
                      setIsRoleModalOpen(false);
                      setPasswordInput('');
                      setPasswordError(false);
                      localStorage.setItem('user_role', 'admin');
                      setSelectedSiteId('all');
                    } else {
                      setPasswordError(true);
                    }
                  } else {
                    if (!userSiteId) {
                      alert('현장 담당자는 반드시 담당 현장을 지정해야 합니다.');
                      return;
                    }
                    const site = sites.find(s => s.id === userSiteId);
                    if (site && passwordInput === (site.password || '1111')) {
                      setIsVerified(true);
                      sessionStorage.setItem('is_verified', 'true');
                      setIsRoleModalOpen(false);
                      setPasswordInput('');
                      setPasswordError(false);
                      localStorage.setItem('user_role', 'manager');
                      localStorage.setItem('user_site_id', userSiteId);
                    } else {
                      setPasswordError(true);
                    }
                  }
                }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 shadow-xl transition-all"
              >
                비밀번호 확인 및 접속
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* App Share Center Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">앱 접속 및 공유</h3>
              <p className="text-sm text-gray-500 mt-2">현장 담당자들에게 시스템 접속 주소를 공유하세요.</p>
            </div>
            
              <div className="p-6 space-y-6">
                {window.location.hostname.includes('ais-dev') && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-2">
                    <div className="flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-red-800 font-bold uppercase tracking-tight">개발용 주소 주의</p>
                        <p className="text-[10px] text-red-700 leading-relaxed font-medium mt-0.5">
                          현재 URL은 <span className="font-bold underline text-red-800">개발 전용</span>입니다. 다른 사람에게 공유하려면 AI Studio 우측 상단의 <span className="font-bold">Share</span> 버튼을 통해 생성된 <span className="font-bold text-red-800">Shared App URL</span>을 사용해야 403 오류가 발생하지 않습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="p-4 bg-white border-4 border-blue-50 rounded-2xl shadow-inner group relative">
                    <QRCodeCanvas 
                      value={window.location.origin + window.location.pathname}
                      size={160}
                      level="H"
                      includeMargin={false}
                    />
                    {window.location.hostname.includes('ais-dev') && (
                      <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                        <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded shadow-sm flex items-center gap-1">
                          <X className="w-2.5 h-2.5" /> DEV ONLY
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-[10px] font-bold">
                    <QrCode className="w-3 h-3" /> QR 코드로 빠른 접속
                  </div>
                </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">시스템 접속 주소</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    readOnly
                    value={window.location.origin + window.location.pathname}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono text-gray-600 truncate"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                      alert('주소가 복사되었습니다.');
                    }}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    title="주소 복사"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                    현장 담당자들에게 이 주소를 전달하면, 각자의 현장 비밀번호를 입력하여 시스템에 접속할 수 있습니다.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 shadow-xl transition-all"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* App Name Edit Modal */}
      {isAppNameModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Edit2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">앱 이름 변경</h3>
              <p className="text-sm text-gray-500 mt-2">시스템 상단에 표시될 이름을 설정하세요.</p>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newName = formData.get('newName') as string;
                const newSubName = formData.get('newSubName') as string;
                
                try {
                  setIsSyncing(true);
                  await updateDoc(doc(db, 'settings', 'admin'), { 
                    appName: newName,
                    appSubName: newSubName
                  });
                  setIsAppNameModalOpen(false);
                  alert('앱 이름이 성공적으로 변경되었습니다.');
                } catch (e) {
                  alert('변경에 실패했습니다.');
                } finally {
                  setIsSyncing(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">메인 타이틀 (예: 업체명)</label>
                <input 
                  name="newName"
                  type="text"
                  required
                  defaultValue={appName}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">서브 타이틀 (예: 시스템명)</label>
                <input 
                  name="newSubName"
                  type="text"
                  required
                  defaultValue={appSubName}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAppNameModalOpen(false)}
                  className="py-4 border border-gray-200 rounded-2xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-xl transition-all"
                >
                  변경 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Admin Password Edit Modal */}
      {isAdminPassModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Settings2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">관리자 비밀번호 변경</h3>
              <p className="text-sm text-gray-500 mt-2">새로운 관리자 마스터 비밀번호를 설정하세요.</p>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newPass = formData.get('newPass') as string;
                const confirmPass = formData.get('confirmPass') as string;
                
                if (newPass !== confirmPass) {
                  alert('비밀번호가 서로 일치하지 않습니다.');
                  return;
                }
                
                setAdminPass(newPass);
                localStorage.setItem('admin_master_pass', newPass);
                setIsAdminPassModalOpen(false);
                alert('관리자 비밀번호가 성공적으로 변경되었습니다.');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">새 비밀번호</label>
                <input 
                  name="newPass"
                  type="password"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">비밀번호 확인</label>
                <input 
                  name="confirmPass"
                  type="password"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAdminPassModalOpen(false)}
                  className="py-4 border border-gray-200 rounded-2xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-xl transition-all"
                >
                  변경 완료
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'available':
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-green-700">
          <CheckCircle2 className="w-3 h-3" /> AVAILABLE
        </span>
      );
    case 'in_transit':
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
          <Truck className="w-3 h-3" /> IN TRANSIT
        </span>
      );
    case 'damaged':
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600">
          <AlertCircle className="w-3 h-3" /> DAMAGED
        </span>
      );
    case 'lost':
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
          <X className="w-3 h-3" /> LOST
        </span>
      );
    case 'disposed':
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
          <Box className="w-3 h-3" /> DISPOSED
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-bold opacity-40 uppercase">{status}</span>
      );
  }
}

function ArrowRight(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  );
}
