// barcodeGenerator.js
const bwipjs = require('bwip-js');

console.log('[DEBUG] Barcode Generator: Using bwip-js (Pure JS).');

/**
 * Generates a Code-39 barcode as a Base64 PNG image.
 *
 * @param {string} text - The text (receipt number) to encode in the barcode.
 * @returns {Promise<string>} A promise that resolves to the barcode's Base64 string (e.g., "data:image/png;base64,...").
 * @throws {Error} Throws an error if barcode generation fails.
 */
async function generateRealBarcode(text) {
    try {
        const pngBuffer = await bwipjs.toBuffer({
            bcid: 'code39',        // Barcode type: Code-39
            text: String(text),    // The text to encode
            scale: 3,              // Scaling factor (image quality)
            height: 10,            // Barcode height (in relative units)
            // --- ✅ التعديل الرئيسي هنا ---
            // تم تغيير القيمة إلى false لإخفاء النص أسفل الباركود
            includetext: false,    // Set to false to hide the human-readable text
            textxalign: 'center',  // Text alignment (no effect when text is hidden)
            backgroundcolor: 'FFFFFF', // White background
            barcolor: '000000',    // Black bars
        });

        console.log(`[DEBUG] Code-39 barcode (without text) generated for text "${text}" successfully.`);

        // Convert the resulting Buffer to a Base64 string for embedding
        return `data:image/png;base64,${pngBuffer.toString('base64')}`;
    } catch (err) {
        // Catch and log any errors during barcode generation
        console.error("[Barcode Generator Error]: Failed to generate Code-39 barcode:", err.message, err.stack);
        // Re-throw the error to be handled by the calling function
        throw new Error(`Failed to generate barcode: ${err.message}`);
    }
}

// Export the function to allow its use in other files
module.exports = {
    generateRealBarcode
};
