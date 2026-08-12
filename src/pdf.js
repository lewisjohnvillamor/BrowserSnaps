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
    for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
    return output;
  }

  function streamObject(dictionary, data) {
    return concat([
      ascii(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
      data,
      ascii("\nendstream")
    ]);
  }

  function createPdf(captures) {
    if (!captures.length) throw new Error("There are no screenshots to add to the PDF.");

    const objects = [null, null];
    const pageReferences = [];

    captures.forEach((capture, captureIndex) => {
      const jpeg = decodeBase64(capture.data);
      const imageId = objects.length + 1;
      objects.push(streamObject(
        `/Type /XObject /Subtype /Image /Width ${capture.width} /Height ${capture.height} ` +
          "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode",
        jpeg
      ));

      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 18;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      const scale = availableWidth / capture.width;
      const imageHeight = capture.height * scale;
      const sourcePageHeight = availableHeight / scale;
      const imageName = `Im${captureIndex + 1}`;

      for (let sourceY = 0; sourceY < capture.height - 0.5; sourceY += sourcePageHeight) {
        const sourceFromBottom = Math.max(0, capture.height - sourceY - sourcePageHeight);
        const translatedY = margin - (sourceFromBottom * scale);
        const drawing = ascii(
          `q\n${margin} ${margin} ${availableWidth} ${availableHeight} re W n\n` +
          `${availableWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${margin.toFixed(2)} ${translatedY.toFixed(2)} cm\n` +
          `/${imageName} Do\nQ`
        );
        const contentId = objects.length + 1;
        objects.push(streamObject("", drawing));

        const pageId = objects.length + 1;
        objects.push(ascii(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
            `/Resources << /XObject << /${imageName} ${imageId} 0 R >> >> ` +
            `/Contents ${contentId} 0 R >>`
        ));
        pageReferences.push(`${pageId} 0 R`);
      }
    });

    objects[0] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
    objects[1] = ascii(`<< /Type /Pages /Count ${pageReferences.length} /Kids [${pageReferences.join(" ")}] >>`);

    const output = [ascii("%PDF-1.4\n%BrowserSnaps\n")];
    const offsets = [0];
    let length = output[0].length;

    objects.forEach((object, index) => {
      offsets.push(length);
      const wrapped = concat([ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n")]);
      output.push(wrapped);
      length += wrapped.length;
    });

    const xrefOffset = length;
    output.push(ascii([
      `xref\n0 ${objects.length + 1}\n`,
      "0000000000 65535 f \n",
      ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    ].join("")));

    return concat(output);
  }

  self.BrowserSnapsPdf = { createPdf };
})();
