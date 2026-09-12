/**
 * Receipt OCR Scanner Service
 * Extracts merchant, total amount, category, and payment method from physical receipts.
 */

export interface ParsedReceiptData {
  success: boolean;
  amount: number | null;
  merchant: string | null;
  category: string;
  paymentMethod: 'CASH' | 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'OTHER';
  rawText?: string;
  notes?: string;
}

export class OCRService {
  /**
   * Scans a base64 encoded receipt image using OCR and extracts financial metadata.
   */
  static async scanReceipt(base64Image: string): Promise<ParsedReceiptData> {
    // Clean base64 string
    const cleanBase64 = base64Image.includes('base64,')
      ? base64Image.split('base64,')[1]
      : base64Image;

    let extractedText = '';

    // 1. Try Gemini Vision if API key is provided
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      try {
        extractedText = await this.callGeminiVision(cleanBase64, geminiKey);
      } catch (e) {
        console.warn('Gemini OCR fallback failed, falling back to standard OCR:', e);
      }
    }

    // 2. If Gemini didn't run or returned empty, call Free OCR Engine (OCR.space)
    if (!extractedText) {
      try {
        extractedText = await this.callOcrSpace(cleanBase64);
      } catch (e) {
        console.warn('OCR.space call failed:', e);
      }
    }

