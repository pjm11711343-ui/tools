/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Site {
  id: string;
  name: string;
  location?: string;
  password?: string;
  order?: number;
}

export type ToolStatus = 'available' | 'in_transit' | 'damaged' | 'lost' | 'disposed';

export interface Tool {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  currentSiteId: string;
  status: ToolStatus;
  lastUpdated: string;
  imageUrl?: string;
  unit: string;
  quantity: number;
  notes?: string;
}

export type TransferType = 'in' | 'out';

export type RequestType = 'transfer' | 'delete';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  toolId: string;
  toolName: string;
  requestedSiteId: string;
  targetSiteId?: string; // for transfer
  quantity: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export interface TransferHistory {
  id: string;
  toolId: string;
  toolName: string;
  fromSiteId: string;
  toSiteId: string;
  date: string;
  type: TransferType;
  notes?: string;
  recordedBy: string;
  quantity: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  important: boolean;
}
