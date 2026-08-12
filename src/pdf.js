/* global self */

(() => {
  const encoder = new TextEncoder();

  function ascii(value) {
    return encoder.encode(value);
  }

  function concat(parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  function decodeBase64(value) {
    const binary = atob(value);
    const output = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      output[index] = binary.charCodeAt(index);
    }
    return output;
  }

  function streamObject(dictionary, data) {
    return concat([
      ascii(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
      data,
      ascii("\nendstream")
    ]);
  }

  function pdfText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/([\\()])/g, "\\$1");
  }

  function createPdf(captures) {
    if (!captures.length) {
      throw new Error("There are no screenshots to add to the PDF.");
    }

    const objects = [null, null];
    const pageReferences = [];
    const fontId = objects.length + 1;
    objects.push(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));

    captures.forEach((capture, captureIndex) => {
      const jpeg = decodeBase64(capture.data);
      const imageId = objects.length + 1;
      objects.push(streamObject(
        `/Type /XObject /Subtype /Image /Width ${capture.width} /Height ${capture.height} ` +
          "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode",
        jpeg
      ));

      const landscape = capture.width >= capture.height;
      const pageWidth = landscape ? 842 : 595;
      const pageHeight = landscape ? 595 : 842;
      const margin = 28;
      const headerHeight = 30;
      const footerHeight = 20;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - headerHeight - footerHeight;
      const scale = Math.min(availableWidth / capture.width, availableHeight / capture.height);
      const imageWidth = capture.width * scale;
      const imageHeight = capture.height * scale;
      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = margin + footerHeight + ((availableHeight - imageHeight) / 2);
      const imageName = `Im${captureIndex + 1}`;
      const header = pdfText(
        `${capture.pageLabel || "Website"} | ${capture.profileLabel || "Capture"} ${capture.viewport || ""}`
      );
      const footer = pdfText(
        `${capture.pageUrl || ""} | Section ${capture.part || 1} of ${capture.parts || 1}`
      );
      const drawing = ascii(
        `BT\n/F1 10 Tf\n${margin} ${pageHeight - margin - 10} Td\n(${header}) Tj\nET\n` +
        `q\n${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${imageX.toFixed(2)} ${imageY.toFixed(2)} cm\n/${imageName} Do\nQ\n` +
        `BT\n/F1 7 Tf\n${margin} ${margin - 2} Td\n(${footer}) Tj\nET`
      );
      const contentId = objects.length + 1;
      objects.push(streamObject("", drawing));

      const pageId = objects.length + 1;
      objects.push(ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
          `/Resources << /Font << /F1 ${fontId} 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`
      ));
      pageReferences.push(`${pageId} 0 R`);
    });

    objects[0] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
    objects[1] = ascii(
      `<< /Type /Pages /Count ${pageReferences.length} /Kids [${pageReferences.join(" ")}] >>`
    );

    const output = [ascii("%PDF-1.4\n%BrowserSnaps\n")];
    const offsets = [0];
    let length = output[0].length;

    objects.forEach((object, index) => {
      offsets.push(length);
      const wrapped = concat([
        ascii(`${index + 1} 0 obj\n`),
        object,
        ascii("\nendobj\n")
      ]);
      output.push(wrapped);
      length += wrapped.length;
    });

    const xrefOffset = length;
    const xref = [
      `xref\n0 ${objects.length + 1}\n`,
      "0000000000 65535 f \n",
      ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    ].join("");
    output.push(ascii(xref));

    return concat(output);
  }

  self.BrowserSnapsPdf = { createPdf };
})();