    // 3. Parse receipt text with specialized retail regex
    return this.parseReceiptText(extractedText);
  }

  /**
   * Calls Google Gemini Vision for intelligent receipt understanding
   */
  private static async callGeminiVision(base64Image: string, apiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Extract all text from this receipt. Include merchant name, all line items, totals, subtotal, VAT, cash/card payment method, and date.',
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate || '';
  }

  /**
   * Calls Free OCR.space engine
   */
  private static async callOcrSpace(base64Image: string): Promise<string> {
    const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
    const form = new URLSearchParams();
    form.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    form.append('apikey', apiKey);
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(`OCR.space error ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed');
    }

    const results = data.ParsedResults || [];
    return results.map((r: any) => r.ParsedText || '').join('\n');
  }

  /**
   * Extracts merchant, total amount, category, and payment method from raw OCR text
   */
  private static parseReceiptText(text: string): ParsedReceiptData {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        amount: null,
        merchant: null,
        category: 'Food & Dining Out',
        paymentMethod: 'CASH',
        notes: 'Could not read text clearly from photo. Please ensure receipt is well-lit and flat.',
      };
    }

    const lower = text.toLowerCase();

    // 1. Identify Merchant
    let merchant: string | null = null;
    let suggestedCategory = 'Food & Dining Out';

    const merchantPatterns: Array<{ name: string; regex: RegExp; category: string }> = [
      // Fast Food / Restaurants
      { name: 'Jollibee', regex: /jollibee/i, category: 'Food & Dining Out' },
      { name: "McDonald's", regex: /mc\s*donald'?s|golden arches/i, category: 'Food & Dining Out' },
      { name: 'KFC', regex: /\bkfc\b|kentucky/i, category: 'Food & Dining Out' },
      { name: 'Chowking', regex: /chowking/i, category: 'Food & Dining Out' },
      { name: 'Mang Inasal', regex: /mang inasal/i, category: 'Food & Dining Out' },
      { name: 'Greenwich', regex: /greenwich/i, category: 'Food & Dining Out' },
      { name: 'Burger King', regex: /burger king/i, category: 'Food & Dining Out' },
      { name: 'Starbucks', regex: /starbucks/i, category: 'Food & Dining Out' },
      { name: 'Dunkin', regex: /dunkin/i, category: 'Food & Dining Out' },
      { name: 'Bonchon', regex: /bonchon/i, category: 'Food & Dining Out' },
      { name: 'Popeyes', regex: /popeyes/i, category: 'Food & Dining Out' },
      { name: 'Shakey', regex: /shakey'?s/i, category: 'Food & Dining Out' },
      { name: 'Pizza Hut', regex: /pizza hut/i, category: 'Food & Dining Out' },
      { name: 'Kenny Rogers', regex: /kenny rogers/i, category: 'Food & Dining Out' },
      
      // Convenience & Groceries
      { name: '7-Eleven', regex: /7\s*-\s*eleven|philippine seven/i, category: 'Groceries & Supermarket' },
      { name: 'Uncle John', regex: /uncle john'?s|ministop/i, category: 'Groceries & Supermarket' },
      { name: 'Alfamart', regex: /alfamart/i, category: 'Groceries & Supermarket' },
      { name: 'Lawson', regex: /lawson/i, category: 'Groceries & Supermarket' },
      { name: 'FamilyMart', regex: /familymart/i, category: 'Groceries & Supermarket' },
      { name: 'SM Supermarket', regex: /sm\s*(?:supermarket|hypermarket|retail|store|savemore)/i, category: 'Groceries & Supermarket' },
      { name: 'Savemore', regex: /savemore/i, category: 'Groceries & Supermarket' },
      { name: 'Puregold', regex: /puregold/i, category: 'Groceries & Supermarket' },
      { name: 'Robinsons Supermarket', regex: /robinsons\s*(?:supermarket|retail)/i, category: 'Groceries & Supermarket' },
      { name: 'Landers', regex: /landers\s*superstore/i, category: 'Groceries & Supermarket' },
      { name: 'S&R', regex: /s\s*&\s*r\s*membership/i, category: 'Groceries & Supermarket' },
      { name: 'Mercury Drug', regex: /mercury drug/i, category: 'Groceries & Supermarket' },
      { name: 'Watsons', regex: /watsons/i, category: 'Groceries & Supermarket' },

      // Gas / Fuel
      { name: 'Petron', regex: /petron/i, category: 'Transportation' },
      { name: 'Shell', regex: /\bshell\b|pilipinas shell/i, category: 'Transportation' },
      { name: 'Caltex', regex: /caltex/i, category: 'Transportation' },
      { name: 'Seaoil', regex: /seaoil/i, category: 'Transportation' },
      { name: 'Phoenix Petroleum', regex: /phoenix petroleum/i, category: 'Transportation' },
      { name: 'Cleanfuel', regex: /cleanfuel/i, category: 'Transportation' },
    ];

    for (const p of merchantPatterns) {
      if (p.regex.test(text)) {
        merchant = p.name;
        suggestedCategory = p.category;
        break;
      }
    }

    // Fallback merchant from top 3 non-empty lines if no brand matched
    if (!merchant) {
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2 && !/official receipt|sales invoice|tin|tax invoice/i.test(l));
      if (lines.length > 0) {
        merchant = lines[0].substring(0, 32);
      }
    }

    // 2. Extract Total Amount
    let amount: number | null = null;

    // Highest priority: "Total Due", "Total Amount", "Grand Total", "Amount Due", "Net Total"
    const totalRegexes = [
      /(?:total\s*(?:due|amount|sales|bill)?|grand\s*total|amount\s*due|net\s*total|total)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
      /(?:total\s*(?:due|amount|sales|bill)?|grand\s*total|amount\s*due|net\s*total|total)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+)/i,
      /(?:cash\s*tendered|tendered|cash)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
      /(?:php|₱)\s*([0-9,]+\.[0-9]{2})/i,
    ];

    for (const reg of totalRegexes) {
      const match = text.match(reg);
      if (match && match[1]) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0 && num < 1000000) {
          amount = num;
          break;
        }
      }
    }

    // 3. Identify Payment Method
    let paymentMethod: 'CASH' | 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'OTHER' = 'CASH';
    if (lower.includes('gcash')) {
      paymentMethod = 'GCASH';
    } else if (lower.includes('maya') || lower.includes('paymaya')) {
      paymentMethod = 'MAYA';
    } else if (lower.includes('visa') || lower.includes('mastercard') || lower.includes('debit') || lower.includes('credit card')) {
      paymentMethod = 'CREDIT_CARD';
    } else if (lower.includes('cash')) {
      paymentMethod = 'CASH';
    }

    return {
      success: !!amount || !!merchant,
      amount,
      merchant,
      category: suggestedCategory,
      paymentMethod,
      rawText: text.substring(0, 800),
    };
  }
}
