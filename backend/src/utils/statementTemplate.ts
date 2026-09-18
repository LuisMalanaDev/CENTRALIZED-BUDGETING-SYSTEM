export interface StatementTemplateData {
  accountHolder: string;
  email: string;
  currency: string;
  periodLabel: string;
  issuedDate: string;
  inflow: number;
  outflow: number;
  net: number;
  savingsRate: number;
  categories: Array<{ name: string; amount: number; percentage: number }>;
  transactions: Array<{
    date: string;
    type: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    account: string;
  }>;
  token?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

export function renderStatementHtml(data: StatementTemplateData): string {
  const sym = data.currency === 'USD' ? '$' : '₱';
  const stmtId = `WS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const csvParams = new URLSearchParams();
  if (data.token) csvParams.set('token', data.token);
  if (data.periodLabel) csvParams.set('label', data.periodLabel);
  if (data.startDate) csvParams.set('startDate', data.startDate);
  if (data.endDate) csvParams.set('endDate', data.endDate);
  if (data.timezone) csvParams.set('tz', data.timezone);
  const csvHref = `export-csv?${csvParams.toString()}`;

  const categoryRows = data.categories
    .map(
      (c) => `
      <div class="cat-item">
        <div class="cat-header">
          <span class="cat-name">${c.name}</span>
          <span class="cat-amt">${sym}${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} <small>(${c.percentage}%)</small></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${c.percentage}%"></div>
        </div>
      </div>
    `
    )
    .join('');

  const txRows = data.transactions
    .map((t) => {
      const isIncome = t.type === 'INCOME';
      const typeBadge = isIncome
        ? '<span class="badge badge-income">INCOME</span>'
        : '<span class="badge badge-expense">EXPENSE</span>';
      const pmBadge = `<span class="badge badge-pm">${t.paymentMethod || 'CASH'}</span>`;
      return `
        <tr>
          <td class="col-date">${t.date}</td>
          <td>${typeBadge}</td>
          <td class="col-cat"><strong>${t.category}</strong><br><small class="text-muted">${t.description || t.account || ''}</small></td>
          <td>${pmBadge}</td>
          <td class="col-amt ${isIncome ? 'text-income' : 'text-expense'}">
            ${isIncome ? '+' : '−'}${sym}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WealthSync Statement - ${data.periodLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    :root {
      --bg: #090A0F;
      --card-bg: #12141C;
      --card-border: #222634;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --accent: #38BDF8;
      --income: #34D399;
      --expense: #F87171;
      --radius: 16px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      padding: 32px 16px 90px;
      line-height: 1.5;
    }

    .container {
      max-width: 820px;
      margin: 0 auto;
    }

    /* Page-break avoidance for PDF renderer */
    .kpi-card, .meta-card, .cats-card, .table-card, tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Floating Action Bar */
    .actions-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 20, 28, 0.95);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.65);
      z-index: 9999;
      max-width: 95vw;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
      white-space: nowrap;
    }
    .action-btn:active { transform: scale(0.96); }
    .action-btn-primary {
      background: #FFFFFF;
      color: #000000;
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
    }
    .action-btn-share {
      background: linear-gradient(135deg, #0EA5E9, #6366F1);
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }
    .action-btn-subtle {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      padding: 10px 14px;
    }
    .action-btn:hover { opacity: 0.92; }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #0EA5E9, #6366F1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      color: #fff;
    }

    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .brand-sub {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .doc-meta {
      text-align: right;
    }

    .doc-badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.1);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .doc-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Account Details Card */
    .meta-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 16px 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .meta-box small {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 4px;
    }

    .meta-box span {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }

    /* Hero KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 20px;
      position: relative;
      overflow: hidden;
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
    }

    .kpi-card.inflow::before { background: var(--income); }
    .kpi-card.outflow::before { background: var(--expense); }
    .kpi-card.net::before { background: var(--accent); }

    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .kpi-val {
      font-size: 24px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.5px;
    }

    .kpi-val.inflow { color: var(--income); }
    .kpi-val.outflow { color: var(--expense); }
    .kpi-val.net { color: var(--text); }

    .kpi-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Section Headings */
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }

    /* Categories Breakdown */
    .cats-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 16px 20px;
      margin-bottom: 28px;
      display: grid;
      gap: 12px;
    }

    .cat-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .cat-amt {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
    }

    .cat-amt small { color: var(--text-muted); font-weight: normal; }

    .progress-track {
      height: 6px;
      background: #1E2230;
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #38BDF8, #818CF8);
      border-radius: 999px;
    }

    /* Transactions Table */
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 40px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: #181B26;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--card-border);
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }

    .col-date {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .col-amt {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .badge-income { background: rgba(52, 211, 153, 0.1); color: var(--income); }
    .badge-expense { background: rgba(248, 113, 113, 0.1); color: var(--expense); }
    .badge-pm { background: #1E2230; color: var(--text-muted); }

    .text-income { color: var(--income); }
    .text-expense { color: var(--text); }
    .text-muted { color: var(--text-muted); }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
      padding-top: 20px;
      border-top: 1px solid var(--card-border);
    }

    /* Print Styles (Converts cleanly to A4 paper) */
    @media print {
      body {
        background: #FFFFFF !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .actions-bar { display: none !important; }
      .meta-card, .kpi-card, .cats-card, .table-card {
        background: #FFFFFF !important;
        border: 1px solid #CBD5E1 !important;
        box-shadow: none !important;
      }
      th {
        background: #F1F5F9 !important;
        color: #475569 !important;
      }
      .badge-pm { background: #F1F5F9 !important; color: #475569 !important; }
      .kpi-val, .cat-amt, .col-amt { color: #0F172A !important; }
      .text-income { color: #059669 !important; }
      .text-expense { color: #DC2626 !important; }
      .progress-track { background: #E2E8F0 !important; }
      .progress-fill { background: #0284C7 !important; }
      .brand-title { color: #0F172A !important; }
    }
  </style>
</head>
<body>
  <!-- Floating Action Bar (Never included in PDF export) -->
  <div class="actions-bar">
    <button class="action-btn action-btn-primary" id="btn-download-pdf" onclick="downloadPdf()">
      📥 Download PDF
    </button>
    <button class="action-btn action-btn-share" id="btn-share-pdf" onclick="sharePdf()">
      📤 Send via Messenger / Email
    </button>
    <a class="action-btn action-btn-subtle" href="${csvHref}" download title="Download raw spreadsheet data">
      CSV
    </a>
  </div>

  <div class="container" id="statement-doc">

    <!-- Header -->
    <div class="header">
      <div class="brand">
        <div class="brand-logo">WS</div>
        <div>
          <div class="brand-title">WealthSync Financial Statement</div>
          <div class="brand-sub">Centralized Personal & Couple Finance</div>
        </div>
      </div>
      <div class="doc-meta">
        <span class="doc-badge">OFFICIAL STATEMENT</span>
        <div class="doc-id">${stmtId}</div>
      </div>
    </div>

    <!-- Account Details -->
    <div class="meta-card">
      <div class="meta-box">
        <small>Account Holder</small>
        <span>${data.accountHolder}</span>
      </div>
      <div class="meta-box">
        <small>Period</small>
        <span>${data.periodLabel}</span>
      </div>
      <div class="meta-box">
        <small>Base Currency</small>
        <span>${data.currency} (${sym})</span>
      </div>
      <div class="meta-box">
        <small>Generated On</small>
        <span>${data.issuedDate}</span>
      </div>
    </div>

    <!-- Hero KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card inflow">
        <div class="kpi-label">Total Inflow</div>
        <div class="kpi-val inflow">+${sym}${data.inflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-sub">Total income, salary, and deposits</div>
      </div>

      <div class="kpi-card outflow">
        <div class="kpi-label">Total Outflow</div>
        <div class="kpi-val outflow">−${sym}${data.outflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-sub">Receipts, bills, orders & expenses</div>
      </div>

      <div class="kpi-card net">
        <div class="kpi-label">Net Cashflow</div>
        <div class="kpi-val net">${data.net >= 0 ? '+' : '−'}${sym}${Math.abs(data.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-sub">${data.savingsRate}% of inflow retained</div>
      </div>
    </div>

    ${
      data.categories.length > 0
        ? `
      <!-- Categories Breakdown -->
      <div class="section-title">Spending Breakdown by Category</div>
      <div class="cats-card">
        ${categoryRows}
      </div>
    `
        : ''
    }

    <!-- Itemized Ledger -->
    <div class="section-title">Itemized Transactions (${data.transactions.length})</div>
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description / Category</th>
            <th>Method</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${txRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      Generated automatically by WealthSync Centralized Finance Platform.<br>
      This document serves as an itemized personal financial ledger and proof of cashflow.
    </div>
  </div>

  <script>
    const cleanFilename = 'WealthSync_Statement_${data.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf';

    function getPdfOptions() {
      return {
        margin: [10, 8, 10, 8],
        filename: cleanFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#090A0F',
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
    }

    async function downloadPdf() {
      if (typeof html2pdf === 'undefined') {
        alert('PDF generator is still loading. Please try again in 2 seconds.');
        return;
      }
      const btn = document.getElementById('btn-download-pdf');
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Generating PDF...';
      btn.disabled = true;

      try {
        const element = document.getElementById('statement-doc');
        await html2pdf().set(getPdfOptions()).from(element).save();
        btn.innerHTML = '✅ Saved to Downloads!';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }, 3000);
      } catch (err) {
        console.error('PDF Generation Error:', err);
        alert('Could not generate PDF: ' + (err.message || err));
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    async function sharePdf() {
      if (typeof html2pdf === 'undefined') {
        alert('PDF generator is still loading. Please try again in 2 seconds.');
        return;
      }
      const btn = document.getElementById('btn-share-pdf');
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Preparing PDF...';
      btn.disabled = true;

      try {
        const element = document.getElementById('statement-doc');
        const blob = await html2pdf().set(getPdfOptions()).from(element).outputPdf('blob');
        const file = new File([blob], cleanFilename, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'WealthSync Financial Statement',
            text: 'Here is my WealthSync Financial Statement for ${data.periodLabel}.'
          });
          btn.innerHTML = '✅ Shared!';
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = cleanFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          btn.innerHTML = '📥 Downloaded!';
          alert('PDF downloaded to your device! You can now attach and send it directly in Messenger or Email.');
        }
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }, 3500);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('PDF Share Error:', err);
          alert('Could not share PDF: ' + (err.message || err));
        }
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}
