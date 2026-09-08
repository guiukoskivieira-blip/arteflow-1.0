export interface OrcagrafQuoteItem {
  id?: string;
  productName: string;
  category?: string;
  sector?: string;
  width?: number;
  height?: number;
  unit?: 'mm' | 'cm' | 'm';
  quantity: number;
  quantityUnit?: string;
  unitPriceCents: number;
  totalPriceCents: number;
  finishings?: string[];
  technicalNotes?: string;
}

export interface OrcagrafQuote {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerContactPerson?: string;
  totalAmountCents: number;
  deliveryDate?: string;
  notes?: string;
  sellerId?: string;
  sellerName?: string;
  sellerCommissionPct?: number;
  sellerCommissionAmountCents?: number;
  approvedAt?: string;
  itemCount: number;
  items: OrcagrafQuoteItem[];
}

export interface OrcagrafEntitlementStatus {
  isEntitled: boolean;
  hasUserAccess: boolean;
  canImport: boolean;
  reason?: string;
}
