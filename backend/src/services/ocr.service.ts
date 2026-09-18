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

    // 1. Try Gemini Vision if API key is provided
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      try {
        const geminiResult = await this.scanWithGemini(cleanBase64, geminiKey);
        if (geminiResult && (geminiResult.amount || geminiResult.merchant)) {
          return geminiResult;
        }
      } catch (e) {
        console.warn('Gemini OCR fallback failed, falling back to standard OCR:', e);
      }
    }

    // 2. Fallback to Free OCR Engine (OCR.space)
    let extractedText = '';
    try {
      extractedText = await this.callOcrSpace(cleanBase64);
    } catch (e) {
      console.warn('OCR.space call failed:', e);
    }

    // 3. Parse receipt text with specialized retail regex
    return this.parseReceiptText(extractedText);
  }

  /**
   * Calls Google Gemini Vision for intelligent structured receipt parsing
   */
  private static async scanWithGemini(base64Image: string, apiKey: string): Promise<ParsedReceiptData | null> {
    const modelsToTry = [
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ].filter(Boolean) as string[];

    const prompt = `Analyze this physical paper receipt image.
Extract:
1. "merchant": the clean store name (e.g., Savemore, Jollibee, McDonald's, 7-Eleven, Puregold, SM Supermarket, Mercury Drug, Petron, Shell).
2. "amount": the FINAL TOTAL amount due or paid as a numeric number (float/int). Do NOT use single item price, cash tendered, change, or subtotal.
3. "category": one of: "Food & Dining Out", "Groceries & Supermarket", "Transportation", "Bills & Utilities", "Entertainment", "Personal Care", or "Other Expense".
4. "paymentMethod": one of: "CASH", "GCASH", "MAYA", "CREDIT_CARD", or "OTHER".
Return strictly valid JSON with keys: merchant, amount, category, paymentMethod.`;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini model ${model} HTTP ${response.status}:`, errText.substring(0, 150));
          continue;
        }

        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        const parsedAmount = typeof parsed.amount === 'number' ? parsed.amount : (parseFloat(parsed.amount) || null);
        let pm: 'CASH' | 'GCASH' | 'MAYA' | 'CREDIT_CARD' | 'OTHER' = 'CASH';
        const pmUpper = (parsed.paymentMethod || '').toUpperCase();
        if (pmUpper.includes('GCASH')) pm = 'GCASH';
        else if (pmUpper.includes('MAYA')) pm = 'MAYA';
        else if (pmUpper.includes('CARD') || pmUpper.includes('VISA') || pmUpper.includes('MASTER') || pmUpper.includes('DEBIT')) pm = 'CREDIT_CARD';
        else if (pmUpper.includes('CASH')) pm = 'CASH';

        if (parsedAmount || parsed.merchant) {
          return {
            success: true,
            amount: parsedAmount,
            merchant: parsed.merchant || null,
            category: parsed.category || 'Groceries & Supermarket',
            paymentMethod: pm,
            rawText: text,
            notes: `Extracted via Gemini AI Vision (${model})`,
          };
        }
      } catch (err) {
        console.warn(`Gemini model ${model} attempt failed:`, err);
      }
    }
    return null;
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
      /(?:total\s*(?:due|amount|sales|bill)?|grand\s*total|amount\s*due|net\s*total)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
      /\btotal\b\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
      /(?:subtotal|sub\s*total)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
      /(?:cash\s*tendered|tendered)\s*[:=]?\s*(?:php|p|₱)?\s*([0-9,]+\.[0-9]{2})/i,
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
