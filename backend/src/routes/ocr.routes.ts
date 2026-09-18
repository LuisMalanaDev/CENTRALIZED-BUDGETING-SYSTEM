import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { OCRService } from '../services/ocr.service.js';

const scanReceiptSchema = z.object({
  imageBase64: z.string().min(10, 'Receipt image base64 data is required'),
});

export async function ocrRoutes(fastify: FastifyInstance) {
  // Scan paper receipt photo and extract merchant, amount, category, payment method
  fastify.post('/scan-receipt', async (request, reply) => {
    try {
      const parsed = scanReceiptSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message || 'Invalid receipt payload',
        });
      }

      const { imageBase64 } = parsed.data;
      console.log(`[OCR Route] Received scan request, payload length: ${(imageBase64.length / 1024).toFixed(1)} KB`);
      const result = await OCRService.scanReceipt(imageBase64);
      console.log('[OCR Route] Scan finished, returning response:', JSON.stringify(result));

      return reply.send(result);
    } catch (error: any) {
      console.error('[OCR Route] Error processing receipt:', error);
      request.log.error(error);
      return reply.status(500).send({
        error: 'OCR Processing Failed',
        message: error.message || 'Failed to scan and parse receipt image',
      });
    }
  });
}
