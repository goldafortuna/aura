/**
 * Utility functions for secure file validation
 */

// Define allowed MIME types with their corresponding magic bytes
const ALLOWED_FILE_TYPES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0], // OLE Compound File (.doc)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B], // PK (ZIP format)
};

// Additional magic bytes for DOCX files (more specific)
const DOCX_SIGNATURES = [
  [0x50, 0x4B, 0x03, 0x04], // Standard ZIP/DOCX
  [0x50, 0x4B, 0x05, 0x06], // Empty ZIP
  [0x50, 0x4B, 0x07, 0x08], // Spanned ZIP
];

const DOC_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

const GENERIC_WORD_CLIENT_MIME_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-ole-storage',
  'multipart/form-data',
]);

/**
 * Validates file type based on magic bytes (first few bytes of the file)
 * @param fileBuffer - ArrayBuffer of the file to validate
 * @param expectedMimeType - Expected MIME type
 * @returns boolean indicating if the file matches the expected type
 */
export function validateFileTypeByMagicBytes(fileBuffer: ArrayBuffer, expectedMimeType: string): boolean {
  const bytes = new Uint8Array(fileBuffer);
  
  if (expectedMimeType === 'application/pdf') {
    const pdfSignature = ALLOWED_FILE_TYPES['application/pdf'];
    return bytes.length >= pdfSignature.length && 
           pdfSignature.every((byte, index) => bytes[index] === byte);
  } 
  else if (expectedMimeType === 'application/msword') {
    return bytes.length >= DOC_SIGNATURE.length &&
           DOC_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }
  else if (expectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // DOCX files are ZIP archives, so check for various ZIP signatures
    return DOCX_SIGNATURES.some(signature => 
      bytes.length >= signature.length && 
      signature.every((byte, index) => bytes[index] === byte)
    );
  }
  
  return false;
}

/**
 * Determines the MIME type based on magic bytes
 * @param fileBuffer - ArrayBuffer of the file to analyze
 * @returns MIME type string or null if not recognized
 */
export function detectMimeTypeByMagicBytes(fileBuffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(fileBuffer);
  
  // Check for PDF
  if (bytes.length >= 4 && 
      bytes[0] === 0x25 && bytes[1] === 0x50 && 
      bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }

  // Check for legacy DOC (OLE Compound File)
  if (
    bytes.length >= DOC_SIGNATURE.length &&
    DOC_SIGNATURE.every((byte, index) => bytes[index] === byte)
  ) {
    return 'application/msword';
  }
  
  // Check for DOCX (ZIP-based)
  if (bytes.length >= 4) {
    for (const signature of DOCX_SIGNATURES) {
      if (signature.every((byte, index) => bytes[index] === byte)) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
    }
  }
  
  return null;
}

/**
 * Validates a file against allowed types using both MIME type and magic bytes
 * @param fileBuffer - ArrayBuffer of the file to validate
 * @param clientMimeType - MIME type provided by the client
 * @returns Validation result with isValid flag and detected type
 */
export function validateUploadedFile(fileBuffer: ArrayBuffer, clientMimeType: string | null): {
  isValid: boolean;
  detectedMimeType: string | null;
  error?: string;
} {
  // First, try to detect the MIME type from magic bytes
  const detectedMimeType = detectMimeTypeByMagicBytes(fileBuffer);
  
  // If we can't detect the type, it's not a valid file
  if (!detectedMimeType) {
    return {
      isValid: false,
      detectedMimeType: null,
      error: 'File type not recognized. Only PDF and DOCX files are allowed.'
    };
  }
  
  // Check if the detected type is in our allowed list
  if (!Object.keys(ALLOWED_FILE_TYPES).includes(detectedMimeType)) {
    return {
      isValid: false,
      detectedMimeType,
      error: `File type not allowed: ${detectedMimeType}`
    };
  }
  
  const normalizedClientMimeType = clientMimeType?.trim().toLowerCase() || null;

  // Some browsers / drag-and-drop integrations report DOCX as a generic ZIP or octet-stream.
  // Allow those generic values when the file content is positively identified as DOCX.
  const isWordWithGenericClientMime =
    (detectedMimeType === 'application/msword' ||
      detectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') &&
    normalizedClientMimeType &&
    GENERIC_WORD_CLIENT_MIME_TYPES.has(normalizedClientMimeType);

  // If client provided a MIME type, verify it matches our detection
  if (normalizedClientMimeType && normalizedClientMimeType !== detectedMimeType && !isWordWithGenericClientMime) {
    return {
      isValid: false,
      detectedMimeType,
      error: `MIME type mismatch. Client reported: ${normalizedClientMimeType}, detected: ${detectedMimeType}`
    };
  }
  
  // Validate the file content matches the expected type
  const isValidType = validateFileTypeByMagicBytes(fileBuffer, detectedMimeType);
  
  if (!isValidType) {
    return {
      isValid: false,
      detectedMimeType,
      error: `File content does not match expected type: ${detectedMimeType}`
    };
  }
  
  return {
    isValid: true,
    detectedMimeType
  };
}
