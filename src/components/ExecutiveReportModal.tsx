import { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  FileText, 
  Check, 
  Building2, 
  Calendar, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';
import { Tool, Site } from '../types';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: Tool[];
  sites: Site[];
  categories: string[];
  currentSiteId: string;
  userRole: 'admin' | 'manager';
}

export function ExecutiveReportModal({
  isOpen,
  onClose,
  tools,
  sites,
  categories,
  currentSiteId,
  userRole
}: ExecutiveReportModalProps) {
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}년 ${mm}월 ${dd}일`;
  }, []);

  const defaultDocNo = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `AST-${yyyy}${mm}${dd}-001`;
  }, []);

  const [selectedReportSiteId, setSelectedReportSiteId] = useState<string>(
    currentSiteId === 'all' ? 'all' : currentSiteId
  );
  const [reportTitle, setReportTitle] = useState(
    '【대표이사 보고용】 전사 공구·장비 자산 보유 및 가동 현황 종합 보고서'
  );
  const [reporterName, setReporterName] = useState('박정민 이사');
  const [reporterDept, setReporterDept] = useState('자재부');

  // Unique list of all available categories
  const allCategories = useMemo(() => {
    const set = new Set<string>(categories);
    tools.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).filter(Boolean);
  }, [categories, tools]);

  // Selected categories list (defaults to all categories, can be individually toggled)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const set = new Set<string>(categories);
    tools.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).filter(Boolean);
  });

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories([...allCategories]);
  };

  const deselectAllCategories = () => {
    setSelectedCategories([]);
  };

  const selectedCategorySummary = useMemo(() => {
    if (selectedCategories.length === 0) return '선택된 카테고리 없음 (0개)';
    if (selectedCategories.length === allCategories.length) {
      return `전체 카테고리 (${allCategories.length}개 분야 전체)`;
    }
    return `${selectedCategories.join(', ')} (총 ${selectedCategories.length}개 선택)`;
  }, [selectedCategories, allCategories]);

  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'recent' | 'category'>('category');
  const [includeDisposed, setIncludeDisposed] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [executiveNotes, setExecutiveNotes] = useState(
    '1. 전사 공구 및 핵심 시공 장비에 대한 일제 실사 결과, 주요 자산이 정상 가동 상태로 양호하게 관리되고 있습니다.\n' +
    '2. 점검 및 정비가 요망되는 자산에 대해서는 전문 수리업체 위탁 및 부품 교체를 즉각 시행하여 현장 공정 일정에 차질이 없도록 조치하겠습니다.\n' +
    '3. 현장 간 빈번한 자산 이동에 따른 분실 및 훼손을 사전 예방하기 위해 반출·반입 전자인계 시스템 및 정기 재물조사를 철저히 이행하겠습니다.'
  );

  // Filter tools for the report (only selected categories)
  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchSite = selectedReportSiteId === 'all' || t.currentSiteId === selectedReportSiteId;
      const cat = t.category || '기타';
      const matchCat = selectedCategories.includes(cat);
      const matchDisposed = includeDisposed ? true : t.status !== 'disposed';
      return matchSite && matchCat && matchDisposed;
    });
  }, [tools, selectedReportSiteId, selectedCategories, includeDisposed]);

  // Sort tools
  const sortedReportTools = useMemo(() => {
    return [...filteredTools].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ko');
      } else if (sortBy === 'quantity') {
        return (b.quantity || 1) - (a.quantity || 1);
      } else if (sortBy === 'recent') {
        return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
      } else {
        // category
        const catCompare = (a.category || '').localeCompare(b.category || '', 'ko');
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name, 'ko');
      }
    });
  }, [filteredTools, sortBy]);

  // KPIs
  const totalItemModels = sortedReportTools.length;
  const totalQuantity = useMemo(() => {
    return sortedReportTools.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  }, [sortedReportTools]);

  const availableQuantity = useMemo(() => {
    return sortedReportTools
      .filter(t => t.status === 'available')
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  }, [sortedReportTools]);

  const damagedQuantity = useMemo(() => {
    return sortedReportTools
      .filter(t => t.status === 'damaged')
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  }, [sortedReportTools]);

  const inTransitQuantity = useMemo(() => {
    return sortedReportTools
      .filter(t => t.status === 'in_transit')
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  }, [sortedReportTools]);

  const operatingRate = totalQuantity > 0 
    ? ((availableQuantity / totalQuantity) * 100).toFixed(1) 
    : '0.0';

  const damagedRate = totalQuantity > 0 
    ? ((damagedQuantity / totalQuantity) * 100).toFixed(1) 
    : '0.0';

  // Category Breakdown
  const categoryStats = useMemo(() => {
    const map: { 
      [cat: string]: { 
        models: number; 
        totalQty: number; 
        available: number; 
        damaged: number;
        inTransit: number; 
      } 
    } = {};

    sortedReportTools.forEach(t => {
      const cat = t.category || '미분류';
      if (!map[cat]) {
        map[cat] = { models: 0, totalQty: 0, available: 0, damaged: 0, inTransit: 0 };
      }
      const qty = t.quantity || 1;
      map[cat].models += 1;
      map[cat].totalQty += qty;
      if (t.status === 'available') map[cat].available += qty;
      if (t.status === 'damaged') map[cat].damaged += qty;
      if (t.status === 'in_transit') map[cat].inTransit += qty;
    });

    return Object.entries(map).sort((a, b) => b[1].totalQty - a[1].totalQty);
  }, [sortedReportTools]);

  // Site Distribution Breakdown
  const siteStats = useMemo(() => {
    const map: { [siteId: string]: { name: string; totalQty: number; availableQty: number; damagedQty: number } } = {};
    sortedReportTools.forEach(t => {
      const sId = t.currentSiteId || 'unknown';
      if (!map[sId]) {
        const s = sites.find(item => item.id === sId);
        map[sId] = { name: s?.name || '현장 미지정', totalQty: 0, availableQty: 0, damagedQty: 0 };
      }
      const qty = t.quantity || 1;
      map[sId].totalQty += qty;
      if (t.status === 'available') map[sId].availableQty += qty;
      if (t.status === 'damaged') map[sId].damagedQty += qty;
    });
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }, [sortedReportTools, sites]);

  const targetSiteName = useMemo(() => {
    if (selectedReportSiteId === 'all') return '전사 통합 (전 현장)';
    return sites.find(s => s.id === selectedReportSiteId)?.name || '선택 현장';
  }, [selectedReportSiteId, sites]);

  // Copy Executive Summary
  const handleCopySummary = () => {
    const summaryText = `[보고] 대표이사 보고용 공구·장비 자산 보유 현황 요약
