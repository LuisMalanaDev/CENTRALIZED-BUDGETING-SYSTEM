import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { OCRService } from '../services/ocr.service.js';

const scanReceiptSchema = z.object({
  imageBase64: z.string().min(10, 'Receipt image base64 data is required'),
});

export async function ocrRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

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
      const result = await OCRService.scanReceipt(imageBase64);

      return reply.send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'OCR Processing Failed',
        message: error.message || 'Failed to scan and parse receipt image',
      });
    }
  });
}
