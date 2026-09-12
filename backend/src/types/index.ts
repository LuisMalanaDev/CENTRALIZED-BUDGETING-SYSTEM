export interface JwtPayload {
  userId: string;
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export interface ParsedTransactionDraft {
  description: string;
  amount: number;
  date: string;
  paymentMethod: 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER';
  source: string;
  tags: string[];
  suggestedCategorySlug: string;
  isShopeeOrder: boolean;
  orderTrackingNumber?: string;
  rawText?: string;
}

export interface ParseImportResult {
  parsedItems: ParsedTransactionDraft[];
  totalCount: number;
  totalAmount: number;
  detectedSources: string[];
}
