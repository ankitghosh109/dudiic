import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type RegisterUserRequest = z.infer<typeof registerUserSchema>;
