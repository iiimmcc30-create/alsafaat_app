import { z } from 'zod';
import {
  adminListQuerySchema,
  approveBodySchema,
  commentBodySchema,
  rejectBodySchema,
} from '../../butcher-applications/routes/schemas';

export type AdminListQueryDto = z.infer<typeof adminListQuerySchema>;
export type ApproveApplicationBodyDto = z.infer<typeof approveBodySchema>;
export type RejectApplicationBodyDto = z.infer<typeof rejectBodySchema>;
export type CommentApplicationBodyDto = z.infer<typeof commentBodySchema>;

export const adminLoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  hidden: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  live: z.string().optional(),
});

export const updateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    verified: z.boolean().optional(),
    role: z.enum(['USER', 'BUTCHER', 'ADMIN', 'MODERATOR']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'empty_update' });

export const updatePostSchema = z.object({
  isHidden: z.boolean(),
});

export const updateListingSchema = z.object({
  status: z.enum(['active', 'sold', 'expired', 'pending_fee', 'suspended']),
});

export const updateReportSchema = z
  .object({
    status: z
      .enum(['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
      .optional(),
    adminNotes: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'empty_update' });

export const updateButcherSchema = z.object({
  type: z.enum(['regular', 'verified']).optional(),
  isOpen: z.boolean().optional(),
});

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  labelAr: z.string().optional(),
  category: z.string().optional(),
});

export const createSectionSchema = z.object({
  slug: z.string().min(1),
  titleAr: z.string().min(1),
  bodyAr: z.string().min(1),
  titleEn: z.string().optional(),
  bodyEn: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateSectionSchema = createSectionSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'empty_update' },
);

export type AdminLoginDto = z.infer<typeof adminLoginSchema>;
export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
