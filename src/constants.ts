/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Site } from './types';

export const SITES: Site[] = [
  { id: 'site-1', name: '서울 본사 현장', password: '1111' },
  { id: 'site-2', name: '경기 판교 테크노', password: '1111' },
  { id: 'site-3', name: '인천 송도 국제', password: '1111' },
  { id: 'site-4', name: '대전 과학 관리', password: '1111' },
  { id: 'site-5', name: '부산 해운대 거점', password: '1111' },
  { id: 'site-6', name: '광주 한남 단지', password: '1111' },
  { id: 'site-7', name: '울산 국가 산업', password: '1111' },
  { id: 'site-8', name: '강원 춘천 테마', password: '1111' },
  { id: 'site-9', name: '제주 정보 기술', password: '1111' },
  { id: 'site-10', name: '세종 정부 종합', password: '1111' },
];

export const APP_VERSION = '1.2.3';

export const CATEGORIES = [
  '전동공구',
  '충전공구',
  '측정장비',
  '안전장비',
  '수동공구',
  '유압장비',
  '배터리/충전기',
];

export const INITIAL_TOOLS = [
  {
    id: 'tool-1',
    name: '해머 드릴 (Hilti TE 70)',
    serialNumber: 'SN-001234',
    category: '전동공구',
    currentSiteId: 'site-1',
    status: 'available',
    lastUpdated: new Date().toISOString(),
    unit: '대',
    quantity: 1,
  },
  {
    id: 'tool-2',
    name: '레이저 레벨기 (Bosch GLL 3-80)',
    serialNumber: 'SN-005678',
    category: '측정장비',
    currentSiteId: 'site-1',
    status: 'available',
    lastUpdated: new Date().toISOString(),
    unit: '대',
    quantity: 1,
  },
  {
    id: 'tool-3',
    name: '임팩트 드라이버 (Makita DTD171)',
    serialNumber: 'SN-009012',
    category: '전동공구',
    currentSiteId: 'site-2',
    status: 'available',
    lastUpdated: new Date().toISOString(),
    unit: '대',
    quantity: 1,
  },
];