문서번호: ${defaultDocNo}
보고일자: ${todayStr}
보고부서: ${reporterDept}
보 고 자: ${reporterName}
보고대상: ${targetSiteName}
보고범위: ${selectedCategorySummary}
결재라인: 담당 → 팀장 → 임원 → 대표이사

--------------------------------------------------
■ 핵심 지표 요약 (Executive KPI)
- 총 보유 수량: ${totalQuantity}개 (${totalItemModels}개 품목)
- 정상 가동 자산: ${availableQuantity}개 (가동률 ${operatingRate}%)
- 점검/정비 요망: ${damagedQuantity}개 (정비율 ${damagedRate}%)
- 현장 간 이동중: ${inTransitQuantity}개

--------------------------------------------------
■ 카테고리별 자산 집계
${categoryStats.map(([cat, stat]) => `• ${cat}: 총 ${stat.totalQty}개 (정상: ${stat.available}개, 수리: ${stat.damaged}개)`).join('\n')}

--------------------------------------------------
■ 주요 현장별 배치
${siteStats.map(s => `• ${s.name}: ${s.totalQty}개 보유 (가동: ${s.availableQty}개)`).join('\n')}

--------------------------------------------------
■ 종합 관리 의견
${executiveNotes}
`;

    navigator.clipboard.writeText(summaryText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = '\ufeff';
    csv += `대표이사 보고용 공구 자산 현황 보고서\n`;
    csv += `문서번호,${defaultDocNo},보고일자,${todayStr}\n`;
    csv += `기안부서,${reporterDept},기안자,${reporterName}\n`;
    csv += `결재라인,담당,팀장,임원,대표이사\n`;
    csv += `보고대상,${targetSiteName},보고카테고리,"${selectedCategorySummary}"\n`;
    csv += `총수량,${totalQuantity}개,가동률,${operatingRate}%\n\n`;

    csv += `[1. 카테고리별 요약]\n`;
    csv += `카테고리,품목수,총보유수량,정상가동,점검수리요망,이동중,가동률\n`;
    categoryStats.forEach(([cat, stat]) => {
      const rate = stat.totalQty > 0 ? ((stat.available / stat.totalQty) * 100).toFixed(1) : '0';
      csv += `"${cat}",${stat.models},${stat.totalQty},${stat.available},${stat.damaged},${stat.inTransit},"${rate}%"\n`;
    });

    csv += `\n[2. 세부 공구·자산 실사 명세서]\n`;
    csv += `연번,카테고리,공구장비명,관리번호(S/N),규격단위,수량,배치현장,상태,최종점검일,관리비고\n`;
    sortedReportTools.forEach((tool, idx) => {
      const siteName = sites.find(s => s.id === tool.currentSiteId)?.name || '기타';
      const statusText = tool.status === 'available' ? '정상 가동' : tool.status === 'damaged' ? '점검/정비필요' : tool.status === 'in_transit' ? '이동중' : tool.status === 'lost' ? '분실' : '폐기';
      csv += `${idx + 1},"${tool.category}","${tool.name}","${tool.serialNumber}","${tool.unit}",${tool.quantity},"${siteName}","${statusText}","${tool.lastUpdated}","${(tool.notes || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `대표이사보고_공구자산현황_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // High Quality Executive Print
  const handlePrintReport = () => {
    const rowsHtml = sortedReportTools.map((t, idx) => {
      const sName = sites.find(s => s.id === t.currentSiteId)?.name || '기타';
      const statusText = t.status === 'available' 
        ? '<span style="color:#059669; font-weight:bold;">● 정상가동</span>' 
        : t.status === 'damaged' 
          ? '<span style="color:#dc2626; font-weight:bold;">▲ 점검/수리</span>' 
          : t.status === 'in_transit' 
            ? '<span style="color:#d97706;">■ 이동중</span>' 
            : t.status;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: 600; color: #334155;">${t.category || '-'}</td>
          <td style="padding: 6px 8px; font-weight: bold; color: #0f172a;">${t.name}</td>
          <td style="padding: 6px 8px; font-family: monospace; color: #475569;">${t.serialNumber}</td>
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${t.unit}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #1e3a8a;">${t.quantity}</td>
          <td style="padding: 6px 8px; color: #2563eb; font-weight: 500;">${sName}</td>
          <td style="padding: 6px 8px; text-align: center;">${statusText}</td>
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${t.lastUpdated ? new Date(t.lastUpdated).toLocaleDateString() : '-'}</td>
          <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">${t.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const categoryHtml = categoryStats.map(([cat, stat]) => {
      const rate = stat.totalQty > 0 ? ((stat.available / stat.totalQty) * 100).toFixed(1) : '0';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 10px; font-weight: bold; color: #1e293b;">${cat}</td>
          <td style="padding: 6px 10px; text-align: right;">${stat.models}개</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: bold; color: #0f172a;">${stat.totalQty}개</td>
          <td style="padding: 6px 10px; text-align: right; color: #059669; font-weight: bold;">${stat.available}개</td>
          <td style="padding: 6px 10px; text-align: right; color: ${stat.damaged > 0 ? '#dc2626' : '#64748b'}; font-weight: ${stat.damaged > 0 ? 'bold' : 'normal'};">${stat.damaged}개</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: bold; color: #2563eb;">${rate}%</td>
        </tr>
      `;
    }).join('');

    const printableHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <meta charset="UTF-8">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 15mm 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 20px;
              line-height: 1.4;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
            }
            .approval-table {
              border-collapse: collapse;
              margin-left: auto;
              text-align: center;
              font-size: 11px;
            }
            .approval-table th, .approval-table td {
              border: 1px solid #334155;
              padding: 4px 10px;
            }
            .approval-table th {
              background-color: #f1f5f9;
              font-weight: bold;
              width: 58px;
            }
            .approval-table td {
              height: 48px;
              vertical-align: middle;
            }
            .title-box {
              text-align: center;
              border-bottom: 2px double #0f172a;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .title-box h1 {
              font-size: 20px;
              font-weight: 800;
              margin: 0 0 6px 0;
              letter-spacing: -0.5px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 12px;
              margin-bottom: 16px;
              background-color: #f8fafc;
              padding: 10px 14px;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
            }
            .kpi-cards {
              display: flex;
              gap: 10px;
              margin-bottom: 20px;
            }
            .kpi-card {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px;
              background-color: #ffffff;
              text-align: center;
            }
            .kpi-card .label {
              font-size: 10px;
              font-weight: bold;
              color: #64748b;
              margin-bottom: 4px;
            }
            .kpi-card .val {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
            }
            .section-title {
              font-size: 13px;
              font-weight: bold;
              color: #1e293b;
              border-left: 4px solid #2563eb;
              padding-left: 8px;
              margin: 18px 0 8px 0;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            table.data-table th {
              background-color: #f1f5f9;
              border-top: 1.5px solid #0f172a;
              border-bottom: 1px solid #94a3b8;
              padding: 7px 8px;
              font-size: 11px;
              font-weight: bold;
              color: #1e293b;
              text-align: center;
            }
            .ceo-box {
              border: 1.5px solid #334155;
              border-radius: 4px;
              padding: 12px;
              margin-top: 20px;
              background-color: #fafaf9;
              page-break-inside: avoid;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 10px; font-weight: bold; color: #64748b;">문서번호: ${defaultDocNo}</div>
                <div style="font-size: 10px; color: #64748b;">보존연한: 5년 | 보안등급: 사내 대외비 (2등급)</div>
              </td>
              <td style="text-align: right;">
                <table class="approval-table">
                  <tr>
                    <th rowspan="2" style="width: 20px; background: #e2e8f0; font-size: 10px; padding: 2px;">결<br>재</th>
                    <th>담당</th>
                    <th>팀장</th>
                    <th>임원</th>
                    <th style="color: #1e40af;">대표이사</th>
                  </tr>
                  <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <div class="title-box">
            <h1>${reportTitle}</h1>
            <div style="font-size: 12px; color: #475569;">보고대상: <strong>${targetSiteName}</strong> | 작성일시: ${todayStr}</div>
          </div>

          <div class="meta-grid">
            <div><strong>기 안 부 서:</strong> ${reporterDept}</div>
            <div><strong>기 안 자:</strong> ${reporterName}</div>
            <div><strong>보고 대상 현장:</strong> ${targetSiteName}</div>
            <div><strong>실사 기준일:</strong> ${todayStr} 현재</div>
            <div style="grid-column: span 2;"><strong>보고 카테고리:</strong> ${selectedCategorySummary}</div>
          </div>

          <div class="kpi-cards">
            <div class="kpi-card">
              <div class="label">총 보유 수량</div>
              <div class="val" style="color: #1e3a8a;">${totalQuantity}<span style="font-size: 12px; font-weight: normal; margin-left: 2px;">개</span></div>
              <div style="font-size: 10px; color: #64748b;">(${totalItemModels}개 품목)</div>
            </div>
            <div class="kpi-card">
              <div class="label">정상 가동 자산</div>
              <div class="val" style="color: #059669;">${availableQuantity}<span style="font-size: 12px; font-weight: normal; margin-left: 2px;">개</span></div>
              <div style="font-size: 10px; color: #059669; font-weight: bold;">가동률 ${operatingRate}%</div>
            </div>
            <div class="kpi-card">
              <div class="label">점검 및 정비 요망</div>
              <div class="val" style="color: #dc2626;">${damagedQuantity}<span style="font-size: 12px; font-weight: normal; margin-left: 2px;">개</span></div>
              <div style="font-size: 10px; color: #dc2626;">정비율 ${damagedRate}%</div>
            </div>
            <div class="kpi-card">
              <div class="label">현장 간 이동중</div>
              <div class="val" style="color: #d97706;">${inTransitQuantity}<span style="font-size: 12px; font-weight: normal; margin-left: 2px;">개</span></div>
              <div style="font-size: 10px; color: #64748b;">배송/인수인계중</div>
            </div>
          </div>

          <div class="section-title">1. 카테고리별 자산 보유 및 가동 현황</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align: left;">카테고리 구분</th>
                <th style="text-align: right;">등록 품목수</th>
                <th style="text-align: right;">총 보유수량</th>
                <th style="text-align: right;">정상 가동</th>
                <th style="text-align: right;">점검/수리요망</th>
                <th style="text-align: right;">가동률</th>
              </tr>
            </thead>
            <tbody>
              ${categoryHtml}
            </tbody>
          </table>

          <div class="section-title">2. 세부 공구·장비 실사 명세표 (상세 내역 ${sortedReportTools.length}건)</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th style="text-align: left;">카테고리</th>
                <th style="text-align: left;">장비/공구명</th>
                <th>관리번호(S/N)</th>
                <th>단위</th>
                <th>수량</th>
                <th>배치현장</th>
                <th>상태</th>
                <th>점검일자</th>
                <th>특이사항/비고</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="section-title">3. 종합 관리 의견 및 유지보수 조치 계획</div>
          <div style="font-size: 11px; line-height: 1.6; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 4px; white-space: pre-line;">
${executiveNotes}
          </div>

          <div class="ceo-box">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
              <strong style="font-size: 12px; color: #1e3a8a;">【대표이사 재가 및 지시사항】</strong>
              <div style="font-size: 11px; font-weight: bold; color: #475569;">
                [ &nbsp; ] 결재 승인 &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 재검토 보완 &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 특별 실사 지시
              </div>
            </div>
            <div style="min-height: 45px; font-size: 11px; color: #64748b; padding-top: 4px;">
              지시사항: 
            </div>
            <div style="text-align: right; font-size: 11px; font-weight: bold; margin-top: 10px; color: #334155;">
              대표이사 서명/인: ___________________________ (2026. &nbsp;&nbsp;&nbsp;&nbsp;. &nbsp;&nbsp;&nbsp;&nbsp;.)
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 600);
            };
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-hidden">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-[94vh] overflow-hidden border border-slate-200"
      >
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-white shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 px-2 py-0.5 rounded">
                  Executive Report
                </span>
                <span className="text-xs text-slate-400 font-mono">{defaultDocNo}</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight mt-0.5">
                대표이사 보고용 공구·장비 자산 보고서
              </h2>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrintReport}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="A4 인쇄 또는 PDF 저장"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">인쇄 / PDF 출력</span>
            </button>

            <button 
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              title="엑셀(CSV) 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">엑셀 다운로드</span>
            </button>

            <button 
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              title="메신저/이메일용 요약 텍스트 복사"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isCopied ? '복사됨' : '요약 복사'}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 sm:px-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Target Site Selector */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-600 text-[11px]">보고 대상:</span>
              <select
                value={selectedReportSiteId}
                onChange={(e) => setSelectedReportSiteId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">전사 통합 (전체 현장)</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600 text-[11px]">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="category">카테고리순</option>
                <option value="name">공구명순</option>
                <option value="quantity">수량순</option>
                <option value="recent">최근 업데이트순</option>
              </select>
            </div>

            {/* Include Disposed Checkbox */}
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={includeDisposed}
                onChange={(e) => setIncludeDisposed(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0"
              />
              폐기 자산 포함
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">
              실사 집계: <strong className="text-blue-600">{sortedReportTools.length}개</strong> 품목 ({totalQuantity}개)
            </span>
          </div>
        </div>

        {/* Category Multi-Selection Bar */}
        <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 text-xs shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-800 text-xs">보고 대상 카테고리 선택:</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                selectedCategories.length === 0
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : selectedCategories.length === allCategories.length
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}>
                {selectedCategories.length === 0
                  ? '선택 없음 (0개)'
                  : selectedCategories.length === allCategories.length
                    ? `전체 선택됨 (${allCategories.length}개)`
                    : `${selectedCategories.length} / ${allCategories.length}개 선택됨`}
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (원하는 카테고리를 클릭하여 선택한 항목만 보고서에 포함됩니다)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAllCategories}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={deselectAllCategories}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                선택 해제
              </button>
            </div>
          </div>

          {/* Category Pills/Chips */}
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map(cat => {
              const isSelected = selectedCategories.includes(cat);
              const toolCount = tools.filter(t => 
                (t.category || '기타') === cat && 
                (selectedReportSiteId === 'all' || t.currentSiteId === selectedReportSiteId) &&
                (includeDisposed ? true : t.status !== 'disposed')
              ).length;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border select-none ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-1 ring-blue-400/30'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                  title={`${cat} (품목 ${toolCount}개) - 클릭하여 ${isSelected ? '해제' : '선택'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'border border-slate-400 text-transparent'
                  }`}>
                    ✓
                  </span>
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {toolCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Report Document Body Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60">
          {/* Formal Paper Container */}
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-10 space-y-6">
            {/* Document Header & Approval Box */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 font-mono tracking-wide">
                  문서번호: {defaultDocNo}
                </div>
                <div className="text-[11px] text-slate-500">
                  보존연한: 5년 | 보안등급: 사내 대외비 (2등급)
                </div>
              </div>

              {/* Approval Stamp Table */}
              <div className="shrink-0">
                <table className="border-collapse text-center text-xs border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th rowSpan={2} className="w-6 p-1 bg-slate-200 border border-slate-700 font-bold text-[10px] leading-tight">
                        결<br />재
                      </th>
                      <th className="w-16 py-1 px-2 border border-slate-700 font-bold text-[11px]">담당</th>
                      <th className="w-16 py-1 px-2 border border-slate-700 font-bold text-[11px]">팀장</th>
                      <th className="w-16 py-1 px-2 border border-slate-700 font-bold text-[11px]">임원</th>
                      <th className="w-18 py-1 px-2 border border-slate-700 font-bold text-[11px] text-blue-700 bg-blue-50/50">
                        대표이사
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-12 text-slate-300">
                      <td className="border border-slate-700"></td>
                      <td className="border border-slate-700"></td>
                      <td className="border border-slate-700"></td>
                      <td className="border border-slate-700 bg-blue-50/20"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Title & Meta */}
            <div className="text-center py-2 space-y-2">
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full text-center text-xl sm:text-2xl font-black text-slate-900 border-b-2 border-slate-800 pb-2 focus:outline-none focus:border-blue-600 tracking-tight"
              />
              <div className="text-xs text-slate-500 flex flex-wrap justify-center items-center gap-3">
                <span>보고일자: <strong>{todayStr}</strong></span>
                <span>•</span>
                <span>대상: <strong className="text-blue-600">{targetSiteName}</strong></span>
              </div>
            </div>

            {/* Reporter Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold w-16">기안부서:</span>
                <input 
                  type="text"
                  value={reporterDept}
                  onChange={(e) => setReporterDept(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 flex-1 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold w-16">기안자:</span>
                <input 
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 flex-1 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-slate-500 font-bold w-16 shrink-0">보고범위:</span>
                <div className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-semibold truncate flex items-center justify-between gap-2">
                  <span className="truncate">{selectedCategorySummary}</span>
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-mono shrink-0">
                    {selectedCategories.length}/{allCategories.length} 선택
                  </span>
                </div>
              </div>
            </div>

            {/* Executive KPIs */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Ⅰ. 핵심 자산 현황 요약 (Executive Summary)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">총 보유 수량</div>
                  <div className="text-xl font-extrabold text-blue-900">{totalQuantity}<span className="text-xs font-normal text-slate-500 ml-0.5">개</span></div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{totalItemModels}개 품목 모델</div>
                </div>
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 text-center">
                  <div className="text-[10px] font-bold text-emerald-800 mb-1">정상 가동 자산</div>
                  <div className="text-xl font-extrabold text-emerald-600">{availableQuantity}<span className="text-xs font-normal text-emerald-700 ml-0.5">개</span></div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">가동률 {operatingRate}%</div>
                </div>
                <div className="bg-red-50/60 p-3 rounded-xl border border-red-200/80 text-center">
                  <div className="text-[10px] font-bold text-red-800 mb-1">점검 및 정비 필요</div>
                  <div className="text-xl font-extrabold text-red-600">{damagedQuantity}<span className="text-xs font-normal text-red-700 ml-0.5">개</span></div>
                  <div className="text-[10px] text-red-700 font-bold mt-0.5">정비율 {damagedRate}%</div>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 text-center">
                  <div className="text-[10px] font-bold text-amber-800 mb-1">현장 이동 진행중</div>
                  <div className="text-xl font-extrabold text-amber-600">{inTransitQuantity}<span className="text-xs font-normal text-amber-700 ml-0.5">개</span></div>
                  <div className="text-[10px] text-amber-700 font-medium mt-0.5">배송/인수인계중</div>
                </div>
              </div>
            </div>

            {/* Category Summary Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Ⅱ. 카테고리별 자산 보유 및 가동 상태
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">카테고리 구분</th>
                      <th className="p-2.5 text-right">보유 품목수</th>
                      <th className="p-2.5 text-right">총 보유 수량</th>
                      <th className="p-2.5 text-right text-emerald-700">정상 가동</th>
                      <th className="p-2.5 text-right text-red-700">점검/수리요망</th>
                      <th className="p-2.5 text-right text-blue-700">가동률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryStats.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                          선택된 카테고리가 없습니다. 상단 '보고 대상 카테고리 선택'에서 카테고리를 선택해 주세요.
                        </td>
                      </tr>
                    ) : (
                      categoryStats.map(([cat, stat]) => {
                        const rate = stat.totalQty > 0 ? ((stat.available / stat.totalQty) * 100).toFixed(1) : '0';
                        return (
                          <tr key={cat} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-bold text-slate-800">{cat}</td>
                            <td className="p-2.5 text-right text-slate-600">{stat.models}개</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{stat.totalQty}개</td>
                            <td className="p-2.5 text-right font-bold text-emerald-600">{stat.available}개</td>
                            <td className={`p-2.5 text-right font-bold ${stat.damaged > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {stat.damaged}개
                            </td>
                            <td className="p-2.5 text-right font-bold text-blue-600">{rate}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Asset Table */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Ⅲ. 세부 공구·장비 실사 명세서 (총 {sortedReportTools.length}개 품목)
                </h4>
                <span className="text-[11px] text-slate-400">정렬: {sortBy}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2 text-center w-10">No.</th>
                      <th className="p-2">카테고리</th>
                      <th className="p-2">공구/장비명</th>
                      <th className="p-2">관리번호(S/N)</th>
                      <th className="p-2 text-center">단위</th>
                      <th className="p-2 text-right">수량</th>
                      <th className="p-2">배치 현장</th>
                      <th className="p-2 text-center">상태</th>
                      <th className="p-2 text-center">점검일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {sortedReportTools.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          <p className="font-bold text-slate-700 text-xs">선택된 카테고리에 해당하는 공구·장비가 없습니다.</p>
                          <p className="text-[11px] text-slate-400 mt-1">상단에서 보고할 카테고리를 선택해 주세요.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedReportTools.map((tool, index) => {
                        const siteName = sites.find(s => s.id === tool.currentSiteId)?.name || '기타';
                        return (
                          <tr key={tool.id} className="hover:bg-slate-50/80 text-[11px]">
                            <td className="p-2 text-center text-slate-400">{index + 1}</td>
                            <td className="p-2 font-medium text-slate-600">{tool.category}</td>
                            <td className="p-2 font-bold text-slate-900">{tool.name}</td>
                            <td className="p-2 font-mono text-slate-500">{tool.serialNumber}</td>
                            <td className="p-2 text-center text-slate-500">{tool.unit}</td>
                            <td className="p-2 text-right font-bold text-blue-900">{tool.quantity}</td>
                            <td className="p-2 text-slate-700">{siteName}</td>
                            <td className="p-2 text-center">
                              {tool.status === 'available' && (
                                <span className="text-emerald-600 font-bold">정상</span>
                              )}
                              {tool.status === 'damaged' && (
                                <span className="text-red-600 font-bold">수리요망</span>
                              )}
                              {tool.status === 'in_transit' && (
                                <span className="text-amber-600 font-bold">이동중</span>
                              )}
                              {tool.status === 'lost' && (
                                <span className="text-slate-400 font-bold">분실</span>
                              )}
                              {tool.status === 'disposed' && (
                                <span className="text-slate-400 font-bold">폐기</span>
                              )}
                            </td>
                            <td className="p-2 text-center text-slate-400">
                              {tool.lastUpdated ? new Date(tool.lastUpdated).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comprehensive Notes and Action Plan */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Ⅳ. 종합 관리 의견 및 조치 계획 (대표이사 보고 메모)
              </h4>
              <textarea
                rows={3}
                value={executiveNotes}
                onChange={(e) => setExecutiveNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
              />
            </div>

            {/* CEO Directives Signoff Box */}
            <div className="border-2 border-slate-700 rounded-xl p-4 bg-stone-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-dashed border-slate-300 pb-2">
                <span className="font-extrabold text-xs text-blue-950">【대표이사 재가 및 지시사항】</span>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                    <span>결재 승인</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600" />
                    <span>보완 지시</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600" />
                    <span>특별 실사</span>
                  </label>
                </div>
              </div>
              <div className="min-h-12 text-xs text-slate-400 italic">
                (대표이사 결재란 또는 특별 지시사항 수기 기재 구역)
              </div>
              <div className="text-right text-xs font-bold text-slate-700 pt-2 border-t border-slate-200">
                대표이사 서명/인: ___________________________ ( &nbsp;&nbsp;&nbsp;&nbsp;년 &nbsp;&nbsp;월 &nbsp;&nbsp;일)
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            인쇄 시 A4 정규 결재 보고서 양식으로 자동 서식 지정되어 출력됩니다.
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrintReport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              보고서 인쇄 및 PDF 저장
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
