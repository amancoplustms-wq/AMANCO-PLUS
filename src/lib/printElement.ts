/**
 * دالة مساعدة موحدة للطباعة المعزولة المتوافقة 100% مع محرك طباعة Chrome (Blink)
 * - نسخ كامل غير مصفى لجميع قواعد cssRules من document.styleSheets
 * - تضمين base href وروابط كاملة مطلقة لجميع ملفات <link rel="stylesheet">
 * - دمج كافة استايلات Tailwind CSS و Google Fonts كنص داخلي لضمان التطبيق الفوري
 * - انتظار تحميل الروابط والخطوط بمهلة 500ms لضمان اكتمال التنسيقات قبل استدعاء print()
 */

export async function printElementById(
  elementId: string,
  documentTitle: string = 'أمانكو بلس للشحن والتوريد | AMANCO PLUS'
): Promise<void> {
  if (typeof window === 'undefined') return;

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.error(`Element with id "${elementId}" not found for printing.`);
    return;
  }

  // 1. نسخ كافة cssRules من document.styleSheets بالكامل بدون أي فلترة أو استثناء
  let collectedStyles = '';
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          for (let i = 0; i < sheet.cssRules.length; i++) {
            collectedStyles += sheet.cssRules[i].cssText + '\n';
          }
        }
      } catch {
        // تجاهل قيود CORS لبعض الملفات الخارجية
      }
    });
  } catch (err) {
    console.warn('Could not read some styleSheets rules', err);
  }

  // 2. نسخ محتوى جميع وسوم <style> في الصفحة
  let inlineStyles = '';
  document.querySelectorAll('head style, body style').forEach((styleEl) => {
    if (styleEl.textContent) {
      inlineStyles += styleEl.textContent + '\n';
    }
  });

  // 3. تجهيز وسوم <link rel="stylesheet"> بروابط مطلقة كاملة
  let linkTagsHtml = '';
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]'));
  links.forEach((link) => {
    if (link.href) {
      linkTagsHtml += `<link rel="stylesheet" href="${link.href}" />\n`;
    }
  });

  // 4. جلب محتوى ملفات الـ css الخاصة بالموقع ذاتياً كنسخة نصية احتياطية مضمونة
  let fetchedCss = '';
  try {
    const fetchedTexts = await Promise.all(
      links.map(async (link) => {
        if (link.href && (link.href.startsWith(window.location.origin) || link.href.startsWith('/'))) {
          try {
            const res = await fetch(link.href);
            if (res.ok) {
              return await res.text();
            }
          } catch {
            // ignore
          }
        }
        return '';
      })
    );
    fetchedCss = fetchedTexts.join('\n');
  } catch {
    // ignore
  }

  // 5. إنشاء iframe مرئي لمحرك الرسم وغير مرئي للمستخدم
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.border = '0';
  iframe.setAttribute('title', documentTitle);

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  // 6. كتابة وثيقة HTML متكاملة مع base href والاستايلات كاملة
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <base href="${window.location.origin}/" />
        <meta charset="utf-8" />
        <title>${documentTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${linkTagsHtml}
        <style>
          ${collectedStyles}
          ${inlineStyles}
          ${fetchedCss}
        </style>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            direction: rtl !important;
            font-family: 'Cairo', sans-serif !important;
            width: 210mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-print-page {
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            padding: 6mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            margin: 0 auto !important;
          }
          .a4-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body class="bg-white text-black font-sans antialiased" dir="rtl">
        ${targetElement.innerHTML}
      </body>
    </html>
  `);
  doc.close();

  // 7. الانتظار حتى اكتمال تحميل جميع الروابط والخطوط ومهلة 500ms
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print iframe error:', err);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  };

  const waitPromises: Promise<unknown>[] = [
    new Promise((resolve) => setTimeout(resolve, 500)),
  ];

  if (doc.fonts && 'ready' in doc.fonts) {
    waitPromises.push(doc.fonts.ready);
  }

  const iframeLinks = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  iframeLinks.forEach((linkEl) => {
    waitPromises.push(
      new Promise((resolve) => {
        linkEl.onload = resolve;
        linkEl.onerror = resolve;
      })
    );
  });

  await Promise.all(waitPromises);
  triggerPrint();
}
